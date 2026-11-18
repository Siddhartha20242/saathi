import { describe, it, expect } from 'vitest';
import { whereIs, wanted } from '../src/where.js';

const page = [
  { text: 'Home', href: '/' },
  { text: 'Pay bill', href: '/pay' },
  { text: 'Pay bill', href: '/pay' }, // a logo and a menu entry to the same place
  { text: 'Make a payment', href: '/p2' },
  { text: 'Edit', href: '/e/1', section: 'Row 1' },
  { text: 'Edit', href: '/e/2', section: 'Row 2' },
  { text: 'Sign out', href: '/out' },
  { text: 'भुक्तानी गर्नुहोस्', href: '/np' },
];

describe('wanted', () => {
  it('drops the words around the name', () => {
    expect(wanted('Where is the Pay bill button?')).toBe('pay bill');
    expect(wanted('show me sign out')).toBe('sign out');
    expect(wanted('where is the button')).toBe('where is the button'); // no name given: the whole question is kept
  });
});

describe('whereIs', () => {
  it('finds one control by its name, however the question is phrased', () => {
    expect(whereIs('where is the home button', page)).toEqual({ verdict: 'found', index: 0 });
    expect(whereIs('sign out', page)).toEqual({ verdict: 'found', index: 6 });
  });
  it('treats the same label with the same address as one control', () => {
    expect(whereIs('pay bill', page).verdict).toBe('found');
  });
  it('lists the choices when several controls fit, and never guesses', () => {
    const r = whereIs('edit', page);
    expect(r.verdict).toBe('several');
    expect(r.matches.map((m) => m.section)).toEqual(['Row 1', 'Row 2']);
  });
  it('matches on every word, in any order', () => {
    expect(whereIs('payment make', page)).toEqual({ verdict: 'found', index: 3 });
  });
  it('finds names in Nepali', () => {
    expect(whereIs('भुक्तानी गर्नुहोस्', page)).toEqual({ verdict: 'found', index: 7 });
  });
  it('says none when nothing fits or the question is empty', () => {
    expect(whereIs('refund', page).verdict).toBe('none');
    expect(whereIs('a', page).verdict).toBe('none');
    expect(whereIs('', page).verdict).toBe('none');
    expect(whereIs('pay', [])).toEqual({ verdict: 'none' });
  });
});
