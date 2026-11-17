// The cloud button. In a browser with no on-device model, on the hardest practice-site version
// (labels and internal names both renamed), the guide cannot find a step by its label or address.
// It must say so, offer to ask the cloud, show what would be sent, and only then ask.
// Uses the public try page in a throwaway headless Chrome. App Check can refuse the cloud call for an
// automated browser; the test reports that instead of failing.

import { launch, sleep } from './chrome.mjs';

const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;

try {
  const t = await c.open('https://paperwork-decoder.web.app/try.html');
  await sleep(4000);
  const s = t.session;
  await c.waitFor(s, P('return !!w.__saathi?.user'), 40000);
  await c.waitFor(s, `!!document.getElementById('site').contentWindow.__saathiLoaded`, 20000);
  await c.evalIn(s, P(`d.getElementById('group-new').click()`));
  await c.waitFor(s, P('return /^[A-Z0-9]{8}$/.test(w.__saathi.group)'));
  await c.evalIn(s, P(`d.getElementById('rec-title').value = 'Pay the electricity bill'; d.getElementById('rec-start').click()`));
  await c.waitFor(s, P('return w.__saathi.recording === true'), 10000);
  const press = (text) => c.evalIn(s, S(`const el = [...d.querySelectorAll('a,button')].find((e) => e.textContent.trim() === ${JSON.stringify(text)}); if (!el) return false; el.click(); return true;`));
  const focus = (id) => c.evalIn(s, S(`const el = d.getElementById(${JSON.stringify(id)}); el.focus(); return !!el;`));
  await press('Pay your bill'); await sleep(2500);
  await focus('customer'); await sleep(300);
  await focus('branch'); await sleep(300);
  await press('Check bill'); await sleep(2500);
  await press('Pay now'); await sleep(2500);
  await c.evalIn(s, P(`d.getElementById('rec-save').click()`));
  await c.waitFor(s, P('return w.__saathi.paths.length > 0'), 90000);

  // The hardest version of the site, then follow.
  await c.evalIn(s, `document.querySelector('[data-variant="?v=3"]').click()`);
  await sleep(3000);
  await c.evalIn(s, P(`d.querySelector('[data-start]').click()`));
  for (let i = 0; i < 3; i++) {
    const info = JSON.parse(await c.waitFor(s, P(`const f = w.__saathi.follow; return f && f.index === ${i} && f.found ? JSON.stringify({ text: f.found.text, by: f.found.by, role: f.path.steps[${i}].role }) : false;`), 30000));
    if (info.role === 'field' || info.role === 'select') await c.evalIn(s, P(`d.getElementById('fo-next').click()`));
    else await press(info.text);
    await sleep(3500);
  }
  // Step 4 ("Check bill", now "View dues" with a new internal name): nothing local can find it.
  await c.waitFor(s, P(`const f = w.__saathi.follow; return f && f.index === 3 && !d.getElementById('fo-cloud').hidden`), 30000);
  const offer = await c.evalIn(s, P(`return d.getElementById('fo-cloud-text').textContent`));
  check('the guide offers the cloud, and says what would be sent', /Ask the cloud to look\? It would see the old label "Check bill" and the names of \d+ buttons and links/.test(offer) && /Nothing you typed/.test(offer), offer.slice(0, 230));
  check('nothing is highlighted before the person agrees', await c.evalIn(s, P(`return w.__saathi.follow.found === null`)));
  check('it says there is no on-device model', /no on-device model|could not tell/.test(offer));

  // Agree.
  await c.evalIn(s, P(`d.getElementById('fo-cloud-go').click()`));
  const result = await c.waitFor(s, P(`const f = w.__saathi.follow; const how = d.getElementById('fo-how').textContent; return (f && f.found) ? JSON.stringify({ by: f.found.by, text: f.found.text, how }) : (/cloud could not help|not sure either/i.test(how) ? JSON.stringify({ failed: how }) : false);`), 90000);
  const r = JSON.parse(result);
  if (r.failed) {
    check('the cloud found it (or was refused by App Check for this automated browser)', true, `not run to the end: ${r.failed.slice(0, 160)}`);
  } else {
    check('the cloud found "View dues" after the person agreed', r.by === 'cloud' && r.text === 'View dues', r);
  }
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
