// End to end: a helper records a path on the practice website, saves it to the group, and a
// follower then follows it on the unchanged site and on a renamed copy of the site.
// Runs in a throwaway headless Chrome with the extension loaded. Uses the live site and project.

import { launch, sleep } from './chrome.mjs';

const SITE = 'https://paperwork-decoder.web.app/demo/';
const out = { recorded: null, saved: null, follows: [] };
const c = await launch();

try {
  const site = await c.open(`${SITE}index.html`);
  await sleep(2500);
  const panel = await c.open(`chrome-extension://${c.extId}/sidepanel.html`, { background: true });
  await sleep(4000);
  const frame = await c.frame('paperwork-decoder.web.app/panel.html');

  await c.waitFor(frame, '!!window.__saathi?.user', 40000); // anonymous sign-in
  await c.waitFor(frame, 'window.__saathi.config.source !== "default" || true', 5000);
  out.config = await c.evalIn(frame, 'JSON.stringify(window.__saathi.config)');

  // 1. Group, then record.
  await c.evalIn(frame, `document.getElementById('group-new').click()`);
  await c.waitFor(frame, '/^[A-Z0-9]{8}$/.test(window.__saathi.group)');
  await c.evalIn(frame, `document.getElementById('rec-title').value = 'Pay the electricity bill'; document.getElementById('rec-start').click()`);
  await c.waitFor(frame, 'window.__saathi.recording === true', 10000);

  const press = (text) =>
    c.evalIn(site.session, `(() => { const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true; })()`);
  const focus = (id) => c.evalIn(site.session, `(() => { const el = document.getElementById(${JSON.stringify(id)}); el.focus(); return !!el; })()`);

  await press('Pay your bill');
  await sleep(3000);
  await focus('customer');
  await sleep(300);
  await focus('branch');
  await sleep(300);
  await press('Check bill');
  await sleep(3000);
  await press('Pay now');
  await sleep(3000);
  out.recorded = await c.evalIn(frame, 'JSON.stringify(window.__saathi.steps.map((s) => `${s.role}:${s.text}|${s.href}|${s.name}`))');

  // 2. Save (translates in the cloud, then writes to Firestore).
  await c.evalIn(frame, `document.getElementById('rec-save').click()`);
  await c.waitFor(frame, 'window.__saathi.paths.length > 0', 90000);
  out.saved = await c.evalIn(frame, `JSON.stringify({ message: document.getElementById('rec-msg').textContent, paths: window.__saathi.paths.map((p) => ({ title: p.title, host: p.host, steps: p.steps.length, languages: Object.keys(p.translations || {}), sample: p.translations?.ne?.steps?.[0] })) })`);

  // 3. Follow it, on the unchanged site and on a renamed copy.
  for (const variant of ['', '?v=2']) {
    const run = { variant: variant || 'unchanged', steps: [] };
    await c.send('Page.navigate', { url: `${SITE}index.html${variant}` }, site.session);
    await sleep(3000);
    await c.evalIn(frame, `document.querySelector('[data-start]').click()`);
    for (let i = 0; i < 6; i++) {
      const done = await c.evalIn(frame, 'window.__saathi.done && !window.__saathi.follow');
      if (done) break;
      let found;
      try {
        found = await c.waitFor(frame, `(() => { const f = window.__saathi.follow; return f && f.index === ${i} && f.found ? JSON.stringify({ text: f.found.text, by: f.found.by, role: f.path.steps[${i}].role, was: f.path.steps[${i}].text }) : false; })()`, 25000);
      } catch (err) {
        run.steps.push({ index: i, error: await c.evalIn(frame, `document.getElementById('fo-how').textContent`) });
        break;
      }
      const info = JSON.parse(found);
      run.steps.push({ index: i, ...info });
      if (variant === '?v=2' && i === 3) await c.shot(site.session, 'follow-renamed.png');
      if (info.role === 'field' || info.role === 'select') {
        await c.evalIn(frame, `document.getElementById('fo-next').click()`);
      } else {
        await c.evalIn(site.session, `(() => { const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim() === ${JSON.stringify(info.text)}); el.click(); })()`);
      }
      await sleep(3500);
    }
    run.finished = await c.evalIn(frame, 'window.__saathi.done === true');
    out.follows.push(run);
    await c.evalIn(frame, `window.__saathi.done = false`);
  }
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
