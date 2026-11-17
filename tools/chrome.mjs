// Starts a throwaway headless Chrome with the Saathi extension loaded and lets a script drive it.
// Nothing here touches the real browser or its profile.

import { spawn } from 'node:child_process';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ extensionPath = join(here, '..', 'extension') } = {}) {
  const profile = join(here, 'profile');
  rmSync(profile, { recursive: true, force: true });
  mkdirSync(profile);

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
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
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
  const evalIn = async (session, expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, session);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
    return r.result.value;
  };

  const { id: extId } = await send('Extensions.loadUnpacked', { path: extensionPath });

  return {
    extId,
    send,
    sleep,
    evalIn,
    /** Opens a tab and returns its session. Pass background:true to keep another tab in front. */
    async open(url, { background = false } = {}) {
      const { targetId } = await send('Target.createTarget', { url, background });
      return { targetId, session: await attach(targetId) };
    },
    /** The session of an iframe whose address contains `match`. */
    async frame(match) {
      const { targetInfos } = await send('Target.getTargets');
      const info = targetInfos.find((t) => t.type === 'iframe' && t.url.includes(match));
      if (!info) throw new Error(`frame not found: ${match}`);
      return attach(info.targetId);
    },
    /** Polls until the expression is truthy. Returns its value, or throws after timeoutMs. */
    async waitFor(session, expression, timeoutMs = 20000) {
      const stop = Date.now() + timeoutMs;
      let last;
      while (Date.now() < stop) {
        try {
          last = await evalIn(session, expression);
          if (last) return last;
        } catch (err) {
          last = err.message;
        }
        await sleep(400);
      }
      throw new Error(`timed out waiting for ${expression} (last: ${JSON.stringify(last)})`);
    },
    async shot(session, file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' }, session);
      writeFileSync(join(here, file), Buffer.from(data, 'base64'));
    },
    close: () => {
      chrome.kill();
    },
  };
}
