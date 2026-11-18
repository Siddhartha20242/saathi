// Record and follow on real public websites, in a throwaway headless Chrome with the extension loaded.
// Nothing is typed, submitted or paid: it only clicks ordinary links.
//
// 1. Record a short path on each site and save it (live project, test group).
// 2. Follow it by clicking through the real pages, unchanged.
// 3. Simulate a redesign: a script renames the labels of the recorded controls as the page loads
//    ("label"), or also changes their link addresses and names ("hard"). Then check that the
//    highlight lands on the renamed control, on every step of every site.
//
// The on-device model is not available in this headless Chrome, so "hard" shows what happens
// without it: the guide should say it is not sure and point at nothing. It must never point at the
// wrong control.

import { launch, sleep } from './chrome.mjs';

const FLOWS = [
  {
    name: 'Bangladesh national portal (Bengali)',
    start: 'https://bangladesh.gov.bd/index.php',
    wait: 9000,
    steps: ['ই-সেবাসমূহ', 'সেবাখাত'],
    mutate: { 'ই-সেবাসমূহ': 'সকল সেবা', 'সেবাখাত': 'খাতভিত্তিক তথ্য' },
  },
  {
    name: 'Nepal passport office (Nepali)',
    start: 'https://nepalpassport.gov.np/',
    wait: 10000,
    steps: ['साधारण राहदानी बनाउन के गर्ने?'],
    mutate: { 'साधारण राहदानी बनाउन के गर्ने?': 'राहदानी कसरी बनाउने' },
  },
  {
    name: 'Wikipedia article, about 4,000 controls (English)',
    start: 'https://en.wikipedia.org/wiki/Nepal',
    wait: 9000,
    steps: ['About Wikipedia'],
    mutate: { 'About Wikipedia': 'Who runs this site' },
  },
  {
    name: 'Wikipedia (English)',
    start: 'https://en.wikipedia.org/wiki/Main_Page',
    wait: 7000,
    steps: ['Talk', 'Main Page'],
    mutate: { Talk: 'Discussion', 'Main Page': 'Home page' },
  },
];

const only = process.env.ONLY?.split('|'); // e.g. ONLY='Wikipedia (English)' to re-run one flow
const out = { flows: [] };
const c = await launch();

const norm = `(s) => (s || '').replace(/\\s+/g, ' ').trim()`;
const clickText = (session, text) =>
  c.evalIn(session, `(() => { const norm = ${norm}; const el = [...document.querySelectorAll('a,button')].find((e) => norm(e.innerText || e.value) === ${JSON.stringify(text)} && e.getBoundingClientRect().width > 3); if (!el) return false; el.click(); return true; })()`);

// Runs on every page load. It renames the recorded controls, and (hard) changes their addresses.
const mutationScript = (map, variant) => `(() => {
  const map = ${JSON.stringify(map)}; const hard = ${variant === 'hard'};
  const norm = ${norm};
  const run = () => {
    for (const el of document.querySelectorAll('a,button')) {
      const t = norm(el.innerText || el.value);
      if (map[t] === undefined) continue;
      el.removeAttribute('aria-label');
      el.textContent = map[t];
      if (hard) {
        if (el.tagName === 'A') el.setAttribute('href', '/redesigned/' + Math.random().toString(36).slice(2));
        el.removeAttribute('name'); el.removeAttribute('id');
      }
    }
  };
  const timer = setInterval(run, 400);
  setTimeout(() => clearInterval(timer), 20000);
})();`;

// What is under the middle of the highlight box, as text.
const underHighlight = (session) =>
  c.evalIn(session, `(() => { const norm = ${norm}; const b = document.querySelector('[data-saathi="highlight"]'); if (!b) return null; const r = b.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); const a = el?.closest('a'); return { text: norm(el?.closest('a,button')?.innerText || el?.value || el?.innerText), path: a ? a.pathname : '' }; })()`);

try {
  const site = await c.open('about:blank');
  await c.send('Page.enable', {}, site.session); // needed for the page-load renaming script to run
  await sleep(500);
  await c.open(`chrome-extension://${c.extId}/sidepanel.html`, { background: true });
  await sleep(4000);
  const frame = await c.frame('paperwork-decoder.web.app/panel.html');
  await c.waitFor(frame, '!!window.__saathi?.user', 40000);
  await c.evalIn(frame, `document.getElementById('group-new').click()`);
  await c.waitFor(frame, '/^[A-Z0-9]{8}$/.test(window.__saathi.group)');

  let saved = 0;
  for (const flow of FLOWS.filter((f) => !only || only.includes(f.name))) {
    const rec = { name: flow.name, recorded: null, unchanged: [], label: [], hard: [] };
    out.flows.push(rec);
    try {
      // 1. Record.
      await c.send('Page.navigate', { url: flow.start }, site.session);
      await sleep(flow.wait);
      await c.evalIn(frame, `document.getElementById('rec-title').value = ${JSON.stringify(flow.name)}; document.getElementById('rec-start').click()`);
      await c.waitFor(frame, 'window.__saathi.recording === true', 15000);
      for (const label of flow.steps) {
        const ok = await clickText(site.session, label);
        if (!ok) throw new Error(`could not find "${label}" to click`);
        await sleep(flow.wait > 8000 ? 8000 : 6000);
      }
      rec.recorded = await c.evalIn(frame, 'window.__saathi.steps.map((s) => `${s.role}:${s.text || "(hidden)"}|href=${s.href}|name=${s.name}`)');
      await c.evalIn(frame, `document.getElementById('rec-save').click()`);
      saved++;
      await c.waitFor(frame, `window.__saathi.paths.length >= ${saved}`, 90000);
      const host = await c.evalIn(frame, `window.__saathi.paths.find((p) => p.title === ${JSON.stringify(flow.name)}).host`);
      const id = await c.evalIn(frame, `window.__saathi.paths.find((p) => p.title === ${JSON.stringify(flow.name)}).id`);
      const steps = await c.evalIn(frame, `window.__saathi.paths.find((p) => p.title === ${JSON.stringify(flow.name)}).steps.map((s) => ({ text: s.text, page: s.page, role: s.role, href: s.href }))`);

      // 2. Follow by clicking through the real pages.
      await c.send('Page.navigate', { url: flow.start }, site.session);
      await sleep(flow.wait);
      await c.evalIn(frame, `document.querySelector('[data-start="${id}"]').click()`);
      for (let i = 0; i < steps.length; i++) {
        let info;
        try {
          info = await c.waitFor(frame, `(() => { const f = window.__saathi.follow; if (!f || f.index !== ${i}) return false; const how = document.getElementById('fo-how').textContent; if (f.found) return JSON.stringify({ by: f.found.by, text: f.found.text, covered: !document.getElementById('fo-warn').hidden }); return /not sure|cannot|nothing|did not answer/i.test(how) ? JSON.stringify({ notSure: how }) : false; })()`, 40000);
        } catch (err) {
          rec.unchanged.push({ step: i, error: 'timed out' });
          break;
        }
        const r = JSON.parse(info);
        rec.unchanged.push({ step: i, ...r });
        if (r.notSure) break;
        await clickText(site.session, r.text);
        await sleep(flow.wait > 8000 ? 8000 : 6500);
      }
      rec.unchangedFinished = await c.evalIn(frame, 'window.__saathi.done === true');
      await c.evalIn(frame, `window.__saathi.done = false; window.__saathi.follow = null`);

      // 3. Simulated redesigns, one step at a time on the real pages.
      for (const variant of ['label', 'hard']) {
        const reg = await c.send('Page.addScriptToEvaluateOnNewDocument', { source: mutationScript(flow.mutate, variant) }, site.session);
        for (let i = 0; i < steps.length; i++) {
          const url = i === 0 ? flow.start : `https://${host}${steps[i].page}`;
          await c.send('Page.navigate', { url }, site.session);
          await sleep(flow.wait + 2500);
          if (i === 0) {
            await c.evalIn(frame, `document.querySelector('[data-start="${id}"]').click()`);
          } else {
            await c.evalIn(frame, `window.__saathi.follow.index = ${i}; document.getElementById('fo-again').click()`);
          }
          const want = flow.mutate[steps[i].text];
          let r;
          try {
            const info = await c.waitFor(frame, `(() => { const f = window.__saathi.follow; if (!f || f.index !== ${i}) return false; const how = document.getElementById('fo-how').textContent; if (f.found) return JSON.stringify({ by: f.found.by, text: f.found.text, covered: !document.getElementById('fo-warn').hidden && /in front/i.test(document.getElementById('fo-warn').textContent) }); return /not sure|cannot|nothing|did not answer/i.test(how) ? JSON.stringify({ notSure: true }) : false; })()`, 40000);
            r = JSON.parse(info);
          } catch {
            r = { timedOut: true };
          }
          if (r.by) {
            await sleep(3000); // the page scrolls to the control smoothly; wait until it has arrived
            const under = await underHighlight(site.session);
            // Right if it is the renamed control, or another link to the same address (it does the same thing).
            const sameAddress = Boolean(under?.path) && under.path === steps[i].href;
            r.result = under?.text === want ? 'right'
              : sameAddress ? 'right (another link, same address)'
              : r.covered ? 'right (pop-up in front, and the guide says so)'
              : 'WRONG';
            if (r.result === 'WRONG') {
              r.under = under;
              // What is on the page for the control the guide named, and where the box is, to see why it was judged wrong.
              r.debug = await c.evalIn(site.session, `(() => { const norm = ${norm}; const b = document.querySelector('[data-saathi="highlight"]'); const box = b ? b.getBoundingClientRect().toJSON() : null; const links = [...document.querySelectorAll('a[href], button, input, select, textarea, summary, [role=button], [role=link], [role=tab], [role=menuitem]')].filter((a) => a.outerHTML.includes(${JSON.stringify(r.text)}) && !a.outerHTML.includes('সকল সেবা')).map((a) => ({ href: a.getAttribute('href'), rect: a.getBoundingClientRect().toJSON(), ariaHidden: Boolean(a.closest('[aria-hidden="true"]')), vis: getComputedStyle(a).visibility, display: getComputedStyle(a).display, html: a.outerHTML.slice(0, 200) })); return { box, links, scrollY: Math.round(scrollY) }; })()`);
            }
          } else {
            r.result = r.notSure ? 'not sure' : 'timed out';
          }
          rec[variant].push({ step: i, was: steps[i].text, ...r });
        }
        await c.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: reg.identifier }, site.session);
      }
    } catch (err) {
      rec.error = err.message;
    }
  }

  // Tidy up: delete the test paths.
  await c.evalIn(frame, `window.confirm = () => true; document.querySelectorAll('[data-delete]').forEach((b) => b.click()); 'ok'`);
  await sleep(4000);
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
