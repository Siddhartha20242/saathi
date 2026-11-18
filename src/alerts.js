// Family alerts: "someone in your group is looking at a scam page". An alert carries only the website's
// address, the brand it imitates, and reason codes. It is sent by the person pressing a button.

import { alertSentence } from './guardText.js';

export const MAX_REASONS = 8;
export const ALERT_HOURS = 48;

/** The fields of an alert that are allowed to leave this computer, cleaned. */
export function cleanAlert(a) {
  const level = a?.level === 'careful' ? 'careful' : 'stop';
  return {
    kind: a?.kind === 'message' ? 'message' : 'page',
    host: String(a?.host ?? '').replace(/[^\w.\-:[\]]/g, '').slice(0, 100),
    brand: String(a?.brand ?? '').slice(0, 60),
    level,
    reasons: (Array.isArray(a?.reasons) ? a.reasons : [])
      .filter((r) => typeof r === 'string' && /^[a-zA-Z]{3,20}$/.test(r))
      .slice(0, MAX_REASONS),
  };
}

const millis = (t) => t?.toMillis?.() ?? (t?.seconds ? t.seconds * 1000 : 0);

/** Alerts from other people in the group in the last `hours`, newest first, minus the ones already seen. */
export function alertsForMe(list, uid, seen = [], now = Date.now(), hours = 24) {
  return list
    .filter((a) => a.createdBy !== uid && !seen.includes(a.id) && now - millis(a.createdAt) < hours * 3600e3 && (millis(a.expiresAt) || Infinity) > now)
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

// ---------- Check-ins: "I finished this guide" ----------
// Sent only when the person presses a button on the finished card. It holds the guide's title and how
// many steps it had. Nothing from the website and nothing typed.

export const CHECKIN_HOURS = 48;

export function cleanCheckin(c) {
  const steps = Number.isInteger(c?.steps) ? Math.min(40, Math.max(1, c.steps)) : 1;
  return { title: String(c?.title ?? '').trim().slice(0, 80) || 'A guide', steps };
}

/** Everyone's recent check-ins (the helper page shows all of them), newest first. */
export function recentCheckins(list, now = Date.now(), hours = 24) {
  return list
    .filter((c) => now - millis(c.createdAt) < hours * 3600e3 && (millis(c.expiresAt) || Infinity) > now)
    .sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

export function checkinSentence(c) {
  const n = c.steps === 1 ? '1 step' : `${c.steps} steps`;
  return `Someone in your group finished "${c.title}" (${n}) on their own.`;
}

export { alertSentence };

/**
 * Which of a person's own records are past their expiry. The free Firebase plan has no automatic deletion,
 * so each person's panel removes their own old help requests, alerts and check-ins when it opens.
 */
export function expiredOwn(docs, uid, nowMs = Date.now()) {
  return (docs ?? [])
    .filter((d) => d && d.createdBy === uid && d.expiresAt)
    .filter((d) => (typeof d.expiresAt.toMillis === 'function' ? d.expiresAt.toMillis() : Number(d.expiresAt) * 1000) < nowMs)
    .map((d) => d.id);
}
