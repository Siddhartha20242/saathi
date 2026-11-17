import { describe, it, expect } from 'vitest';
import { cleanAlert, alertsForMe, alertSentence, MAX_REASONS } from '../src/alerts.js';

const at = (ms) => ({ toMillis: () => ms });
const NOW = 1_000_000_000_000;

describe('cleanAlert', () => {
  it('keeps only the address, the brand, the level and reason codes', () => {
    const a = cleanAlert({ host: 'fake.top', brand: 'Nabil Bank', level: 'stop', reasons: ['pretends', 'asksSecret'], title: 'secret title', text: 'page words', url: 'https://fake.top/x?id=1' });
    expect(a).toEqual({ host: 'fake.top', brand: 'Nabil Bank', level: 'stop', reasons: ['pretends', 'asksSecret'] });
  });
  it('drops anything in a reason that is not a plain code, and limits how many', () => {
    const a = cleanAlert({ host: 'x.top', reasons: ['ok', 'has space', '<script>', 'a'.repeat(40), ...Array(20).fill('urgency')] });
    expect(a.reasons.every((r) => /^[a-zA-Z]{3,20}$/.test(r))).toBe(true);
    expect(a.reasons.length).toBeLessThanOrEqual(MAX_REASONS);
  });
  it('strips odd characters from the address, and defaults to stop', () => {
    expect(cleanAlert({ host: 'fake.top/path?x=1 secret' }).host).toBe('fake.toppathx1secret'.slice(0, 100));
    expect(cleanAlert({ host: 'a.top' }).level).toBe('stop');
    expect(cleanAlert({ host: 'a.top', level: 'careful' }).level).toBe('careful');
  });
});

describe('alertsForMe', () => {
  const list = [
    { id: 'a', createdBy: 'me', createdAt: at(NOW - 1000) },
    { id: 'b', createdBy: 'mum', createdAt: at(NOW - 3600e3) },
    { id: 'c', createdBy: 'dad', createdAt: at(NOW - 60e3) },
    { id: 'd', createdBy: 'dad', createdAt: at(NOW - 30 * 3600e3) },
    { id: 'e', createdBy: 'dad', createdAt: at(NOW - 120e3), expiresAt: at(NOW - 1) },
  ];
  it('shows other people\'s recent alerts, newest first', () => {
    expect(alertsForMe(list, 'me', [], NOW).map((a) => a.id)).toEqual(['c', 'b']);
  });
  it('leaves out my own, old, expired and already-seen alerts', () => {
    expect(alertsForMe(list, 'me', ['c'], NOW).map((a) => a.id)).toEqual(['b']);
  });
});

describe('alertSentence', () => {
  it('describes the alert in plain English', () => {
    expect(alertSentence({ host: 'fake.top', brand: 'Nabil Bank', reasons: ['pretends'] })).toContain('a page pretending to be Nabil Bank (fake.top)');
  });
});
