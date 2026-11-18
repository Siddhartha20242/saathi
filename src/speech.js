// Picks a voice for read-aloud. Many computers have no Nepali voice. A Hindi voice reads Devanagari
// and is understood by most Nepali speakers, but it is not Nepali, so the screen says when it is used.

const FALLBACK = { ne: ['hi'] };

/** { voice, lang, fallback } for the language, or { voice: null } when nothing suitable is installed. */
export function chooseVoice(voices, lang) {
  const list = Array.from(voices ?? []);
  const base = (v) => String(v.lang ?? '').toLowerCase().replace('_', '-').split('-')[0];
  const exact = list.find((v) => base(v) === lang);
  if (exact) return { voice: exact, lang: exact.lang, fallback: false };
  for (const other of FALLBACK[lang] ?? []) {
    const v = list.find((x) => base(x) === other);
    if (v) return { voice: v, lang: v.lang, fallback: true };
  }
  return { voice: null, lang: null, fallback: false };
}
