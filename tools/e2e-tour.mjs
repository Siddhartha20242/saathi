// A first-time visitor's path on the live try page, using only the tour's buttons (no recording, no typing).

import { launch, sleep } from './chrome.mjs';

const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;

try {
  const t = await c.open('https://paperwork-decoder.web.app/try.html');
  const s = t.session;
  await sleep(5000);
  await c.waitFor(s, P('return !!w.__saathiDemo'), 40000);
  check('the tour starts at step 1 with plain words', await c.evalIn(s, `/Step 1 of 6/i.test(document.getElementById('tour-count').textContent) && document.getElementById('tour-do').textContent === 'Get the guide'`));

  await c.evalIn(s, `document.getElementById('tour-do').click()`);
  await c.waitFor(s, P(`return d.getElementById('lib-list').children.length > 0`), 90000);
  check('step 1 makes a ready-made guide with 5 steps', await c.evalIn(s, P(`return /5 steps/.test(d.getElementById('lib-list').textContent)`)));
  check('the tour moved to step 2', await c.evalIn(s, `/Step 2 of 6/i.test(document.getElementById('tour-count').textContent)`));

  await c.evalIn(s, `document.getElementById('tour-do').click()`);
  await c.waitFor(s, P(`const f = w.__saathi.follow; return !!(f && f.found)`), 30000);
  check('step 2 starts the guide and points at "Pay your bill"', await c.evalIn(s, P(`return /Pay your bill/.test(d.getElementById('fo-text').textContent)`)));
  check('the pointer is on the page', await c.evalIn(s, S(`return !!d.querySelector('[data-saathi="highlight"]')`)));

  await c.evalIn(s, `document.getElementById('tour-do').click()`);
  await sleep(6000);
  const how = await c.evalIn(s, P(`return d.getElementById('fo-text').textContent + ' | ' + d.getElementById('fo-how').textContent`));
  check('step 3 changes the website and the guide still points at the right link', /Pay your bill/.test(how) && /same place|found it/i.test(how), how);

  await c.evalIn(s, `document.getElementById('tour-do').click()`);
  await sleep(4000);
  const bar = await c.evalIn(s, S(`const h = d.querySelector('[data-saathi="guard"]'); return h && h.shadowRoot ? h.shadowRoot.textContent.slice(0, 120) : ''`));
  check('step 4 shows the fake bank page with a warning', bar.length > 20, bar);

  await c.evalIn(s, `document.getElementById('tour-do').click()`);
  await c.waitFor(s, P(`return !d.getElementById('msg-result').hidden`), 15000);
  check('step 5 checks the example message and warns', await c.evalIn(s, P(`return d.getElementById('msg-headline').textContent.length > 5`)), await c.evalIn(s, P(`return d.getElementById('msg-headline').textContent`)));
  check('the last step is reachable', await c.evalIn(s, `/Step 6 of 6/i.test(document.getElementById('tour-count').textContent)`));
  await c.shot(s, 'tour-final.png');
} catch (err) {
  out.error = String(err?.message ?? err);
} finally {
  console.log(JSON.stringify(out, null, 1));
  await c.close();
}
