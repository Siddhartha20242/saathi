// The page shown inside the extension's side panel. It is an ordinary hosted web page, so
// Firebase AI Logic, App Check, Auth, Firestore and Remote Config work here as on the web.
// The extension around it only reads the open tab's controls and draws the highlight.

import { run, deviceStatus, getUsage, synthesize } from './firebase.js';
import { refind, codeFind, cloudPreview } from './refind.js';
import { isPersonalControl, isPersonalText, maskText } from './masking.js';
import { recordSpeech } from './audio.js';
import { voicePrompt, parseVoice, VOICE_SCHEMA } from './voice.js';
import { warning, messageWarning } from './guardText.js';
import { assessMessage } from './messageCheck.js';
import { buildRound, quizText } from './quiz.js';
import { alertsForMe, alertSentence } from './alerts.js';
import { explainPrompt, explainPayloadSummary } from './explain.js';
import {
  sanitizeStep, sameStep, stepInstruction, originMatches, validatePath, newGroupCode, normaliseGroup, inviteText, joinCodeFrom, GROUP_RE, LANGS, MAX_STEPS,
} from './path.js';
import { chooseVoice } from './speech.js';
import { planSpeech, deviceFallback, spokenText, ttsPrompt, playable, isQuotaError, BLOCK_HOURS, TTS_VOICE, TTS_LANGUAGE } from './tts.js';
import { whereIs } from './where.js';
import { plainError } from './plainError.js';
import { askMode, askPrompt, cleanQuestion, cleanAnswer } from './ask.js';
import { controlsForHelp, helpPreview, cleanTitle } from './help.js';
import {
  ensureUser, loadConfig, savePath, listPaths, deletePath, translatePath, createHelp, watchHelp, closeHelp,
  createAlert, watchAlerts, createCheckin, cleanUpOwn,
} from './backend.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const framed = window.parent !== window;
if (joinCodeFrom(location.search)) store.set('saathi:group', joinCodeFrom(location.search));
const demoFlag = new URLSearchParams(location.search).has('demo');
const parentOrigin = !framed
  ? ''
  : location.ancestorOrigins?.[0] || (demoFlag ? location.origin : '');
const inExtension = parentOrigin.startsWith('chrome-extension://');
// Demo mode: the hosted try page (same website) stands in for the extension.
const inDemo = framed && demoFlag && parentOrigin === location.origin;
const bridged = inExtension || inDemo;

const state = {
  group: joinCodeFrom(location.search) || store.get('saathi:group') || '',
  user: null,
  config: { cloudEnabled: true, maxLabels: 60, languages: ['ne', 'hi'], source: 'default' },
  device: 'checking',
  recording: false,
  steps: [],
  paths: [],
  follow: null,
  done: false,
  lang: store.get('saathi:lang') || 'en',
  big: store.get('saathi:big') === '1',
  cloudVoice: store.get('saathi:cloudVoice') !== '0',
  speak: false,
};
window.__saathi = state; // read by the end-to-end test

$('where').textContent = inExtension
  ? 'Running inside the extension side panel.'
  : inDemo
    ? 'Demo mode: this page stands in for the Chrome extension, using the same code.'
    : 'Running as a normal page. Recording and following need the extension.';

function say(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `out ${kind}`;
}

// ---------- Talking to the extension ----------

let nextId = 1;
const waiting = new Map();

addEventListener('message', (ev) => {
  if (!bridged || ev.source !== window.parent || ev.origin !== parentOrigin) return;
  const msg = ev.data;
  if (!msg || typeof msg !== 'object') return;
  if (msg.event) return onPageEvent(msg);
  if (!waiting.has(msg.id)) return;
  const { resolve, reject } = waiting.get(msg.id);
  waiting.delete(msg.id);
  if (msg.error) reject(new Error(msg.error));
  else resolve(msg.result);
});

function callExtension(type, payload = {}) {
  if (!bridged) return Promise.reject(new Error('Open this panel from the Saathi extension, or from the try page, to use this.'));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    waiting.set(id, { resolve, reject });
    window.parent.postMessage({ source: 'saathi-panel', id, type, ...payload }, parentOrigin);
    setTimeout(() => {
      if (!waiting.has(id)) return;
      waiting.delete(id);
      reject(new Error('The page did not answer. Reload the tab and try again.'));
    }, 8000);
  });
}

function onPageEvent(msg) {
  if (msg.event === 'guard') renderGuard(msg.guard);
  if (msg.event === 'guardAlert') tellFamily(msg.alert);
  if (msg.event === 'recorded' && state.recording) addRecorded(msg.step);
  if (msg.event === 'clicked' && state.follow && msg.stepIndex === state.follow.index) {
    // Let the next page load, then go on, but only if the person is still on the same step of the same guide.
    const f = state.follow;
    const i = f.index;
    setTimeout(() => {
      if (state.follow === f && f.index === i) nextStep();
    }, 1200);
  }
}

// ---------- Header ----------

function renderChips() {
  const joined = Boolean(state.group) && !state.switching;
  document.body.dataset.joined = String(joined);
  $('groupbar').hidden = !state.group || state.switching;
  $('group-now').textContent = state.group;
  $('sec-group').hidden = joined;
  $('group-cancel').hidden = !(state.switching && state.group);
  const model = $('chip-model');
  model.textContent = `On-device model: ${state.device}`;
  $('dot-model').className = `dot ${state.device === 'available' ? 'ok' : 'off'}`;
  $('chip-cloud').textContent = state.config.cloudEnabled ? 'Cloud: on, labels only' : 'Cloud: switched off';
  $('dot-cloud').className = `dot ${state.config.cloudEnabled ? 'ok' : 'off'}`;
  document.body.classList.toggle('big', state.big);
  $('opt-big').setAttribute('aria-pressed', String(state.big));
  $('opt-voice').setAttribute('aria-pressed', String(state.cloudVoice));
  $('opt-speak').setAttribute('aria-pressed', String(state.speak));
  // Speaking needs a microphone and the cloud, because the on-device model does not understand Nepali speech.
  $('voice').hidden = !(joined && navigator.mediaDevices?.getUserMedia && state.config.cloudEnabled);
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === state.lang)));
}

// ---------- Tabs ----------

const TABS = ['follow', 'record', 'help'];
function showTab(name) {
  state.tab = name;
  for (const t of TABS) {
    $(`tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`panel-${t}`).hidden = t !== name;
  }
}
TABS.forEach((t) => $(`tab-${t}`).addEventListener('click', () => showTab(t)));
$('tab-follow').closest('.tabs').addEventListener('keydown', (ev) => {
  const at = TABS.indexOf(state.tab ?? 'follow');
  const next = ev.key === 'ArrowRight' ? at + 1 : ev.key === 'ArrowLeft' ? at - 1 : null;
  if (next === null) return;
  const name = TABS[(next + TABS.length) % TABS.length];
  showTab(name);
  $(`tab-${name}`).focus();
});

// ---------- Group ----------

async function setGroup(code) {
  state.switching = false;
  state.group = code;
  store.set('saathi:group', code);
  $('group-code').value = '';
  $('g-enter').hidden = true;
  $('g-choose').hidden = false;
  renderChips();
  renderTell();
  renderMessage();
  watchFamilyAlerts();
  cleanUpOwn(code).catch(() => {}); // remove this person's own expired records
  await refreshLibrary();
}

$('group-switch').addEventListener('click', () => {
  state.switching = true;
  renderChips();
  $('g-have').focus();
});
$('group-cancel').addEventListener('click', () => {
  state.switching = false;
  renderChips();
});
$('group-copy').addEventListener('click', async (ev) => {
  const button = ev.currentTarget;
  try {
    await navigator.clipboard.writeText(state.group);
    button.textContent = 'Copied';
  } catch {
    button.textContent = state.group; // no clipboard here: show the code to read out
  }
  setTimeout(() => (button.textContent = 'Copy'), 2000);
});
$('group-invite').addEventListener('click', async (ev) => {
  const button = ev.currentTarget;
  const text = inviteText(state.group, location.origin);
  try {
    if (navigator.share) await navigator.share({ text });
    else await navigator.clipboard.writeText(text);
    button.textContent = navigator.share ? 'Shared' : 'Copied';
  } catch (err) {
    if (err?.name === 'AbortError') return;
    say('group-msg', text); // nothing to share or copy with here: show it to read out
    $('sec-group').hidden = false;
  }
  setTimeout(() => (button.textContent = 'Invite'), 2000);
});
$('g-have').addEventListener('click', () => {
  $('g-choose').hidden = true;
  $('g-enter').hidden = false;
  $('group-code').focus();
});
$('g-back').addEventListener('click', () => {
  $('g-enter').hidden = true;
  $('g-choose').hidden = false;
  say('group-msg', '');
});
$('group-new').addEventListener('click', async () => {
  const shown = !store.get('saathi:welcomed');
  const done = setGroup(newGroupCode()); // the library may take a moment to load: do not wait for it
  if (shown) $('sec-next').hidden = false;
  await done;
});
$('next-ok').addEventListener('click', () => {
  store.set('saathi:welcomed', '1');
  $('sec-next').hidden = true;
});
$('group-join').addEventListener('click', () => {
  const code = normaliseGroup($('group-code').value);
  if (!GROUP_RE.test(code)) return say('group-msg', 'A family code has 8 letters and numbers, for example K7M2QX4P.', 'bad');
  setGroup(code);
});

// ---------- Ask about this step ----------

const ASK = {
  en: { label: 'Ask about this step', ph: 'For example: What does this mean?', go: 'Ask', privacy: 'Sent: the step, the guide name and your question. Never the page.', empty: 'Type your question.', wait: 'Thinking…', ranDevice: 'Answered on this computer. Nothing was sent.', ranCloud: 'Answered in the cloud. Only the step, the guide name and your question were sent.', needsCloud: 'Nepali and Hindi answers need the cloud, and it is switched off. Try English.', noModel: 'No model is available right now. Ask your family.', fail: 'Could not answer. Ask your family.' },
  ne: { label: 'यो चरणबारे सोध्नुहोस्', ph: 'जस्तै: यसको अर्थ के हो?', go: 'सोध्नुहोस्', privacy: 'पठाइने कुरा: चरण, गाइडको नाम र तपाईंको प्रश्न। पेज कहिल्यै होइन।', empty: 'आफ्नो प्रश्न लेख्नुहोस्।', wait: 'सोच्दै छ…', ranDevice: 'यही कम्प्युटरमा उत्तर आयो। केही पठाइएन।', ranCloud: 'क्लाउडमा उत्तर आयो। चरण, गाइडको नाम र तपाईंको प्रश्न मात्र पठाइयो।', needsCloud: 'नेपाली उत्तरका लागि क्लाउड चाहिन्छ, र त्यो बन्द छ। अंग्रेजी प्रयोग गर्नुहोस्।', noModel: 'अहिले कुनै मोडेल उपलब्ध छैन। परिवारलाई सोध्नुहोस्।', fail: 'उत्तर दिन सकिएन। परिवारलाई सोध्नुहोस्।' },
  hi: { label: 'इस चरण के बारे में पूछिए', ph: 'जैसे: इसका क्या मतलब है?', go: 'पूछिए', privacy: 'भेजा जाएगा: चरण, गाइड का नाम और आपका सवाल। पेज कभी नहीं।', empty: 'अपना सवाल लिखिए।', wait: 'सोच रहा है…', ranDevice: 'इसी कंप्यूटर पर जवाब आया। कुछ नहीं भेजा गया।', ranCloud: 'क्लाउड में जवाब आया। सिर्फ़ चरण, गाइड का नाम और आपका सवाल भेजा गया।', needsCloud: 'हिन्दी जवाब के लिए क्लाउड चाहिए, और वह बंद है। अंग्रेज़ी आज़माइए।', noModel: 'अभी कोई मॉडल उपलब्ध नहीं है। परिवार से पूछिए।', fail: 'जवाब नहीं दे सका। परिवार से पूछिए।' },
};

function renderAskLabels() {
  const a = ASK[state.lang] ?? ASK.en;
  $('ask-label').textContent = a.label;
  $('ask-q').placeholder = a.ph;
  $('ask-go').textContent = a.go;
  $('ask-privacy').textContent = a.privacy;
}

$('ask-go').addEventListener('click', async (ev) => {
  const f = state.follow;
  const a = ASK[state.lang] ?? ASK.en;
  const btn = ev.currentTarget;
  if (!f) return;
  const question = cleanQuestion($('ask-q').value);
  if (!question) return say('ask-out', a.empty, 'bad');
  const pick = askMode(state.lang, { cloudEnabled: state.config.cloudEnabled, deviceAvailable: state.device === 'available' });
  if (!pick.mode) return say('ask-out', pick.why === 'needs-cloud' ? a.needsCloud : a.noModel, 'bad');
  const index = f.index;
  btn.disabled = true;
  $('ask-ran').textContent = '';
  say('ask-out', a.wait, '');
  try {
    const step = stepInstruction(f.path.steps[index]);
    const prompt = askPrompt({ lang: state.lang, title: cleanTitle(f.path.title, ''), step, question });
    const res = await run({ mode: pick.mode, prompt });
    if (state.follow !== f || f.index !== index) return; // the person moved on
    const text = cleanAnswer(res.text);
    if (!text) return say('ask-out', a.fail, 'bad');
    say('ask-out', text, 'ok');
    $('ask-ran').textContent = res.source === 'ON_DEVICE' ? a.ranDevice : res.source === 'IN_CLOUD' ? a.ranCloud : '';
    if (state.speak) speak(text, state.lang);
  } catch {
    say('ask-out', a.fail, 'bad');
  } finally {
    btn.disabled = false;
  }
});
$('ask-q').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') $('ask-go').click();
});

// ---------- Where is…? ----------

function renderWhereLabels() {
  const w = WHERE[state.lang] ?? WHERE.en;
  $('where-label').textContent = w.label;
  $('where-q').placeholder = w.ph;
  $('where-go').textContent = w.go;
}

async function pointAtIndex(page, index, text) {
  const w = WHERE[state.lang] ?? WHERE.en;
  $('where-pick').innerHTML = '';
  try {
    await callExtension('highlight', { index, scanId: page.scanId, info: true });
    say('where-out', w.found(text), 'ok');
    if (state.speak) speak(w.found(text), state.lang);
  } catch (err) {
    say('where-out', err.message || w.fail, 'bad');
  }
}

$('where-go').addEventListener('click', async (ev) => {
  const w = WHERE[state.lang] ?? WHERE.en;
  const q = $('where-q').value;
  if (!q.trim()) return say('where-out', w.empty, 'bad');
  const btn = ev.currentTarget; // ev.currentTarget is empty once the handler has awaited
  btn.disabled = true;
  $('where-pick').innerHTML = '';
  try {
    const page = await callExtension('scan');
    const res = whereIs(q, page.elements);
    if (res.verdict === 'found') return await pointAtIndex(page, res.index, page.elements[res.index].text);
    if (res.verdict === 'none') return say('where-out', w.none, 'bad');
    say('where-out', w.several, '');
    $('where-pick').innerHTML = res.matches
      .map((m) => `<button data-i="${m.index}">${esc(m.text)}${m.section ? ` · ${esc(m.section)}` : ''}</button>`)
      .join('');
    $('where-pick').onclick = (e) => {
      const i = e.target.closest('[data-i]')?.dataset.i;
      if (i !== undefined) pointAtIndex(page, Number(i), page.elements[Number(i)].text);
    };
  } catch (err) {
    say('where-out', err.message || w.fail, 'bad');
  } finally {
    btn.disabled = false;
  }
});
$('where-q').addEventListener('keydown', (ev) => {
  if (ev.key === 'Enter') $('where-go').click();
});

// ---------- Library ----------

async function refreshLibrary() {
  const list = $('lib-list');
  if (!state.group) {
    list.innerHTML = '';
    return say('lib-msg', 'Join or start a family to see its guides.');
  }
  say('lib-msg', 'Loading guides…');
  try {
    state.paths = await listPaths(state.group);
    const fromCache = state.paths.some((p) => p.fromCache);
    list.innerHTML = state.paths
      .map((p) => {
        const langs = Object.keys(p.translations ?? {}).map((l) => LANGS[l]);
        return `<li class="path">
          <div class="info"><div class="title">${esc(p.title)}</div>
            <div class="meta">${esc(p.host)} · ${p.steps.length} steps${langs.length ? ` · ${esc(langs.join(', '))}` : ''}</div></div>
          <div class="go"><button class="primary" data-start="${esc(p.id)}">Start</button>${
            p.mine ? `<button class="quiet small" data-delete="${esc(p.id)}">Delete</button>` : ''
          }</div></li>`;
      })
      .join('');
    say(
      'lib-msg',
      state.paths.length
        ? fromCache
          ? 'Showing the copy saved on this laptop. It updates when you are online.'
          : ''
        : 'No guides for this family yet. Open "Make a guide" to make the first one.',
    );
  } catch (err) {
    say('lib-msg', `Could not load guides. ${plainError(err)}`, 'bad');
  }
}

$('lib-refresh').addEventListener('click', refreshLibrary);
$('lib-list').addEventListener('click', async (ev) => {
  const start = ev.target.dataset?.start;
  const del = ev.target.dataset?.delete;
  if (start) return startFollow(state.paths.find((p) => p.id === start));
  if (del && confirm('Delete this path for everyone in the group?')) {
    try {
      await deletePath(state.group, del);
      await refreshLibrary();
    } catch (err) {
      say('lib-msg', `Could not delete. ${plainError(err)}`, 'bad');
    }
  }
});

// ---------- Scam guard ----------
// The page script decides, on this computer, whether the page in front of the person looks like a scam.
// This panel shows what it found, and sends a family alert when the person presses the button.

let guardNow = null;
let lastGuardSpoken = '';
let alertsStop = null;
let allAlerts = [];
const SEEN_KEY = 'saathi:seenAlerts';
const seenAlerts = () => {
  try {
    return JSON.parse(store.get(SEEN_KEY) || '[]');
  } catch {
    return [];
  }
};

function renderGuard(g) {
  guardNow = g && g.level && g.level !== 'ok' ? g : null;
  const box = $('guard');
  if (!guardNow) {
    box.hidden = true;
    return;
  }
  const w = warning(guardNow, state.lang);
  const spokenKey = `${guardNow.level}|${guardNow.host}|${state.lang}`;
  if (state.speak && spokenKey !== lastGuardSpoken) {
    lastGuardSpoken = spokenKey;
    speak([w.headline, ...w.reasons].join(' '), state.lang);
  }
  box.className = `guard ${guardNow.level}`;
  box.hidden = false;
  $('guard-headline').textContent = w.headline;
  $('guard-reasons').innerHTML = w.reasons.map((r) => `<li>${esc(r)}</li>`).join('');
  const button = $('guard-family');
  button.hidden = guardNow.level !== 'stop';
  button.textContent = state.group ? w.family : `${w.family} (join a group first)`;
  button.disabled = !state.group;
  say('guard-msg', '');
}

let lastPageAlert = { host: '', at: 0 };
async function tellFamily(data) {
  // An alert sent from the page's bar: one per website per minute, so a page cannot flood the family with alerts.
  if (data) {
    if (data.host === lastPageAlert.host && Date.now() - lastPageAlert.at < 60000) return;
    lastPageAlert = { host: data.host, at: Date.now() };
  }
  const alert = data ?? (guardNow && { host: guardNow.host, brand: guardNow.brand ?? '', level: guardNow.level, reasons: guardNow.reasons.map((r) => r.code) });
  if (!alert) return;
  if (!state.group) return say('guard-msg', 'Join a family first.', 'bad');
  try {
    await createAlert(state.group, alert);
    say('guard-msg', warning({ level: 'stop', reasons: [] }, state.lang).sent, 'ok');
    await callExtension('alertSent').catch(() => {});
  } catch (err) {
    say('guard-msg', `Could not tell your family. ${plainError(err)}`, 'bad');
  }
}
$('guard-family').addEventListener('click', () => tellFamily());

function renderFamilyAlert() {
  const box = $('family-alert');
  const list = alertsForMe(allAlerts, state.user?.uid, seenAlerts());
  if (!list.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  box.dataset.ids = list.map((a) => a.id).join(',');
  $('family-alert-text').textContent = alertSentence(list[0]) + (list.length > 1 ? ` (${list.length - 1} more)` : '');
}
$('family-alert-ok').addEventListener('click', () => {
  const ids = ($('family-alert').dataset.ids || '').split(',').filter(Boolean);
  store.set(SEEN_KEY, JSON.stringify([...seenAlerts(), ...ids].slice(-50)));
  renderFamilyAlert();
});

function watchFamilyAlerts() {
  alertsStop?.();
  alertsStop = null;
  allAlerts = [];
  renderFamilyAlert();
  if (!state.group || !state.user) return;
  alertsStop = watchAlerts(state.group, (list) => {
    allAlerts = list;
    renderFamilyAlert();
  }, () => {});
}

// ---------- Checking a pasted message ----------
// Plain code on this computer. The message is never sent. Telling the family sends only the link's
// address (if any), the brand it imitates and reason codes, and only when the person presses the button.

let msgNow = null;
let msgSentFor = ''; // the text a family alert was already sent for, so pressing a button twice cannot send two
let msgSending = false;

function renderMessage() {
  const box = $('msg-result');
  if (!msgNow) {
    box.hidden = true;
    $('msg-clear').hidden = true;
    return;
  }
  const w = messageWarning(msgNow, state.lang);
  box.className = `guard inline ${msgNow.level}`;
  box.hidden = false;
  $('msg-clear').hidden = false;
  $('msg-read').hidden = false;
  $('msg-headline').textContent = w.headline;
  $('msg-reasons').innerHTML = w.reasons.map((r) => `<li>${esc(r)}</li>`).join('');
  const button = $('msg-family');
  button.hidden = msgNow.level !== 'stop' || Boolean(msgNow.sent);
  button.textContent = state.group ? w.family : `${w.family} (join a group first)`;
  button.disabled = !state.group || msgSending;
  const note = [msgNow.sent ? w.sent : '', msgNow.truncated ? w.truncated : ''].filter(Boolean).join(' ');
  $('msg-note').textContent = note;
  $('msg-note').className = `out${msgNow.sent ? ' ok' : ''}`;
}

$('msg-check').addEventListener('click', () => {
  const text = $('msg-text').value;
  if (!text.trim()) {
    msgNow = null;
    renderMessage();
    $('msg-result').hidden = false;
    $('msg-result').className = 'guard inline ok';
    $('msg-headline').textContent = messageWarning({ level: 'ok', reasons: [] }, state.lang).empty;
    $('msg-reasons').innerHTML = '';
    $('msg-family').hidden = true;
    $('msg-read').hidden = true;
    $('msg-note').textContent = '';
    announce($('msg-headline').textContent);
    return;
  }
  msgNow = assessMessage(text);
  msgNow.sent = text === msgSentFor;
  renderMessage();
  $('msg-result').focus();
  announce(`${$('msg-headline').textContent} ${[...document.querySelectorAll('#msg-reasons li')].map((li) => li.textContent).join(' ')}`);
  if (state.speak) readMessageResult();
});

function readMessageResult() {
  if (!msgNow) return;
  const w = messageWarning(msgNow, state.lang);
  speak([w.headline, ...w.reasons].join(' '), state.lang);
}
$('msg-read').addEventListener('click', readMessageResult);

$('msg-clear').addEventListener('click', () => {
  $('msg-text').value = '';
  msgNow = null;
  renderMessage();
  $('msg-text').focus();
});

$('msg-family').addEventListener('click', async () => {
  if (!msgNow || !state.group || msgSending || msgNow.sent) return;
  const w = messageWarning(msgNow, state.lang);
  const text = $('msg-text').value;
  msgSending = true;
  $('msg-family').disabled = true;
  try {
    await createAlert(state.group, { kind: 'message', host: msgNow.host || 'message', brand: msgNow.brand ?? '', level: msgNow.level, reasons: msgNow.reasons.map((r) => r.code) });
    msgSentFor = text;
    if (msgNow) msgNow.sent = true;
    msgSending = false;
    renderMessage();
    announce(w.sent);
    $('msg-result').focus();
  } catch (err) {
    msgSending = false;
    renderMessage();
    $('msg-note').textContent = `Could not tell your family. ${plainError(err)}`;
    $('msg-note').className = 'out bad';
  }
});

// ---------- Practice: spot the scam ----------
// Made-up messages. The person answers, then sees Saathi's own verdict and reasons. Nothing is saved or sent.

const quiz = { round: [], index: 0, right: 0, answered: false, view: null };

function renderQuizStatic() {
  const t = quizText(state.lang);
  renderQuizView(t);
  $('quiz-title').textContent = t.title;
  $('quiz-intro').textContent = t.intro;
  $('quiz-start').textContent = quiz.round.length ? t.again : t.start;
  $('quiz-ask').textContent = t.ask;
  $('quiz-scam').textContent = t.scam;
  $('quiz-fine').textContent = t.fine;
}

// Everything in the quiz that is words, drawn again from the saved state, so a language switch changes it all.
function renderQuizView(t) {
  const v = quiz.view;
  if (!v) return;
  if (v.phase === 'card' || v.phase === 'reveal') $('quiz-count').textContent = t.card(quiz.index + 1, quiz.round.length);
  if (v.phase === 'reveal') {
    $('quiz-result').textContent = `${v.correct ? t.right : t.wrong} ${v.card.scam ? t.isScam : t.isFine}`;
    const w = messageWarning(assessMessage(v.card.text), state.lang);
    $('quiz-reasons').innerHTML = v.card.scam ? w.reasons.map((r) => `<li>${esc(r)}</li>`).join('') : '';
    $('quiz-next').textContent = quiz.index + 1 >= quiz.round.length ? t.finish : t.next;
  }
  if (v.phase === 'score') $('quiz-score').textContent = t.score(quiz.right, quiz.round.length);
}

function showQuizCard() {
  quiz.view = { phase: 'card' };
  const t = quizText(state.lang);
  const card = quiz.round[quiz.index];
  quiz.answered = false;
  $('quiz-card').hidden = false;
  $('quiz-reveal').hidden = true;
  $('quiz-answers').hidden = false;
  $('quiz-score').textContent = '';
  $('quiz-count').textContent = t.card(quiz.index + 1, quiz.round.length);
  $('quiz-text').textContent = card.text;
  $('quiz-scam').focus();
}

$('quiz-start').addEventListener('click', () => {
  quiz.round = buildRound();
  quiz.index = 0;
  quiz.right = 0;
  $('quiz-score').textContent = '';
  $('quiz-start').hidden = true;
  showQuizCard();
  renderQuizStatic();
});

function answerQuiz(saidScam) {
  if (quiz.answered) return;
  quiz.answered = true;
  const t = quizText(state.lang);
  const card = quiz.round[quiz.index];
  const verdict = assessMessage(card.text);
  const correct = saidScam === card.scam;
  if (correct) quiz.right++;
  const w = messageWarning(verdict, state.lang);
  quiz.view = { phase: 'reveal', correct, card };
  $('quiz-answers').hidden = true;
  $('quiz-reveal').hidden = false;
  $('quiz-result').className = `out ${correct ? 'ok' : 'bad'}`;
  renderQuizView(t);
  $('quiz-next').focus();
  announce(`${$('quiz-result').textContent} ${card.scam ? w.reasons.join(' ') : ''}`);
  if (state.speak) speak(`${$('quiz-result').textContent} ${card.scam ? w.reasons.join(' ') : ''}`, state.lang);
}
$('quiz-scam').addEventListener('click', () => answerQuiz(true));
$('quiz-fine').addEventListener('click', () => answerQuiz(false));

$('quiz-next').addEventListener('click', () => {
  const t = quizText(state.lang);
  quiz.index++;
  if (quiz.index >= quiz.round.length) {
    $('quiz-card').hidden = true;
    $('quiz-start').hidden = false;
    quiz.view = { phase: 'score' };
    renderQuizStatic();
    $('quiz-score').className = 'out ok';
    announce($('quiz-score').textContent);
    $('quiz-start').focus();
    return;
  }
  showQuizCard();
});

renderQuizStatic();

// ---------- Speaking a request ----------
// The recording and the titles of the group's paths go to the cloud model, which says which path is
// wanted. It starts only when the person presses the button, and nothing from the website is sent.

const voice = { busy: false, stop: null };
const VOICE_LABEL = { idle: 'Speak · बोल्नुहोस्', listening: 'Listening… tap when you are done', thinking: 'Understanding…' };
const voiceUi = (name) => {
  $('voice-go').dataset.state = name;
  $('voice-label').textContent = VOICE_LABEL[name];
};

function voiceError(err) {
  if (err?.name === 'NotAllowedError') {
    if (inExtension) {
      $('voice-perm').href = `${parentOrigin}/mic.html`;
      $('voice-perm').hidden = false;
    }
    return 'The microphone is blocked. Allow it for this page, then tap Speak again.';
  }
  if (err?.name === 'NotFoundError') return 'No microphone was found on this computer.';
  return `I could not understand that. ${plainError(err)}`;
}

$('voice-go').addEventListener('click', async () => {
  if (voice.busy) return voice.stop?.(); // tapping again ends the recording
  if (!state.paths.length) return say('voice-out', 'There are no guides for this family yet. Open "Make a guide" to make the first one.', 'bad');
  voice.busy = true;
  voiceUi('listening');
  $('voice-perm').hidden = true;
  say('voice-out', '');
  try {
    const wav = await recordSpeech({ maxMs: 8000, stop: new Promise((resolve) => (voice.stop = resolve)) });
    if (!wav) return say('voice-out', 'I did not hear anything. Tap and try again.', 'bad');
    voiceUi('thinking');
    const { text } = await run({ mode: 'ONLY_IN_CLOUD', prompt: voicePrompt(state.paths), audio: wav, schema: VOICE_SCHEMA });
    const answer = parseVoice(text, state.paths.length);
    const heard = answer.heard
      ? `I heard: \u201c${answer.heard}\u201d${answer.english && answer.english !== answer.heard ? ` (${answer.english})` : ''}`
      : '';
    if (answer.index === null) {
      return say('voice-out', `${heard ? `${heard}\n` : ''}I could not match that to one of your guides. Tap and try again, or choose from the list.`, 'bad');
    }
    const path = state.paths[answer.index];
    say('voice-out', `${heard}\nStarting \u201c${path.title}\u201d.`, 'ok');
    voice.busy = false; // show the button as ready now, not after the first step has been found
    voiceUi('idle');
    await startFollow(path);
  } catch (err) {
    say('voice-out', voiceError(err), 'bad');
  } finally {
    voice.busy = false;
    voiceUi('idle');
  }
});

// ---------- Recording ----------

function renderSteps() {
  $('rec-steps').innerHTML = state.steps
    .map(
      (s, i) => `<li>${esc(s.role)}: <b>${esc(s.text || '(personal label, hidden)')}</b>
        <span class="muted">${esc(s.page)}</span> <button class="quiet" data-remove="${i}">Remove</button></li>`,
    )
    .join('');
}

function addRecorded(raw) {
  const step = sanitizeStep(raw);
  if (sameStep(state.steps[state.steps.length - 1], step)) return;
  if (state.steps.length >= MAX_STEPS) return say('rec-msg', `That is ${MAX_STEPS} steps, the most one guide can have.`, 'bad');
  state.steps.push(step);
  renderSteps();
}

$('rec-steps').addEventListener('click', (ev) => {
  const i = ev.target.dataset?.remove;
  if (i === undefined) return;
  state.steps.splice(Number(i), 1);
  renderSteps();
});

function recordingUi(on) {
  state.recording = on;
  $('rec-start').hidden = on;
  $('rec-save').hidden = !on;
  $('rec-cancel').hidden = !on;
  $('rec-title').disabled = on;
}

$('rec-start').addEventListener('click', async () => {
  if (!state.group) return say('rec-msg', 'Join or start a family first.', 'bad');
  if (!$('rec-title').value.trim()) return say('rec-msg', 'Give the guide a name first.', 'bad');
  try {
    state.steps = [];
    renderSteps();
    const page = await callExtension('scan'); // also finds out which website this is
    state.host = page.host;
    await callExtension('recordStart');
    recordingUi(true);
    showTab('record');
    say('rec-msg', 'Recording. Use the website now. Press "Finish and save" when you are done.', 'ok');
  } catch (err) {
    say('rec-msg', err.message, 'bad');
  }
});

$('rec-cancel').addEventListener('click', async () => {
  await callExtension('recordStop').catch(() => {});
  state.steps = [];
  renderSteps();
  recordingUi(false);
  say('rec-msg', 'Cancelled. Nothing was saved.');
});

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise((_, rej) => setTimeout(() => rej(new Error('took too long')), ms))]);
}

$('rec-save').addEventListener('click', async () => {
  $('rec-save').disabled = true;
  await callExtension('recordStop').catch(() => {});
  const title = $('rec-title').value.trim();
  const steps = state.steps.slice();
  const problem = validatePath({ title, host: state.host, steps });
  if (problem) {
    say('rec-msg', problem, 'bad');
    recordingUi(false);
    $('rec-save').disabled = false;
    return;
  }
  try {
    const note = await persistGuide(title, steps, state.host);
    state.steps = [];
    renderSteps();
    recordingUi(false);
    $('rec-title').value = '';
    say('rec-msg', `Saved "${title}" with ${steps.length} steps for your family.${note}`, 'ok');
    await refreshLibrary();
  } catch (err) {
    recordingUi(false);
    say('rec-msg', `Could not save. ${plainError(err)}`, 'bad');
  } finally {
    $('rec-save').disabled = false;
  }
});

/** Translates (when the cloud is on) and saves a guide for the family. Returns a note to show when something was skipped. */
async function persistGuide(title, steps, host) {
  let translations = {};
  let note = '';
  if (state.config.cloudEnabled && state.config.languages.length) {
    say('rec-msg', `Translating ${steps.length} step labels in the cloud. Only the guide name and the written steps are sent, nothing you typed…`);
    try {
      translations = await withTimeout(translatePath({ title, steps }, state.config.languages), 45000);
    } catch (err) {
      note = ` Saved without translations. ${plainError(err)}`;
    }
  } else {
    note = ' The cloud is switched off, so there are no translations.';
  }
  await savePath(state.group, { title, host, steps, translations });
  return note;
}

// The try page can ask for a ready-made guide, so a first visit does not have to start by recording one.
const SAMPLE_STEPS = [
  { role: 'link', text: 'Pay your bill', section: 'Menu', page: '/demo/index.html', href: '/demo/bill.html', name: '' },
  { role: 'field', text: 'Customer ID', section: 'Pay your bill', page: '/demo/bill.html', href: '', name: 'customer' },
  { role: 'select', text: 'Branch office', section: 'Pay your bill', page: '/demo/bill.html', href: '', name: 'branch' },
  { role: 'button', text: 'Check bill', section: 'Pay your bill', page: '/demo/bill.html', href: '', name: 'check' },
  { role: 'button', text: 'Pay now', section: 'Bill details', page: '/demo/details.html', href: '', name: 'pay' },
];

async function ensureFamily() {
  if (!state.group) await setGroup(newGroupCode());
  $('sec-next').hidden = true;
}

if (inDemo) {
  window.__saathiDemo = {
    async makeSample() {
      await ensureFamily();
      const steps = SAMPLE_STEPS.map(sanitizeStep);
      await persistGuide('Pay the electricity bill', steps, location.hostname);
      showTab('follow');
      await refreshLibrary();
      return state.paths.length;
    },
    // For checking the voice: how many bytes of audio a sentence becomes, with and without the instruction in front.
    async voiceBytes(text, lang, withInstruction = true, prompt = null) {
      const audio = await synthesize({ prompt: prompt ?? (withInstruction ? ttsPrompt(text) : spokenText(text)), languageCode: TTS_LANGUAGE[lang], voiceName: TTS_VOICE });
      return atob(audio.data).length;
    },
    async openMessage(text) {
      await ensureFamily();
      showTab('help');
      $('msg-text').value = text ?? '';
      $('msg-text').scrollIntoView({ block: 'center' });
      $('msg-text').focus();
    },
  };
}

// ---------- Following ----------

const WHERE = {
  en: { label: 'Where is…?', ph: 'For example: Sign out', go: 'Show me', found: (t) => `Here: "${t}". It has a green dashed outline for a few seconds. Your step is still waiting.`, several: 'More than one fits. Which one?', none: 'I could not find that on this page. Try the word as it is written on the page.', empty: 'Type what you are looking for.', fail: 'Saathi could not read this page. Reload the tab and try again.' },
  ne: { label: 'कहाँ छ…?', ph: 'जस्तै: Sign out', go: 'देखाउनुहोस्', found: (t) => `यहाँ: "${t}"। केही सेकेन्डसम्म हरियो टुटेको रेखाले घेरिन्छ। तपाईंको चरण अझै पर्खिरहेको छ।`, several: 'एकभन्दा बढी मिल्छन्। कुन?', none: 'यो पेजमा भेटिएन। पेजमा लेखिएको शब्द प्रयोग गरेर हेर्नुहोस्।', empty: 'के खोज्दै हुनुहुन्छ, लेख्नुहोस्।', fail: 'साथीले यो पेज पढ्न सकेन। ट्याब रिलोड गरेर फेरि प्रयास गर्नुहोस्।' },
  hi: { label: 'कहाँ है…?', ph: 'जैसे: Sign out', go: 'दिखाइए', found: (t) => `यहाँ: "${t}"। कुछ सेकंड हरी टूटी लकीर से घिरा रहेगा। आपका चरण अभी रुका हुआ है।`, several: 'एक से ज़्यादा मिलते हैं। कौन सा?', none: 'यह इस पेज पर नहीं मिला। पेज पर जैसा लिखा है वैसा शब्द आज़माइए।', empty: 'लिखिए कि क्या ढूँढ रहे हैं।', fail: 'साथी यह पेज नहीं पढ़ सका। टैब दोबारा खोलकर कोशिश कीजिए।' },
};

const WORDS = {
  en: { step: (i, n) => `Step ${i} of ${n}`, done: 'You did it. Saathi only showed the way.', tell: 'Let my family know I finished', told: 'Your family has been told. Well done.', noGroup: 'Join a group to tell your family.' },
  ne: { step: (i, n) => `चरण ${i} / ${n}`, done: 'तपाईंले आफैं गर्नुभयो। साथीले बाटो मात्र देखायो।', tell: 'मैले सकेँ भनेर परिवारलाई खबर पठाउनुहोस्', told: 'तपाईंको परिवारलाई खबर पठाइयो। धेरै राम्रो!', noGroup: 'परिवारलाई भन्न समूहमा जोडिनुहोस्।' },
  hi: { step: (i, n) => `चरण ${i} / ${n}`, done: 'आपने खुद कर दिखाया। साथी ने बस रास्ता दिखाया।', tell: 'परिवार को खबर भेजिए कि मेरा काम हो गया', told: 'आपके परिवार को खबर भेज दी गई है। बहुत बढ़िया!', noGroup: 'परिवार को बताने के लिए किसी समूह से जुड़िए।' },
};
const VOICE_NOTE = {
  ne: { limit: 'साथीको आवाजको आजको निःशुल्क सीमा सकियो। यो उपकरणको आवाज प्रयोग हुँदैछ, वा लेखिएको पढ्नुहोस्।', cloud: 'साथीको आवाज: वाक्य क्लाउडमा पठाइन्छ र आवाज बनाइन्छ।', none: 'यो उपकरणमा नेपाली आवाज छैन। कृपया लेखिएको पढ्नुहोस्।', fallback: 'यो उपकरणमा नेपाली आवाज छैन, त्यसैले हिन्दी आवाज प्रयोग भयो।' },
  hi: { limit: 'साथी की आवाज़ की आज की मुफ़्त सीमा पूरी हो गई। इस उपकरण की आवाज़ इस्तेमाल हो रही है, या लिखा हुआ पढ़िए।', cloud: 'साथी की आवाज़: वाक्य क्लाउड में भेजा जाता है और आवाज़ बनती है।', none: 'इस उपकरण में हिन्दी आवाज़ नहीं है। कृपया लिखा हुआ पढ़िए।' },
  en: { limit: 'The Saathi voice has reached its free limit for today. Using the voice on this device, or please read the text.', cloud: 'Saathi voice: only the sentence is sent to the cloud to be spoken.', none: '' },
};

// Read-aloud. Nepali and Hindi come from Firebase AI Logic's text-to-speech when the cloud is on; English uses the
// voice on this device when it has one. Anything that fails falls back to the voice on the device, then to the text.
let speaking = 0; // each call gets a number, so an older, slower voice never plays over a newer one
let player = null;
const spokenCache = new Map(); // sentence + language -> audio, so a repeated step is not fetched twice

// When the cloud voice says its free daily limit is used up, stop asking for a while and use the device voice.
const blockedUntil = () => Number(store.get('saathi:ttsBlockedUntil') || 0);
const ttsBlocked = () => blockedUntil() > Date.now();
const blockTts = () => store.set('saathi:ttsBlockedUntil', String(Date.now() + BLOCK_HOURS * 3600e3));

function stopSpeaking() {
  speaking += 1;
  try {
    player?.pause();
  } catch {
    // nothing playing
  }
  player = null;
  try {
    stopSpeaking();
  } catch {
    // no speech on this device
  }
}

function speakOnDevice(text, lang, plan) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = plan.voice;
    u.lang = plan.voiceLang;
    speechSynthesis.speak(u);
  } catch {
    // no voice available
  }
}

async function playCloud(text, lang, turn) {
  const key = `${lang}|${text}`;
  let audio = spokenCache.get(key);
  if (!audio) {
    audio = await withTimeout(synthesize({ prompt: ttsPrompt(text), languageCode: TTS_LANGUAGE[lang], voiceName: TTS_VOICE }), 20000);
    spokenCache.set(key, audio);
  }
  if (turn !== speaking) return; // the person moved on while it was being made
  const raw = Uint8Array.from(atob(audio.data), (c) => c.charCodeAt(0));
  const { bytes, type } = playable(raw, audio.mimeType);
  state.lastSpeech = { mime: audio.mimeType, bytes: raw.length, played: type };
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  player = new Audio(url);
  player.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
  await player.play();
}

async function speak(text, lang) {
  stopSpeaking();
  const turn = speaking;
  // Personal details are masked before a sentence is sent anywhere, and only a short sentence is sent.
  const sentence = spokenText(maskText(String(text ?? '')).masked);
  if (!sentence) return;
  const voices = typeof speechSynthesis !== 'undefined' ? speechSynthesis.getVoices() : [];
  const plan = planSpeech(voices, lang, { cloudEnabled: state.config.cloudEnabled, cloudVoice: state.cloudVoice, blocked: ttsBlocked() });
  const note = $('read-note');
  if (plan.source === 'device') {
    note.textContent = plan.fallback ? VOICE_NOTE[lang]?.fallback ?? '' : '';
    return speakOnDevice(sentence, lang, plan);
  }
  if (plan.source === 'cloud') {
    note.textContent = (VOICE_NOTE[lang] ?? VOICE_NOTE.en).cloud;
    try {
      await playCloud(sentence, lang, turn);
      return;
    } catch (err) {
      const quota = isQuotaError(err);
      if (quota) blockTts();
      state.lastSpeech = { ...(state.lastSpeech ?? {}), error: `${err?.name ?? ''} ${String(err?.message ?? '').slice(0, 120)}`.trim(), quota };
      if (turn !== speaking) return;
      const back = deviceFallback(voices, lang);
      if (back.source === 'device') {
        note.textContent = quota ? (VOICE_NOTE[lang] ?? VOICE_NOTE.en).limit : back.fallback ? VOICE_NOTE[lang]?.fallback ?? '' : '';
        return speakOnDevice(sentence, lang, back);
      }
      note.textContent = quota ? (VOICE_NOTE[lang] ?? VOICE_NOTE.en).limit : VOICE_NOTE[lang]?.none ?? '';
      return;
    }
  }
  note.textContent = ttsBlocked() ? (VOICE_NOTE[lang] ?? VOICE_NOTE.en).limit : VOICE_NOTE[lang]?.none ?? '';
}

const instructionIn = (path, i, lang) => path.translations?.[lang]?.steps?.[i] ?? null;

function renderStepCard() {
  renderWhereLabels();
  renderAskLabels();
  const f = state.follow;
  const step = f.path.steps[f.index];
  const english = stepInstruction(step);
  const other = state.lang !== 'en' ? instructionIn(f.path, f.index, state.lang) : null;
  $('fo-count').textContent = `${f.path.title} · ${(WORDS[state.lang] ?? WORDS.en).step(f.index + 1, f.path.steps.length)}`;
  $('fo-bar').style.width = `${((f.index + 1) / f.path.steps.length) * 100}%`;
  $('fo-text').textContent = other ?? english;
  $('fo-text2').textContent = other ? english : state.lang !== 'en' ? '(This path has no translation yet, so it is shown in English.)' : '';
  $('fo-next').textContent = f.index === f.path.steps.length - 1 ? 'I did it, finish' : 'I did it, next';
  if (state.speak) speak(other ?? english, other ? state.lang : 'en');
}

function setHow(text, kind = '') {
  const el = $('fo-how');
  el.textContent = text;
  el.className = `muted ${kind}`;
}

const HOW = {
  code: 'I found it on the page.',
  anchor: 'The name changed, but it goes to the same place, so I found it.',
  model: 'The name changed. Saathi found it using the AI on this device.',
  cloud: 'The name changed. With your OK, the cloud AI found it. It saw only button and link names.',
};

const askLocal = async (prompt) => {
  // Only when the model is already on this computer. Otherwise asking would start a large download.
  if (state.device !== 'available') return '';
  try {
    return (await run({ mode: 'ONLY_ON_DEVICE', prompt })).text;
  } catch {
    return ''; // the guide will say it is not sure
  }
};

// The cloud model is asked only when the person presses the button, and it sees only labels.
const askCloud = async (prompt) => (await run({ mode: 'ONLY_IN_CLOUD', prompt })).text;

// A label that holds a personal detail is not sent, even to the cloud.
const scrub = (elements) =>
  elements.map((e) => {
    const personal = isPersonalControl(e.text, e.acct);
    const section = e.section && isPersonalText(e.section) ? '' : e.section;
    return personal ? { ...e, text: '(personal label)', section } : { ...e, section };
  });

function offerCloud(f, step, page, ctx) {
  if (!state.config.cloudEnabled) return;
  const preview = cloudPreview(step, page.elements, ctx);
  if (!preview.count) return;
  f.cloud = { step, page, ctx };
  const why = state.device === 'available' ? 'The on-device model could not tell.' : 'This computer has no on-device model.';
  $('fo-cloud-text').textContent = `${why} Ask the cloud to look? It would see the old label "${step.text || 'this step'}" and the names of ${preview.count} buttons and links near this step (for example: ${preview.examples.map((t) => `"${t}"`).join(', ')}). Nothing you typed, and no picture of the page.`;
  $('fo-cloud').hidden = false;
}

$('fo-cloud-go').addEventListener('click', async (ev) => {
  const f = state.follow;
  if (!f?.cloud) return;
  const { step, page, ctx } = f.cloud;
  const index = f.index;
  const btn = ev.currentTarget; // ev.currentTarget is empty once the handler has awaited
  btn.disabled = true;
  setHow('Asking the cloud…');
  try {
    const safe = scrub(page.elements);
    // One call is enough for the cloud model: on 22 real renamed controls it found all of them, in about
    // half the time of the careful three-call check that suits the small on-device model.
    const res = await refind(step, safe, { ...ctx, region: false, single: true }, askCloud);
    if (state.follow !== f || f.index !== index) return;
    $('fo-cloud').hidden = true;
    if (res.index === null) return setHow('The cloud was not sure either. Try "Ask a helper" in Get help.', 'bad');
    const drawn = await callExtension('highlight', { index: res.index, stepIndex: index, scanId: page.scanId });
    f.found = { text: page.elements[res.index].text, by: 'cloud' };
    if (drawn?.covered) {
      $('fo-warn').hidden = false;
      $('fo-warn').textContent = 'Something is in front of it, such as a pop-up notice. Close that first.';
    }
    setHow(HOW.cloud);
  } catch (err) {
    setHow(`The cloud could not help. ${plainError(err)}`, 'bad');
  } finally {
    btn.disabled = false;
  }
});

async function scanWithRetry() {
  let last;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const page = await callExtension('scan');
      if (page.elements.length) return page;
      last = new Error('The page has nothing to show yet.');
    } catch (err) {
      last = err;
    }
    await sleep(700);
  }
  throw last;
}

async function showStep() {
  const f = state.follow;
  if (!f) return;
  renderStepCard();
  $('fo-warn').hidden = true;
  $('fo-cloud').hidden = true;
  f.found = null;
  f.cloud = null;
  setHow('Looking for it on the page…');
  const index = f.index;
  try {
    const page = await scanWithRetry();
    if (state.follow !== f || f.index !== index) return;
    if (!originMatches(f.path.host, page.host)) {
      $('fo-warn').hidden = false;
      $('fo-warn').textContent = `This is not the website this guide was made on (${f.path.host}). Stop here. Do not type anything on this page.`;
      return setHow('');
    }
    const step = f.path.steps[index];
    const others = f.path.steps.filter((_, i) => i !== index).map((s) => s.text).filter(Boolean);
    const ctx = { task: f.path.title, others, previous: f.path.steps[index - 1]?.text };
    const res = await refind(step, page.elements, ctx, askLocal);
    if (state.follow !== f || f.index !== index) return;
    if (res.index === null) {
      offerCloud(f, step, page, ctx);
      return setHow(
        state.device === 'available'
          ? `I am not sure which one it is (${res.reason}). The page may have changed.`
          : 'I could not find it by its label or address, and this computer has no on-device model.',
        'bad',
      );
    }
    const drawn = await callExtension('highlight', { index: res.index, stepIndex: index, scanId: page.scanId });
    f.found = { text: page.elements[res.index].text, by: res.by };
    if (drawn?.covered) {
      $('fo-warn').hidden = false;
      $('fo-warn').textContent = 'Something is in front of it, such as a pop-up notice. Close that first.';
    }
    setHow(HOW[res.by]);
  } catch (err) {
    setHow(err.message, 'bad');
  }
}

async function startFollow(path) {
  if (!path) return;
  state.follow = { path, index: 0, found: null };
  state.done = false;
  state.lastDone = null;
  state.told = false;
  $('fo-tell').hidden = true;
  document.body.dataset.following = 'true';
  showTab('follow');
  $('fo-done').hidden = true;
  $('follow').hidden = false;
  $('fo-where').hidden = false;
  $('fo-ask').hidden = false;
  $('ask-out').textContent = '';
  $('ask-ran').textContent = '';
  $('where-out').textContent = '';
  $('where-pick').innerHTML = '';
  await showStep();
}

const announce = (text) => {
  const el = $('live');
  el.textContent = '';
  setTimeout(() => (el.textContent = text), 50); // a change after a pause is read out by screen readers
};

// The finished card can tell the family. It sends only the guide's title and its number of steps,
// and only when the person presses the button.
function renderTell() {
  const w = WORDS[state.lang] ?? WORDS.en;
  $('fo-tell').hidden = !state.lastDone;
  $('fo-tell-btn').textContent = state.group ? w.tell : w.noGroup;
  $('fo-tell-btn').disabled = !state.group;
  $('fo-tell-btn').hidden = state.told;
  $('fo-tell-msg').textContent = state.told ? w.told : '';
}

$('fo-tell-btn').addEventListener('click', async () => {
  if (!state.lastDone || !state.group) return;
  const w = WORDS[state.lang] ?? WORDS.en;
  $('fo-tell-btn').disabled = true;
  try {
    await createCheckin(state.group, state.lastDone);
    state.told = true;
    renderTell();
    $('fo-tell-msg').tabIndex = -1;
    $('fo-tell-msg').focus();
    announce(w.told);
  } catch (err) {
    $('fo-tell-msg').textContent = `Could not tell your family. ${plainError(err)}`;
    $('fo-tell-btn').disabled = false;
  }
});

async function nextStep() {
  const f = state.follow;
  if (!f) return;
  f.index++;
  if (f.index >= f.path.steps.length) {
    state.lastDone = { title: f.path.title, steps: f.path.steps.length };
    state.follow = null;
    state.done = true;
    document.body.dataset.following = 'false';
    $('follow').hidden = true;
    $('fo-where').hidden = true;
    $('fo-ask').hidden = true;
    $('fo-done').hidden = false;
    $('fo-done').textContent = (WORDS[state.lang] ?? WORDS.en).done;
    renderTell();
    if (state.speak) speak($('fo-done').textContent, state.lang);
    return;
  }
  await showStep();
}

$('fo-next').addEventListener('click', nextStep);
$('fo-again').addEventListener('click', showStep);
$('fo-read').addEventListener('click', () => {
  const f = state.follow;
  if (!f) return;
  const other = state.lang !== 'en' ? instructionIn(f.path, f.index, state.lang) : null;
  speak(other ?? stepInstruction(f.path.steps[f.index]), other ? state.lang : 'en');
});
$('fo-stop').addEventListener('click', () => {
  state.follow = null;
  document.body.dataset.following = 'false';
  $('follow').hidden = true;
  $('fo-where').hidden = true;
  $('fo-ask').hidden = true;
  stopSpeaking();
});

document.querySelectorAll('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    store.set('saathi:lang', state.lang);
    callExtension('setLang', { lang: state.lang }).catch(() => {});
    renderGuard(guardNow);
    renderMessage();
    renderQuizStatic();
    if (state.done) {
      $('fo-done').textContent = (WORDS[state.lang] ?? WORDS.en).done;
      renderTell();
    }
    renderChips();
    if (state.follow) renderStepCard();
  }),
);
$('opt-voice').addEventListener('click', () => {
  state.cloudVoice = !state.cloudVoice;
  store.set('saathi:cloudVoice', state.cloudVoice ? '1' : '0');
  renderChips();
});
$('opt-big').addEventListener('click', () => {
  state.big = !state.big;
  store.set('saathi:big', state.big ? '1' : '0');
  renderChips();
});
$('opt-speak').addEventListener('click', () => {
  state.speak = !state.speak;
  renderChips();
  if (!state.speak) stopSpeaking();
});

// ---------- Explain this page ----------
// Labels only, so it may fall back to the cloud when this laptop has no on-device model,
// unless Remote Config has switched the cloud off.

$('t-explain').addEventListener('click', async (ev) => {
  const btn = ev.currentTarget; // ev.currentTarget is empty once the handler has awaited
  btn.disabled = true;
  say('o-explain', 'Reading the page…');
  try {
    const page = await callExtension('scan');
    say('o-explain', `Read ${page.elements.length} controls. Explaining…`);
    const started = performance.now();
    const onDevice = state.device === 'available';
    if (!onDevice && !state.config.cloudEnabled) throw new Error('This computer has no on-device model, and the cloud is switched off.');
    // Without the model already on this computer, go straight to the cloud (labels only) instead of starting a download.
    const mode = !onDevice ? 'ONLY_IN_CLOUD' : state.config.cloudEnabled ? 'PREFER_ON_DEVICE' : 'ONLY_ON_DEVICE';
    const { text, source } = await run({ mode, prompt: explainPrompt(page, state.config.maxLabels) });
    const ms = Math.round(performance.now() - started);
    const sent = explainPayloadSummary(page, state.config.maxLabels);
    const where =
      source === 'ON_DEVICE'
        ? 'On this laptop. Nothing left it.'
        : `In the cloud. Sent: the page title and ${sent.labels} labels, ${sent.typedValues} typed values.`;
    say('o-explain', `${text.trim()}\n\n${where}\nTime: ${ms} ms`, 'ok');
  } catch (err) {
    say('o-explain', `Failed: ${err.message}`, 'bad');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Ask my helper ----------
// Sends the names of this page's controls to the group, so a helper on a phone can tap the right one.

let helpWatch = null;
let lastPick = null;

function endHelp() {
  helpWatch?.();
  helpWatch = null;
  lastPick = null;
  state.help = null;
  $('help-confirm').hidden = true;
  $('help-live').hidden = true;
  $('help-ask').hidden = false;
}

$('help-ask').addEventListener('click', async () => {
  if (!state.group) return say('help-msg', 'Join or start a family first.', 'bad');
  say('help-msg', 'Reading the page…');
  try {
    const page = await callExtension('scan');
    const controls = controlsForHelp(page.elements);
    state.help = { page, controls, id: null };
    $('help-preview').textContent = `This will send ${helpPreview(controls, page.host)}`;
    $('help-confirm').hidden = false;
    $('help-ask').hidden = true;
    say('help-msg', '');
  } catch (err) {
    say('help-msg', err.message, 'bad');
  }
});

$('help-cancel').addEventListener('click', endHelp);

$('help-send').addEventListener('click', async () => {
  const h = state.help;
  if (!h) return;
  $('help-send').disabled = true;
  try {
    const id = await createHelp(state.group, { title: cleanTitle(h.page.title, h.page.host), host: h.page.host, controls: h.controls });
    h.id = id;
    $('help-confirm').hidden = true;
    $('help-live').hidden = false;
    $('help-url').textContent = `${location.origin}/help.html`;
    $('help-code').textContent = state.group;
    $('help-status').textContent = 'Waiting for your helper…';
    helpWatch = watchHelp(
      state.group,
      id,
      (data) => onHelpAnswer(data),
      (err) => say('help-msg', `Lost the connection to your helper. ${plainError(err)}`, 'bad'),
    );
  } catch (err) {
    say('help-msg', `Could not ask. ${plainError(err)}`, 'bad');
  } finally {
    $('help-send').disabled = false;
  }
});

async function onHelpAnswer(data) {
  const h = state.help;
  if (!h || !data) return;
  const note = data.note ? ` Your helper says: ${data.note}` : '';
  if (data.pick === null || data.pick === undefined) return;
  const label = h.controls[data.pick]?.text || 'a control';
  const scanIndex = h.controls[data.pick]?.at ?? data.pick; // the control's place in the page scan
  $('help-status').textContent = `Your helper pointed at "${label}". Look for the yellow box.${note}`;
  if (data.pick === lastPick && !data.note) return;
  lastPick = data.pick;
  try {
    await callExtension('highlight', { index: scanIndex, scanId: h.page?.scanId });
  } catch {
    // The page may have been rescanned since. Find the control again by its name.
    try {
      const page = await callExtension('scan');
      const c = h.controls[data.pick];
      const hit = c && c.text ? codeFind({ role: c.role, text: c.text, section: c.section }, page.elements) : null;
      if (hit?.verdict === 'found') await callExtension('highlight', { index: hit.index, scanId: page.scanId });
      else $('help-status').textContent += ' (The page has changed, so I could not light it up. Ask your helper again.)';
    } catch (err) {
      say('help-msg', err.message, 'bad');
    }
  }
  if (state.speak) speak(`Your helper pointed at ${label}.${note}`, 'en');
}

// If the panel is closed while a help request is open, try to take the names down. The request also runs out by
// itself after two hours (and is removed by the database's expiry policy), so this is a best effort.
addEventListener('pagehide', () => {
  const id = state.help?.id;
  if (id && state.group) closeHelp(state.group, id).catch(() => {});
});

$('help-end').addEventListener('click', async () => {
  const id = state.help?.id;
  endHelp();
  if (id) await closeHelp(state.group, id).catch(() => {});
  say('help-msg', 'Stopped sharing. The names were deleted.', 'ok');
});

// ---------- Developer checks ----------

async function modelTest(mode, outId, button) {
  button.disabled = true;
  say(outId, 'Running…');
  const started = performance.now();
  try {
    const { text, source } = await run({ mode, prompt: 'Reply with the single word READY and nothing else.' });
    const ms = Math.round(performance.now() - started);
    say(outId, `Answer: ${text.trim()}\nRan: ${source === 'ON_DEVICE' ? 'on this laptop' : source === 'IN_CLOUD' ? 'in the cloud' : source}\nTime: ${ms} ms`, 'ok');
  } catch (err) {
    say(outId, `Failed: ${err.message}`, 'bad');
  } finally {
    button.disabled = false;
  }
}

$('t-usage').addEventListener('click', () => {
  const rows = getUsage();
  const where = { ON_DEVICE: 'on this computer', IN_CLOUD: 'in the cloud', NONE: 'failed', UNKNOWN: 'unknown' };
  const lines = rows.map((u) => `${new Date(u.at).toLocaleTimeString()}  asked ${u.asked.replace(/_/g, ' ').toLowerCase()} → ran ${where[u.ran] ?? u.ran} · ${u.ms} ms · ${u.ran === 'NONE' ? 'no answer came back' : u.sentChars ? `${u.sentChars} characters sent${u.media ? ' + a recording' : ''}` : 'nothing sent'}`);
  const device = rows.filter((u) => u.ran === 'ON_DEVICE').length;
  const cloud = rows.filter((u) => u.ran === 'IN_CLOUD').length;
  say('o-usage', rows.length ? `${rows.length} calls: ${device} on this computer, ${cloud} in the cloud.\n${lines.join('\n')}` : 'No AI call yet in this session.', rows.length ? 'ok' : '');
});
$('t-device').addEventListener('click', (ev) => modelTest('ONLY_ON_DEVICE', 'o-device', ev.currentTarget));
$('t-cloud').addEventListener('click', (ev) => modelTest('ONLY_IN_CLOUD', 'o-cloud', ev.currentTarget));

$('t-find').addEventListener('click', async (ev) => {
  const label = $('f-label').value.trim();
  if (!label) return say('o-find', 'Type a name first.', 'bad');
  const btn = ev.currentTarget; // ev.currentTarget is empty once the handler has awaited
  btn.disabled = true;
  say('o-find', 'Reading the page…');
  try {
    const page = await callExtension('scan');
    const step = { role: $('f-kind').value, text: label, section: '' };
    let calls = 0;
    const started = performance.now();
    const ask = async (prompt) => {
      calls++;
      say('o-find', `Read ${page.elements.length} controls. Asking the on-device model (${calls})…`);
      return askLocal(prompt);
    };
    const res = await refind(step, page.elements, { task: cleanTitle(page.title, page.host) }, ask);
    const ms = Math.round(performance.now() - started);
    if (res.index === null) {
      say('o-find', `Not sure (${res.reason}). ${page.elements.length} controls read, ${calls} model calls, ${ms} ms.`, 'bad');
    } else {
      const drawn = await callExtension('highlight', { index: res.index, scanId: page.scanId });
      const found = page.elements[res.index];
      say(
        'o-find',
        `Found: "${found.text}" (${found.role}${found.section ? `, under "${found.section}"` : ''})\nBy: ${res.by}${calls ? `, ${calls} model calls` : ''}\nTime: ${ms} ms · ${page.elements.length} controls read${
          drawn?.covered ? '\nSomething is in front of it, such as a pop-up notice. Close that first.' : ''
        }`,
        drawn?.covered ? 'bad' : 'ok',
      );
    }
  } catch (err) {
    say('o-find', `Failed: ${err.message}`, 'bad');
  } finally {
    btn.disabled = false;
  }
});

// ---------- Start ----------

async function start() {
  renderChips();
  deviceStatus().then((s) => {
    state.device = s;
    renderChips();
  });
  try {
    state.user = await ensureUser();
  } catch (err) {
    say('group-msg', `Could not sign in. ${plainError(err)}`, 'bad');
  }
  state.config = await loadConfig();
  renderChips();
  callExtension('setLang', { lang: state.lang }).catch(() => {});
  callExtension('guardStatus').then(renderGuard).catch(() => {});
  watchFamilyAlerts();
  if (state.group) cleanUpOwn(state.group).catch(() => {});
  if (state.group) await refreshLibrary();
  else say('lib-msg', 'Join or start a family to see its guides.');
}

start();
