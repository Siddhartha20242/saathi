// The side panel shell. It shows the hosted panel page in a frame and passes requests from it to
// the open tab, and events from the tab back to it. It never passes page content anywhere except
// back to the panel frame.

// The panel is the hosted page, where App Check runs with reCAPTCHA.
// For local development, change this to http://localhost:5173/panel.html.
const PANEL_URL = 'https://paperwork-decoder.web.app/panel.html';
const PANEL_ORIGIN = new URL(PANEL_URL).origin;
const ALLOWED = new Set(['scan', 'highlight', 'recordStart', 'recordStop']);

const frame = document.getElementById('panel');
frame.src = PANEL_URL;

// While the helper is recording, pages that load later are told to keep recording.
let recording = false;

// For the test: is the on-device model also visible directly in an extension page?
(async () => {
  let status = 'not present';
  try {
    if (typeof LanguageModel !== 'undefined') status = await LanguageModel.availability();
  } catch (err) {
    status = `error: ${err.message}`;
  }
  document.getElementById('direct').textContent = `· Model seen by the extension page itself: ${status}`;
})();

async function activeTabId() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!tab?.id) throw new Error('No open tab found.');
  return tab.id;
}

// From the panel frame to the open tab.
addEventListener('message', async (ev) => {
  if (ev.origin !== PANEL_ORIGIN || ev.source !== frame.contentWindow) return;
  const msg = ev.data;
  if (!msg || msg.source !== 'saathi-panel' || !ALLOWED.has(msg.type)) return;

  const reply = (body) => frame.contentWindow.postMessage({ id: msg.id, ...body }, PANEL_ORIGIN);
  if (msg.type === 'recordStart') recording = true;
  if (msg.type === 'recordStop') recording = false;
  try {
    const result = await chrome.tabs.sendMessage(await activeTabId(), {
      saathi: msg.type,
      index: msg.index,
      stepIndex: msg.stepIndex,
    });
    if (!result) throw new Error('empty');
    if (result.error) return reply({ error: result.error });
    reply({ result });
  } catch {
    reply({ error: 'Saathi cannot read this tab. Open a normal website, reload it, and try again.' });
  }
});

// From a page's script to the panel frame.
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id || !msg) return;
  if (msg.saathi === 'hello') {
    sendResponse({ recording });
  } else if (msg.saathi === 'recorded' || msg.saathi === 'clicked') {
    frame.contentWindow?.postMessage(
      { event: msg.saathi, step: msg.step, stepIndex: msg.stepIndex },
      PANEL_ORIGIN,
    );
  }
});
