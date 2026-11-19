import { describe, it, expect } from 'vitest';
import { planSpeech, deviceFallback, spokenText, ttsPrompt, MAX_SPOKEN } from '../src/tts.js';
import { pickTtsModel, DEFAULT_TTS_MODEL } from '../src/firebase.js';

const en = { lang: 'en-US' };
const hi = { lang: 'hi-IN' };
const ne = { lang: 'ne-NP' };

describe('planSpeech', () => {
  it('uses the device voice for English when there is one', () => {
    expect(planSpeech([en], 'en', { cloudEnabled: true }).source).toBe('device');
  });
  it('uses the cloud voice for English when the device has none', () => {
    expect(planSpeech([], 'en', { cloudEnabled: true }).source).toBe('cloud');
    expect(planSpeech([], 'en', { cloudEnabled: false }).source).toBe('none');
  });
  it('does not use the cloud voice when the person turned it off, or when the daily limit was reached', () => {
    expect(planSpeech([hi], 'hi', { cloudEnabled: true, cloudVoice: false }).source).toBe('device');
    expect(planSpeech([hi], 'ne', { cloudEnabled: true, blocked: true })).toMatchObject({ source: 'device', fallback: true });
    expect(planSpeech([], 'ne', { cloudEnabled: true, blocked: true }).source).toBe('none');
  });
  it('uses the cloud voice for Nepali and Hindi when the cloud is on, even if the device has a voice', () => {
    expect(planSpeech([ne, hi], 'ne', { cloudEnabled: true }).source).toBe('cloud');
    expect(planSpeech([hi], 'hi', { cloudEnabled: true }).source).toBe('cloud');
  });
  it('with the cloud off, uses the device voice, and a Hindi voice for Nepali is marked as a fallback', () => {
    expect(planSpeech([hi], 'hi', { cloudEnabled: false }).source).toBe('device');
    const p = planSpeech([hi], 'ne', { cloudEnabled: false });
    expect(p).toMatchObject({ source: 'device', fallback: true });
    expect(planSpeech([en], 'ne', { cloudEnabled: false }).source).toBe('none');
  });
});

describe('deviceFallback', () => {
  it('gives the device voice, or none', () => {
    expect(deviceFallback([hi], 'ne')).toMatchObject({ source: 'device', fallback: true });
    expect(deviceFallback([en], 'ne').source).toBe('none');
  });
});

describe('what is sent to the voice model', () => {
  it('is one short sentence, cleaned, with a plain instruction', () => {
    expect(spokenText('  hello\n\nthere  ')).toBe('hello there');
    expect(spokenText('x'.repeat(2000)).length).toBe(MAX_SPOKEN);
    const p = ttsPrompt('Press the link "Pay your bill".');
    expect(p).toContain('slowly');
    expect(p).toContain('Pay your bill');
    expect(p.length).toBeLessThan(MAX_SPOKEN + 120);
  });
});

describe('pickTtsModel', () => {
  it('accepts only Gemini 3 text-to-speech names', () => {
    expect(pickTtsModel('gemini-3.1-flash-tts-preview')).toBe('gemini-3.1-flash-tts-preview');
    for (const v of ['', undefined, 'gemini-3.5-flash-lite', 'gemini-2.5-flash-tts', 'tts', 'gemini-3.1-flash-tts-preview; x']) {
      expect(pickTtsModel(v), String(v)).toBe(DEFAULT_TTS_MODEL);
    }
  });
});

import { wavFromPcm, playable } from '../src/tts.js';
describe('playable audio', () => {
  it('wraps raw PCM in a WAV header, with the rate from the type', () => {
    const wav = wavFromPcm(new Uint8Array([1, 2, 3, 4]), 24000);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe('WAVE');
    expect(wav.length).toBe(48);
    expect(new DataView(wav.buffer).getUint32(24, true)).toBe(24000);
    const p = playable(new Uint8Array([0, 0, 0, 0]), 'audio/L16;rate=16000');
    expect(p.type).toBe('audio/wav');
    expect(new DataView(p.bytes.buffer).getUint32(24, true)).toBe(16000);
  });
  it('leaves a WAV alone, even when the type is wrong', () => {
    const riff = new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0, 87, 65, 86, 69, 1]);
    expect(playable(riff, 'audio/mpeg').bytes).toBe(riff);
    expect(playable(new Uint8Array(20), 'audio/wav').type).toBe('audio/wav');
  });
  it('lets other types play as they are', () => {
    expect(playable(new Uint8Array(20), 'audio/mpeg').type).toBe('audio/mpeg');
  });
});

import { isQuotaError } from '../src/tts.js';
describe('isQuotaError', () => {
  it('recognises the free daily limit and rate limits', () => {
    expect(isQuotaError(new Error('AI: Error fetching ...: [429 ] You exceeded your current quota'))).toBe(true);
    expect(isQuotaError({ message: 'RESOURCE_EXHAUSTED' })).toBe(true);
    expect(isQuotaError(new Error('Too many requests'))).toBe(true);
  });
  it('does not treat other failures as a limit', () => {
    expect(isQuotaError(new Error('[401 ] App Check token is invalid'))).toBe(false);
    expect(isQuotaError(new Error('No audio came back'))).toBe(false);
    expect(isQuotaError(undefined)).toBe(false);
  });
});
