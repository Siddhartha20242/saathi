// End to end for "I'm stuck": a person asks for help from the extension panel, a helper on a phone-sized
// page taps a control, and it lights up on the person's page. Runs in a throwaway headless Chrome.

import { launch, sleep } from './chrome.mjs';

const SITE = 'https://paperwork-decoder.web.app/demo/';
const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();

try {
  const site = await c.open(`${SITE}bill.html`);
  await sleep(2500);
  await c.open(`chrome-extension://${c.extId}/sidepanel.html`, { background: true });
  await sleep(4000);
  const frame = await c.frame('paperwork-decoder.web.app/panel.html');
  await c.waitFor(frame, '!!window.__saathi?.user', 40000);

  await c.evalIn(frame, `document.getElementById('group-new').click()`);
  const code = await c.waitFor(frame, '/^[A-Z0-9]{8}$/.test(window.__saathi.group) && window.__saathi.group');

  // The person asks for help. First they see exactly what would be sent.
  await c.evalIn(frame, `document.getElementById('help-ask').click()`);
  await c.waitFor(frame, `!document.getElementById('help-confirm').hidden`, 15000);
  out.preview = await c.evalIn(frame, `document.getElementById('help-preview').textContent`);
  await c.evalIn(frame, `document.getElementById('help-send').click()`);
  await c.waitFor(frame, `!document.getElementById('help-live').hidden`, 20000);

  // The helper, on a phone-sized page, in the same group.
  const phone = await c.open('https://paperwork-decoder.web.app/help.html', { background: true });
  await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, phone.session);
  await sleep(3000);
  await c.evalIn(phone.session, `document.getElementById('group-code').value = ${JSON.stringify(code)}; document.getElementById('group-join').click()`);
  await c.waitFor(phone.session, 'window.__helper.requests.length > 0', 30000);
  check('helper sees the request', true, await c.evalIn(phone.session, `document.getElementById('requests').innerText.replace(/\\n+/g, ' | ')`));
  await c.shot(phone.session, 'phone-list.png');

  await c.evalIn(phone.session, `document.querySelector('[data-open]').click()`);
  await c.waitFor(phone.session, `document.querySelectorAll('[data-pick]').length > 0`, 20000);
  out.helperSees = await c.evalIn(phone.session, `[...document.querySelectorAll('[data-pick]')].map((b) => b.innerText.replace(/\\n/g, ' - '))`);

  const tap = (text) =>
    c.evalIn(phone.session, `(() => { const b = [...document.querySelectorAll('[data-pick]')].find((x) => x.innerText.includes(${JSON.stringify(text)})); if (!b) return false; b.click(); return true; })()`);
  const lit = (text, tag = 'button') =>
    c.evalIn(site.session, `(() => { const box = document.querySelector('[data-saathi="highlight"]'); const el = [...document.querySelectorAll(${JSON.stringify(tag)})].find((e) => (e.textContent || e.value || '').trim() === ${JSON.stringify(text)}); if (!box || !el) return null; const b = box.getBoundingClientRect(); const r = el.getBoundingClientRect(); return { dx: Math.round(Math.abs(b.x + 6 - r.x)), dy: Math.round(Math.abs(b.y + 6 - r.y)) }; })()`);

  // The helper taps "Check bill": it should light up on the person's page.
  check('helper tapped Check bill', await tap('Check bill'));
  await c.waitFor(frame, `document.getElementById('help-status').textContent.includes('Check bill')`, 20000);
  await sleep(1200);
  const first = await lit('Check bill');
  check('Check bill is lit up on the person\'s page', first && first.dx <= 3 && first.dy <= 3, first);
  await c.shot(site.session, 'help-lit.png');

  // A note, then a different control: the highlight must move.
  await c.evalIn(phone.session, `document.getElementById('note').value = 'the green one'; document.getElementById('note-send').click()`);
  await c.waitFor(frame, `document.getElementById('help-status').textContent.includes('the green one')`, 20000);
  check('note reaches the person', true, await c.evalIn(frame, `document.getElementById('help-status').textContent`));
  await tap('Branch office');
  await c.waitFor(frame, `document.getElementById('help-status').textContent.includes('Branch office')`, 20000);
  await sleep(1200);
  const moved = await c.evalIn(site.session, `(() => { const box = document.querySelector('[data-saathi="highlight"]'); const el = document.getElementById('branch'); if (!box) return null; const b = box.getBoundingClientRect(); const r = el.getBoundingClientRect(); return { dx: Math.round(Math.abs(b.x + 6 - r.x)), dy: Math.round(Math.abs(b.y + 6 - r.y)) }; })()`);
  check('highlight moves to Branch office', moved && moved.dx <= 3 && moved.dy <= 3, moved);
  await c.shot(phone.session, 'phone-picked.png');

  // The person stops sharing: the request must be deleted from the group.
  await c.evalIn(frame, `document.getElementById('help-end').click()`);
  await c.waitFor(phone.session, `window.__helper.current === null`, 20000);
  check('request deleted after stopping', true, await c.evalIn(phone.session, `document.getElementById('help-state').textContent`));
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
