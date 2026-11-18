// Keeps the Saathi pages working with no internet, so a saved guide still opens (its steps are kept by
// Firestore on the device). Pages are fetched fresh when online. Only this site's own files are kept: the
// Firebase and AI calls always go to the network and are never stored.
const CACHE = 'saathi-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/demo-bridge/')) return;

  const store = (res) => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };

  if (req.mode === 'navigate' || /\.(?:html|webmanifest)$/.test(url.pathname)) {
    // Pages: the latest when online, the last one seen when not.
    event.respondWith(fetch(req).then(store).catch(() => caches.match(req).then((hit) => hit || caches.match('/index.html'))));
    return;
  }
  // Hashed files (built scripts, styles, icons): kept after the first time.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then(store)));
});
