// The only file that talks to a model. Every inference call in the app goes
// through Firebase AI Logic (hybrid inference). No other model API is used.

import './polyfills.js';
import { initializeApp } from 'firebase/app';
import { getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, ThinkingLevel } from 'firebase/ai';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { normaliseSource } from './source.js';
import { usage } from './usage.js';
import { localAvailable } from './device.js';

const env = import.meta.env;

export const configured = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID);

let ai = null;
let app = null;
const models = new Map();

// Our jobs (re-finding a button, translating a few lines, a short answer) do not need long reasoning, so the cloud model is
// asked to think as little as it can. That is the biggest single cut to waiting time. If a model refuses the setting, it is
// dropped for the rest of the session and the call is made again, so nothing breaks.
let fastThinking = true;
const isThinkingError = (err) => /thinking/i.test(String(err?.message));

/** The shared FirebaseApp (initialises AI Logic and App Check on first use). */
export function getFirebaseApp() {
  init();
  return app;
}

function init() {
  if (ai) return ai;
  if (!configured) {
    throw new Error('Firebase is not configured. Copy .env.example to .env and fill it in.');
  }
  app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });

  // App Check is required for Firebase AI Logic. The debug token is for local development only.
  if (env.VITE_APPCHECK_DEBUG === 'true') self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(env.VITE_RECAPTCHA_ENTERPRISE_KEY || 'unset'),
    isTokenAutoRefreshEnabled: true,
  });

  // Replay protection: each AI call carries a fresh single-use App Check token. Off unless asked for, because it
  // needs a real (not bot-scored) browser to check, and a refused token would stop every cloud call.
  ai = getAI(app, {
    backend: new GoogleAIBackend(),
    ...(env.VITE_APPCHECK_LIMITED_USE === 'true' && { useLimitedUseAppCheckTokens: true }),
  });
  return ai;
}

// Gemini Nano (Prompt API) supports only these. Declaring others makes Chrome report it unavailable.
const LANGS = ['en', 'es', 'ja'];

// The cloud model is named here, so an SDK update cannot change it without us noticing. Remote Config
// (`cloud_model`) can switch it without a new release, but only to a Gemini 3 model name.
export const DEFAULT_CLOUD_MODEL = 'gemini-3.1-flash-lite';
let cloudModel = DEFAULT_CLOUD_MODEL;
export const CLOUD_MODEL_PATTERN = /^gemini-3(?:\.\d+)?-[a-z0-9.-]{1,40}$/;

/** The cloud model to use: the Remote Config value if it is a Gemini 3 name, otherwise the default. */
export function pickCloudModel(value) {
  const v = String(value ?? '').trim();
  return CLOUD_MODEL_PATTERN.test(v) ? v : DEFAULT_CLOUD_MODEL;
}
export function setCloudModel(value) {
  cloudModel = pickCloudModel(value);
}
export const getCloudModel = () => cloudModel;

// The voice model. Remote Config (`tts_model`) can change it, but only to a Gemini 3 text-to-speech name.
export const DEFAULT_TTS_MODEL = 'gemini-3.1-flash-tts-preview';
export const TTS_MODEL_PATTERN = /^gemini-3(?:\.\d+)?-[a-z0-9.-]*tts[a-z0-9.-]*$/;
let ttsModel = DEFAULT_TTS_MODEL;
export function pickTtsModel(value) {
  const v = String(value ?? '').trim();
  return TTS_MODEL_PATTERN.test(v) ? v : DEFAULT_TTS_MODEL;
}
export function setTtsModel(value) {
  ttsModel = pickTtsModel(value);
}

/**
 * @param {string} mode ONLY_ON_DEVICE | PREFER_ON_DEVICE | PREFER_IN_CLOUD | ONLY_IN_CLOUD
 * @param {boolean} withImage
 * @param {object|null} schema a plain JSON schema. When given, both the on-device and the cloud
 *   model must answer in that shape (structured output), so the answer needs no guessing to read.
 */
function getModel(mode, withImage = false, schema = null) {
  const key = `${cloudModel}|${mode}|${withImage}|${fastThinking}|${schema ? JSON.stringify(schema) : ''}`;
  if (models.has(key)) return models.get(key);
  const expectedInputs = [{ type: 'text', languages: LANGS }];
  if (withImage) expectedInputs.push({ type: 'image' });
  const isEnum = schema?.type === 'string' && Array.isArray(schema.enum);
  const model = getGenerativeModel(init(), {
    mode: InferenceMode[mode],
    inCloudParams: {
      model: cloudModel,
      generationConfig: {
        ...(fastThinking && { thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL } }),
        ...(schema && { responseMimeType: isEnum ? 'text/x.enum' : 'application/json', responseSchema: schema }),
      },
    },
    onDeviceParams: {
      createOptions: {
        expectedInputs,
        expectedOutputs: [{ type: 'text', languages: LANGS }],
      },
      ...(schema && { promptOptions: { responseConstraint: schema } }),
    },
  });
  models.set(key, model);
  return model;
}

export { deviceStatus, localAvailable } from './device.js';

/** Must be called from a user gesture (a button click). */
export function enableDeviceModel(onProgress) {
  return getModel('PREFER_ON_DEVICE').initializeDeviceModel((fraction) => onProgress?.(fraction));
}

async function toPart(image) {
  // image: File | { data (base64), mimeType }
  if (!(image instanceof Blob)) return { type: 'inlineData', inlineData: image };
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(image);
  });
  return { type: 'inlineData', inlineData: { data, mimeType: image.type } };
}

// A plain record of where each AI call ran in this session: the mode asked for, where it actually ran, how long
// it took and how much was sent. Never the prompt or the answer. Shown under "Technical details".
export { getUsage } from './usage.js';

/**
 * Speaks a sentence with Firebase AI Logic's text-to-speech. Always the cloud. Returns the audio as base64 with its type.
 * Only the sentence is sent. Falls back to asking without a language code if the model does not take one for this language.
 */
export async function synthesize({ prompt, languageCode, voiceName }) {
  const started = Date.now();
  const ask = async (withLanguage) => {
    const model = getGenerativeModel(init(), {
      model: ttsModel,
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } }, ...(withLanguage && { languageCode }) },
      },
    });
    const result = await model.generateContent(prompt);
    const part = result.response.inlineDataParts?.()?.[0]?.inlineData;
    if (!part?.data) throw new Error('No audio came back');
    return { data: part.data, mimeType: part.mimeType || 'audio/wav' };
  };
  try {
    let audio;
    try {
      audio = await ask(true);
    } catch (err) {
      if (!/language|locale|unsupported|invalid/i.test(String(err?.message))) throw err;
      audio = await ask(false);
    }
    usage.push({ at: started, asked: 'TEXT_TO_SPEECH', ran: 'IN_CLOUD', ms: Date.now() - started, sentChars: String(prompt).length, media: false, ok: true });
    return audio;
  } catch (err) {
    usage.push({ at: started, asked: 'TEXT_TO_SPEECH', ran: 'NONE', ms: Date.now() - started, sentChars: 0, media: false, ok: false });
    throw err;
  }
}

/** The runner the pipeline uses. Returns the text and where it actually ran. */
export async function run({ mode, prompt, image, audio, schema = null }) {
  const media = image ?? audio; // a picture or a short spoken recording
  const started = Date.now();
  const input = media ? [prompt, await toPart(media)] : prompt;
  try {
    let result;
    try {
      result = await getModel(mode, Boolean(image), schema).generateContent(input);
    } catch (err) {
      if (!fastThinking || !isThinkingError(err)) throw err;
      fastThinking = false;
      result = await getModel(mode, Boolean(image), schema).generateContent(input);
    }
    const text = result.response.text();
    const source = normaliseSource(result.response.inferenceSource, mode);
    usage.push({ at: started, asked: mode, ran: source, ms: Date.now() - started, sentChars: source === 'ON_DEVICE' ? 0 : String(prompt).length, media: Boolean(media), ok: true });
    return { text, source };
  } catch (err) {
    usage.push({ at: started, asked: mode, ran: 'NONE', ms: Date.now() - started, sentChars: 0, media: Boolean(media), ok: false });
    throw err;
  }
}
