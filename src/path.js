// What a helper records: which website, and which controls to use in what order.
// Typed values are never part of a path: a step has no field that could hold one.

import { maskText } from './masking.js';

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
    role: ROLES.includes(d.role) ? d.role : 'button',
    text: clip(d.text, 80),
    section: clip(d.section, 80),
    page: pathOnly(d.page),
    href: d.href ? pathOnly(d.href) : '',
    name: clip(d.name, 60),
  };
  // A label can hold a person's name or number, for example an account menu. It is not saved;
  // the step is found again by its link or internal name instead.
  if (step.text && maskText(step.text).items.length) {
    step.text = '';
    step.personal = true;
  }
  if (step.section && maskText(step.section).items.length) step.section = '';
  return step;
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
