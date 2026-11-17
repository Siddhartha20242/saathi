import { describe, it, expect } from 'vitest';
import { explainPrompt, explainPayloadSummary } from '../src/explain.js';

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
    expect(explainPayloadSummary(big)).toEqual({ labels: 60, typedValues: 0 });
  });
});
