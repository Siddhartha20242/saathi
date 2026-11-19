// On the Android app: get the ready-made guide, switch to Nepali / Hindi / English with read-aloud on, and report where
// each spoken sentence came from (the AI use log lists the text-to-speech calls). Audio itself cannot be heard from here.
import { evalJs, navigate, close } from './android-cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const until = async (js, ms = 40000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evalJs(js).catch(() => false)) return true; await sleep(500); } return false; };

await navigate('https://paperwork-decoder.web.app/try.html'); await sleep(7000);
await until(P('return !!w.__saathiDemo'));
await evalJs(`document.getElementById('tour-do').click()`);
console.log('guide:', await until(P(`return d.getElementById('lib-list').children.length > 0`), 90000));
await evalJs(P(`d.getElementById('opt-speak').click()`), true);
for (const lang of ['ne', 'hi', 'en']) {
  await evalJs(P(`d.querySelector('[data-lang="${lang}"]').click()`));
  await evalJs(P(`d.getElementById('lib-list').querySelector('[data-start]').click()`), true);
  await until(P(`const f = w.__saathi.follow; return !!(f && f.found)`), 30000);
  await sleep(9000);
  const note = await evalJs(P(`return d.getElementById('read-note').textContent`));
  const text = await evalJs(P(`return d.getElementById('fo-text').textContent`));
  const sp = await evalJs(P(`return JSON.stringify(w.__saathi.lastSpeech || null)`));
  console.log(`--- ${lang} ---\nstep text: ${text}\nnote: ${note}\nlast speech: ${sp}`);
  await evalJs(P(`d.getElementById('fo-stop').click()`));
}
await evalJs(P(`d.querySelector('footer details').open = true; d.getElementById('t-usage').click()`));
console.log('--- AI use log ---\n' + await evalJs(P(`return d.getElementById('o-usage').textContent`)));
close();
