// The try page: the practice website on the left, the real panel on the right.
// This page does what the extension does. It loads the extension's own page script (content.js)
// into the practice website and passes messages between that script and the panel, so the
// demo runs the same code as the extension.

const $ = (id) => document.getElementById(id);
const siteFrame = $('site');
const panelFrame = $('panel');
const ALLOWED = new Set(['scan', 'highlight', 'recordStart', 'recordStop']);

let recording = false; // pages that load while recording are told to keep recording
let listeners = []; // the page script's message handlers

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
  };
  const script = win.document.createElement('script');
  script.src = '/demo-bridge/content.js';
  win.document.documentElement.append(script);
}

siteFrame.addEventListener('load', inject);

// From the page script to the panel.
function fromPage(message, callback) {
  if (message?.saathi === 'hello') {
    callback?.({ recording });
  } else if (message?.saathi === 'recorded' || message?.saathi === 'clicked') {
    panelFrame.contentWindow?.postMessage(
      { event: message.saathi, step: message.step, stepIndex: message.stepIndex },
      location.origin,
    );
  }
}

// From the panel to the page script. If the practice website has only just loaded, wait a moment
// for its page script instead of failing straight away.
function toPage(msg) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const attempt = () => {
      const listener = listeners[0];
      if (!listener) {
        if (Date.now() - started > 3000) return reject(new Error('not ready'));
        return setTimeout(attempt, 150);
      }
      let answered = false;
      listener({ saathi: msg.type, index: msg.index, stepIndex: msg.stepIndex }, {}, (response) => {
        answered = true;
        resolve(response);
      });
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

document.querySelectorAll('[data-variant]').forEach((button) =>
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-variant]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    const here = new URL(siteFrame.contentWindow.location.href).pathname;
    const page = here.startsWith('/demo/') ? here : '/demo/index.html';
    siteFrame.src = `${page}${button.dataset.variant}`;
  }),
);

window.__try = { get recording() { return recording; } }; // read by the end-to-end test
