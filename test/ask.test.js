import { describe, it, expect } from 'vitest';
import { cleanQuestion, askMode, askPrompt, cleanAnswer, MAX_QUESTION } from '../src/ask.js';

describe('cleanQuestion', () => {
  it('trims, shortens and masks personal details', () => {
    expect(cleanQuestion('  what   is\nthis? ')).toBe('what is this?');
    expect(cleanQuestion('x'.repeat(500)).length).toBeLessThanOrEqual(MAX_QUESTION);
    const q = cleanQuestion('my number is 9841234567 and email ram@example.com, what do I press?');
    expect(q).not.toMatch(/9841234567|ram@example\.com/);
    expect(q).toContain('what do I press');
  });
  it('handles nothing', () => {
    expect(cleanQuestion(undefined)).toBe('');
  });
});

describe('askMode', () => {
  it('uses the on-device model for English when it is there', () => {
    expect(askMode('en', { cloudEnabled: true, deviceAvailable: true })).toEqual({ mode: 'PREFER_ON_DEVICE' });
  });
  it('uses the cloud for English when the model is not there', () => {
    expect(askMode('en', { cloudEnabled: true, deviceAvailable: false })).toEqual({ mode: 'ONLY_IN_CLOUD' });
  });
  it('needs the cloud for Nepali and Hindi, even with the on-device model', () => {
    expect(askMode('ne', { cloudEnabled: true, deviceAvailable: true })).toEqual({ mode: 'ONLY_IN_CLOUD' });
    expect(askMode('hi', { cloudEnabled: false, deviceAvailable: true })).toMatchObject({ mode: null, why: 'needs-cloud' });
  });
  it('says so when nothing can answer', () => {
    expect(askMode('en', { cloudEnabled: false, deviceAvailable: false })).toMatchObject({ mode: null, why: 'no-model' });
  });
});

describe('askPrompt', () => {
  const p = askPrompt({ lang: 'ne', title: 'Pay the bill', step: 'Press "Check bill"', question: 'what is this?' });
  it('names the language, the step and the question, and holds the safety rules', () => {
    expect(p).toContain('Nepali');
    expect(p).toContain('Press "Check bill"');
    expect(p).toContain('what is this?');
    expect(p).toMatch(/Never tell them to type a password/);
    expect(p).toMatch(/cannot see their screen/);
  });
  it('sends no page content: only the guide name, the step and the question', () => {
    expect(p.length).toBeLessThan(1200);
  });
});

describe('cleanAnswer', () => {
  it('removes markdown and long runs', () => {
    expect(cleanAnswer('**Press** the `button`.\n\n\n\nThen wait.')).toBe('Press the button.\nThen wait.');
    expect(cleanAnswer('a'.repeat(2000)).length).toBe(600);
    expect(cleanAnswer(null)).toBe('');
  });
});
