// On the Android app (emulator or phone): record a one-step guide on the practice site, follow it, and ask a real
// question about the step in English and in Nepali. Needs the app running and the DevTools port forwarded (see android-cdp.mjs).
import { evalJs, navigate, close } from './android-cdp.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const P = (js) => `(() => { const w = document.getElementById('panel').contentWindow; const d = w.document; ${js} })()`;
const S = (js) => `(() => { const d = document.getElementById('site').contentDocument; ${js} })()`;
const until = async (js, ms = 40000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await evalJs(js).catch(() => false)) return true; await sleep(500); } return false; };

await navigate('https://paperwork-decoder.web.app/try.html'); await sleep(7000);
console.log('ready:', await until(P('return !!w.__saathi?.user')), await until(`!!document.getElementById('site').contentWindow.__saathiLoaded`));
await evalJs(P(`d.getElementById('group-new').click()`));
await until(P('return /^[A-Z0-9]{8}$/.test(w.__saathi.group)'));
await evalJs(P(`d.getElementById('rec-title').value = 'Pay the electricity bill'; d.getElementById('rec-start').click()`));
await until(P('return w.__saathi.recording === true'), 10000);
await evalJs(S(`[...d.querySelectorAll('a,button')].find((e) => e.textContent.trim() === 'Pay your bill').click()`)); await sleep(2500);
await evalJs(P(`d.getElementById('rec-save').click()`));
console.log('saved:', await until(P('return w.__saathi.paths.length > 0'), 90000));
await evalJs(P(`d.querySelector('[data-start]').click()`));
console.log('following:', await until(P(`const f = w.__saathi.follow; return !!(f && f.found)`), 25000));
const ask = async (lang, q) => {
  await evalJs(P(`d.querySelector('[data-lang="${lang}"]').click(); d.getElementById('ask-q').value = ${JSON.stringify(q)}; d.getElementById('ask-go').click()`));
  await until(P(`const o = d.getElementById('ask-out').textContent; return o.length > 0 && !/^(Thinking|सोच|सोचा)/.test(o) && !d.getElementById('ask-go').disabled`), 60000);
  return evalJs(P(`return d.getElementById('ask-out').textContent + '\\n[' + d.getElementById('ask-ran').textContent + ']'`));
};
console.log('--- English ---\n' + await ask('en', 'What does this step mean?'));
console.log('--- Nepali ---\n' + await ask('ne', 'यो चरणको अर्थ के हो?'));
console.log('--- Hindi ---\n' + await ask('hi', 'इसका क्या मतलब है?'));
await evalJs(P(`d.querySelector('footer details').open = true; d.getElementById('t-usage').click()`));
console.log('--- AI use log ---\n' + await evalJs(P(`return d.getElementById('o-usage').textContent`)));
close();
