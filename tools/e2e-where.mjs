// "Where is…?" end to end on the hosted try page: while following a guide, ask for another control.
// The teal outline must appear, the step's own outline must stay, and nothing must be pressed.

import { launch, sleep } from './chrome.mjs';

const URL_TRY = 'https://paperwork-decoder.web.app/try.html';
const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;

try {
  const t = await c.open(URL_TRY);
  await sleep(4000);
  const s = t.session;
  await c.waitFor(s, P('return !!w.__saathi?.user'), 40000);
  await c.waitFor(s, `!!document.getElementById('site').contentWindow.__saathiLoaded`, 20000);
  await c.evalIn(s, P(`d.getElementById('group-new').click()`));
  await c.waitFor(s, P('return /^[A-Z0-9]{8}$/.test(w.__saathi.group)'));
  await c.evalIn(s, P(`d.getElementById('rec-title').value = 'Where test'; d.getElementById('rec-start').click()`));
  await c.waitFor(s, P('return w.__saathi.recording === true'), 10000);
  await c.evalIn(s, S(`[...d.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Pay your bill').click()`));
  await sleep(2500);
  await c.evalIn(s, P(`d.getElementById('rec-save').click()`));
  await c.waitFor(s, P('return w.__saathi.paths.length > 0'), 90000);
  await c.evalIn(s, P(`d.querySelector('[data-start]').click()`));
  await c.waitFor(s, P(`const f = w.__saathi.follow; return !!(f && f.found)`), 25000);
  check('where box shows while following', await c.evalIn(s, P(`return !d.getElementById('fo-where').hidden`)));
  const stepBox = () => c.evalIn(s, S(`return !!d.querySelector('[data-saathi="highlight"]')`));
  const pointBox = () => c.evalIn(s, S(`return !!d.querySelector('[data-saathi="point"]')`));
  check('step outline is showing', await stepBox());

  // Pick a real link on the page that is not the current step.
  const target = await c.evalIn(s, S(`const cur = (d.querySelector('[data-saathi="highlight"]'), 'Pay your bill'); const a = [...d.querySelectorAll('a')].map((e) => e.textContent.trim()).filter((t) => t && t.length < 30 && t !== cur); return a[0] || ''`));
  out.target = target;
  const ask = async (q) => {
    await c.evalIn(s, P(`d.getElementById('where-q').value = ${JSON.stringify(q)}; d.getElementById('where-go').click()`));
    await sleep(2000);
    return c.evalIn(s, P(`return d.getElementById('where-out').textContent + ' | picks: ' + d.getElementById('where-pick').children.length + ' | disabled: ' + d.getElementById('where-go').disabled`));
  };
  const said = await ask(`where is the ${target} link`);
  out.said = said;
  check('a control other than the step is outlined in the second colour', await pointBox(), said);
  check('the step outline stays', await stepBox());
  check('nothing was pressed or moved on', await c.evalIn(s, P(`return w.__saathi.follow && w.__saathi.follow.index === 0`)));
  const none = await ask('refund');
  check('an unknown name is answered, not guessed', /could not find/.test(none), none);
  // A button inside an open shadow root (a web component) can be found too.
  await c.evalIn(s, S(`const h = d.createElement('div'); d.body.prepend(h); const r = h.attachShadow({ mode: 'open' }); r.innerHTML = '<button style="padding:10px 20px">Shadow gift</button>'; return true;`));
  await c.evalIn(s, S(`d.querySelector('[data-saathi="point"]')?.remove(); return true;`));
  const sh = await ask('shadow gift');
  check('a button inside a shadow root is found and outlined', (await pointBox()) && /Shadow gift/.test(sh), sh);
  // The ask box is there while following. Here the model is not usable (App Check refuses automated browsers),
  // so it must fail kindly: a plain message, the button usable again, the guide unmoved.
  check('ask box shows while following', await c.evalIn(s, P(`return !d.getElementById('fo-ask').hidden && d.getElementById('ask-privacy').textContent.length > 10`)));
  await c.evalIn(s, P(`d.getElementById('ask-q').value = 'what does this mean? my phone is 9841234567'; d.getElementById('ask-go').click()`));
  await sleep(12000);
  const asked = await c.evalIn(s, P(`return d.getElementById('ask-out').textContent + ' | disabled: ' + d.getElementById('ask-go').disabled`));
  check('an answer or a kind failure, button usable again, guide unmoved', /disabled: false/.test(asked) && !/Thinking/.test(asked) && (await c.evalIn(s, P(`return w.__saathi.follow.index === 0`))), asked);
  await c.shot(s, 'where-is.png');
} catch (err) {
  out.error = String(err?.message ?? err);
} finally {
  console.log(JSON.stringify(out, null, 1));
  await c.close();
}
