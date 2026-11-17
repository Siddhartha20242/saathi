// Family alerts: "someone in your group is looking at a scam page". An alert carries only the website's
// address, the brand it imitates, and reason codes. It is sent by the person pressing a button.

import { alertSentence } from './guardText.js';

export const MAX_REASONS = 8;
export const ALERT_HOURS = 48;

/** The fields of an alert that are allowed to leave this computer, cleaned. */
export function cleanAlert(a) {
  const level = a?.level === 'careful' ? 'careful' : 'stop';
  return {
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

export { alertSentence };
