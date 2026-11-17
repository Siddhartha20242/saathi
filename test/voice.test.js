import { describe, it, expect } from 'vitest';
import { encodeWav, peak, MIN_PEAK } from '../src/audio.js';
import { voicePrompt, parseVoice, pathLines, VOICE_SCHEMA } from '../src/voice.js';

const paths = [
  { title: 'Pay the electricity bill', translations: { ne: { title: 'बिजुली बिल तिर्नुहोस्' }, hi: { title: 'बिजली का बिल भरें' } } },
  { title: 'Renew passport' },
];

describe('encodeWav', () => {
  const view = (samples) => new DataView(encodeWav(new Float32Array(samples), 16000));
  const tag = (v, at) => String.fromCharCode(v.getUint8(at), v.getUint8(at + 1), v.getUint8(at + 2), v.getUint8(at + 3));
  it('writes a valid mono 16-bit WAV header', () => {
    const v = view([0, 0.5, -0.5, 1]);
    expect([tag(v, 0), tag(v, 8), tag(v, 12), tag(v, 36)]).toEqual(['RIFF', 'WAVE', 'fmt ', 'data']);
    expect(v.getUint16(20, true)).toBe(1); // PCM
    expect(v.getUint16(22, true)).toBe(1); // mono
    expect(v.getUint32(24, true)).toBe(16000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(8); // 4 samples, 2 bytes each
    expect(v.getUint32(4, true)).toBe(36 + 8);
    expect(v.byteLength).toBe(44 + 8);
  });
  it('converts samples to 16-bit values and clips anything outside -1 to 1', () => {
    const v = view([0, 1, -1, 5, -5]);
    expect([0, 1, 2, 3, 4].map((i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
});

describe('peak', () => {
  it('finds the loudest sample, and tells silence from speech', () => {
    expect(peak(new Float32Array([0.1, -0.4, 0.2]))).toBeCloseTo(0.4);
    expect(peak(new Float32Array(1000))).toBeLessThan(MIN_PEAK);
    expect(peak(new Float32Array([0.2]))).toBeGreaterThan(MIN_PEAK);
  });
});

describe('voice request', () => {
  it('lists the paths with the translations the group already has', () => {
    expect(pathLines(paths)).toEqual([
      '1. Pay the electricity bill (नेपाली: बिजुली बिल तिर्नुहोस्; हिन्दी: बिजली का बिल भरें)',
      '2. Renew passport',
    ]);
  });
  it('puts only the path titles in the prompt, and tells the model not to guess', () => {
    const p = voicePrompt(paths);
    expect(p).toContain('1. Pay the electricity bill');
    expect(p).toContain('Use 0 if no guide clearly matches');
    expect(p).not.toMatch(/steps|href|http/i);
  });
  it('asks for a fixed shape', () => {
    expect(VOICE_SCHEMA.required).toEqual(['heard', 'english', 'path']);
  });
});

describe('parseVoice', () => {
  it('reads what was heard and which path was chosen', () => {
    const r = parseVoice('{"heard":"मलाई बिजुली बिल तिर्नु छ","english":"I need to pay the electricity bill","path":1}', 2);
    expect(r).toEqual({ heard: 'मलाई बिजुली बिल तिर्नु छ', english: 'I need to pay the electricity bill', index: 0 });
  });
  it('treats 0, out of range, and a non-number as no match', () => {
    expect(parseVoice('{"heard":"x","english":"y","path":0}', 2).index).toBeNull();
    expect(parseVoice('{"heard":"x","english":"y","path":3}', 2).index).toBeNull();
    expect(parseVoice('{"heard":"x","english":"y","path":"two"}', 2).index).toBeNull();
    expect(parseVoice('{"heard":"x","english":"y","path":1.5}', 2).index).toBeNull();
  });
  it('survives anything that is not the expected JSON', () => {
    expect(parseVoice('I think the first one', 2)).toEqual({ heard: '', english: '', index: null });
    expect(parseVoice('', 2).index).toBeNull();
  });
});
