// Firebase side of Saathi: anonymous sign-in (Auth), shared paths (Firestore, kept on this laptop
// too so a saved path still opens with no internet), settings (Remote Config), and the cloud
// translation of a path's step instructions (AI Logic, cloud only, labels only).

import { getAuth, signInAnonymously } from 'firebase/auth';
import {
  initializeFirestore, getFirestore, persistentLocalCache, collection, doc, setDoc, getDocs, deleteDoc, updateDoc,
  onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { getRemoteConfig, fetchAndActivate, getValue } from 'firebase/remote-config';
import { getFirebaseApp, run } from './firebase.js';
import { stepInstruction } from './path.js';

let auth = null;
let db = null;
let rc = null;

function services() {
  const app = getFirebaseApp();
  if (!auth) {
    auth = getAuth(app);
    try {
      db = initializeFirestore(app, { localCache: persistentLocalCache() });
    } catch {
      db = getFirestore(app);
    }
  }
  return { auth, db };
}

/** Signs in without a name or password. A person is only a random id here. */
export async function ensureUser() {
  const { auth } = services();
  await auth.authStateReady();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

// ---------- Remote Config ----------

const DEFAULTS = { cloud_enabled: true, max_labels: 60, languages: 'ne,hi' };

export function parseLanguages(text) {
  return String(text ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s === 'ne' || s === 'hi');
}

/** Settings from Remote Config. Falls back to built-in defaults when it cannot be reached. */
export async function loadConfig() {
  try {
    if (!rc) {
      rc = getRemoteConfig(getFirebaseApp());
      rc.defaultConfig = DEFAULTS;
      rc.settings.minimumFetchIntervalMillis = 15000;
    }
    await fetchAndActivate(rc);
  } catch {
    // keep defaults
  }
  const get = (k) => (rc ? getValue(rc, k) : null);
  const cloud = get('cloud_enabled');
  const labels = get('max_labels');
  const langs = get('languages');
  return {
    cloudEnabled: cloud ? cloud.asBoolean() : DEFAULTS.cloud_enabled,
    maxLabels: Math.min(150, Math.max(10, (labels && labels.asNumber()) || DEFAULTS.max_labels)),
    languages: parseLanguages(langs ? langs.asString() : DEFAULTS.languages),
    source: cloud ? cloud.getSource() : 'default',
  };
}

// ---------- Shared paths (Firestore) ----------

const pathsOf = (code) => collection(services().db, 'groups', code, 'paths');

export async function savePath(code, { title, host, steps, translations }) {
  const user = await ensureUser();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await setDoc(doc(pathsOf(code), id), {
    title,
    host,
    steps,
    translations: translations ?? {},
    createdBy: user.uid,
    createdAt: serverTimestamp(),
  });
  return id;
}

export async function listPaths(code) {
  const user = await ensureUser();
  const snap = await getDocs(pathsOf(code));
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data(), mine: d.data().createdBy === user.uid, fromCache: snap.metadata.fromCache }))
    .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
}

export async function deletePath(code, id) {
  await ensureUser();
  await deleteDoc(doc(pathsOf(code), id));
}

// ---------- Live help (Firestore, real-time) ----------
// A help request holds the names of the controls on one page. The helper's tap is written back as
// `pick`, and the person's panel sees it at once.

const helpOf = (code) => collection(services().db, 'groups', code, 'help');
const HELP_MINUTES = 120;

export async function createHelp(code, { title, host, controls }) {
  const user = await ensureUser();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  await setDoc(doc(helpOf(code), id), {
    title,
    host,
    controls,
    pick: null,
    note: '',
    status: 'open',
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    expiresAt: Timestamp.fromMillis(Date.now() + HELP_MINUTES * 60000),
  });
  return id;
}

/** Calls back with the request each time the helper changes it. Returns a function that stops listening. */
export function watchHelp(code, id, onChange, onError) {
  return onSnapshot(
    doc(helpOf(code), id),
    (snap) => onChange(snap.exists() ? { id, ...snap.data() } : null),
    onError,
  );
}

/** Calls back with every request in the group, newest first. Returns a function that stops listening. */
export function watchHelpRequests(code, onChange, onError) {
  return onSnapshot(
    helpOf(code),
    (snap) =>
      onChange(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0)),
      ),
    onError,
  );
}

/** The helper's answer: which control to point at, and an optional short note. */
export async function answerHelp(code, id, { pick, note }) {
  await ensureUser();
  await updateDoc(doc(helpOf(code), id), { pick, note: note ?? '', status: 'answered' });
}

export async function closeHelp(code, id) {
  await ensureUser();
  await deleteDoc(doc(helpOf(code), id));
}

// ---------- Translation (cloud, labels only) ----------

const LANG_NAMES = { ne: 'Nepali (Devanagari script)', hi: 'Hindi (Devanagari script)' };

export const TRANSLATION_SCHEMA = {
  type: 'object',
  properties: { title: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } } },
  required: ['title', 'steps'],
};

export function translationPrompt(lang, title, instructions) {
  return `Translate these instructions for a person who is not used to computers. Use simple everyday ${LANG_NAMES[lang]}.
Keep any text inside straight double quotes exactly as written: it is a label on a website and must not be translated.
Translate only what is written. Do not add colours, positions or any other detail that is not in the step.
Return the title and the same number of steps, in the same order.

Title: ${title}
Steps:
${instructions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
}

/** What the cloud is sent for a translation. Shown to the person as the privacy receipt. */
export function translationPayload(title, steps) {
  return { title, instructions: steps.map(stepInstruction), typedValues: 0 };
}

export async function translatePath({ title, steps }, languages) {
  const instructions = steps.map(stepInstruction);
  const out = {};
  for (const lang of languages) {
    const { text } = await run({
      mode: 'ONLY_IN_CLOUD',
      prompt: translationPrompt(lang, title, instructions),
      schema: TRANSLATION_SCHEMA,
    });
    const parsed = JSON.parse(text);
    // Only keep a translation that lines up with the steps.
    if (typeof parsed.title === 'string' && Array.isArray(parsed.steps) && parsed.steps.length === steps.length) {
      out[lang] = { title: parsed.title, steps: parsed.steps.map(String) };
    }
  }
  return out;
}
