// Recording a short spoken request and turning it into a 16 kHz mono WAV file, which the cloud model
// accepts. The recording stays in memory: it is sent once, when the person presses the button, and is
// never stored.

const RATE = 16000;

/** Packs samples (floats from -1 to 1) into the bytes of a 16-bit mono WAV file. */
export function encodeWav(samples, sampleRate = RATE) {
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const text = (at, s) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true); // size of this block
  view.setUint16(20, 1, true); // plain PCM
  view.setUint16(22, 1, true); // one channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((s, i) => {
    const clamped = Math.max(-1, Math.min(1, s));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  });
  return bytes;
}

/** The loudest sample, 0 to 1. A recording of near silence has nothing to understand. */
export function peak(samples) {
  let max = 0;
  for (const s of samples) max = Math.max(max, Math.abs(s));
  return max;
}

export const MIN_PEAK = 0.02;

async function toSamples(blob) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * RATE)), RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return (await offline.startRendering()).getChannelData(0);
  } finally {
    context.close();
  }
}

/**
 * Listens until `stop` resolves or `maxMs` passes, then returns the speech as a WAV Blob, or null if
 * nothing was heard. Throws the browser's own error if the microphone is refused.
 * @param {{ maxMs?: number, stop?: Promise<unknown> }} [options]
 */
export async function recordSpeech({ maxMs = 8000, stop = new Promise(() => {}) } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  let recorder;
  try {
    recorder = new MediaRecorder(stream);
  } catch (err) {
    stream.getTracks().forEach((t) => t.stop()); // do not leave the microphone on
    throw err;
  }
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const finished = new Promise((resolve) => (recorder.onstop = resolve));
  recorder.start();
  await Promise.race([new Promise((resolve) => setTimeout(resolve, maxMs)), stop]);
  if (recorder.state !== 'inactive') recorder.stop();
  await finished;
  stream.getTracks().forEach((t) => t.stop());

  const samples = await toSamples(new Blob(chunks, { type: recorder.mimeType }));
  if (peak(samples) < MIN_PEAK) return null;
  return new Blob([encodeWav(samples)], { type: 'audio/wav' });
}
