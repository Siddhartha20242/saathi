// Starts a throwaway headless Chrome, loads the Saathi extension into it, and runs the
// panel's "Find" test on real websites. Saves screenshots next to this file.
import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const EXT = '/Users/siddharthabhattarai/saathi/extension';
const profile = join(here, 'profile');
rmSync(profile, { recursive: true, force: true });
mkdirSync(profile);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-pipe', '--enable-unsafe-extension-debugging',
    '--no-first-run', '--no-default-browser-check', '--window-size=1280,900', 'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] },
);
const toChrome = chrome.stdio[3];
const fromChrome = chrome.stdio[4];

let n = 0;
const waiting = new Map();
let buffer = '';
fromChrome.on('data', (chunk) => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) !== -1) {
    const msg = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (msg.id && waiting.has(msg.id)) {
      const { res, rej } = waiting.get(msg.id);
      waiting.delete(msg.id);
      msg.error ? rej(new Error(`${msg.error.message}`)) : res(msg.result);
    }
  }
});
const send = (method, params = {}, sessionId) =>
  new Promise((res, rej) => {
    const id = ++n;
    waiting.set(id, { res, rej });
    toChrome.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    setTimeout(() => waiting.has(id) && (waiting.delete(id), rej(new Error(`${method} timed out`))), 30000);
  });
const attach = async (targetId) => (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
const evaluate = async (sessionId, expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
  return r.result.value;
};
const shot = async (sessionId, name) => {
  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(join(here, name), Buffer.from(data, 'base64'));
};

const out = { sites: [] };
try {
  const { id: extId } = await send('Extensions.loadUnpacked', { path: EXT });
  out.extensionId = extId;

  const SITES = JSON.parse(process.argv[2]);
  for (const [i, site] of SITES.entries()) {
    const rec = { url: site.url, want: site.label, kind: site.kind };
    site.label ??= '';
    site.kind ??= 'button';
    try {
      // The website, in the active tab.
      const { targetId: siteId } = await send('Target.createTarget', { url: site.url });
      const siteS = await attach(siteId);
      await sleep(site.wait ?? 7000);
      rec.title = await evaluate(siteS, 'document.title');

      // The side panel page, opened as a background tab so the website stays the active tab.
      const { targetId: panelId } = await send('Target.createTarget', { url: `chrome-extension://${extId}/sidepanel.html`, background: true });
      const panelS = await attach(panelId);
      await sleep(5000);
      rec.shellBar = await evaluate(panelS, 'document.getElementById("bar").textContent');

      // What the extension reads from the page.
      const scan = await evaluate(
        panelS,
        `chrome.tabs.query({ active: true, lastFocusedWindow: true }).then(([t]) => chrome.tabs.sendMessage(t.id, { saathi: 'scan' }))`,
      );
      rec.controls = scan.elements.length;
      rec.sample = scan.elements.slice(0, 12).map((e) => `${e.role}: ${e.text}${e.section ? ` [${e.section}]` : ''}`);
      rec.byRole = scan.elements.reduce((m, e) => ((m[e.role] = (m[e.role] ?? 0) + 1), m), {});
      rec.noSection = scan.elements.filter((e) => !e.section).length;
      if (site.pick) {
        // Label not known in advance: choose a control from what the extension read.
        const re = new RegExp(site.pick, 'i');
        const el = scan.elements.find((e) => re.test(e.text) && (!site.role || e.role === site.role));
        if (el) {
          site.label = el.text;
          site.kind = ['field', 'select', 'checkbox'].includes(el.role) ? 'field' : 'button';
          rec.want = el.text;
          rec.kind = site.kind;
        }
      }
      rec.hasLabel = scan.elements.some((e) => e.text.toLowerCase() === site.label.toLowerCase());

      // The hosted panel inside the side panel's frame.
      const { targetInfos } = await send('Target.getTargets');
      const frame = targetInfos.find((t) => t.type === 'iframe' && t.url.includes('paperwork-decoder.web.app/panel.html'));
      if (!frame) throw new Error('panel frame not found');
      const frameS = await attach(frame.targetId);
      rec.panelWhere = await evaluate(frameS, 'document.getElementById("where").textContent');
      rec.panelModel = await evaluate(frameS, 'document.getElementById("status").textContent');

      // Use the panel exactly as a person would: type the label, choose the kind, press Find.
      await evaluate(
        frameS,
        `document.getElementById('f-label').value = ${JSON.stringify(site.label)};
         document.getElementById('f-kind').value = ${JSON.stringify(site.kind)};
         document.getElementById('t-find').click(); 'clicked'`,
      );
      await sleep(4000);
      rec.findResult = await evaluate(frameS, 'document.getElementById("o-find").textContent');
      rec.highlightBox = await evaluate(
        siteS,
        `(() => { const b = document.querySelector('[data-saathi="highlight"]'); if (!b) return null; const r = b.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })()`,
      );
      await shot(siteS, `site-${site.name}.png`);
      await shot(panelS, `panel-${site.name}.png`);
      await send('Target.closeTarget', { targetId: panelId });
      await send('Target.closeTarget', { targetId: siteId });
    } catch (err) {
      rec.error = err.message;
    }
    out.sites.push(rec);
  }
} catch (err) {
  out.error = err.message;
} finally {
  console.log(JSON.stringify(out, null, 1));
  chrome.kill();
  process.exit(0);
}
