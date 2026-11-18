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

// ---------- The guide, and the panel height on a phone ----------

const guide = $('guide');
const toggle = $('guide-toggle');
const setGuide = (open) => {
  guide.hidden = !open;
  toggle.setAttribute('aria-expanded', String(open));
};
// Open on a computer, where there is room. Closed on a phone, so the website and Saathi fill the screen.
setGuide(!matchMedia('(max-width: 900px)').matches);
toggle.addEventListener('click', () => setGuide(guide.hidden));
$('guide-close').addEventListener('click', () => setGuide(false));

$('expand').addEventListener('click', (ev) => {
  const tall = document.body.classList.toggle('tall');
  ev.currentTarget.setAttribute('aria-pressed', String(tall));
  ev.currentTarget.textContent = tall ? 'Shorter' : 'Taller';
  ev.currentTarget.setAttribute('aria-label', tall ? 'Make Saathi shorter' : 'Make Saathi taller');
});

window.__try = { get recording() { return recording; } }; // read by the end-to-end test
