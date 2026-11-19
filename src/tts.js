// Where a spoken sentence comes from. The voice on this device is free and sends nothing, but many devices have no
// Nepali voice and the Hindi ones sound flat. Firebase AI Logic's text-to-speech (a Gemini model) speaks all three
// languages, but it needs the cloud and receives the sentence. So: Nepali and Hindi use the cloud voice when the cloud
// is on, English uses the voice on the device when there is one, and anything that fails falls back to the device.

import { chooseVoice } from './speech.js';

/**
 * @returns {{source: 'cloud' | 'device' | 'none', voice?: object, voiceLang?: string, fallback?: boolean}}
 */
export function planSpeech(voices, lang, { cloudEnabled, cloudVoice = true, blocked = false }) {
  const device = chooseVoice(voices, lang);
  const exact = device.voice && !device.fallback;
  // The cloud voice has a small free daily limit, so it is not spent where the device can already speak the language
  // for nothing: English uses the device voice when there is one. It is wanted for Nepali, which most devices cannot
  // speak, and for Hindi when the person turned on the natural voice.
  const cloudOk = cloudEnabled && cloudVoice && !blocked;
  if (lang === 'en') {
    if (exact) return { source: 'device', voice: device.voice, voiceLang: device.lang };
    return cloudOk ? { source: 'cloud' } : { source: 'none' };
  }
  if (cloudOk) return { source: 'cloud' };
  if (device.voice) return { source: 'device', voice: device.voice, voiceLang: device.lang, fallback: device.fallback };
  return { source: 'none' };
}

/** The device voice to use when the cloud voice could not be fetched. */
export function deviceFallback(voices, lang) {
  const d = chooseVoice(voices, lang);
  return d.voice ? { source: 'device', voice: d.voice, voiceLang: d.lang, fallback: d.fallback } : { source: 'none' };
}

// Sent to the voice model: a plain instruction and the sentence. The sentence is shortened, so a long answer cannot
// become a long and slow request.
export const MAX_SPOKEN = 400;
export function spokenText(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_SPOKEN);
}

export const TTS_VOICE = 'Kore';
export const TTS_LANGUAGE = { en: 'en-US', ne: 'ne-NP', hi: 'hi-IN' };

export function ttsPrompt(text) {
  return `Say this slowly, clearly and kindly, as if to an older person who is learning: ${spokenText(text)}`;
}

/** Raw 16-bit mono PCM (what a streamed or "audio/L16" answer is) wrapped in a WAV header so an <audio> element can play it. */
export function wavFromPcm(pcm, sampleRate = 24000) {
  const header = new ArrayBuffer(44);
  const v = new DataView(header);
  const put = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  put(0, 'RIFF');
  v.setUint32(4, 36 + pcm.length, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  put(36, 'data');
  v.setUint32(40, pcm.length, true);
  const out = new Uint8Array(44 + pcm.length);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
}

/** The bytes and type to give an <audio> element, whatever the model returned. */
export function playable(bytes, mimeType = '') {
  const type = String(mimeType).toLowerCase();
  if (/wav|wave/.test(type) || (bytes.length > 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF')) return { bytes, type: 'audio/wav' };
  if (/l16|pcm|raw/.test(type)) {
    const rate = Number(type.match(/rate=(\d+)/)?.[1]) || 24000;
    return { bytes: wavFromPcm(bytes, rate), type: 'audio/wav' };
  }
  return { bytes, type: type || 'audio/wav' }; // mp3, ogg and the like play as they are
}

/** Is this error the model saying the free daily limit is used up (or too many requests at once)? */
export function isQuotaError(err) {
  const m = `${err?.message ?? ''} ${err?.code ?? ''}`;
  return /\b429\b|quota|rate.?limit|resource.?exhausted|too many requests/i.test(m);
}
export const BLOCK_HOURS = 3;
