// Makes the page installable and usable offline. Does nothing inside the extension's side panel.
if ('serviceWorker' in navigator && window.parent === window && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
