// The family app and the helper page show their screen first and load the Firebase code (about 200 KB compressed) in
// the background. Every call here waits for that code, so nothing runs early; the screen is just not held up by it.

let firebase;
let backend;
export const warm = () => {
  firebase ??= import('./firebase.js');
  backend ??= import('./backend.js');
  return Promise.all([firebase, backend]);
};
warm().catch(() => {}); // start downloading at once; a failure shows up on the first real call

const fb = () => (firebase ??= import('./firebase.js'));
const be = () => (backend ??= import('./backend.js'));

export const run = (...a) => fb().then((m) => m.run(...a));
export const synthesize = (...a) => fb().then((m) => m.synthesize(...a));

const call = (name) => (...a) => be().then((m) => m[name](...a));
export const ensureUser = call('ensureUser');
export const loadConfig = call('loadConfig');
export const savePath = call('savePath');
export const listPaths = call('listPaths');
export const deletePath = call('deletePath');
export const translatePath = call('translatePath');
export const createHelp = call('createHelp');
export const closeHelp = call('closeHelp');
export const answerHelp = call('answerHelp');
export const createAlert = call('createAlert');
export const createCheckin = call('createCheckin');
export const cleanUpOwn = call('cleanUpOwn');

// Watchers hand back a function that stops them. Here that function exists at once and stops the watcher once it is running.
const watcher = (name) => (...a) => {
  let stop = null;
  let stopped = false;
  be().then((m) => {
    if (stopped) return;
    stop = m[name](...a);
  }).catch((err) => a[a.length - 1]?.(err));
  return () => {
    stopped = true;
    try { stop?.(); } catch { /* already stopped */ }
  };
};
export const watchHelp = watcher('watchHelp');
export const watchHelpRequests = watcher('watchHelpRequests');
export const watchAlerts = watcher('watchAlerts');
export const watchCheckins = watcher('watchCheckins');
