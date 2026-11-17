// Asks for the microphone once. The browser can show its permission prompt in a normal tab,
// but not always inside the side panel.
const out = document.getElementById('out');
document.getElementById('go').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    out.textContent = 'Done. You can close this tab and press Speak again.';
  } catch (err) {
    out.textContent = err?.name === 'NotFoundError' ? 'No microphone was found.' : 'The microphone was not allowed. Change it in the browser\'s site settings for this page.';
  }
});
