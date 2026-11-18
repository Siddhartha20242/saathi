// What a helper records: which website, and which controls to use in what order.
// Typed values are never part of a path: a step has no field that could hold one.

import { maskText, isPersonalControl } from './masking.js';

export const MAX_STEPS = 40;
export const LANGS = { en: 'English', ne: 'नेपाली', hi: 'हिन्दी' };
export const GROUP_RE = /^[A-HJ-NP-Z2-9]{8}$/;

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no look-alike characters
const ROLES = ['button', 'link', 'field', 'select', 'checkbox'];
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** A new 8-character group code, for example for one family or one community. */
export function newGroupCode() {
  const values = crypto.getRandomValues(new Uint8Array(8));
  return [...values].map((v) => ALPHABET[v % ALPHABET.length]).join('');
}

export const normaliseGroup = (s) => String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** A page address without anything after ? or #, which can hold personal details. */
export function pathOnly(address) {
  const s = String(address ?? '');
  try {
    return new URL(s, 'http://placeholder.invalid').pathname.slice(0, 120);
  } catch {
    return clip(s.split(/[?#]/)[0], 120);
  }
}

/**
 * A page address kept only as far as it is safe to keep: a part of the path that has digits, an @, a long
 * mixed run of letters and digits (a reset or sign-in token), or anything that looks like a name or number
 * is replaced by "~". Two addresses that differ only in such a part then count as the same.
 */
export function safePath(address) {
  // "ram.sharma" or "ram_sharma" is a user name only where a path says "this is a person" (/u/, /user/, /profile/...).
  // Elsewhere an underscore is ordinary: Wikipedia's "/wiki/Main_Page" must stay as it is.
  const PERSON = new Set(['u', 'user', 'users', 'profile', 'profiles', 'people', 'member', 'members', 'account', 'accounts', 'customer', 'customers', 'me', 'id']);
  let prev = '';
  return pathOnly(address)
    .split('/')
    .map((seg) => {
      const before = prev;
      prev = seg.toLowerCase();
      if (!seg) return seg;
      let decoded = seg;
      try {
        decoded = decodeURIComponent(seg);
      } catch { /* keep as is */ }
      const mixed = /[A-Za-z]/.test(decoded) && /\d/.test(decoded) && decoded.length >= 8;
      // "ram.sharma" or "ram_sharma" in a path is a user name; "index.html" is a file.
      const userName = PERSON.has(before) && /^[a-z0-9]+[._][a-z0-9._]+$/i.test(decoded) && !/\.(html?|php|aspx?|jsp|js|css|png|jpe?g|gif|svg|pdf|json|xml|txt)$/i.test(decoded);
      return /\d{3,}|@/.test(decoded) || decoded.length > 32 || mixed || userName || maskText(decoded).items.length ? '~' : seg;
    })
    .join('/');
}

export function hostOf(address) {
  try {
    return new URL(address).hostname;
  } catch {
    return clip(address, 80);
  }
}

const bareHost = (h) => String(h ?? '').toLowerCase().replace(/^www\./, '');

/** True when the open page is on the website the path was recorded on. */
export const originMatches = (recordedHost, currentHost) =>
  bareHost(recordedHost) !== '' && bareHost(recordedHost) === bareHost(currentHost);

/**
 * Turns what the page script saw into a step. Only these fields are kept, so anything else
 * (such as a typed value) is dropped here.
 */
export function sanitizeStep(d = {}) {
  const step = {
    ...(Number.isInteger(d.at) && d.at >= 0 && d.at < 100000 ? { at: d.at } : {}),
    role: ROLES.includes(d.role) ? d.role : 'button',
    text: clip(d.text, 80),
    section: clip(d.section, 80),
    page: safePath(d.page),
    href: d.href && pathOnly(d.href) !== '/' ? safePath(d.href) : '',
    name: /@/.test(clip(d.name, 60)) || maskText(clip(d.name, 60)).items.length ? '' : clip(d.name, 60),
  };
  // A label can hold a person's name or number, for example an account menu. It is not saved;
  // the step is found again by its link or internal name instead.
  if ((step.text && isPersonalControl(step.text, d.acct)) || d.personal === true) {
    step.text = '';
    step.personal = true;
  }
  if (step.section && maskText(step.section).items.length) step.section = '';
  return step;
}

/**
 * A path as read back from the shared database. Anyone who knows the group code could have written it, so
 * every step is rebuilt from its allowed fields and every translated line is cut and made plain text.
 */
export function cleanLoadedPath(p = {}) {
  const steps = (Array.isArray(p.steps) ? p.steps : []).slice(0, MAX_STEPS).map((st) => sanitizeStep(st && typeof st === 'object' ? st : {}));
  const translations = {};
  for (const lang of ['ne', 'hi']) {
    const t = p.translations?.[lang];
    if (!t || typeof t !== 'object' || !Array.isArray(t.steps) || t.steps.length !== steps.length) continue;
    translations[lang] = { title: clip(t.title, 120), steps: t.steps.map((x) => clip(typeof x === 'string' ? x : '', 200)) };
  }
  return { ...p, title: clip(p.title, 80), host: clip(p.host, 80), steps, translations };
}

export const sameStep = (a, b) =>
  Boolean(a && b) && ['role', 'text', 'href', 'name', 'page'].every((k) => (a[k] ?? '') === (b[k] ?? ''));

/** Plain instruction for a step, written by code. The cloud only translates it. */
export function stepInstruction(step) {
  const label = step.text ? ` "${step.text}"` : '';
  switch (step.role) {
    case 'link':
      return step.text ? `Press the link${label}.` : 'Press the highlighted link.';
    case 'field':
      return step.text ? `Click the box${label} and type your own answer.` : 'Click the highlighted box and type your own answer.';
    case 'select':
      return step.text ? `Choose from the list${label}.` : 'Choose from the highlighted list.';
    case 'checkbox':
      return step.text ? `Tick the box${label}.` : 'Tick the highlighted box.';
    default:
      return step.text ? `Press the button${label}.` : 'Press the highlighted button.';
  }
}

/** Returns a message when the path cannot be saved, otherwise null. */
export function validatePath({ title, host, steps } = {}) {
  if (!clip(title, 80)) return 'Give the path a name.';
  if (!clip(host, 80)) return 'The website was not recorded.';
  if (!Array.isArray(steps) || !steps.length) return 'Nothing was recorded yet.';
  if (steps.length > MAX_STEPS) return `A path can have at most ${MAX_STEPS} steps.`;
  return null;
}
