// Speaking a request instead of choosing from a list. The recording and the titles of the group's
// saved paths go to the cloud model, which says which path the person wants. Nothing from the web page
// is sent. The titles are the only text, and a path title is something the group wrote.

import { LANGS } from './path.js';

/** The answer the cloud model must give. */
export const VOICE_SCHEMA = {
  type: 'object',
  properties: {
    heard: { type: 'string' },
    english: { type: 'string' },
    path: { type: 'integer' },
  },
  required: ['heard', 'english', 'path'],
};

/** One line per path: its title, and the translations the group already has. */
export function pathLines(paths) {
  return paths.map((p, i) => {
    const others = ['ne', 'hi']
      .map((l) => (p.translations?.[l]?.title ? `${LANGS[l]}: ${p.translations[l].title}` : null))
      .filter(Boolean);
    return `${i + 1}. ${p.title}${others.length ? ` (${others.join('; ')})` : ''}`;
  });
}

export function voicePrompt(paths) {
  return `A person spoke a request to a helper app, in Nepali, Hindi or English. Listen to the audio.

The app has these saved step-by-step guides:
${pathLines(paths).join('\n')}

Answer in JSON:
- "heard": what the person said, written in the language they spoke (Nepali or Hindi in Devanagari script).
- "english": the same, in English.
- "path": the number of the one guide that clearly matches the request, or 0.

Use 0 if no guide clearly matches, or if the audio has no clear request. Do not guess.`;
}

/**
 * Reads the model's answer. Returns the words heard and the chosen path's position in `paths`, or
 * null for the path when the answer is 0, out of range, or not in the expected shape.
 */
export function parseVoice(text, count) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { heard: '', english: '', index: null };
  }
  const n = Number(data?.path);
  return {
    heard: String(data?.heard ?? '').trim().slice(0, 200),
    english: String(data?.english ?? '').trim().slice(0, 200),
    index: Number.isInteger(n) && n >= 1 && n <= count ? n - 1 : null,
  };
}
