// Scam guard: deciding, in plain code on this computer, whether a page looks like a scam.
// A small language model is poor at this kind of judgement, so none is used here. The rules look at
// facts a person cannot easily see: whether the address really belongs to the bank the page names,
// whether it asks for a password or one-time code, whether it pushes you to hurry, and whether what
// you type would be sent to a different website. Nothing leaves the computer.
//
// This is not a replacement for the browser's own protection. It covers the banks, wallets and
// government sites below, which are the ones scammers copy in South Asia, and it is deliberately
// cautious: it only says "stop" when several signals agree.

/**
 * Brands whose real addresses are listed in full. A page that names one of these but is not on one
 * of its addresses is suspicious. Global brands with many regional addresses (Amazon, Google) are
 * left out, because their lists cannot be complete here and a wrong guess would block a real site.
 * "Himal Bank" is made up, for the practice page.
 */
export const BRANDS = [
  { id: 'nabil', name: 'Nabil Bank', names: ['nabil bank'], domains: ['nabilbank.com'] },
  { id: 'nicasia', name: 'NIC Asia Bank', names: ['nic asia'], domains: ['nicasiabank.com'] },
  { id: 'globalime', name: 'Global IME Bank', names: ['global ime'], domains: ['globalimebank.com'] },
  { id: 'nmb', name: 'NMB Bank', names: ['nmb bank'], domains: ['nmb.com.np'] },
  { id: 'siddhartha', name: 'Siddhartha Bank', names: ['siddhartha bank'], domains: ['siddharthabank.com'] },
  { id: 'esewa', name: 'eSewa', names: ['esewa'], domains: ['esewa.com.np'] },
  { id: 'khalti', name: 'Khalti', names: ['khalti'], domains: ['khalti.com'] },
  { id: 'fonepay', name: 'Fonepay', names: ['fonepay'], domains: ['fonepay.com'] },
  { id: 'nea', name: 'Nepal Electricity Authority', names: ['nepal electricity authority'], domains: ['nea.org.np'] },
  { id: 'passport-np', name: 'Department of Passports', names: ['department of passports'], domains: ['nepalpassport.gov.np'] },
  { id: 'ird-np', name: 'Inland Revenue Department', names: ['inland revenue department'], domains: ['ird.gov.np'] },
  { id: 'ntc', name: 'Nepal Telecom', names: ['nepal telecom'], domains: ['ntc.net.np'] },
  { id: 'sbi', name: 'State Bank of India', names: ['state bank of india', 'onlinesbi'], domains: ['sbi.co.in', 'onlinesbi.sbi'] },
  { id: 'hdfc', name: 'HDFC Bank', names: ['hdfc bank'], domains: ['hdfcbank.com'] },
  { id: 'icici', name: 'ICICI Bank', names: ['icici bank'], domains: ['icicibank.com'] },
  { id: 'paytm', name: 'Paytm', names: ['paytm'], domains: ['paytm.com'] },
  { id: 'phonepe', name: 'PhonePe', names: ['phonepe'], domains: ['phonepe.com'] },
  { id: 'irctc', name: 'IRCTC', names: ['irctc'], domains: ['irctc.co.in'] },
  { id: 'uidai', name: 'UIDAI (Aadhaar)', names: ['uidai'], domains: ['uidai.gov.in'] },
  { id: 'incometax', name: 'Income Tax Department', names: ['income tax department'], domains: ['incometax.gov.in'] },
  { id: 'bkash', name: 'bKash', names: ['bkash'], domains: ['bkash.com'] },
  { id: 'nagad', name: 'Nagad', names: ['nagad'], domains: ['nagad.com.bd'] },
  { id: 'himal', name: 'Himal Bank', names: ['himal bank'], domains: ['himalbank.example'] },
];

// Tools that exist to let someone control a computer. Their own sites are not scams.
const REMOTE_TOOL_SITES = ['anydesk.com', 'teamviewer.com', 'rustdesk.com'];

const SECOND_LEVEL = new Set([
  'com.np', 'org.np', 'gov.np', 'edu.np', 'net.np', 'co.in', 'gov.in', 'org.in', 'ac.in', 'net.in',
  'com.bd', 'gov.bd', 'org.bd', 'edu.bd', 'co.uk',
]);

/** The part of an address that is registered by one owner: "login.nabilbank.com" is "nabilbank.com". */
export function registrable(host) {
  const h = String(host ?? '').toLowerCase().replace(/\.$/, '');
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return h;
  const labels = h.split('.').filter(Boolean);
  if (labels.length <= 2) return labels.join('.');
  return labels.slice(-(SECOND_LEVEL.has(labels.slice(-2).join('.')) ? 3 : 2)).join('.');
}

const firstLabel = (domain) => String(domain).split('.')[0];

function distance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** The brand whose address this one imitates, or null. A page on a real address of the brand is never an imitation. */
export function lookalikeOf(host) {
  const reg = registrable(host);
  const squashed = String(host).toLowerCase().replace(/[-_.]/g, '');
  for (const brand of BRANDS) {
    if (brand.domains.includes(reg)) return null; // this is the real thing
  }
  for (const brand of BRANDS) {
    for (const domain of brand.domains) {
      const label = firstLabel(domain);
      if (label.length >= 6 && squashed.includes(label)) return brand; // nabilbank-kyc.com, nabilbank.com.verify.top
      const own = firstLabel(reg);
      const allowed = label.length >= 8 ? 2 : 1;
      if (label.length >= 6 && own !== label && Math.abs(own.length - label.length) <= 2 && distance(own, label) <= allowed) return brand; // nabi1bank.com
    }
  }
  return null;
}

/** A brand named in the page's title or main heading, when the page is not on one of that brand's addresses. */
export function pretendsToBe(host, title, heading) {
  const reg = registrable(host);
  const said = ` ${String(title ?? '')} ${String(heading ?? '')} `.toLowerCase();
  for (const brand of BRANDS) {
    if (brand.domains.includes(reg)) continue;
    if (brand.names.some((n) => said.includes(` ${n}`) || said.includes(`${n} `) || said.includes(`${n}-`))) return brand;
  }
  return null;
}

// Fields that ask for a secret. Based on what the box is (its type and its label), never on what is typed.
const SECRET_LABEL = /\b(otp|one[- ]?time|pin|mpin|tpin|cvv|cvc|card number|atm|verification code|security code)\b|ओटीपी|पिन|सीवीवी|कार्ड नम्बर|कार्ड नंबर|एक पटक/i;

export function secretKind(field) {
  const type = String(field?.type ?? '').toLowerCase();
  const auto = String(field?.autocomplete ?? '').toLowerCase();
  if (type === 'password') return 'password';
  if (auto.includes('one-time-code')) return 'otp';
  if (auto.includes('cc-number') || auto.includes('cc-csc')) return 'card';
  if (SECRET_LABEL.test(`${field?.label ?? ''} ${field?.name ?? ''}`)) return 'secret';
  return null;
}

// Phrases scam pages lean on, in English, Nepali and Hindi.
export const URGENCY = [
  'will be blocked', 'will be suspended', 'will be closed', 'account is blocked', 'within 24 hours', 'within 48 hours',
  'immediately', 'urgent', 'act now', 'last warning', 'final notice', 'verify your account', 'update your kyc', 'kyc update',
  'kyc expired', 'you have won', 'lottery', 'prize', 'arrest', 'legal action', 'your parcel',
  'खाता बन्द', 'तुरुन्त', 'केवाईसी', 'पुरस्कार', 'लटरी', 'पक्राउ',
  'खाता बंद', 'तुरंत', 'इनाम', 'गिरफ्तार',
];
export const PAYMENT = ['gift card', 'giftcard', 'bitcoin', 'crypto', 'processing fee', 'release fee', 'send money to', 'wire transfer'];
export const REMOTE = ['anydesk', 'teamviewer', 'quicksupport', 'install the apk', 'download the apk', '.apk'];

const countMatches = (text, list) => list.filter((p) => text.includes(p)).length;

/**
 * @typedef {object} Snapshot what the page script reads from a page. No typed values, ever.
 * @property {string} host
 * @property {string} protocol 'https:' or 'http:'
 * @property {string} title
 * @property {string} [heading]
 * @property {string} text the page's visible words, cut short
 * @property {{type?: string, label?: string, name?: string, autocomplete?: string}[]} fields
 * @property {string[]} [formHosts] the hosts that forms on the page send their data to
 * @property {string[]} [linkTargets] file names or hosts of links, for ".apk" and the like
 */

/**
 * Decides how much to worry about a page.
 * @param {Snapshot} page
 * @returns {{ level: 'ok'|'careful'|'stop', score: number, brand: string|null, reasons: {code: string, brand?: string}[] }}
 */
export function assess(page) {
  const host = String(page.host ?? '').toLowerCase();
  const reg = registrable(host);
  const text = String(page.text ?? '').toLowerCase();
  const reasons = [];
  let score = 0;
  const add = (points, code, brand) => {
    score += points;
    if (code && !reasons.some((r) => r.code === code)) reasons.push({ code, ...(brand ? { brand } : {}) });
  };

  const secrets = (page.fields ?? []).map(secretKind).filter(Boolean);
  const asksSecret = secrets.length > 0;
  const lookalike = lookalikeOf(host);
  const pretends = pretendsToBe(host, page.title, page.heading);
  const imitated = lookalike ?? pretends;

  if (lookalike) add(3, 'lookalike', lookalike.name);
  if (pretends) add(2, 'pretends', pretends.name);
  if (asksSecret) add(1, 'asksSecret');
  if (imitated && asksSecret) score += 3; // naming a bank and asking for a secret is the heart of a phishing page

  const urgent = countMatches(`${text} ${page.title ?? ''}`, URGENCY);
  if (urgent >= 3) add(2, 'urgency');
  else if (urgent >= 2) add(1, 'urgency');

  const linkText = (page.linkTargets ?? []).join(' ').toLowerCase();
  if (!REMOTE_TOOL_SITES.includes(reg) && countMatches(`${text} ${linkText}`, REMOTE) > 0) add(3, 'remoteAccess');
  if (countMatches(text, PAYMENT) > 0 && urgent >= 1) add(2, 'paymentAsk');
  if (asksSecret && (page.protocol === 'http:' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host))) add(2, 'insecure');
  if (asksSecret && (page.formHosts ?? []).some((h) => h && registrable(h) !== reg)) add(3, 'crossForm');

  const level = score >= 5 ? 'stop' : score >= 3 ? 'careful' : 'ok';
  return { level, score, brand: imitated?.name ?? null, reasons: level === 'ok' ? [] : reasons };
}
