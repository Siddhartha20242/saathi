// End to end on the hosted try page, with no extension involved: record a path on the practice
// website, save it, then follow it on the renamed copy. Runs in a throwaway headless Chrome.
// The page is the same public try page anyone can open.

import { launch, sleep } from './chrome.mjs';

const URL_TRY = 'https://paperwork-decoder.web.app/try.html';
const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();

// The two frames are on the same site as the page, so the page can reach into both.
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;

try {
  const t = await c.open(URL_TRY);
  await sleep(4000);
  const s = t.session;
  // PHONE=1 runs the same flow in a phone-sized, touch-enabled window.
  const phone = process.env.PHONE === '1';
  if (phone) {
    await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, s);
    await c.send('Emulation.setTouchEmulationEnabled', { enabled: true }, s);
    await c.send('Page.reload', {}, s);
    await sleep(5000);
  }
  await c.waitFor(s, P('return !!w.__saathi?.user'), 40000);
  check('panel runs in demo mode', await c.evalIn(s, P(`return d.getElementById('where').textContent`)).then((x) => /Demo mode/.test(x)));

  await c.waitFor(s, `!!document.getElementById('site').contentWindow.__saathiLoaded`, 20000); // the practice site's page script is ready
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
  out.recorded = await c.evalIn(s, P('return w.__saathi.steps.map((x) => `${x.role}:${x.text}`)'));
  check('five steps recorded across four pages', out.recorded.length === 5, out.recorded);

  await c.evalIn(s, P(`d.getElementById('rec-save').click()`));
  await c.waitFor(s, P('return w.__saathi.paths.length > 0'), 90000);
  out.saved = await c.evalIn(s, P(`return d.getElementById('rec-msg').textContent`));
  // The cloud step can be refused by App Check when reCAPTCHA scores this automated browser as a bot.
  // That is the designed fallback (the path is saved without translations), so it is reported, not failed.
  const languages = await c.evalIn(s, P(`return Object.keys(w.__saathi.paths[0].translations || {}).join(',')`));
  check('saved (translated, or saved without translations when the cloud refuses)', /^Saved/.test(out.saved), languages === 'ne,hi' ? 'translated into ne,hi' : `fallback: ${out.saved.replace(/^.*Saved without/, 'Saved without').slice(0, 120)}`);

  // Switch to the renamed copy and follow.
  await c.evalIn(s, `document.querySelector('[data-variant="?v=2"]').click()`);
  await sleep(3000);
  await c.evalIn(s, P(`d.querySelector('[data-start]').click()`));
  const how = [];
  for (let i = 0; i < 5; i++) {
    const found = await c.waitFor(s, P(`const f = w.__saathi.follow; return f && f.index === ${i} && f.found ? JSON.stringify({ text: f.found.text, by: f.found.by, role: f.path.steps[${i}].role }) : false;`), 25000);
    const info = JSON.parse(found);
    how.push(`${info.by}:${info.text}`);
    if (i === 3) await c.shot(s, phone ? 'try-follow-phone.png' : 'try-follow-renamed.png');
    if (info.role === 'field' || info.role === 'select') await c.evalIn(s, P(`d.getElementById('fo-next').click()`));
    else await press(info.text);
    await sleep(3200);
  }
  out.how = how;
  check('followed to the end on the renamed copy', await c.evalIn(s, P('return w.__saathi.done === true')), how);

  // The finished card offers to tell the family. Pressing it writes a check-in with only a title and a step count.
  check('finished card offers to tell the family', await c.evalIn(s, P(`const b = d.getElementById('fo-tell-btn'); return !d.getElementById('fo-tell').hidden && !b.disabled`)));
  await c.evalIn(s, P(`d.getElementById('fo-tell-btn').click()`));
  await c.waitFor(s, P(`return d.getElementById('fo-tell-msg').textContent.length > 0`), 15000);
  check('family told after the button is pressed', await c.evalIn(s, P(`return /told|Well done/.test(d.getElementById('fo-tell-msg').textContent)`)), await c.evalIn(s, P(`return d.getElementById('fo-tell-msg').textContent`)));
  const written = await c.evalIn(s, P(`return w.__saathi.user.getIdToken()
    .then((tok) => fetch('https://firestore.googleapis.com/v1/projects/paperwork-decoder/databases/(default)/documents/groups/' + w.__saathi.group + '/checkins', { headers: { Authorization: 'Bearer ' + tok } }))
    .then((r) => r.json())
    .then((j) => JSON.stringify((j.documents || []).map((x) => Object.keys(x.fields).sort().join(',') + ' | ' + x.fields.title.stringValue + ' | ' + x.fields.steps.integerValue)));`));
  out.checkin = JSON.parse(written);
  check('check-in holds only title, steps and bookkeeping fields', out.checkin.length === 1 && out.checkin[0].startsWith('createdAt,createdBy,expiresAt,steps,title | Pay the electricity bill | 5'), out.checkin);

  // Check a pasted message: plain code on the laptop. Telling the family sends no message text.
  await c.evalIn(s, P(`d.getElementById('tab-help').click()`));
  const scam = 'Dear customer your Nabil Bank account will be blocked within 24 hours. Update your KYC now: http://nabilbank-kyc.top/login';
  await c.evalIn(s, P(`d.getElementById('msg-text').value = ${JSON.stringify(scam)}; d.getElementById('msg-check').click()`));
  out.message = await c.evalIn(s, P(`return JSON.stringify({ cls: d.getElementById('msg-result').className, head: d.getElementById('msg-headline').textContent, reasons: [...d.querySelectorAll('#msg-reasons li')].length, family: !d.getElementById('msg-family').hidden && !d.getElementById('msg-family').disabled })`)).then(JSON.parse);
  await c.evalIn(s, P(`d.getElementById('msg-result').scrollIntoView({ block: 'center' })`)); await sleep(500);
  await c.shot(s, phone ? 'try-message-phone.png' : 'try-message-check.png');
  check('pasted scam message gets a stop warning with reasons and a family button', /stop/.test(out.message.cls) && /Stop/.test(out.message.head) && out.message.reasons >= 3 && out.message.family, out.message);
  await c.evalIn(s, P(`d.getElementById('msg-text').value = 'Are you coming for dinner on Saturday? Bring the photos.'; d.getElementById('msg-check').click()`));
  check('an ordinary message gets no warning', await c.evalIn(s, P(`return /ok/.test(d.getElementById('msg-result').className) && d.getElementById('msg-family').hidden`)));
  await c.evalIn(s, P(`d.getElementById('msg-text').value = ${JSON.stringify(scam)}; d.getElementById('msg-check').click(); d.getElementById('msg-family').click(); d.getElementById('msg-family').click()`)); // a double press must send one alert
  await c.waitFor(s, P(`return d.getElementById('msg-note').textContent.length > 0`), 15000);
  const alerts = await c.evalIn(s, P(`return w.__saathi.user.getIdToken()
    .then((tok) => fetch('https://firestore.googleapis.com/v1/projects/paperwork-decoder/databases/(default)/documents/groups/' + w.__saathi.group + '/alerts', { headers: { Authorization: 'Bearer ' + tok } }))
    .then((r) => r.json())
    .then((j) => JSON.stringify((j.documents || []).map((x) => Object.keys(x.fields).sort().join(',') + ' | ' + x.fields.kind.stringValue + ' | ' + x.fields.host.stringValue)));`)).then(JSON.parse);
  out.messageAlert = alerts;
  check('message alert holds only kind, host, brand, level, reasons and bookkeeping (no message text)', alerts.length === 1 && alerts[0] === 'brand,createdAt,createdBy,expiresAt,host,kind,level,reasons | message | nabilbank-kyc.top', alerts);

  // Practice round: answer "Scam" every time. Half the cards are scams, so the score must be 3 of 6, and a
  // wrong answer must show Saathi's own verdict.
  await c.evalIn(s, P(`d.getElementById('quiz-start').click()`));
  let sawReasons = false;
  for (let i = 0; i < 6; i++) {
    await c.waitFor(s, P(`return !d.getElementById('quiz-card').hidden && !d.getElementById('quiz-answers').hidden`), 5000);
    await c.evalIn(s, P(`d.getElementById('quiz-scam').click()`));
    await c.waitFor(s, P(`return !d.getElementById('quiz-reveal').hidden`), 5000);
    sawReasons ||= await c.evalIn(s, P(`return d.querySelectorAll('#quiz-reasons li').length > 0`));
    if (i === 0) {
      // Switching language while an answer is showing must change the words that are already on screen.
      await c.evalIn(s, P(`d.querySelector('[data-lang=ne]').click()`));
      out.quizNe = await c.evalIn(s, P(`return d.getElementById('quiz-result').textContent + ' | ' + d.getElementById('quiz-count').textContent + ' | ' + d.getElementById('quiz-next').textContent`));
      check('language switch mid-quiz changes the answer text already on screen', /[\u0900-\u097F]/.test(out.quizNe) && !/Right|Not quite|Message/.test(out.quizNe), out.quizNe);
      await c.evalIn(s, P(`d.querySelector('[data-lang=en]').click()`));
    }
    await c.evalIn(s, P(`d.getElementById('quiz-next').click()`));
  }
  out.quiz = await c.evalIn(s, P(`return d.getElementById('quiz-score').textContent`));
  check('practice round: six cards, scam reasons shown, score is 3 of 6 when answering "Scam" every time', out.quiz === 'You got 3 of 6.' && sawReasons, out.quiz);
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  c.close();
  process.exit(0);
}
