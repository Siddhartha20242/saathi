// An automated accessibility audit (axe-core, WCAG 2 A and AA rules) of the live pages in light and dark mode.
// Automated checks find about a third of real problems, so a pass here is not a claim of full accessibility.

import { readFileSync } from 'node:fs';
import { launch, sleep } from './chrome.mjs';

const AXE = readFileSync(new URL('../node_modules/axe-core/axe.min.js', import.meta.url), 'utf8');
const BASE = process.env.BASE || 'https://paperwork-decoder.web.app';
const out = { pages: [] };
const c = await launch();

const run = async (s, scheme) => {
  await c.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] }, s);
  await sleep(500);
  await c.evalIn(s, AXE);
  return c.evalIn(s, `axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }).then((r) => ({ passes: r.passes.length, incomplete: r.incomplete.map((i) => i.id), violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length, sample: v.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\\n').slice(1, 3).join(' ').slice(0, 160)) })) }))`);
};

try {
  const pages = [
    ['home', '/', null],
    ['tour (try)', '/try.html', null],
    ['panel, before joining', '/panel.html', null],
    ['panel, joined (help tab)', '/panel.html', `document.getElementById('group-new').click(); await new Promise((r) => setTimeout(r, 3000)); document.getElementById('sec-next').hidden = true; document.getElementById('tab-help').click();`],
    ['helper page', '/help.html', null],
  ];
  for (const [name, path, prep] of pages) {
    const t = await c.open(BASE + path);
    const s = t.session;
    await sleep(5000);
    if (prep) {
      await c.waitFor(s, `!!window.__saathi?.user`, 40000);
      await c.evalIn(s, `(async () => { ${prep} })()`);
      await sleep(2000);
    }
    const entry = { page: name };
    for (const scheme of ['light', 'dark']) entry[scheme] = await run(s, scheme);
    out.pages.push(entry);
  }
} catch (err) {
  out.error = String(err?.message ?? err);
} finally {
  console.log(JSON.stringify(out, null, 1));
  await c.close();
}
