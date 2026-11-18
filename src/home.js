// The home page: says what this device can do, whether the on-device model is here, and offers to install.

const $ = (id) => document.getElementById(id);

const touch = matchMedia('(pointer: coarse)').matches;
const narrow = Math.min(screen.width, screen.height) < 800;
const mobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const kind = mobileUA || (touch && narrow) ? 'phone' : 'computer';
const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inApp = typeof window.Capacitor !== 'undefined'; // the Android app is a native shell around this site
const standalone = inApp || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

for (const row of document.querySelectorAll('#matrix tr[data-kind]')) {
  row.classList.toggle('here', row.dataset.kind === kind);
}

$('here').textContent = `${kind === 'phone' ? 'Phone or tablet' : 'Computer'}${inApp ? ', Saathi Android app' : standalone ? ', installed' : ''}`;

(async () => {
  let status = 'unsupported';
  try {
    if (typeof LanguageModel !== 'undefined') status = await LanguageModel.availability();
  } catch {
    status = 'unsupported';
  }
  const ready = status === 'available';
  $('ai-dot').className = `dot${ready ? ' ok' : ''}`;
  $('ai-note').textContent = ready
    ? 'The on-device model is ready here. Short tasks stay on this device. Nothing is sent.'
    : status === 'downloadable' || status === 'downloading'
      ? 'The on-device model can be downloaded in Chrome. Until then the cloud model answers, and only button names are sent.'
      : 'No on-device model on this device, so the cloud model answers. Only button names are sent, never the page.';
})();

// Install: Android and desktop Chrome offer a prompt. iPhone and iPad need "Add to Home Screen".
let offered = null;
addEventListener('beforeinstallprompt', (ev) => {
  ev.preventDefault();
  offered = ev;
  $('install').hidden = false;
});
$('install').addEventListener('click', async () => {
  if (!offered) return;
  offered.prompt();
  await offered.userChoice.catch(() => {});
  offered = null;
  $('install').hidden = true;
});
addEventListener('appinstalled', () => {
  $('install-note').textContent = 'Installed. Open Saathi from your home screen.';
  $('install').hidden = true;
});
if (standalone) {
  $('install-card').hidden = true;
} else if (ios) {
  $('install-note').textContent = 'Press the Share button, then "Add to Home Screen". It works like an app and still opens with no internet.';
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
