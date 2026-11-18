// "Spot the scam": a short practice round for the person. Each card is a made-up message. The person says
// "scam" or "looks fine", then Saathi shows its own verdict and the reasons, in their language. Nothing is
// sent anywhere and nothing is saved. The cards are checked by the tests against the message checker, so
// Saathi never tells a person "scam" about a card it would itself not warn about, or the other way round.

export const CARDS = [
  { id: 'kyc', scam: true, text: 'Dear customer your Nabil Bank account will be blocked within 24 hours. Update your KYC now: http://nabilbank-kyc.top/login' },
  { id: 'otp-real', scam: false, text: 'Your OTP is 482913. Do not share it with anyone. - Nabil Bank' },
  { id: 'lottery', scam: true, text: 'You have won a lottery prize of Rs 50,00,000! Click bit.ly/xyz and share your bank card details to claim immediately' },
  { id: 'dinner', scam: false, text: 'Are you coming for dinner on Saturday? Bring the photos.' },
  { id: 'newnumber', scam: true, text: 'Hi mum, this is my new number. I lost my phone. Please send money urgently, I will explain later' },
  { id: 'bill-real', scam: false, text: 'Dear customer, your electricity bill of Rs 1,250 is due on 25th. Pay at nea.org.np' },
  { id: 'otp-call', scam: true, text: 'Sir, I am calling from the bank. Please read out the OTP we sent to your phone so we can cancel the wrong payment' },
  { id: 'doctor', scam: false, text: 'Reminder: your doctor appointment is tomorrow at 10 am at the clinic near the bus park.' },
  { id: 'kyc-ne', scam: true, text: 'तपाईंको खाता बन्द हुनेछ। तुरुन्त केवाईसी अपडेट गर्नुहोस् र ओटीपी पठाउनुहोस्: http://nabilbank-update.top' },
  { id: 'otp-ne', scam: false, text: 'तपाईंको ओटीपी 482913 हो। कसैलाई नदिनुहोस्।' },
  { id: 'esewa-real', scam: false, text: 'Your eSewa payment of Rs 500 to Ram Stores was successful. Balance Rs 2,340.' },
  { id: 'apk', scam: true, text: 'Your electricity will be disconnected tonight. Download the APK to pay the bill immediately: http://nea-bill.top/pay.apk' },
];

export const ROUND = 6;

/** A small seeded random generator, so a round can be repeated in tests. */
export function rng(seed) {
  let x = (seed >>> 0) || 1;
  return () => {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 4294967296;
  };
}

/** A round of `n` cards, half scams and half ordinary, in a mixed order. */
export function buildRound(seed = Date.now(), n = ROUND) {
  const rand = rng(seed);
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const half = Math.floor(n / 2);
  const scams = shuffle(CARDS.filter((c) => c.scam)).slice(0, half);
  const fine = shuffle(CARDS.filter((c) => !c.scam)).slice(0, n - half);
  return shuffle([...scams, ...fine]);
}

const TEXT = {
  en: {
    title: 'Practice: spot the scam',
    intro: 'Six made-up messages. Say which are scams. Nothing is saved or sent.',
    start: 'Start practice',
    ask: 'Is this a scam?',
    scam: 'Scam',
    fine: 'Looks fine',
    right: 'Right.',
    wrong: 'Not quite.',
    isScam: 'Saathi says this is a scam.',
    isFine: 'Saathi finds nothing wrong with this one.',
    next: 'Next',
    finish: 'See my score',
    score: (k, n) => `You got ${k} of ${n}.`,
    again: 'Play again',
    card: (i, n) => `Message ${i} of ${n}`,
  },
  ne: {
    title: 'अभ्यास: ठगी चिन्नुहोस्',
    intro: 'छवटा बनावटी सन्देश। कुन ठगी हो भन्नुहोस्। केही सुरक्षित गरिँदैन वा पठाइँदैन।',
    start: 'अभ्यास सुरु गर्नुहोस्',
    ask: 'के यो ठगी हो?',
    scam: 'ठगी',
    fine: 'ठीक छ',
    right: 'सही।',
    wrong: 'सही भएन।',
    isScam: 'साथीका अनुसार यो ठगी हो।',
    isFine: 'साथीले यसमा केही गलत भेटेन।',
    next: 'अर्को',
    finish: 'मेरो अंक हेर्नुहोस्',
    score: (k, n) => `तपाईंले ${n} मध्ये ${k} सही गर्नुभयो।`,
    again: 'फेरि खेल्नुहोस्',
    card: (i, n) => `सन्देश ${i} / ${n}`,
  },
  hi: {
    title: 'अभ्यास: ठगी पहचानिए',
    intro: 'छह बनावटी संदेश। बताइए कौन से ठगी हैं। कुछ सहेजा या भेजा नहीं जाता।',
    start: 'अभ्यास शुरू करें',
    ask: 'क्या यह ठगी है?',
    scam: 'ठगी',
    fine: 'ठीक है',
    right: 'सही।',
    wrong: 'सही नहीं।',
    isScam: 'साथी के अनुसार यह ठगी है।',
    isFine: 'साथी को इसमें कुछ गलत नहीं मिला।',
    next: 'अगला',
    finish: 'मेरा स्कोर देखें',
    score: (k, n) => `आपने ${n} में से ${k} सही किए।`,
    again: 'फिर खेलिए',
    card: (i, n) => `संदेश ${i} / ${n}`,
  },
};

export const quizText = (lang) => TEXT[TEXT[lang] ? lang : 'en'];
