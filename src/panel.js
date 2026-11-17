// The page shown inside the extension's side panel. It is an ordinary hosted web page, so
// Firebase AI Logic, App Check, Auth, Firestore and Remote Config work here as on the web.
// The extension around it only reads the open tab's controls and draws the highlight.

import { run, deviceStatus } from './firebase.js';
import { refind, codeFind } from './refind.js';
import { explainPrompt, explainPayloadSummary } from './explain.js';
import {
  sanitizeStep, sameStep, stepInstruction, originMatches, validatePath, newGroupCode, normaliseGroup, GROUP_RE, LANGS, MAX_STEPS,
} from './path.js';
import { controlsForHelp, helpPreview } from './help.js';
import {
  ensureUser, loadConfig, savePath, listPaths, deletePath, translatePath, createHelp, watchHelp, closeHelp,
} from './backend.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

const framed = window.parent !== window;
const demoFlag = new URLSearchParams(location.search).has('demo');
const parentOrigin = !framed
  ? ''
  : location.ancestorOrigins?.[0] || (demoFlag ? location.origin : '');
const inExtension = parentOrigin.startsWith('chrome-extension://');
// Demo mode: the hosted try page (same website) stands in for the extension.
const inDemo = framed && demoFlag && parentOrigin === location.origin;
const bridged = inExtension || inDemo;

const state = {
  group: store.get('saathi:group') || '',
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
  if (msg.event === 'recorded' && state.recording) addRecorded(msg.step);
  if (msg.event === 'clicked' && state.follow && msg.stepIndex === state.follow.index) {
    setTimeout(() => nextStep(), 1200); // let the next page load
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
  $('opt-speak').setAttribute('aria-pressed', String(state.speak));
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
  say('group-msg', '');
  renderChips();
  await refreshLibrary();
}

$('group-switch').addEventListener('click', () => {
  state.switching = true;
  renderChips();
  $('group-code').focus();
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
$('group-new').addEventListener('click', () => setGroup(newGroupCode()));
$('group-join').addEventListener('click', () => {
  const code = normaliseGroup($('group-code').value);
  if (!GROUP_RE.test(code)) return say('group-msg', 'A group code has 8 letters and numbers, for example K7M2QX4P.', 'bad');
  setGroup(code);
});

// ---------- Library ----------

async function refreshLibrary() {
  const list = $('lib-list');
  if (!state.group) {
    list.innerHTML = '';
    return say('lib-msg', 'Join or start a group to see its paths.');
  }
  say('lib-msg', 'Loading paths…');
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
        : 'No paths in this group yet. Open "Show the way" to record the first one.',
    );
  } catch (err) {
    say('lib-msg', `Could not load paths: ${err.message}`, 'bad');
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
      say('lib-msg', `Could not delete: ${err.message}`, 'bad');
    }
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
  if (state.steps.length >= MAX_STEPS) return say('rec-msg', `That is ${MAX_STEPS} steps, the most a path can have.`, 'bad');
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
  if (!state.group) return say('rec-msg', 'Join or start a group first (step 1).', 'bad');
  if (!$('rec-title').value.trim()) return say('rec-msg', 'Give the path a name first.', 'bad');
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
    let translations = {};
    let note = '';
    if (state.config.cloudEnabled && state.config.languages.length) {
      say('rec-msg', `Translating ${steps.length} step labels in the cloud. Only the path name and the written steps are sent, nothing you typed…`);
      try {
        translations = await withTimeout(translatePath({ title, steps }, state.config.languages), 45000);
      } catch (err) {
        note = ` Saved without translations (${err.message}).`;
      }
    } else {
      note = ' The cloud is switched off, so there are no translations.';
    }
    await savePath(state.group, { title, host: state.host, steps, translations });
    state.steps = [];
    renderSteps();
    recordingUi(false);
    $('rec-title').value = '';
    say('rec-msg', `Saved "${title}" with ${steps.length} steps for group ${state.group}.${note}`, 'ok');
    await refreshLibrary();
  } catch (err) {
    recordingUi(false);
    say('rec-msg', `Could not save: ${err.message}`, 'bad');
  } finally {
    $('rec-save').disabled = false;
  }
});

// ---------- Following ----------

const WORDS = {
  en: { step: (i, n) => `Step ${i} of ${n}`, done: 'You did it. Saathi only showed the way.' },
  ne: { step: (i, n) => `चरण ${i} / ${n}`, done: 'तपाईंले आफैं गर्नुभयो। साथीले बाटो मात्र देखायो।' },
  hi: { step: (i, n) => `चरण ${i} / ${n}`, done: 'आपने खुद कर दिखाया। साथी ने बस रास्ता दिखाया।' },
};
const VOICE = { en: 'en-US', ne: 'ne-NP', hi: 'hi-IN' };

function speak(text, lang) {
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = VOICE[lang] ?? 'en-US';
    speechSynthesis.speak(u);
  } catch { /* no voice available */ }
}

const instructionIn = (path, i, lang) => path.translations?.[lang]?.steps?.[i] ?? null;

function renderStepCard() {
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
  code: 'Found by its label.',
  anchor: 'The label changed, but the link or box underneath is the same.',
  model: 'The label changed. Found by the on-device model.',
};

const askLocal = async (prompt) => {
  try {
    return (await run({ mode: 'ONLY_ON_DEVICE', prompt })).text;
  } catch {
    return ''; // no on-device model: the guide will say it is not sure
  }
};

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
  f.found = null;
  setHow('Looking for it on the page…');
  const index = f.index;
  try {
    const page = await scanWithRetry();
    if (state.follow !== f || f.index !== index) return;
    if (!originMatches(f.path.host, page.host)) {
      $('fo-warn').hidden = false;
      $('fo-warn').textContent = `This is not the website this path was recorded on (${f.path.host}). Stop here. Do not type anything on this page.`;
      return setHow('');
    }
    const step = f.path.steps[index];
    const others = f.path.steps.filter((_, i) => i !== index).map((s) => s.text).filter(Boolean);
    const res = await refind(step, page.elements, { task: f.path.title, others, previous: f.path.steps[index - 1]?.text }, askLocal);
    if (state.follow !== f || f.index !== index) return;
    if (res.index === null) {
      return setHow(`I am not sure which one it is (${res.reason}). The page may have changed. Try "Explain this page" below.`, 'bad');
    }
    const drawn = await callExtension('highlight', { index: res.index, stepIndex: index });
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
  document.body.dataset.following = 'true';
  showTab('follow');
  $('fo-done').hidden = true;
  $('follow').hidden = false;
  await showStep();
}

async function nextStep() {
  const f = state.follow;
  if (!f) return;
  f.index++;
  if (f.index >= f.path.steps.length) {
    state.follow = null;
    state.done = true;
    document.body.dataset.following = 'false';
    $('follow').hidden = true;
    $('fo-done').hidden = false;
    $('fo-done').textContent = (WORDS[state.lang] ?? WORDS.en).done;
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
  speechSynthesis?.cancel?.();
});

document.querySelectorAll('[data-lang]').forEach((b) =>
  b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    store.set('saathi:lang', state.lang);
    renderChips();
    if (state.follow) renderStepCard();
  }),
);
$('opt-big').addEventListener('click', () => {
  state.big = !state.big;
  store.set('saathi:big', state.big ? '1' : '0');
  renderChips();
});
$('opt-speak').addEventListener('click', () => {
  state.speak = !state.speak;
  renderChips();
  if (!state.speak) speechSynthesis?.cancel?.();
});

// ---------- Explain this page ----------
// Labels only, so it may fall back to the cloud when this laptop has no on-device model,
// unless Remote Config has switched the cloud off.

$('t-explain').addEventListener('click', async (ev) => {
  ev.currentTarget.disabled = true;
  say('o-explain', 'Reading the page…');
  try {
    const page = await callExtension('scan');
    say('o-explain', `Read ${page.elements.length} controls. Explaining…`);
    const started = performance.now();
    const mode = state.config.cloudEnabled ? 'PREFER_ON_DEVICE' : 'ONLY_ON_DEVICE';
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
    ev.currentTarget.disabled = false;
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
  if (!state.group) return say('help-msg', 'Join or start a group first (step 1).', 'bad');
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
    const id = await createHelp(state.group, { title: h.page.title || h.page.host, host: h.page.host, controls: h.controls });
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
      (err) => say('help-msg', `Lost the connection to your helper: ${err.message}`, 'bad'),
    );
  } catch (err) {
    say('help-msg', `Could not ask: ${err.message}`, 'bad');
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
  $('help-status').textContent = `Your helper pointed at "${label}". Look for the yellow box.${note}`;
  if (data.pick === lastPick && !data.note) return;
  lastPick = data.pick;
  try {
    await callExtension('highlight', { index: data.pick });
  } catch {
    // The page may have been rescanned since. Find the control again by its name.
    try {
      const page = await callExtension('scan');
      const c = h.controls[data.pick];
      const hit = c && c.text ? codeFind({ role: c.role, text: c.text, section: c.section }, page.elements) : null;
      if (hit?.verdict === 'found') await callExtension('highlight', { index: hit.index });
      else $('help-status').textContent += ' (The page has changed, so I could not light it up. Ask your helper again.)';
    } catch (err) {
      say('help-msg', err.message, 'bad');
    }
  }
  if (state.speak) speak(`Your helper pointed at ${label}.${note}`, 'en');
}

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

$('t-device').addEventListener('click', (ev) => modelTest('ONLY_ON_DEVICE', 'o-device', ev.currentTarget));
$('t-cloud').addEventListener('click', (ev) => modelTest('ONLY_IN_CLOUD', 'o-cloud', ev.currentTarget));

$('t-find').addEventListener('click', async (ev) => {
  const label = $('f-label').value.trim();
  if (!label) return say('o-find', 'Type a label first.', 'bad');
  ev.currentTarget.disabled = true;
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
    const res = await refind(step, page.elements, { task: page.title }, ask);
    const ms = Math.round(performance.now() - started);
    if (res.index === null) {
      say('o-find', `Not sure (${res.reason}). ${page.elements.length} controls read, ${calls} model calls, ${ms} ms.`, 'bad');
    } else {
      const drawn = await callExtension('highlight', { index: res.index });
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
    ev.currentTarget.disabled = false;
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
    say('group-msg', `Could not sign in: ${err.message}`, 'bad');
  }
  state.config = await loadConfig();
  renderChips();
  if (state.group) await refreshLibrary();
  else say('lib-msg', 'Join or start a group to see its paths.');
}

start();
