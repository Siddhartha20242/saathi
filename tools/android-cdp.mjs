// Drives the Saathi Android app's WebView over Chrome DevTools. The emulator or phone must be running the app and
// `adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>` must be set. Usage: node android-cdp.mjs '<js>'.
const targets = await fetch('http://localhost:9222/json').then((r) => r.json());
const page = targets.find((t) => t.type === 'page');
if (!page) throw new Error('no page in the app');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let n = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
const send = (method, params = {}) => new Promise((res) => { const id = ++n; pending.set(id, res); ws.send(JSON.stringify({ id, method, params })); });
export const evalJs = async (expression, userGesture = false) => {
  const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture });
  if (m.result?.exceptionDetails) throw new Error(m.result.exceptionDetails.exception?.description ?? 'error');
  return m.result?.result?.value;
};
export const navigate = (url) => send('Page.navigate', { url });
export const close = () => ws.close();
if (process.argv[2]) {
  console.log(JSON.stringify(await evalJs(process.argv[2]), null, 1));
  close();
}
