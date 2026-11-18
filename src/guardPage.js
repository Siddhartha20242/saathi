// The scam guard on a real page: read what the page asks for, run the rules, and show a warning bar on
// the page itself. Bundled into the extension as guard-bundle.js (see tools/build-extension.mjs).
//
// What it reads: the address, the title, the page's visible words, and what each box on the page is
// (its type and label). It never reads what is typed into a box. All of it stays on this computer. The
// only thing that can leave is a family alert, which the person sends by pressing a button, and that
// carries only the website's address, the brand it imitates, and the reason codes.

import { assess, secretKind } from './guard.js';
import { warning, pickLang } from './guardText.js';

const clean = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** What the page asks for. A "demo host" can be set by the try page, which shows a pretend page at a made-up address. */
export function collectSnapshot(doc = document, loc = location, win = window) {
  const hostOf = (href) => {
    try {
      return new URL(href, loc.href).hostname;
    } catch {
      return '';
    }
  };
  const isBox = (el) => !['hidden', 'submit', 'button', 'reset', 'image', 'checkbox', 'radio'].includes((el.getAttribute('type') || '').toLowerCase());
  const describe = (el) => ({
    type: (el.getAttribute('type') || el.tagName).toLowerCase(),
    label: clean(el.labels?.[0]?.textContent || el.getAttribute('aria-label') || el.getAttribute('placeholder'), 80),
    name: clean(el.getAttribute('name') || el.id, 60),
    autocomplete: clean(el.getAttribute('autocomplete'), 40),
  });
  const fields = [...doc.querySelectorAll('input, textarea, select')].filter(isBox).slice(0, 60).map(describe);
  // Only a form that holds a box asking for a secret matters for "this sends what you type somewhere else":
  // a newsletter box on the same page posting to a mailing service does not.
  const forms = [...doc.querySelectorAll('form')].filter((f) => [...f.querySelectorAll('input, textarea')].filter(isBox).some((el) => secretKind(describe(el))));
  const links = [...doc.querySelectorAll('a[href]')].map((a) => a.getAttribute('href') || '');
  return {
    host: win.__saathiDemoHost || loc.hostname,
    protocol: win.__saathiDemoProtocol || loc.protocol,
    title: clean(doc.title, 200),
    heading: clean(doc.querySelector('h1')?.textContent, 200),
    text: clean(doc.body?.innerText, 4000),
    fields,
    formHosts: forms.map((f) => hostOf(f.getAttribute('action') || loc.href)).filter(Boolean),
    linkTargets: links.filter((h) => /\.apk($|\?)/i.test(h) || /anydesk|teamviewer|quicksupport/i.test(h)).map((h) => clean(h, 80)),
  };
}

const COLORS = { stop: '#a3271f', careful: '#8a5a00' };

/** The warning bar. Built with textContent only, so nothing from the page can run inside it. */
export function showBar(doc, assessment, lang, { onFamily, onDismiss }) {
  doc.querySelector('[data-saathi="guard"]')?.remove();
  const w = warning(assessment, lang);
  // The bar lives in a shadow root, so the page's own style rules cannot hide or restyle it, and the host has
  // its position set inline with !important, which beats any rule in the page's style sheets.
  const host = doc.createElement('div');
  host.setAttribute('data-saathi', 'guard');
  host.style.cssText = 'all:initial!important;position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:2147483647!important;display:block!important;';
  const root = host.attachShadow({ mode: 'open' });
  const bar = doc.createElement('div');
  bar.setAttribute('role', 'alert');
  bar.style.cssText = `background:${COLORS[assessment.level]};color:#fff;font:600 18px/1.4 system-ui,sans-serif;padding:12px 16px;box-shadow:0 2px 12px rgba(0,0,0,.4);box-sizing:border-box;`;
  root.append(bar);

  const head = doc.createElement('div');
  head.textContent = w.headline;
  bar.append(head);

  const list = doc.createElement('ul');
  list.style.cssText = 'margin:8px 0 0;padding-left:22px;font-weight:400;font-size:16px;display:none;';
  w.reasons.forEach((r) => {
    const li = doc.createElement('li');
    li.textContent = r;
    list.append(li);
  });

  const row = doc.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;';
  const button = (label, primary) => {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = `font:600 16px system-ui,sans-serif;min-height:44px;padding:8px 16px;border-radius:10px;border:2px solid #fff;cursor:pointer;background:${primary ? '#fff' : 'transparent'};color:${primary ? COLORS[assessment.level] : '#fff'};`;
    return b;
  };
  // Only a real click by the person counts. A page script can call .click() on a button, but that event is not "trusted".
  const why = button(w.why, false);
  why.addEventListener('click', (ev) => {
    if (ev.isTrusted) list.style.display = list.style.display === 'none' ? 'block' : 'none';
  });
  row.append(why);
  let familyButton = null;
  if (assessment.level === 'stop' && onFamily) {
    familyButton = button(w.family, true);
    familyButton.addEventListener('click', (ev) => {
      if (ev.isTrusted) onFamily(familyButton);
    });
    row.append(familyButton);
  }
  const dismiss = button(w.dismiss, false);
  dismiss.addEventListener('click', (ev) => {
    if (!ev.isTrusted) return;
    host.remove();
    onDismiss?.();
  });
  row.append(dismiss);
  bar.append(list, row);
  doc.documentElement.append(host);
  host.__bar = bar;
  host.__familyButton = familyButton;
  host.__sent = w.sent;
  return host;
}

/** Starts watching the page it is loaded in. `chromeApi` is the extension API (or a stand-in on the try page). */
export function startGuard(chromeApi, doc = document, win = window) {
  let last = null; // the latest assessment, with the host it was made for
  let lastKey = '';
  let dismissed = false;
  let lang = 'en';

  const readLang = () =>
    new Promise((resolve) => {
      try {
        chromeApi?.storage?.local?.get('saathi:lang', (r) => resolve(pickLang(r?.['saathi:lang'])));
        if (!chromeApi?.storage?.local) resolve('en');
      } catch {
        resolve('en');
      }
    });

  const tell = (message, done) => {
    try {
      chromeApi.runtime.sendMessage(message, (response) => {
        void chromeApi.runtime.lastError;
        done?.(response);
      });
    } catch {
      done?.(undefined); // the panel is closed
    }
  };

  async function run() {
    const snapshot = collectSnapshot(doc, win.location, win);
    const result = assess(snapshot);
    const key = `${snapshot.host}|${result.level}|${result.reasons.map((r) => r.code).join(',')}`;
    if (key === lastKey) return;
    lastKey = key;
    last = { host: snapshot.host, ...result };
    tell({ saathi: 'guard', guard: last });
    if (result.level === 'ok') return doc.querySelector('[data-saathi="guard"]')?.remove();
    if (dismissed) return;
    lang = await readLang();
    showBar(doc, result, lang, {
      // Only the open side panel can write the alert. If it is closed, say how to open it.
      onFamily: () =>
        tell({ saathi: 'guardAlert', alert: { host: last.host, brand: last.brand ?? '', level: last.level, reasons: last.reasons.map((r) => r.code) } }, (response) => {
          const host = doc.querySelector('[data-saathi="guard"]');
          if (response?.ok || !host?.__bar) return;
          const hint = doc.createElement('div');
          hint.style.cssText = 'margin-top:8px;font-weight:400;font-size:16px;';
          hint.textContent = warning(last, lang).openPanel;
          host.__bar.append(hint);
        }),
      onDismiss: () => (dismissed = true),
    });
  }

  // Pages fill in after they load, and single-page sites change address without reloading.
  setTimeout(run, 600);
  setTimeout(run, 2500);
  let href = win.location.href;
  setInterval(() => {
    if (win.location.href !== href) {
      href = win.location.href;
      dismissed = false;
      setTimeout(run, 800);
    }
  }, 1500);
  // A login box that appears later (a pop-up, or a page that fills in after it loads) is assessed too: when the
  // page changes, look again, at most once every three seconds. run() does nothing if the result is unchanged.
  let pending = null;
  try {
    new win.MutationObserver(() => {
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        run();
      }, 3000);
    }).observe(doc.documentElement, { childList: true, subtree: true });
  } catch {
    // no observer on this page
  }

  chromeApi.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.saathi === 'guardStatus') {
      sendResponse(last ?? { level: 'ok', reasons: [] });
    } else if (msg?.saathi === 'alertSent') {
      const host = doc.querySelector('[data-saathi="guard"]');
      if (host?.__familyButton) {
        host.__familyButton.textContent = host.__sent;
        host.__familyButton.disabled = true;
      }
      sendResponse({ ok: true });
    }
    return false;
  });
  return { run };
}

// The page script (content.js) starts this once it has the extension API.
if (typeof window !== 'undefined') window.__saathiGuard = { start: startGuard, collectSnapshot, showBar };
