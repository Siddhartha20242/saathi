// The side panel shell. It shows the hosted panel page in a frame and passes requests from it to
// the open tab, and events from the tab back to it. It never passes page content anywhere except
// back to the panel frame.

// The panel is the hosted page, where App Check runs with reCAPTCHA.
// For local development, change this to http://localhost:5173/panel.html.
const PANEL_URL = 'https://paperwork-decoder.web.app/panel.html';
const PANEL_ORIGIN = new URL(PANEL_URL).origin;
const ALLOWED = new Set(['scan', 'highlight', 'recordStart', 'recordStop', 'setLang', 'alertSent', 'guardStatus']);

const frame = document.getElementById('panel');
frame.src = PANEL_URL;

// While the helper is recording, pages that load later in the same tab are told to keep recording. Only one
// tab records, so a click in an unrelated tab (webmail, a bank) never becomes a step.
let recording = false;
let recordingTab = null;

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
  if (msg.type === 'recordStart') {
    recording = true;
    recordingTab = await activeTabId().catch(() => null);
  }
  if (msg.type === 'recordStop') {
    recording = false;
    const was = recordingTab;
    recordingTab = null;
    // Tell the tab that was recording to stop, even if it is no longer the open one.
    if (was !== null) chrome.tabs.sendMessage(was, { saathi: 'recordStop' }).catch(() => {});
  }
  // The person's language is kept in the extension, so the warning on a page can use it even when this panel is closed.
  if (msg.type === 'setLang') {
    chrome.storage.local.set({ 'saathi:lang': ['en', 'ne', 'hi'].includes(msg.lang) ? msg.lang : 'en' });
    return reply({ result: { ok: true } });
  }
  try {
    const result = await chrome.tabs.sendMessage(await activeTabId(), {
      saathi: msg.type,
      index: msg.index,
      stepIndex: msg.stepIndex,
      info: msg.info === true,
      scanId: typeof msg.scanId === 'string' ? msg.scanId.slice(0, 40) : undefined,
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
    sendResponse({ recording: recording && sender.tab?.id === recordingTab });
  } else if (msg.saathi === 'recorded' || msg.saathi === 'clicked') {
    if (msg.saathi === 'recorded' && recordingTab !== null && sender.tab?.id !== recordingTab) return;
    frame.contentWindow?.postMessage(
      { event: msg.saathi, step: msg.step, stepIndex: msg.stepIndex },
      PANEL_ORIGIN,
    );
  } else if (msg.saathi === 'guard' || msg.saathi === 'guardAlert') {
    // The scam guard on a page: what it found, or a request to tell the family. Only the active tab counts.
    // A page in the background (a tab that finished loading behind this one) must not change or clear the warning
    // for the tab the person is looking at.
    if (!sender.tab?.active) return;
    frame.contentWindow?.postMessage({ event: msg.saathi, guard: msg.guard, alert: msg.alert }, PANEL_ORIGIN);
    sendResponse({ ok: true }); // the page can tell that the panel is open
  }
});

// When the person switches to another tab, ask that page how it looks to the guard.
chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const guard = await chrome.tabs.sendMessage(tabId, { saathi: 'guardStatus' });
    frame.contentWindow?.postMessage({ event: 'guard', guard }, PANEL_ORIGIN);
  } catch {
    frame.contentWindow?.postMessage({ event: 'guard', guard: { level: 'ok', reasons: [] } }, PANEL_ORIGIN);
  }
});
