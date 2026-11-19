// The home page: plain words in three languages, and a short, honest note on what this device can do.

const $ = (id) => document.getElementById(id);

const TEXT = {
  en: {
    h1: 'A guide that shows you where to press.',
    lede: 'When a website feels confusing, someone in your family shows the way once. Saathi then walks you through it, one step at a time, in your own language.',
    try: 'Try it now', help: 'I am helping my parents', free: 'Free. No sign-up. Nothing to buy.',
    stepOf: 'Step 1 of 5', bubble: 'Press “Pay your bill” in the menu.',
    howTitle: 'How it works',
    s1h: 'Your family shows the way once', s1p: 'A son, a daughter or a neighbour does the task on the real website, one time.',
    s2h: 'Saathi shows you each step', s2p: 'You see one step at a time, in big words, read aloud if you like. The right button glows.',
    s3h: 'You press. Saathi never does.', s3p: 'You stay in charge. Saathi never types or presses for you, and it never sees your passwords.',
    scamH: 'Got a strange message?', scamP: 'Paste a text or an email and Saathi tells you if it looks like a scam. It stays on your device.', scamB: 'Check a message',
    famH: 'Helping from far away?', famP: 'See who is stuck, point to the right button on your phone, and get an alert if a scam page is opened.', famB: 'Open the family page',
    safeH: 'Made to be safe',
    safe1: 'It points. You press. It never clicks or types for you.',
    safe2: 'It does not see what you type, and it does not keep your pages.',
    safe3: 'If it is not sure which button to point to, it says so and asks your family.',
    instH: 'Keep Saathi on your phone', instP: 'It works like an app, and it still opens with no internet.', instB: 'Install Saathi',
    instIos: 'Press the Share button, then “Add to Home Screen”. It works like an app, and it still opens with no internet.',
    instDone: 'Installed. Open Saathi from your home screen.',
    techS: 'For developers and judges: where Saathi runs',
    foot: 'Saathi works in Nepali, Hindi and English. The Nepali and Hindi were written with AI and have not yet been checked by a native speaker.',
  },
  ne: {
    h1: 'कहाँ थिच्ने भनेर देखाउने गाइड।',
    lede: 'कुनै वेबसाइट अलि अप्ठ्यारो लाग्दा, परिवारको कसैले एक पटक बाटो देखाइदिन्छन्। त्यसपछि साथीले तपाईंलाई आफ्नै भाषामा एक-एक चरण गरेर साथ दिन्छ।',
    try: 'अहिले नै हेर्नुहोस्', help: 'म आमाबुबालाई सघाउँदै छु', free: 'निःशुल्क। साइन-अप चाहिँदैन। केही किन्नु पर्दैन।',
    stepOf: 'चरण १ / ५', bubble: 'मेनुमा “Pay your bill” थिच्नुहोस्।',
    howTitle: 'यो कसरी चल्छ',
    s1h: 'परिवारले एक पटक बाटो देखाउँछ', s1p: 'छोरा, छोरी वा छिमेकीले साँचो वेबसाइटमा त्यो काम एक पटक गरेर देखाउँछन्।',
    s2h: 'साथीले हरेक चरण देखाउँछ', s2p: 'ठूला अक्षरमा एक-एक चरण देखिन्छ, चाहनुभयो भने सुनाउँछ पनि। सही बटन चम्किन्छ।',
    s3h: 'तपाईं थिच्नुहुन्छ। साथीले कहिल्यै थिच्दैन।', s3p: 'नियन्त्रण तपाईंकै हातमा रहन्छ। साथीले तपाईंका लागि केही लेख्दैन, थिच्दैन, र तपाईंको पासवर्ड कहिल्यै देख्दैन।',
    scamH: 'अनौठो सन्देश आयो?', scamP: 'सन्देश वा इमेल यहाँ टाँस्नुहोस्। ठगी जस्तो देखिन्छ कि देखिँदैन, साथीले भन्छ। यो तपाईंकै उपकरणमा रहन्छ।', scamB: 'सन्देश जाँच्नुहोस्',
    famH: 'टाढाबाट सघाउँदै हुनुहुन्छ?', famP: 'को अड्किएको छ हेर्नुहोस्, आफ्नो फोनबाट सही बटन देखाउनुहोस्, र ठगी पेज खुल्यो भने सूचना पाउनुहोस्।', famB: 'परिवारको पेज खोल्नुहोस्',
    safeH: 'सुरक्षित हुने गरी बनाइएको',
    safe1: 'यसले देखाउँछ। तपाईं थिच्नुहुन्छ। यसले आफैं थिच्दैन, लेख्दैन।',
    safe2: 'तपाईंले लेखेको यसले देख्दैन, र तपाईंका पेज राख्दैन।',
    safe3: 'कुन बटन देखाउने भन्ने पक्का भएन भने, यसले भन्छ र परिवारलाई सोध्न लगाउँछ।',
    instH: 'साथीलाई फोनमै राख्नुहोस्', instP: 'यो एपजस्तै चल्छ, र इन्टरनेट नभए पनि खुल्छ।', instB: 'साथी इन्स्टल गर्नुहोस्',
    instIos: '“Share” थिच्नुहोस्, अनि “Add to Home Screen”। यो एपजस्तै चल्छ, र इन्टरनेट नभए पनि खुल्छ।',
    instDone: 'इन्स्टल भयो। होम स्क्रिनबाट साथी खोल्नुहोस्।',
    techS: 'डेभलपर र न्यायाधीशका लागि: साथी कहाँ चल्छ',
    foot: 'साथी नेपाली, हिन्दी र अंग्रेजीमा चल्छ। नेपाली र हिन्दी एआईले लेखेको हो, र अझै कुनै मातृभाषीले जाँचेका छैनन्।',
  },
  hi: {
    h1: 'एक गाइड जो बताता है कहाँ दबाना है।',
    lede: 'जब कोई वेबसाइट उलझन भरी लगे, तो परिवार का कोई सदस्य एक बार रास्ता दिखा देता है। फिर साथी आपको आपकी अपनी भाषा में एक-एक क़दम चलाता है।',
    try: 'अभी आज़माइए', help: 'मैं अपने माता-पिता की मदद कर रहा हूँ', free: 'मुफ़्त। साइन-अप नहीं। कुछ ख़रीदना नहीं।',
    stepOf: 'चरण 1 / 5', bubble: 'मेनू में “Pay your bill” दबाइए।',
    howTitle: 'यह कैसे काम करता है',
    s1h: 'परिवार एक बार रास्ता दिखाता है', s1p: 'बेटा, बेटी या पड़ोसी असली वेबसाइट पर वह काम एक बार करके दिखाते हैं।',
    s2h: 'साथी हर चरण दिखाता है', s2p: 'बड़े अक्षरों में एक-एक चरण दिखता है, चाहें तो बोलकर भी सुनाता है। सही बटन चमकता है।',
    s3h: 'आप दबाते हैं। साथी कभी नहीं दबाता।', s3p: 'काबू आपके हाथ में रहता है। साथी आपके लिए कुछ टाइप नहीं करता, दबाता नहीं, और आपका पासवर्ड कभी नहीं देखता।',
    scamH: 'कोई अजीब संदेश आया?', scamP: 'संदेश या ईमेल यहाँ चिपकाइए। साथी बताएगा कि वह ठगी जैसा लगता है या नहीं। यह आपके अपने उपकरण पर ही रहता है।', scamB: 'संदेश जाँचिए',
    famH: 'दूर से मदद कर रहे हैं?', famP: 'देखिए कौन अटका है, अपने फ़ोन से सही बटन दिखाइए, और ठगी वाला पेज खुले तो सूचना पाइए।', famB: 'परिवार का पेज खोलिए',
    safeH: 'सुरक्षित रहने के लिए बनाया गया',
    safe1: 'यह दिखाता है। आप दबाते हैं। यह ख़ुद नहीं दबाता, न टाइप करता है।',
    safe2: 'आप जो लिखते हैं वह यह नहीं देखता, और आपके पेज नहीं रखता।',
    safe3: 'कौन सा बटन दिखाना है, इसका पक्का पता न हो तो यह साफ़ कहता है और परिवार से पूछने को कहता है।',
    instH: 'साथी को अपने फ़ोन में रखिए', instP: 'यह ऐप की तरह चलता है, और बिना इंटरनेट के भी खुलता है।', instB: 'साथी इंस्टॉल कीजिए',
    instIos: '“Share” दबाइए, फिर “Add to Home Screen”। यह ऐप की तरह चलता है, और बिना इंटरनेट के भी खुलता है।',
    instDone: 'इंस्टॉल हो गया। होम स्क्रीन से साथी खोलिए।',
    techS: 'डेवलपर और जजों के लिए: साथी कहाँ चलता है',
    foot: 'साथी नेपाली, हिन्दी और अंग्रेज़ी में चलता है। नेपाली और हिन्दी एआई से लिखी गई हैं और अभी किसी मातृभाषी ने नहीं जाँची हैं।',
  },
};

let lang = 'en';
try {
  const saved = localStorage.getItem('saathi:lang');
  if (saved && TEXT[saved]) lang = saved;
} catch {
  // storage unavailable: stay in English
}

function apply() {
  const t = TEXT[lang];
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) {
    const v = t[el.dataset.t];
    if (v) el.textContent = v;
  }
  for (const b of document.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  if (iosHint) $('install-note').textContent = t.instIos;
}

for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => {
    lang = b.dataset.lang;
    try {
      localStorage.setItem('saathi:lang', lang);
    } catch {
      // storage unavailable
    }
    apply();
  });
}

const touch = matchMedia('(pointer: coarse)').matches;
const narrow = Math.min(screen.width, screen.height) < 800;
const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const kind = mobileUA || (touch && narrow) ? 'phone' : 'computer';
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = typeof window.Capacitor !== 'undefined'; // the Android app is a native shell around this site
let iosHint = false;
const standalone = inApp || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

for (const row of document.querySelectorAll('#matrix tr[data-kind]')) {
  row.classList.toggle('here', row.dataset.kind === kind);
}

$('here').textContent = `${kind === 'phone' ? 'Phone or tablet' : 'Computer'}${inApp ? ', Saathi Android app' : standalone ? ', installed' : ''}`;

(async () => {
  let status = 'unsupported';
  try {
    if (typeof LanguageModel !== 'undefined') status = await LanguageModel.availability();
  } catch {
    status = 'unsupported';
  }
  const ready = status === 'available';
  $('ai-dot').className = `dot${ready ? ' ok' : ''}`;
  $('ai-note').textContent = ready
    ? 'The on-device model is ready here. Short tasks stay on this device. Nothing is sent.'
    : status === 'downloadable' || status === 'downloading'
      ? 'The on-device model can be downloaded in Chrome. Until then the cloud model answers, and only button names are sent.'
      : 'No on-device model on this device, so the cloud model answers. Only button names are sent, never the page.';
})();

// Install: Android and desktop Chrome offer a prompt. iPhone and iPad need "Add to Home Screen".
let offered = null;
addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  offered = ev;
  $('install').hidden = false;
  if (!standalone) $('install-card').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!offered) return;
  offered.prompt();
  await offered.userChoice.catch(() => {});
  offered = null;
  $('install').hidden = true;
});
addEventListener('appinstalled', () => {
  $('install-note').textContent = TEXT[lang].instDone;
  $('install').hidden = true;
});
$('install-card').hidden = true; // shown only where installing is possible
if (!standalone && ios) {
  iosHint = true;
  $('install-card').hidden = false;
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

apply();
