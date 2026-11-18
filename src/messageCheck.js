// Checking a message someone pasted (a text, a WhatsApp message, an email). Plain code on this computer,
// like the page guard: the message is never sent anywhere and no model is used. It looks for the things
// scam messages lean on: a link that imitates a bank, a request to read out or send a code or PIN, a
// rush, a short link that hides where it goes, an app to install, and "this is my new number, send money".
//
// "Nothing found" does not mean "safe". The result says so.

import { BRANDS, lookalikeOf, registrable, URGENCY, PAYMENT, REMOTE } from './guard.js';

const MAX_CHARS = 4000;

const TLDS = 'com|net|org|info|top|xyz|in|np|bd|co|io|me|ly|link|click|site|online|live|vip|club|app|icu|cc|ws|gov|edu|biz|shop|store|support|cloud';
const LINK = new RegExp(`\\b(?:https?://)?(?:[a-z0-9-]+\\.)+(?:${TLDS})\\b(?:[/?#][^\\s]*)?`, 'gi');
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'goo.gl', 'ow.ly', 'tiny.cc'];

/** The addresses in a message, as host names, in order, without repeats. */
export function linksIn(text) {
  const hosts = [];
  for (const m of String(text ?? '').slice(0, MAX_CHARS).matchAll(LINK)) {
    if (String(text)[m.index - 1] === '@') continue; // the part after @ in an email address
    const host = m[0].replace(/^https?:\/\//i, '').split(/[/?#]/)[0].toLowerCase().replace(/[.,;:!)"'\]]+$/, '');
    if (host && !hosts.includes(host)) hosts.push(host);
  }
  return hosts;
}

// Asking someone to hand over a code, PIN or password. English, Nepali and Hindi.
const SECRETS = '(?:otp|one[- ]?time (?:password|code)|pin|mpin|cvv|password|verification code|security code|card (?:number|details))';
const HAND_OVER = new RegExp(`\\b(?:share|send|tell|give|read out|provide|enter|reply with|forward|confirm)\\b[^.!?\\n]{0,30}\\b${SECRETS}\\b`, 'i');
const HAND_OVER_NE_HI = /(ओटीपी|पिन|पासवर्ड|सीवीवी|कोड)[^।.!?\n]{0,25}(पठाउनुहोस्|भन्नुहोस्|दिनुहोस्|शेयर|बताइए|बताएं|बताओ|भेजिए|भेजें|भेजो|दीजिए|दीजिये)|(पठाउनुहोस्|भन्नुहोस्|दिनुहोस्|बताइए|बताएं|भेजिए|भेजें|दीजिए)[^।.!?\n]{0,10}(ओटीपी|पिन|पासवर्ड)/;
// A sentence that tells you NOT to share a code is a warning from a real bank, not a request.
const NEGATED = /(do not|don't|dont|never|not to)\b|नदिनु|न दिनु|नभन्नु|न भन्नु|न बता|न भेज|कसैलाई\s*न|मत\s|कभी\s*न/i;

const NEW_NUMBER = ['my new number', 'this is my new number', 'new number', 'lost my phone', 'changed my number', 'नयाँ नम्बर', 'नया नंबर', 'नया नम्बर'];
const MONEY = ['send money', 'transfer money', 'send me', 'need money', 'send some money', 'पैसा पठाउ', 'पैसे भेज', 'रकम पठाउ', 'पैसा भेज'];

const countMatches = (text, list) => list.filter((p) => text.includes(p)).length;

function asksToHandOver(text) {
  return text
    .split(/[.!?\n।]+/)
    .filter((s) => !NEGATED.test(s))
    .some((s) => HAND_OVER.test(s) || HAND_OVER_NE_HI.test(s));
}

/**
 * How much to worry about a pasted message.
 * @param {string} message
 * @returns {{ level: 'ok'|'careful'|'stop', score: number, brand: string|null, host: string, reasons: {code: string, brand?: string}[] }}
 */
export function assessMessage(message) {
  const text = String(message ?? '').slice(0, MAX_CHARS).toLowerCase();
  const hosts = linksIn(message);
  const reasons = [];
  let score = 0;
  const add = (points, code, brand) => {
    score += points;
    if (code && !reasons.some((r) => r.code === code)) reasons.push({ code, ...(brand ? { brand } : {}) });
  };

  // A link whose address imitates a listed bank, wallet or government site.
  let imitated = null;
  let flagged = '';
  for (const h of hosts) {
    const b = lookalikeOf(h);
    if (b) {
      imitated = b;
      flagged = h;
      add(3, 'lookalikeLink', b.name);
      break;
    }
  }
  // A listed brand is named, but every link goes somewhere that is not that brand.
  if (!imitated && hosts.length) {
    for (const b of BRANDS) {
      const named = b.names.some((n) => text.includes(n));
      if (named && !hosts.some((h) => b.domains.includes(registrable(h)))) {
        imitated = b;
        flagged = hosts[0];
        add(2, 'pretendsMsg', b.name);
        break;
      }
    }
  } else if (imitated && hosts.length) {
    // The message also names a brand: that is the usual shape of a phishing text.
    const named = BRANDS.some((b) => b.names.some((n) => text.includes(n)));
    if (named) add(2, 'pretendsMsg', imitated.name);
  }

  if (hosts.some((h) => SHORTENERS.includes(registrable(h)))) {
    add(1, 'shortLink');
    flagged = flagged || hosts.find((h) => SHORTENERS.includes(registrable(h)));
  }

  if (asksToHandOver(text)) add(3, 'shareSecret');

  const urgent = countMatches(text, URGENCY);
  if (urgent >= 3) add(2, 'urgency');
  else if (urgent >= 2) add(1, 'urgency');

  if (countMatches(text, REMOTE) > 0) add(3, 'remoteAccess');
  if (countMatches(text, PAYMENT) > 0 && urgent >= 1) add(2, 'paymentAsk');
  if (countMatches(text, NEW_NUMBER) > 0 && (countMatches(text, MONEY) > 0 || countMatches(text, PAYMENT) > 0 || urgent >= 1)) add(3, 'impersonation');

  const level = score >= 5 ? 'stop' : score >= 3 ? 'careful' : 'ok';
  return { level, score, brand: imitated?.name ?? null, host: flagged || hosts[0] || '', reasons: level === 'ok' ? [] : reasons };
}
