// The try page: the practice website on the left, the real panel on the right.
// This page does what the extension does. It loads the extension's own page script (content.js)
// into the practice website and passes messages between that script and the panel, so the
// demo runs the same code as the extension.

const $ = (id) => document.getElementById(id);
const siteFrame = $('site');
const panelFrame = $('panel');
const ALLOWED = new Set(['scan', 'highlight', 'recordStart', 'recordStop', 'setLang', 'alertSent', 'guardStatus']);

let recording = false; // pages that load while recording are told to keep recording
let listeners = []; // the page script's message handlers
let pretendScam = false; // showing the pretend scam page instead of the practice website

// ---------- The page script, loaded into the practice website ----------

function inject() {
  const win = siteFrame.contentWindow;
  try {
    void win.document; // the practice website is on this site, so it can be reached
  } catch {
    return;
  }
  listeners = [];
  win.chrome = {
    runtime: {
      lastError: undefined,
      onMessage: { addListener: (fn) => listeners.push(fn) },
      sendMessage: (message, callback) => fromPage(message, callback),
    },
    // The warning on the page speaks the language chosen in the panel, which keeps it in this page's storage.
    storage: { local: { get: (key, cb) => cb({ [key]: localStorage.getItem(key) }) } },
  };
  // The pretend scam page claims to be at a made-up address, as a real scam page would.
  if (pretendScam) {
    win.__saathiDemoHost = 'himalbank-kyc-verify.top';
    win.__saathiDemoProtocol = 'https:';
  }
  // The scam guard first, then the page script. async = false keeps them in this order.
  for (const file of ['guard-bundle.js', 'content.js']) {
    const script = win.document.createElement('script');
    script.src = `/demo-bridge/${file}`;
    script.async = false;
    win.document.documentElement.append(script);
  }
}

siteFrame.addEventListener('load', inject);
// The practice website can finish loading before this script has run. Then no load event is seen, so inject now.
if (siteFrame.contentDocument?.readyState === 'complete' && siteFrame.contentDocument.location.href !== 'about:blank') inject();

// From the page script to the panel.
function fromPage(message, callback) {
  if (message?.saathi === 'hello') {
    callback?.({ recording });
  } else if (message?.saathi === 'recorded' || message?.saathi === 'clicked') {
    panelFrame.contentWindow?.postMessage(
      { event: message.saathi, step: message.step, stepIndex: message.stepIndex },
      location.origin,
    );
  } else if (message?.saathi === 'guard' || message?.saathi === 'guardAlert') {
    panelFrame.contentWindow?.postMessage({ event: message.saathi, guard: message.guard, alert: message.alert }, location.origin);
    callback?.({ ok: true });
  }
}

// From the panel to the page scripts. The first listener that answers wins, as in a real extension.
function toPage(msg) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      if (!listeners.length) {
        if (Date.now() - started > 3000) return reject(new Error('not ready'));
        return setTimeout(attempt, 150);
      }
      let answered = false;
      for (const listener of listeners) {
        listener({ saathi: msg.type, index: msg.index, stepIndex: msg.stepIndex, info: msg.info === true }, {}, (response) => {
          if (answered) return;
          answered = true;
          resolve(response);
        });
        if (answered) break;
      }
      if (!answered) setTimeout(() => !answered && reject(new Error('no answer')), 500);
    };
    attempt();
  });
}

addEventListener('message', async (ev) => {
  if (ev.origin !== location.origin || ev.source !== panelFrame.contentWindow) return;
  const msg = ev.data;
  if (!msg || msg.source !== 'saathi-panel' || !ALLOWED.has(msg.type)) return;

  const reply = (body) => panelFrame.contentWindow.postMessage({ id: msg.id, ...body }, location.origin);
  if (msg.type === 'recordStart') recording = true;
  if (msg.type === 'recordStop') recording = false;
  if (msg.type === 'setLang') return reply({ result: { ok: true } }); // the panel already keeps it in storage this page shares
  try {
    const result = await toPage(msg);
    if (!result) throw new Error('empty');
    if (result.error) return reply({ error: result.error });
    reply({ result });
  } catch {
    reply({ error: 'The practice website is still loading. Try again in a moment.' });
  }
});

// ---------- Which version of the practice website ----------

// A pretend scam page. It is made here, in the browser, and is never a page on the hosted site, so no
// fake bank page exists at a real address. The try page tells the guard it is at a made-up address.
const SCAM_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Himal Bank - Update your KYC</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:0;background:#f3f6fb;color:#12202f}header{background:#0b3a66;color:#fff;padding:10px 16px}
.practice{background:#fff4dc;border-bottom:1px solid #e0a11b;padding:4px 16px;font-size:12px;color:#12202f}main{max-width:520px;margin:12px auto;padding:0 16px}
h1{font-size:19px;margin:0 0 6px}form{display:flex;flex-direction:column;gap:10px;background:#fff;padding:14px;border-radius:10px;border:1px solid #cfd8e3}
label{display:flex;flex-direction:column;gap:4px;font-size:14px}input{font:inherit;padding:10px;border:1px solid #9fb0c2;border-radius:6px}button{font:inherit;padding:11px;border:0;border-radius:6px;background:#0b6e4f;color:#fff;font-weight:600}</style></head>
<body><div class="practice">Practice page. A pretend scam. Nothing here is real and nothing is sent.</div>
<header>Himal Bank</header>
<main><h1>Himal Bank</h1>
<p>Your account will be blocked within 24 hours. Update your KYC immediately to keep access.</p>
<form onsubmit="return false"><label>Customer ID<input name="cid" autocomplete="off"></label>
<label>Password<input name="pw" type="password" autocomplete="off"></label>
<label>One-time code (OTP)<input name="otp" autocomplete="off"></label>
<button type="button">Verify now</button></form></main></body></html>`;

document.querySelectorAll('[data-variant]').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-variant]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    if (button.dataset.variant === 'scam') {
      pretendScam = true;
      siteFrame.srcdoc = SCAM_PAGE;
      return;
    }
    pretendScam = false;
    const here = siteFrame.hasAttribute('srcdoc') ? '/demo/index.html' : new URL(siteFrame.contentWindow.location.href).pathname;
    const page = here.startsWith('/demo/') ? here : '/demo/index.html';
    siteFrame.removeAttribute('srcdoc');
    siteFrame.src = `${page}${button.dataset.variant}`;
  }),
);

// ---------- The tour: one thing to try at a time ----------

const EXAMPLE_MESSAGE = 'Dear customer your Nabil Bank account will be blocked within 24 hours. Update your KYC now: http://nabilbank-kyc.top/login';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const panelDoc = () => panelFrame.contentDocument;
const demoApi = async () => {
  for (let i = 0; i < 80; i++) {
    const api = panelFrame.contentWindow?.__saathiDemo;
    if (api) return api;
    await sleep(250);
  }
  throw new Error('Saathi is still starting. Try again in a moment.');
};
const pressVariant = (v) => document.querySelector(`[data-variant="${v}"]`)?.click();

const STEPS = [
  {
    title: 'Meet your family’s guide',
    text: 'Someone in the family has already shown the way to pay an electricity bill. Press the button to get that guide.',
    action: 'Get the guide',
    run: async () => {
      const api = await demoApi();
      await api.makeSample();
    },
  },
  {
    title: 'Now follow it, one step at a time',
    text: 'Saathi points to the right button and says what to do. You press it, and Saathi moves on. It never presses for you.',
    action: 'Start the guide',
    run: async () => {
      pressVariant('');
      await sleep(1500);
      await demoApi();
      panelDoc().getElementById('fo-stop')?.click();
      panelDoc().querySelector('[data-start]')?.click();
    },
  },
  {
    title: 'What if the website changes?',
    text: 'Websites rename their buttons all the time. Saathi finds the right one anyway, or tells you honestly when it is not sure.',
    action: 'Change the website, then start again',
    run: async () => {
      await demoApi();
      panelDoc().getElementById('fo-stop')?.click();
      pressVariant('?v=2');
      await sleep(2500);
      panelDoc().querySelector('[data-start]')?.click();
    },
  },
  {
    title: 'Is this page safe?',
    text: 'If a page looks like a fake bank, Saathi shows a warning and says why, in your language. Press the button to see a pretend fake bank page.',
    action: 'Show a fake bank page',
    run: async () => {
      await demoApi();
      panelDoc().getElementById('fo-stop')?.click();
      pressVariant('scam');
    },
  },
  {
    title: 'Got a strange message?',
    text: 'Paste a text or an email and Saathi tells you if it looks like a scam. Nothing is sent anywhere.',
    action: 'Try an example message',
    run: async () => {
      const api = await demoApi();
      await api.openMessage(EXAMPLE_MESSAGE);
      await sleep(300);
      panelDoc().getElementById('msg-check')?.click();
    },
  },
  {
    title: 'That is Saathi',
    text: 'You can make your own guide in the “Make a guide” tab. A family member can open the family page on their phone to help when someone is stuck.',
    action: 'Open the family page',
    run: async () => {
      window.open('/help.html', '_blank', 'noopener');
    },
  },
];

let at = 0;
const tour = $('tour');
function renderTour() {
  const step = STEPS[at];
  $('tour-count').textContent = `Step ${at + 1} of ${STEPS.length}`;
  $('tour-title').textContent = step.title;
  $('tour-text').textContent = step.text;
  $('tour-do').textContent = step.action;
  $('tour-back').disabled = at === 0;
  $('tour-next').disabled = at === STEPS.length - 1;
  $('tour-dots').innerHTML = STEPS.map((_, i) => `<i class="${i === at ? 'on' : ''}"></i>`).join('');
}
$('tour-do').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget;
  btn.disabled = true;
  const label = btn.textContent;
  btn.textContent = 'One moment…';
  try {
    await STEPS[at].run();
    if (at < STEPS.length - 1) {
      at += 1;
      renderTour();
    }
  } catch (err) {
    $('tour-text').textContent = err?.message ?? 'That did not work. Try again.';
    btn.textContent = label;
  } finally {
    btn.disabled = false;
  }
});
$('tour-back').addEventListener('click', () => {
  at = Math.max(0, at - 1);
  renderTour();
});
$('tour-next').addEventListener('click', () => {
  at = Math.min(STEPS.length - 1, at + 1);
  renderTour();
});
$('tour-min').addEventListener('click', (ev) => {
  const min = tour.classList.toggle('min');
  ev.currentTarget.textContent = min ? 'Show' : 'Hide';
  ev.currentTarget.setAttribute('aria-expanded', String(!min));
});
// A link from the home page can start in the middle: try.html#message
if (location.hash === '#message') at = 4;
else if (location.hash === '#scam') at = 3;
renderTour();

$('expand').addEventListener('click', (ev) => {
  const tall = document.body.classList.toggle('tall');
  ev.currentTarget.setAttribute('aria-pressed', String(tall));
  ev.currentTarget.textContent = tall ? 'Shorter' : 'Taller';
  ev.currentTarget.setAttribute('aria-label', tall ? 'Make Saathi shorter' : 'Make Saathi taller');
});

window.__try = { get recording() { return recording; } }; // read by the end-to-end test
