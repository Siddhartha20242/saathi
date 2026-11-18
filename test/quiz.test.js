import { describe, it, expect } from 'vitest';
import { CARDS, buildRound, quizText, rng, ROUND } from '../src/quiz.js';
import { assessMessage } from '../src/messageCheck.js';

describe('the quiz cards agree with the message checker', () => {
  it('every scam card gets a warning from the checker, and every ordinary card gets none', () => {
    for (const c of CARDS) {
      const level = assessMessage(c.text).level;
      expect(`${c.id}: ${c.scam ? level !== 'ok' : level === 'ok'}`).toBe(`${c.id}: true`);
    }
  });
  it('every scam card has reasons to show', () => {
    for (const c of CARDS.filter((x) => x.scam)) expect(assessMessage(c.text).reasons.length).toBeGreaterThan(0);
  });
  it('has enough cards of each kind for a round', () => {
    expect(CARDS.filter((c) => c.scam).length).toBeGreaterThanOrEqual(ROUND / 2);
    expect(CARDS.filter((c) => !c.scam).length).toBeGreaterThanOrEqual(ROUND / 2);
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(CARDS.length);
  });
});

describe('buildRound', () => {
  it('gives half scams and half ordinary messages, with no repeats', () => {
    for (const seed of [1, 2, 3, 99, 12345]) {
      const r = buildRound(seed);
      expect(r.length).toBe(ROUND);
      expect(r.filter((c) => c.scam).length).toBe(ROUND / 2);
      expect(new Set(r.map((c) => c.id)).size).toBe(ROUND);
    }
  });
  it('is repeatable for a seed and different between seeds', () => {
    expect(buildRound(7).map((c) => c.id)).toEqual(buildRound(7).map((c) => c.id));
    const orders = new Set([1, 2, 3, 4, 5, 6].map((s) => buildRound(s).map((c) => c.id).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('rng stays in [0, 1)', () => {
    const r = rng(5);
    for (let i = 0; i < 1000; i++) {
      const x = r();
      expect(x >= 0 && x < 1).toBe(true);
    }
  });
});

describe('quizText', () => {
  it('has every string in all three languages', () => {
    const en = quizText('en');
    for (const lang of ['ne', 'hi']) {
      const t = quizText(lang);
      expect(Object.keys(t).sort()).toEqual(Object.keys(en).sort());
      for (const key of Object.keys(en)) {
        const v = typeof t[key] === 'function' ? t[key](3, 6) : t[key];
        expect(String(v)).toMatch(/[ऀ-ॿ]/);
      }
    }
  });
  it('falls back to English', () => {
    expect(quizText('xx').start).toBe('Start practice');
  });
});
