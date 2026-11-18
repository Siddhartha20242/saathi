// Checking a message someone pasted (a text, a WhatsApp message, an email). Plain code on this computer,
// like the page guard: the message is never sent anywhere and no model is used. It looks for the things
// scam messages lean on: a link that imitates a bank, a request to read out or send a code or PIN, a
// rush, a short link that hides where it goes, an app to install, and "this is my new number, send money".
//
// "Nothing found" does not mean "safe". The result says so.

import { BRANDS, lookalikeOf, registrable, URGENCY, PAYMENT, REMOTE } from './guard.js';

export const MAX_CHARS = 4000;

// ---------- Links ----------

const TLDS = 'com|net|org|info|top|xyz|in|np|bd|co|io|me|ly|link|click|site|online|live|vip|club|app|icu|cc|ws|gov|edu|biz|shop|store|support|cloud|cfd|sbs|ru|tk|buzz|pw|rest|cn|ga|ml|cf|gq';
// Without "http://" or "www.", these endings are too often just a missing space after a full stop
// ("Thanks.Me too", "see you.live"), so a bare address with one of them counts only if it has a path.
const WEAK_TLDS = new Set(['me', 'in', 'co', 'io', 'cc', 'ws', 'live', 'app', 'club', 'biz', 'shop', 'store', 'support', 'cloud', 'online', 'site']);
const BARE = new RegExp(`(?<![\\w@.-])(?:www\\.)?(?:[a-z0-9-]+\\.)+(${TLDS})\\b(?:[/?#][^\\s]*)?`, 'gi');
const WITH_SCHEME = /\bhttps?:\/\/[^\s<>"']+/gi;
const SHORTENERS = ['bit.ly', 'tinyurl.com', 't.co', 'cutt.ly', 'is.gd', 'rb.gy', 'shorturl.at', 'goo.gl', 'ow.ly', 'tiny.cc'];
// Throwaway addresses that tunnel to someone's own computer. No bank or government site is ever served from one.
const TEMP_HOSTS = ['ngrok.io', 'ngrok-free.app', 'ngrok.app', 'trycloudflare.com', 'loca.lt', 'serveo.net', 'localtunnel.me'];
// Common, ordinary sites that people really do share in family chat. A bank named next to one of these is not a sign of a scam.
const BENIGN = ['google.com', 'youtube.com', 'youtu.be', 'wikipedia.org', 'facebook.com', 'instagram.com', 'whatsapp.com', 'wa.me', 'zoom.us', 'dhl.com', 'fedex.com', 'amazon.com', 'microsoft.com', 'apple.com', 'gov.np'];

const trimEnd = (s) => s.replace(/[.,;:!?)"'\]]+$/, '');

/** The host of an address with a scheme. The part after "@" before the first "/" is not the destination ("http://bank.com@evil.top"). */
function hostOfUrl(raw) {
  try {
    return new URL(trimEnd(raw)).hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return '';
  }
}

/** The addresses in a message, as host names, in order, without repeats. */
export function linksIn(text) {
  const t = String(text ?? '').slice(0, MAX_CHARS);
  const hosts = [];
  const push = (h) => {
    if (h && !hosts.includes(h)) hosts.push(h);
  };
  const covered = [];
  for (const m of t.matchAll(WITH_SCHEME)) {
    push(hostOfUrl(m[0]));
    covered.push([m.index, m.index + m[0].length]);
  }
  for (const m of t.matchAll(BARE)) {
    if (covered.some(([a, b]) => m.index >= a && m.index < b)) continue; // already read as part of an address with a scheme
    const hasPath = /[/?#]/.test(m[0]);
    if (WEAK_TLDS.has(m[1].toLowerCase()) && !hasPath && !/^www\./i.test(m[0])) continue;
    push(trimEnd(m[0]).replace(/^www\./i, '').split(/[/?#]/)[0].toLowerCase());
  }
  return hosts;
}

const isIp = (h) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':');
const isOddHost = (h) => isIp(h) || h.startsWith('xn--') || /[^\x00-\x7f]/.test(h);

// ---------- Asking for a code ----------

// English verbs that mean "hand it over". "Enter" and "confirm" are left out on purpose: real bank texts say
// "enter this OTP on the website", and that is not a request to hand it to someone.
const SECRETS = '(?:otp|one[- ]?time (?:password|code)|pin|mpin|cvv|password|verification code|security code|card (?:number|details))';
const HAND_OVER = new RegExp(`\\b(share|send|tell|give|read out|provide|reply with|forward)\\b[^.!?\\n]{0,30}\\b${SECRETS}`, 'gi');
const HAND_OVER_NE_HI = /(ओटीपी|पिन|पासवर्ड|सीवीवी|कोड)[^।.!?\n,]{0,25}(पठाउनुहोस्|पठाइदिनुहोस्|भन्नुहोस्|भनिदिनुहोस्|दिनुहोस्|शेयर|बताइए|बताएं|बताओ|बता दो|बता दीजिए|बता दें|भेजिए|भेजें|भेजो|भेज दो|भेज दीजिए|भेज दें|दीजिए|दीजिये|दे दो)|(पठाउनुहोस्|भन्नुहोस्|दिनुहोस्|बताइए|बताएं|भेजिए|भेजें|दीजिए)[^।.!?\n,]{0,10}(ओटीपी|पिन|पासवर्ड)/;
// A warning from a real bank ("do not share your OTP") is not a request. The negation has to sit right in front of
// the verb, with at most two words between and no punctuation: "do not delay: share your OTP" is still a request.
const NEG_BEFORE = /(do not|don't|dont|never|not to|must not|should not)\s+(?:\w+\s+){0,2}$/i;
const NEG_NE_HI = /नदिनु|न दिनु|नभन्नु|न भन्नु|न बता|न भेज|कसैलाई\s*न|मत\s|कभी\s*न/;

// "Send me the wifi password" is a friend asking for the home network. It is not a bank secret. Only a password for
// a named home device or streaming service is let through, and only when no bank word is nearby, so "your bank wifi"
// style tricks do not slip past.
const HOME_PASSWORD = /\b(?:wi-?fi|wifi|router|hotspot|netflix|prime|hotstar|zoom|laptop|tv)\s+(?:password|pass)\b/i;
const BANK_WORDS = /\b(?:bank|account|a\/c|card|upi|wallet|esewa|khalti|kyc|blocked|suspended|otp|pin|mpin|cvv)\b/i;

function asksToHandOver(text) {
  const normal = text.replace(/\bo\.t\.p\b\.?/gi, 'otp'); // "O.T.P" written with dots
  for (const m of normal.matchAll(HAND_OVER)) {
    if (!NEG_BEFORE.test(normal.slice(Math.max(0, m.index - 40), m.index))) {
      if (HOME_PASSWORD.test(m[0]) && !BANK_WORDS.test(normal)) continue;
      return true;
    }
  }
  for (const clause of normal.split(/[.!?\n।,;:]+/)) {
    if (HAND_OVER_NE_HI.test(clause) && !NEG_NE_HI.test(clause)) return true;
  }
  return false;
}

// ---------- Other phrases ----------

const NEW_NUMBER = ['my new number', 'this is my new number', 'new number', 'new phone', 'lost my phone', 'changed my number', 'नयाँ नम्बर', 'नया नंबर', 'नया नम्बर'];
const MONEY = ['send money', 'transfer money', 'need money', 'send some money', 'can you transfer', 'please transfer', 'transfer rs', 'पैसा पठाउ', 'पैसे भेज', 'रकम पठाउ', 'पैसा भेज'];

// Extra rush and threat wording that shows up in texts (the page guard does not use these, because a web page
// can say "update now" or "will expire" for ordinary reasons). From published bank, police and CERT-In examples.
const MESSAGE_URGENCY = [
  'kyc is incomplete', 'kyc pending', 'incomplete kyc', 'self-verify', 'self verify', 'regain access',
  'has been suspended', 'have been suspended', 'is suspended', 'are suspended', 'is on hold', 'will be frozen',
  'will expire', 'expire today', 'reward points', 'closed in', 'within 1 hour', 'within 2 hours', 'due to security reasons',
  'claim it today', 'claim now', 'redeem now', 'dhamaka', 'update here', 'call now',
];
const MESSAGE_URGENCY_RE = [/will be block(?!ed)/]; // the typo seen in real HDFC phishing texts
const MESSAGE_PAYMENT = ['service charge', 'advance payment', 'registration fee', 'claim fee', 'pay the fee', 'pay a fee', 'refundable deposit', 'customs fee', 'delivery fee', 'processing fee'];
// Brand wording that appears in messages but would be too loose for page checks.
const EXTRA_NAMES = { sbi: ['sbi customer', 'sbi account', 'sbi kyc', 'dear sbi'] };

const countMatches = (text, list) => list.filter((p) => text.includes(p)).length;
const isKnownHost = (h) => BRANDS.some((b) => b.domains.includes(registrable(h)));
const isBenignHost = (h) => BENIGN.includes(registrable(h));

/**
 * How much to worry about a pasted message.
 * @param {string} message
 * @returns {{ level: 'ok'|'careful'|'stop', score: number, brand: string|null, host: string, truncated: boolean, reasons: {code: string, brand?: string}[] }}
 */
export function assessMessage(message) {
  const whole = String(message ?? '');
  const truncated = whole.length > MAX_CHARS;
  const text = whole.slice(0, MAX_CHARS).toLowerCase();
  const hosts = linksIn(whole);
  const reasons = [];
  let score = 0;
  const add = (points, code, brand) => {
    score += points;
    if (code && !reasons.some((r) => r.code === code)) reasons.push({ code, ...(brand ? { brand } : {}) });
  };

  const named = (b) => b.names.some((n) => text.includes(n)) || (EXTRA_NAMES[b.id] ?? []).some((n) => text.includes(n));
  const unknownHosts = hosts.filter((h) => !isKnownHost(h) && !isBenignHost(h));

  // A link whose address imitates a listed bank, wallet or government site.
  let imitated = null;
  let flagged = '';
  for (const h of hosts) {
    const b = isBenignHost(h) ? null : lookalikeOf(h);
    if (b) {
      imitated = b;
      flagged = h;
      add(3, 'lookalikeLink', b.name);
      break;
    }
  }
  // A listed brand is named, but a link in the message goes somewhere that is not that brand's, and is not an ordinary site.
  if (!imitated && unknownHosts.length) {
    for (const b of BRANDS) {
      if (named(b) && !hosts.some((h) => b.domains.includes(registrable(h)))) {
        imitated = b;
        flagged = unknownHosts[0];
        add(2, 'pretendsMsg', b.name);
        break;
      }
    }
  } else if (imitated && BRANDS.some(named)) {
    add(2, 'pretendsMsg', imitated.name);
  }

  // A number address, or letters made to look like a bank's: no real bank sends people to one.
  const odd = hosts.find(isOddHost);
  if (odd) {
    add(3, 'oddLink');
    flagged = flagged || odd;
  }
  const temp = hosts.find((h) => TEMP_HOSTS.includes(registrable(h)));
  if (temp) {
    add(3, 'tempLink');
    flagged = flagged || temp;
  }
  const short = hosts.find((h) => SHORTENERS.includes(registrable(h)));
  if (short) {
    add(1, 'shortLink');
    flagged = flagged || short;
  }

  const kyc = /\bkyc\b|केवाईसी/i.test(text);
  if (asksToHandOver(text)) add(kyc ? 5 : 3, 'shareSecret'); // "update your KYC: tell me the OTP" is the call-centre scam in the police reports

  // Banks do not update KYC through a link in a message (the RBI and Nepali banks say so).
  if (kyc && unknownHosts.length) add(2, 'kycLink');

  const urgent =
    countMatches(text, URGENCY) + countMatches(text, MESSAGE_URGENCY) + MESSAGE_URGENCY_RE.filter((re) => re.test(text)).length;
  if (urgent >= 3) add(2, 'urgency');
  else if (urgent >= 2) add(1, 'urgency');
  // One rush word next to a link to an address nobody listed is enough to be careful.
  if (urgent >= 1 && unknownHosts.length && !reasons.some((r) => r.code === 'urgency')) add(2, 'urgency');

  if (countMatches(text, REMOTE) > 0) add(3, 'remoteAccess');
  if (countMatches(text, [...PAYMENT, ...MESSAGE_PAYMENT]) > 0 && urgent >= 1) add(2, 'paymentAsk');
  if (countMatches(text, NEW_NUMBER) > 0 && (countMatches(text, MONEY) > 0 || countMatches(text, PAYMENT) > 0 || urgent >= 1)) add(3, 'impersonation');

  // For messages, 2 points is already "be careful": a message has little else to go on than these few signals.
  const level = score >= 5 ? 'stop' : score >= 2 ? 'careful' : 'ok';
  return { level, score, brand: imitated?.name ?? null, host: flagged || hosts[0] || '', truncated, reasons: level === 'ok' ? [] : reasons };
}
