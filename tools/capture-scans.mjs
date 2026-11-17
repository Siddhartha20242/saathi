// Saves what the extension reads on a few real public pages, so re-finding can be tested against
// them again and again without visiting the sites. Runs in a throwaway headless Chrome. It only reads.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, sleep } from './chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PAGES = {
  wiki: ['https://en.wikipedia.org/wiki/Main_Page', 7000],
  py: ['https://www.python.org/', 7000],
  nea: ['https://www.nea.org.np/', 10000],
  bd: ['https://bangladesh.gov.bd/index.php', 9000],
  wikilong: ['https://en.wikipedia.org/wiki/Nepal', 9000], // about 4,000 controls: footer links are far down the page
};
const c = await launch();
try {
  const panel = await c.open(`chrome-extension://${c.extId}/sidepanel.html`, { background: true });
  await sleep(1500);
  for (const [key, [url, wait]] of Object.entries(PAGES)) {
    const site = await c.open(url);
    await sleep(wait);
    const scan = await c.evalIn(panel.session, `chrome.tabs.query({active:true,lastFocusedWindow:true}).then(([t]) => chrome.tabs.sendMessage(t.id,{saathi:'scan'}))`);
    writeFileSync(join(here, 'real-model', 'scans', `${key}.json`), JSON.stringify({ url, title: scan.title, elements: scan.elements }, null, scan.elements.length > 300 ? 0 : 1) + '\n');
    console.log(key, scan.elements.length, 'controls');
    await c.send('Target.closeTarget', { targetId: site.targetId });
  }
} catch (e) {
  console.log('error', e.message);
}
c.close();
process.exit(0);
