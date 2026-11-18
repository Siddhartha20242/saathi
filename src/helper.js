// The helper's phone page. It shows the names of the controls on another person's page, and
// writes back which one to point at. No extension and no on-device model are needed here.

import { ensureUser, watchHelpRequests, watchHelp, answerHelp, watchAlerts, watchCheckins } from './backend.js';
import { alertsForMe, alertSentence, recentCheckins, checkinSentence } from './alerts.js';
import { GROUP_RE, normaliseGroup } from './path.js';
import { groupBySection, kindWord, cleanNote, isLive } from './help.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
  del: (k) => { try { localStorage.removeItem(k); } catch { /* storage unavailable */ } },
};

const state = { group: store.get('saathi-helper:group') || '', requests: [], open: null, current: null };
window.__helper = state; // read by the end-to-end test
let stopList = null;
let stopOne = null;
let stopAlerts = null;
let stopCheckins = null;

function say(id, text, kind = '') {
  const el = $(id);
  el.textContent = text;
  el.className = `out ${kind}`;
}

function show(which) {
  $('s-group').hidden = which !== 'group';
  $('s-list').hidden = which !== 'list';
  $('s-help').hidden = which !== 'help';
}

// ---------- Group and list ----------

async function join(code) {
  state.group = code;
  store.set('saathi-helper:group', code);
  show('list');
  $('list-note').textContent = 'Waiting for a request…';
  try {
    await ensureUser();
  } catch (err) {
    show('group');
    return say('group-msg', `Could not sign in: ${err.message}`, 'bad');
  }
  stopAlerts?.();
  stopAlerts = watchAlerts(
    code,
    (all) => {
      const recent = alertsForMe(all, null, [], Date.now(), 24); // everyone's alerts: the helper is not the one who raised them
      $('s-alerts').hidden = recent.length === 0;
      $('alerts').innerHTML = recent
        .map((a) => `<li>${esc(alertSentence(a))}<small>${new Date(a.createdAt?.toMillis?.() ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></li>`)
        .join('');
    },
    () => {},
  );
  stopCheckins?.();
  stopCheckins = watchCheckins(
    code,
    (all) => {
      const recent = recentCheckins(all, Date.now(), 24);
      $('s-checkins').hidden = recent.length === 0;
      $('checkins').innerHTML = recent
        .map((c) => `<li>${esc(checkinSentence(c))}<small>${new Date(c.createdAt?.toMillis?.() ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small></li>`)
        .join('');
    },
    () => {},
  );
  stopList?.();
  stopList = watchHelpRequests(
    code,
    (all) => {
      state.requests = all.filter((r) => isLive(r));
      renderList();
    },
    (err) => ($('list-note').textContent = `Could not load requests: ${err.message}`),
  );
}

function renderList() {
  const list = state.requests;
  $('list-note').textContent = list.length ? 'Tap a request to help.' : 'No one is asking for help right now. This list updates by itself.';
  $('requests').innerHTML = list
    .map(
      (r) => `<li><button class="request" data-open="${esc(r.id)}"><b>${esc(r.title)}</b>
        <small>${esc(r.host)} · ${r.controls.length} buttons and boxes${r.status === 'answered' ? ' · answered' : ''}</small></button></li>`,
    )
    .join('');
}

$('group-join').addEventListener('click', () => {
  const code = normaliseGroup($('group-code').value);
  if (!GROUP_RE.test(code)) return say('group-msg', 'A group code has 8 letters and numbers, for example K7M2QX4P.', 'bad');
  join(code);
});
$('group-leave').addEventListener('click', () => {
  stopList?.();
  stopAlerts?.();
  stopCheckins?.();
  $('s-alerts').hidden = true;
  $('s-checkins').hidden = true;
  store.del('saathi-helper:group');
  state.group = '';
  show('group');
});
$('requests').addEventListener('click', (ev) => {
  const id = ev.target.closest('[data-open]')?.dataset.open;
  if (id) openRequest(id);
});

// ---------- One request ----------

function openRequest(id) {
  state.open = id;
  state.current = null;
  show('help');
  $('help-title').textContent = 'Loading…';
  $('controls').innerHTML = '';
  stopOne?.();
  stopOne = watchHelp(
    state.group,
    id,
    (data) => {
      state.current = data;
      if (!data) {
        $('help-title').textContent = 'This request is finished';
        $('controls').innerHTML = '';
        return say('help-state', 'The person closed it. Thank you for helping.', 'ok');
      }
      renderRequest(data);
    },
    (err) => say('help-state', `Could not load: ${err.message}`, 'bad'),
  );
}

function renderRequest(data) {
  $('help-title').textContent = data.title;
  $('help-host').textContent = `${data.host} · ${data.controls.length} buttons and boxes`;
  $('controls').innerHTML = groupBySection(data.controls)
    .map(
      (g) => `<h3>${esc(g.section)}</h3>${g.items
        .map(
          (i) => `<button class="control${i.personal ? ' hidden' : ''}" data-pick="${i.index}" aria-pressed="${data.pick === i.index}">
            <span>${i.personal ? 'Hidden label (personal details)' : esc(i.text)}</span><small>${kindWord(i.role)}</small></button>`,
        )
        .join('')}`,
    )
    .join('');
  if (data.pick !== null && data.pick !== undefined) {
    const c = data.controls[data.pick];
    say('help-state', `Lit up on their screen: ${c?.text || 'a hidden control'}. Tap another to change it.`, 'ok');
  }
}

$('controls').addEventListener('click', async (ev) => {
  const index = ev.target.closest('[data-pick]')?.dataset.pick;
  if (index === undefined || !state.current) return;
  say('help-state', 'Sending…');
  try {
    await answerHelp(state.group, state.open, { pick: Number(index), note: cleanNote($('note').value) });
  } catch (err) {
    say('help-state', `Could not send: ${err.message}`, 'bad');
  }
});

$('note-send').addEventListener('click', async () => {
  const pick = state.current?.pick;
  if (pick === null || pick === undefined) return say('help-state', 'Tap a button or box first, then add a note.', 'bad');
  try {
    await answerHelp(state.group, state.open, { pick, note: cleanNote($('note').value) });
    say('help-state', 'Note sent.', 'ok');
  } catch (err) {
    say('help-state', `Could not send: ${err.message}`, 'bad');
  }
});

$('back').addEventListener('click', () => {
  stopOne?.();
  state.open = null;
  show('list');
});

// ---------- Start ----------

if (GROUP_RE.test(state.group)) join(state.group);
else show('group');
