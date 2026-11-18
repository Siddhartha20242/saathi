// The scam guard, end to end, in a throwaway headless Chrome.
//
// Part 1, the family loop on the try page: a pretend scam page (made in the browser, never hosted) shows a
// warning on the page in the person's language, the panel shows it too, "Tell my family" writes an alert,
// and the helper page for the same group shows it. The practice website must show no warning.
//
// Part 2, false alarms: the real extension is loaded and visits real, legitimate pages, including real
// bank and wallet sites and login pages. None should get a "stop". No real scam page is visited.

import { launch, sleep } from './chrome.mjs';

const out = { checks: [], real: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;

try {
  // ---------- Part 1 ----------
  const t = await c.open('https://paperwork-decoder.web.app/try.html');
  await sleep(4000);
  const s = t.session;
  await c.waitFor(s, P('return !!w.__saathi?.user'), 40000);
  await c.evalIn(s, P(`d.getElementById('group-new').click()`));
  const group = await c.waitFor(s, P('return /^[A-Z0-9]{8}$/.test(w.__saathi.group) && w.__saathi.group'));

  // The ordinary practice website: no warning.
  await c.waitFor(s, `!!document.getElementById('site').contentWindow.__saathiLoaded`, 20000);
  await sleep(4000);
  check('the practice website shows no warning', await c.evalIn(s, S(`return !d.querySelector('[data-saathi="guard"]')`)) && await c.evalIn(s, P(`return d.getElementById('guard').hidden`)));

  // Nepali first, then the pretend scam page.
  await c.evalIn(s, P(`d.querySelector('[data-lang="ne"]').click()`));
  await c.evalIn(s, `document.querySelector('[data-variant="scam"]').click()`);
  await c.waitFor(s, S(`return !!d.querySelector('[data-saathi="guard"]')`), 20000);
  const bar = await c.evalIn(s, S(`const h = d.querySelector('[data-saathi="guard"]'); const b = h.shadowRoot.firstChild; return { headline: b.firstChild.textContent, buttons: [...b.querySelectorAll('button')].map((x) => x.textContent), reasons: [...b.querySelectorAll('li')].map((x) => x.textContent) }`));
  check('the page shows a stop warning in Nepali', bar.headline.includes('रोकिनुहोस्'), bar.headline);
  check('it lists reasons in Nepali, naming the imitated bank', bar.reasons.length >= 3 && bar.reasons.some((r) => r.includes('Himal Bank')), bar.reasons);
  await sleep(600);
  await c.shot(s, 'guard-warning.png');
  check('it offers a family button and a dismiss button', bar.buttons.length === 3, bar.buttons);
  await c.waitFor(s, P(`return !d.getElementById('guard').hidden`), 10000);
  const panel = await c.evalIn(s, P(`return { headline: d.getElementById('guard-headline').textContent, cls: d.getElementById('guard').className, reasons: d.querySelectorAll('#guard-reasons li').length }`));
  check('the panel shows the same warning', panel.headline.includes('रोकिनुहोस्') && /stop/.test(panel.cls), panel);

  // Tell the family from the warning on the page itself.
  // A script on the page can call .click() on the button, but that click is not a person's. It must do nothing.
  await c.evalIn(s, S(`const h = d.querySelector('[data-saathi="guard"]'); const b = h.shadowRoot.firstChild; [...b.querySelectorAll('button')][1].click(); return true`));
  await sleep(2500);
  check('a click made by a script on the page does not tell the family', await c.evalIn(s, P(`return d.getElementById('guard-msg').textContent === ''`)));
  // A real click, as a person would make it, at the button's place on the screen.
  const where = await c.evalIn(s, `(() => { const f = document.getElementById('site').getBoundingClientRect(); const h = document.getElementById('site').contentDocument.querySelector('[data-saathi="guard"]'); const r = [...h.shadowRoot.firstChild.querySelectorAll('button')][1].getBoundingClientRect(); return { x: Math.round(f.x + r.x + r.width / 2), y: Math.round(f.y + r.y + r.height / 2) }; })()`);
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: where.x, y: where.y }, s);
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: where.x, y: where.y, button: 'left', clickCount: 1 }, s);
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: where.x, y: where.y, button: 'left', clickCount: 1 }, s);
  await c.waitFor(s, P(`return /परिवारलाई जानकारी/.test(d.getElementById('guard-msg').textContent)`), 30000);
  check('pressing it on the page tells the family', true, await c.evalIn(s, P(`return d.getElementById('guard-msg').textContent`)));
  check('the page then confirms it', await c.waitFor(s, S(`const h = d.querySelector('[data-saathi="guard"]'); const b = h && h.shadowRoot.firstChild; return b && [...b.querySelectorAll('button')][1].disabled && b.querySelectorAll('button')[1].textContent`), 15000).then((x) => /परिवारलाई जानकारी/.test(x)));

  // The helper page for the same group.
  const helper = await c.open('https://paperwork-decoder.web.app/help.html', { background: true });
  await sleep(3000);
  await c.evalIn(helper.session, `document.getElementById('group-code').value = ${JSON.stringify(group)}; document.getElementById('group-join').click()`);
  const alertText = await c.waitFor(helper.session, `document.getElementById('s-alerts').hidden ? false : document.getElementById('alerts').innerText`, 30000);
  check('the helper page shows the alert, with the address and brand', /himalbank-kyc-verify\.top/.test(alertText) && /Himal Bank/.test(alertText), alertText.slice(0, 220));
  check('the alert has no page content in it', !/Customer ID|One-time|KYC immediately/.test(alertText));

  // ---------- Part 2 ----------
  if (process.env.SKIP_REAL === '1') throw new Error('skipped part 2');
  const panelTab = await c.open(`chrome-extension://${c.extId}/sidepanel.html`, { background: true });
  await sleep(2000);
  const status = () => c.evalIn(panelTab.session, `chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([t]) => chrome.tabs.sendMessage(t.id, { saathi: 'guardStatus' }))`);
  const PAGES = [
    'https://en.wikipedia.org/wiki/Main_Page', 'https://en.wikipedia.org/wiki/Nabil_Bank', 'https://www.python.org/',
    'https://www.nea.org.np/', 'https://nepalpassport.gov.np/', 'https://bangladesh.gov.bd/index.php',
    'https://github.com/login', 'https://accounts.google.com/signin', 'https://www.nabilbank.com/', 'https://esewa.com.np/',
    'https://khalti.com/', 'https://ird.gov.np/', 'https://www.paypal.com/signin',
  ];
  for (const url of PAGES) {
    const rec = { url };
    try {
      const page = await c.open(url);
      await sleep(7500);
      const g = await status();
      rec.level = g.level;
      rec.host = g.host;
      rec.reasons = (g.reasons || []).map((r) => r.code);
      await c.send('Target.closeTarget', { targetId: page.targetId });
    } catch (err) {
      rec.error = err.message.slice(0, 80);
    }
    out.real.push(rec);
  }
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
