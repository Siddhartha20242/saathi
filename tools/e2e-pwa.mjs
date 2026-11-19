// The hosted site as an installable, offline-capable web app: a valid manifest and icons, a service worker that
// takes control, and a page that still opens with the network switched off.

import { launch, sleep } from './chrome.mjs';

const BASE = 'https://paperwork-decoder.web.app';
const out = { checks: [] };
const check = (name, ok, detail) => out.checks.push({ name, ok: Boolean(ok), ...(detail !== undefined && { detail }) });
const c = await launch();

try {
  const t = await c.open(`${BASE}/`);
  const s = t.session;
  await sleep(3000);
  const manifest = await c.evalIn(s, `fetch('/manifest.webmanifest').then((r) => r.json())`);
  check('manifest names the app and starts standalone', manifest.name === 'Saathi' && manifest.display === 'standalone' && manifest.start_url, manifest.start_url);
  const sizes = manifest.icons.map((i) => i.sizes).join(',');
  check('icons include 192, 512 and a maskable one', /192x192/.test(sizes) && /512x512/.test(sizes) && manifest.icons.some((i) => i.purpose === 'maskable'), sizes);
  const status = await c.evalIn(s, `Promise.all(${JSON.stringify(manifest.icons.map((i) => i.src))}.map((u) => fetch(u).then((r) => r.status + ' ' + r.headers.get('content-type'))))`);
  check('every icon loads as a png', status.every((x) => /^200 image\/png/.test(x)), status);
  check('the page links the manifest', await c.evalIn(s, `!!document.querySelector('link[rel=manifest]')`));

  await c.waitFor(s, `navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))`, 20000);
  check('a service worker is active', true);
  // Visit the helper page so it is kept, then reload so the worker controls the page.
  await c.evalIn(s, `location.href = '/help.html'`);
  await sleep(4000);
  await c.evalIn(s, `location.reload()`);
  await sleep(4000);
  check('the worker controls the page after a reload', await c.evalIn(s, `!!navigator.serviceWorker.controller`));

  // Offline: the helper page and the home page must still open.
  await c.send('Network.enable', {}, s);
  await c.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, s);
  await c.evalIn(s, `location.reload()`).catch(() => {});
  await sleep(4000);
  const offline = await c.evalIn(s, `({ title: document.title, text: document.body ? document.body.innerText.slice(0, 80) : '' })`);
  check('the helper page opens with no internet', /Saathi helper/.test(offline.title), offline);
  await c.evalIn(s, `location.href = '/'`).catch(() => {});
  await sleep(4000);
  const home = await c.evalIn(s, `({ title: document.title, h1: !!document.querySelector('h1'), buttons: document.querySelectorAll('a.btn').length })`);
  check('the home page opens with no internet', /^Saathi/.test(home.title) && home.h1 && home.buttons >= 2, home);
  await c.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }, s);
} catch (err) {
  out.error = String(err?.message ?? err);
} finally {
  console.log(JSON.stringify(out, null, 1));
  await c.close();
}
