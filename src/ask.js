// "What does this step mean?" A person following a guide asks a short question about the step in front of them.
// The model is sent the step's wording, the guide's name and the question (personal details masked). Never the page.
//
// Where it runs: Chrome's on-device model writes only English, Spanish and Japanese, so an English answer is tried on
// this computer first (cloud only if the model is not there), and a Nepali or Hindi answer needs the cloud.

import { maskText } from './masking.js';

export const MAX_QUESTION = 200;
const LANG_NAMES = { en: 'English', ne: 'Nepali (Devanagari script)', hi: 'Hindi (Devanagari script)' };

/** The question as it will be sent: trimmed, shortened, and with personal details replaced by labels. */
export function cleanQuestion(q) {
  const text = String(q ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUESTION);
  return maskText(text).masked;
}

/**
 * @returns {{mode: 'PREFER_ON_DEVICE' | 'ONLY_IN_CLOUD'} | {mode: null, why: string}}
 */
export function askMode(lang, { cloudEnabled, deviceAvailable }) {
  if (lang === 'en' && deviceAvailable) return { mode: 'PREFER_ON_DEVICE' };
  if (cloudEnabled) return { mode: 'ONLY_IN_CLOUD' };
  return { mode: null, why: lang === 'en' ? 'no-model' : 'needs-cloud' };
}

export function askPrompt({ lang, title, step, question }) {
  return `You help an older person who is not used to computers. They are following a saved guide on a website, one step at a time.

Guide: ${title || 'a task on a website'}
The step they are on: ${step}
Their question: ${question}

Answer in simple everyday ${LANG_NAMES[lang] ?? LANG_NAMES.en}, in at most three short sentences.
Explain only what the step and the question say. You cannot see their screen, so do not describe colours, positions or anything else on it.
Never tell them to type a password, PIN, one-time code or card number anywhere. If their question is about money, a code, or something that sounds unsafe, or you are not sure, tell them to ask their family first.`;
}

/** The answer as it will be shown: plain text, no markdown, not too long. */
export function cleanAnswer(text) {
  return String(text ?? '')
    .replace(/[*_`#>]+/g, '')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 600);
}

/** What is sent, for the privacy receipt shown before the person presses the button. */
export function askReceipt({ title, step, question }) {
  return { title, step, question };
}
