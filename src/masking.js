// Masking: replace personal details with tokens, and restore them locally.
// Pattern matching catches structured identifiers. The on-device model adds
// names and street addresses. The user previews and can add terms by hand.

const MONEY_LIKE = /^[$€£]/;

const looksLikeDate = (s) =>
  /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) || /^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}$/.test(s);

// Order matters: more specific patterns first.
const PATTERNS = [
  { kind: 'SSN', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'EMAIL', re: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g },
  {
    kind: 'PHONE',
    re: /(?<![\d$])(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}(?!\d)/g,
  },
  // Letter prefix + long digits, e.g. A123456789, INV-2044991
  { kind: 'ID', re: /\b[A-Z]{1,4}-?\d{6,}\b/g },
  // Long digit runs (account / member / claim numbers), grouped or plain.
  {
    kind: 'ID',
    re: /(?<![$€£\d.,])\b(?:\d{6,}|(?:\d{2,5}[- ]){2,}\d{2,5})\b(?![.,]\d)/g,
    reject: looksLikeDate,
  },
  // Names after a common label, e.g. "Applicant: Chen Wei" or "Dear Maria Lopez".
  // A safety net for when the local model misses a name or is not available.
  {
    kind: 'NAME',
    re: /(?<=\b(?:Patient|Applicant|Customer|Tenant|Taxpayer|Member|Insured|Name|Dear|Mr\.?|Mrs\.?|Ms\.?)[:\s,]{1,3})[A-Z][a-z]+(?: [A-Z][a-z]+){1,2}\b/g,
  },
  {
    kind: 'ADDRESS',
    re: /\b\d{1,6}\s+(?:[A-Z][\w.']*\s+){1,3}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Ct|Court|Way|Pl|Place)\b\.?/g,
  },
];

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * @param {string} text
 * @param {{kind: string, value: string}[]} [extra] entities found by the local model or typed by the user
 * @returns {{masked: string, map: Record<string,string>, items: {kind:string,value:string,token:string}[]}}
 */
export function maskText(text, extra = []) {
  const items = [];
  const byValue = new Map(); // normalised value -> token
  const counters = {};

  const tokenFor = (kind, value) => {
    const key = `${kind}|${value.toLowerCase()}`;
    if (byValue.has(key)) return byValue.get(key);
    counters[kind] = (counters[kind] || 0) + 1;
    const token = `[${kind}_${counters[kind]}]`;
    byValue.set(key, token);
    items.push({ kind, value, token });
    return token;
  };

  let masked = text;

  for (const { kind, re, reject } of PATTERNS) {
    masked = masked.replace(re, (m) => {
      if (MONEY_LIKE.test(m) || (reject && reject(m))) return m;
      return tokenFor(kind, m);
    });
  }

  // Extra entities: only accept values that really appear in the text,
  // so a hallucinating model cannot invent anything.
  const seen = new Set();
  const cleaned = extra
    .map((e) => ({ kind: String(e.kind || 'NAME').toUpperCase(), value: String(e.value || '').trim() }))
    .filter((e) => e.value.length >= 2 && text.toLowerCase().includes(e.value.toLowerCase()))
    .filter((e) => {
      const k = e.value.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    // longest first so "Maria Lopez" is replaced before "Maria"
    .sort((a, b) => b.value.length - a.value.length);

  for (const { kind, value } of cleaned) {
    const re = new RegExp(`(?<![\\w\\[])${escapeRe(value)}(?![\\w\\]])`, 'gi');
    masked = masked.replace(re, () => tokenFor(kind, value));
  }

  const map = Object.fromEntries(items.map((i) => [i.token, i.value]));
  return { masked, map, items };
}

/** Put the real details back. Tolerates a model dropping the brackets or changing case. */
export function restoreText(text, map) {
  let out = String(text ?? '');
  for (const [token, value] of Object.entries(map)) {
    const inner = token.slice(1, -1);
    out = out.replace(new RegExp(`\\[?${escapeRe(inner)}\\]?`, 'gi'), () => value);
  }
  return out;
}

/** Restore inside every string of a parsed JSON value. */
export function restoreDeep(value, map) {
  if (typeof value === 'string') return restoreText(value, map);
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, map));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreDeep(v, map)]));
  }
  return value;
}

/** Pull the first JSON object or array out of model text. Returns null on failure. */
export function parseJsonLoose(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) return null;
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  const end = candidate.lastIndexOf(close);
  if (end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}
