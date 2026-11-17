// Runs inside a real page, in a Chrome that has the on-device model. Paste the built file
// (tools/real-model/out/check.js) into the page's console, then call
//   window.__runCases('wiki')      (or 'py', 'nea', 'bd')
// and read window.__R when `done` is true.
//
// It uses the extension's real page script (to read the page) and the real re-finding code, and
// asks the on-device model directly through Chrome's Prompt API. Nothing is sent to the cloud.

import { refind } from '../../src/refind.js';
import { CASES } from './cases.js';
import makeScan from './out/scan.generated.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

// The extension's page script, run with a stand-in for the extension API.
function installScan() {
  const listeners = [];
  window.__saathiLoaded = false;
  makeScan({
    runtime: { lastError: undefined, onMessage: { addListener: (fn) => listeners.push(fn) }, sendMessage: () => {} },
  });
  return () => {
    let out;
    listeners[0]({ saathi: 'scan' }, {}, (x) => (out = x));
    return out;
  };
}

async function ask(prompt) {
  const session = await LanguageModel.create({
    expectedInputs: [{ type: 'text', languages: ['en'] }],
    expectedOutputs: [{ type: 'text', languages: ['en'] }],
  });
  try {
    return await session.prompt(prompt);
  } finally {
    session.destroy();
  }
}

const visible = (el) => el.getBoundingClientRect().width > 3 && getComputedStyle(el).visibility !== 'hidden';

function findTarget(label) {
  return [...document.querySelectorAll('a, button, input[type=button], input[type=submit]')].find(
    (el) => visible(el) && [norm(el.innerText), norm(el.value), norm(el.getAttribute('aria-label'))].includes(label),
  );
}

/** Applies the redesign to the open page. Returns a function that undoes it. */
function mutate(el, c) {
  const saved = { html: el.innerHTML, href: el.getAttribute('href'), name: el.getAttribute('name'), id: el.id, aria: el.getAttribute('aria-label'), title: el.getAttribute('title'), display: el.style.cssText };
  if (c.variant === 'removed') {
    el.style.setProperty('display', 'none', 'important');
  } else {
    el.removeAttribute('aria-label');
    el.removeAttribute('title');
    el.textContent = c.renamed;
    if (el.tagName === 'A') el.setAttribute('href', `/redesigned/${Math.random().toString(36).slice(2)}`);
    el.removeAttribute('name');
    el.removeAttribute('id');
  }
  return () => {
    el.innerHTML = saved.html;
    el.style.cssText = saved.display;
    for (const [k, v] of [['href', saved.href], ['name', saved.name], ['aria-label', saved.aria], ['title', saved.title]]) {
      v === null ? el.removeAttribute(k) : el.setAttribute(k, v);
    }
    if (saved.id) el.id = saved.id;
  };
}

window.__runCases = async (page) => {
  const R = { page, model: null, rows: [], done: false };
  window.__R = R;
  try {
    R.model = await LanguageModel.availability();
    const scan = installScan();
    for (const c of CASES.filter((k) => k.page === page)) {
      const row = { variant: c.variant, label: c.label, renamed: c.renamed ?? null };
      R.rows.push(row);
      const el = findTarget(c.label);
      if (!el) { row.result = 'target not found'; continue; }
      // The recorded step: what the control looked like before the redesign.
      const before = scan();
      const recorded = before.elements.find((e) => e.text === c.label && (c.role === 'button' ? e.role === 'button' : e.role === 'link'));
      if (!recorded) { row.result = 'not in the scan'; continue; }
      const step = { role: recorded.role, text: recorded.text, section: recorded.section, href: recorded.href, name: recorded.name };
      const undo = mutate(el, c);
      await sleep(150);
      const started = performance.now();
      try {
        const now = scan();
        let calls = 0;
        const res = await refind(step, now.elements, { task: document.title }, async (p) => {
          calls++;
          try { return await ask(p); } catch (err) { row.error = String(err.message || err).slice(0, 80); return ''; }
        });
        row.by = res.by;
        row.calls = calls;
        row.ms = Math.round(performance.now() - started);
        row.reason = res.reason ?? null;
        if (res.index === null) {
          row.result = c.variant === 'removed' ? 'right (not sure)' : 'not sure';
        } else {
          row.picked = now.elements[res.index].text;
          const ok = c.variant === 'renamed' && row.picked === c.renamed;
          row.result = ok ? 'right' : 'WRONG';
        }
      } finally {
        undo();
      }
    }
  } catch (err) {
    R.error = String(err.message || err);
  }
  R.done = true;
};
