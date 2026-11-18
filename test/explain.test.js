import { describe, it, expect } from 'vitest';
import { explainPrompt, explainPayloadSummary, forPrompt } from '../src/explain.js';

const page = {
  title: 'Pay your bill',
  elements: [
    { role: 'field', text: 'Customer ID', section: 'Bill payment' },
    { role: 'button', text: 'Check bill', section: 'Bill payment' },
    { role: 'link', text: 'Home', section: '' },
  ],
};

describe('explainPrompt', () => {
  it('lists the title and the labels', () => {
    const p = explainPrompt(page);
    expect(p).toContain('Page title: Pay your bill');
    expect(p).toContain('- field: Customer ID (under "Bill payment")');
    expect(p).toContain('- link: Home\n');
  });
  it('caps a long page at 60 controls', () => {
    const big = { title: 'x', elements: Array.from({ length: 200 }, (_, i) => ({ role: 'link', text: `Link ${i}`, section: '' })) };
    const p = explainPrompt(big);
    expect(p).toContain('Link 59');
    expect(p).not.toContain('Link 60');
    expect(explainPayloadSummary(big)).toEqual({ labels: 60, hidden: 0, typedValues: 0 });
  });  it('describes what is on screen first, on a long page', () => {
    const long = { title: 'x', elements: Array.from({ length: 300 }, (_, i) => ({ role: 'link', text: `Link ${i}`, section: '', inView: i >= 200 && i < 210 })) };
    expect(forPrompt(long).map((e) => e.text)).toEqual(Array.from({ length: 10 }, (_, i) => `Link ${200 + i}`));
    expect(explainPrompt(long)).not.toContain('Link 0\n');
    expect(explainPayloadSummary(long)).toEqual({ labels: 10, hidden: 0, typedValues: 0 });
  });
});
