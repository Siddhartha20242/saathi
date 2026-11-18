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
  { id: 'connectips', name: 'connectIPS', names: ['connectips', 'connect ips'], domains: ['connectips.com', 'nchl.com.np'] },
  { id: 'nea', name: 'Nepal Electricity Authority', names: ['nepal electricity authority'], domains: ['nea.org.np'] },
  { id: 'passport-np', name: 'Department of Passports', names: ['department of passports'], domains: ['nepalpassport.gov.np'] },
  { id: 'ird-np', name: 'Inland Revenue Department', names: ['inland revenue department'], domains: ['ird.gov.np'] },
  { id: 'ntc', name: 'Nepal Telecom', names: ['nepal telecom'], domains: ['ntc.net.np'] },
  { id: 'sbi', name: 'State Bank of India', names: ['state bank of india', 'onlinesbi', 'sbi bank'], domains: ['sbi.co.in', 'onlinesbi.sbi'] },
  { id: 'rbi', name: 'Reserve Bank of India', names: ['reserve bank of india', 'rbi notice', 'rbi alert'], domains: ['rbi.org.in'] },
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

// Payment processors and sign-in providers that real checkout and login forms post to.
const TRUSTED_FORM_HOSTS = ['stripe.com', 'razorpay.com', 'paypal.com', 'checkout.com', 'adyen.com', 'squareup.com', 'braintreegateway.com', 'payu.in', 'payumoney.com', 'ccavenue.com', 'billdesk.com', 'esewa.com.np', 'khalti.com', 'fonepay.com', 'connectips.com', 'accounts.google.com', 'login.microsoftonline.com', 'appleid.apple.com', 'auth0.com', 'okta.com'];

// Tools that exist to let someone control a computer. Their own sites are not scams.
const REMOTE_TOOL_SITES = ['anydesk.com', 'teamviewer.com', 'rustdesk.com'];

// Endings where the registered name is one label further in ("a.com.np", "b.co.uk"), and sites where every
// customer gets their own sub-address ("a.web.app", "b.web.app" are different owners).
const SECOND_LEVEL = new Set([
  'com.np', 'org.np', 'gov.np', 'edu.np', 'net.np', 'co.in', 'gov.in', 'org.in', 'ac.in', 'net.in', 'nic.in', 'res.in',
  'com.bd', 'gov.bd', 'org.bd', 'edu.bd', 'net.bd', 'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'org.au', 'gov.au',
  'com.pk', 'org.pk', 'gov.pk', 'com.lk', 'gov.lk', 'co.jp', 'co.nz', 'co.za', 'com.sg', 'com.my', 'com.ph', 'com.cn',
  'github.io', 'pages.dev', 'blogspot.com', 'web.app', 'firebaseapp.com', 'netlify.app', 'vercel.app', 'herokuapp.com',
  'azurewebsites.net', 'cloudfront.net', 'appspot.com', 'weebly.com', 'wixsite.com', '000webhostapp.com', 'ngrok.io',
  'ngrok-free.app', 'trycloudflare.com', 'workers.dev', 'onrender.com', 'glitch.me', 'repl.co', 'surge.sh',
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

// ---------- Look-alike letters ----------
// Chrome gives a page's host in punycode ("xn--nbilbank-16g.com" for a Cyrillic "а" in nabilbank.com), so the
// letters have to be decoded and mapped to the Latin letters they imitate before comparing with a bank's name.

function punycodeDecode(input) {
  const base = 36, tMin = 1, tMax = 26, skew = 38, damp = 700;
  const out = [];
  let n = 128, bias = 72, i = 0;
  let b = input.lastIndexOf('-');
  if (b < 0) b = 0;
  for (let j = 0; j < b; j++) out.push(input.charCodeAt(j));
  const adapt = (delta, numPoints, first) => {
    let k = 0;
    delta = first ? Math.floor(delta / damp) : delta >> 1;
    delta += Math.floor(delta / numPoints);
    for (; delta > ((base - tMin) * tMax) >> 1; k += base) delta = Math.floor(delta / (base - tMin));
    return Math.floor(k + ((base - tMin + 1) * delta) / (delta + skew));
  };
  for (let idx = b > 0 ? b + 1 : 0; idx < input.length;) {
    const oldi = i;
    for (let w = 1, k = base; ; k += base) {
      if (idx >= input.length) return null;
      const c = input.charCodeAt(idx++);
      const digit = c - 48 < 10 ? c - 22 : c - 65 < 26 ? c - 65 : c - 97 < 26 ? c - 97 : base;
      if (digit >= base) return null;
      i += digit * w;
      const t = k <= bias ? tMin : k >= bias + tMax ? tMax : k - bias;
      if (digit < t) break;
      w *= base - t;
    }
    bias = adapt(i - oldi, out.length + 1, oldi === 0);
    n += Math.floor(i / (out.length + 1));
    i %= out.length + 1;
    out.splice(i++, 0, n);
  }
  return String.fromCodePoint(...out);
}

// Letters from other scripts that look like Latin ones (Cyrillic, Greek, and a few others).
const CONFUSABLE = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'і': 'i', 'ј': 'j', 'ѕ': 's', 'һ': 'h', 'ԁ': 'd', 'ɡ': 'g', 'ԛ': 'q', 'ԝ': 'w', 'ӏ': 'l', 'ո': 'n', 'ν': 'v', 'ο': 'o', 'α': 'a', 'ρ': 'p', 'τ': 't', 'ι': 'i', 'κ': 'k', 'μ': 'u', 'ɑ': 'a', 'ⅼ': 'l', 'ℓ': 'l', '０': '0', '１': '1', '0': '0' };

/** The host written with plain Latin letters: punycode decoded, look-alike letters replaced, accents removed. */
export function skeleton(host) {
  const labels = String(host ?? '').toLowerCase().split('.').map((label) => {
    if (!label.startsWith('xn--')) return label;
    return punycodeDecode(label.slice(4)) ?? label;
  });
  return labels
    .join('.')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/./gu, (ch) => CONFUSABLE[ch] ?? ch);
}

/** True when the host is written with non-Latin letters or punycode, which no real bank in the list uses. */
export const isIdn = (host) => /xn--/.test(host) || /[^\x00-\x7f]/.test(host);

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
  const plain = skeleton(host); // a Cyrillic "а" in place of a Latin one is read as the Latin one
  const reg = registrable(plain);
  const isLookalikeLetters = plain !== String(host).toLowerCase();
  for (const brand of BRANDS) {
    if (brand.domains.includes(reg)) {
      // Plain letters on the bank's own address: the real thing. Look-alike letters that spell it: an imitation.
      return isLookalikeLetters && isIdn(host) ? brand : null;
    }
  }
  const squashed = plain.replace(/[-_.]/g, '');
  const tokens = plain.split(/[-_.]+/); // "esewa.com.np.verify.top" and "paytm-kyc.com" both contain the token "esewa" / "paytm"
  for (const brand of BRANDS) {
    for (const domain of brand.domains) {
      const label = firstLabel(domain);
      if (label.length >= 6 && squashed.includes(label)) return brand; // nabilbank-kyc.com, nabilbank.com.verify.top
      // Short names (eSewa, Paytm, SBI) are too short to find inside a longer word, but as a whole piece of the address they are clear.
      if (label.length >= 3 && label.length < 6 && !brand.domains.includes(reg) && tokens.includes(label)) return brand;
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
const SECRET_LABEL = /\b(otp|one[- ]?time|pin(?!\s?-?code)|mpin|tpin|cvv|cvc|card number|atm|verification code|security code)\b|ओटीपी|पिन|सीवीवी|कार्ड नम्बर|कार्ड नंबर|एक पटक/i;

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

  // An address like a bank's is a sign but not proof (a school called "Khalti Academy" has one). It needs a form to
  // go with it before it reaches "be careful" on its own, and a page that only reports on a bank (a news article)
  // with nothing to fill in is not pretending to be that bank.
  const hasForm = (page.fields ?? []).length > 0;
  if (lookalike) add(2, 'lookalike', lookalike.name);
  if (lookalike && (asksSecret || hasForm)) score += 1;
  if (pretends && (asksSecret || hasForm)) add(2, 'pretends', pretends.name);
  if (asksSecret) add(1, 'asksSecret');
  if (imitated && asksSecret) score += 3; // naming a bank and asking for a secret is the heart of a phishing page

  const urgent = countMatches(`${text} ${page.title ?? ''}`, URGENCY);
  if (urgent >= 3) add(2, 'urgency');
  else if (urgent >= 2) add(1, 'urgency');

  const linkText = (page.linkTargets ?? []).join(' ').toLowerCase();
  if (!REMOTE_TOOL_SITES.includes(reg) && countMatches(`${text} ${linkText}`, REMOTE) > 0) add(3, 'remoteAccess');
  if (countMatches(text, PAYMENT) > 0 && urgent >= 1) add(2, 'paymentAsk');
  const privateHost = host === 'localhost' || host.endsWith('.localhost') || /^(127|10)\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (asksSecret && !privateHost && (page.protocol === 'http:' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host))) add(2, 'insecure');
  // formHosts are the targets of the forms that hold the secret boxes. A payment processor or sign-in provider is expected.
  if (asksSecret && (page.formHosts ?? []).some((h) => h && registrable(h) !== reg && !TRUSTED_FORM_HOSTS.includes(registrable(h)))) add(3, 'crossForm');

  const level = score >= 5 ? 'stop' : score >= 3 ? 'careful' : 'ok';
  return { level, score, brand: imitated?.name ?? null, reasons: level === 'ok' ? [] : reasons };
}
