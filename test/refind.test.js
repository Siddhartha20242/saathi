import { describe, it, expect } from 'vitest';
import { textSimilarity, codeFind, candidatesFor, refindPrompt, parseChoice, parseYesNo, refind, anchorFind, narrowToRegion } from '../src/refind.js';
import { buildCases, SITES } from '../src/refindCases.js';

const PAGE = [
  { role: 'link', text: 'Home', section: 'Menu' },
  { role: 'button', text: 'Pay now', section: 'Bill details' },
  { role: 'button', text: 'Remind me later', section: 'Bill details' },
  { role: 'field', text: 'Customer ID', section: 'Bill payment' },
];
const payNow = { role: 'button', text: 'Pay now', section: 'Bill details' };

describe('textSimilarity', () => {
  it('ignores case and punctuation', () => {
    expect(textSimilarity('Pay Now!', 'pay now')).toBe(1);
  });
  it('compares labels written in Devanagari and Bengali', () => {
    expect(textSimilarity('गृहपृष्ठ', 'गृहपृष्ठ ')).toBe(1);
    expect(textSimilarity('गृहपृष्ठ', 'हाम्रो बारे')).toBeLessThan(0.5);
    expect(textSimilarity('অনুসন্ধান', 'অনুসন্ধান')).toBe(1);
  });
  it('is low for labels that only mean the same', () => {
    expect(textSimilarity('Pay now', 'Proceed to payment')).toBeLessThan(0.6);
  });
});

describe('codeFind', () => {
  it('finds a control whose label has not changed, wherever it moved', () => {
    const moved = [PAGE[3], PAGE[2], { ...PAGE[1], section: 'Summary' }, PAGE[0]];
    expect(codeFind(payNow, moved)).toMatchObject({ verdict: 'found', index: 2 });
  });
  it('hands a renamed control to the model', () => {
    const renamed = PAGE.map((e) => (e.text === 'Pay now' ? { ...e, text: 'Proceed to payment' } : e));
    const res = codeFind(payNow, renamed);
    expect(res.verdict).toBe('unclear');
    expect(res.candidates.map((c) => c.text)).toEqual(['Home', 'Proceed to payment', 'Remind me later']);
  });
  it('uses the section to choose between two identical labels', () => {
    const twins = [{ role: 'button', text: 'Continue', section: 'Login' }, { role: 'button', text: 'Continue', section: 'Send money' }];
    expect(codeFind({ role: 'button', text: 'Continue', section: 'Send money' }, twins)).toMatchObject({ verdict: 'found', index: 1 });
  });
  it('only offers controls of the same kind', () => {
    const field = { role: 'field', text: 'Customer ID', section: 'Bill payment' };
    expect(candidatesFor(field, PAGE).map((c) => c.text)).toEqual(['Customer ID']);
  });
});

describe('parseChoice', () => {
  const cands = [{ index: 7 }, { index: 9 }];
  it('maps the number to the element', () => {
    expect(parseChoice('2', cands)).toBe(9);
    expect(parseChoice('Answer: 1.', cands)).toBe(7);
  });
  it('reads 0 as none and rejects anything else', () => {
    expect(parseChoice('0', cands)).toBe('none');
    expect(parseChoice('5', cands)).toBeNull();
    expect(parseChoice('the second one', cands)).toBeNull();
  });
});

describe('refind', () => {
  const renamed = PAGE.map((e) => (e.text === 'Pay now' ? { ...e, text: 'Proceed to payment' } : e));
  // A fake model: answers from a queue and records how often it was asked.
  const fake = (answers) => {
    const queue = answers.slice();
    const ask = async () => queue.shift();
    ask.left = () => queue.length;
    return ask;
  };

  it('uses code alone when the label is unchanged', async () => {
    const ask = fake([]);
    expect(await refind(payNow, PAGE, {}, ask)).toEqual({ index: 1, by: 'code' });
  });
  it('points at the pick when both orders agree and the check says yes', async () => {
    // Candidates are Home, Proceed to payment, Remind me later: 2 in order, 2 when reversed.
    expect(await refind(payNow, renamed, { region: false, strictVerify: false }, fake(['2', '2', 'YES']))).toEqual({ index: 1, by: 'model' });
  });
  it('says not sure when the two orders disagree', async () => {
    const res = await refind(payNow, renamed, { region: false, strictVerify: false }, fake(['2', '1', 'YES']));
    expect(res).toMatchObject({ index: null, reason: 'answers disagreed' });
  });
  it('says not sure when the check says no, or the model says none', async () => {
    expect(await refind(payNow, renamed, { region: false, strictVerify: false }, fake(['2', '2', 'NO']))).toMatchObject({ index: null, reason: 'check failed' });
    const ask = fake(['0', '2', 'YES']);
    expect(await refind(payNow, renamed, { region: false, strictVerify: false }, ask)).toMatchObject({ index: null, reason: 'no match' });
    expect(ask.left()).toBe(2); // stopped after the first answer
  });
  it('finds a renamed control by its link address or internal name, without the model', async () => {
    const page = [
      { role: 'link', text: 'Online bill payment', section: 'Menu', href: '/bill.html', name: '' },
      { role: 'button', text: 'View dues', section: 'Pay', href: '', name: 'show' },
      { role: 'button', text: 'Clear', section: 'Pay', href: '', name: 'clear' },
    ];
    const ask = fake([]);
    expect(await refind({ role: 'link', text: 'Pay your bill', href: '/bill.html' }, page, {}, ask)).toEqual({ index: 0, by: 'anchor' });
    expect(await refind({ role: 'button', text: 'Check bill', name: 'show' }, page, {}, ask)).toEqual({ index: 1, by: 'anchor' });
  });
  it('ignores a front-page link address as an anchor', () => {
    const page = [{ role: 'link', text: 'Start', href: '/' }];
    expect(anchorFind({ role: 'link', text: 'Old', href: '/' }, page)).toBeNull();
  });
  it('treats the same link shown twice as one, preferring the recorded section', () => {
    const page = [
      { role: 'link', text: 'Main Page', section: 'Menu', href: '/wiki/Main_Page' },
      { role: 'link', text: 'Main Page', section: 'Talk', href: '/wiki/Main_Page' },
    ];
    expect(anchorFind({ role: 'link', text: 'Old', section: 'Talk', href: '/wiki/Main_Page' }, page)).toBe(1);
    expect(anchorFind({ role: 'link', text: 'Old', section: 'Elsewhere', href: '/wiki/Main_Page' }, page)).toBe(0);
  });
  it('does not mix up links that share an address but have different labels', () => {
    const page = [
      { role: 'link', text: 'Log in', section: 'Menu', href: '/w/index.php' },
      { role: 'link', text: 'Create account', section: 'Menu', href: '/w/index.php' },
    ];
    expect(anchorFind({ role: 'link', text: 'Sign in', section: 'Menu', href: '/w/index.php' }, page)).toBeNull();
  });
  it('does not trust an anchor that two controls share', async () => {
    const twins = [
      { role: 'button', text: 'A', name: 'go' },
      { role: 'button', text: 'B', name: 'go' },
    ];
    expect(anchorFind({ role: 'button', text: 'Old', name: 'go' }, twins)).toBeNull();
  });
  it('tells the model which answers are allowed', async () => {
    const seen = [];
    const answers = ['2', '2', 'YES'];
    const ask = async (_prompt, schema) => (seen.push(schema), answers.shift());
    await refind(payNow, renamed, { region: false, strictVerify: false }, ask);
    expect(seen[0]).toEqual({ type: 'string', enum: ['0', '1', '2', '3'] });
    expect(seen[2]).toEqual({ type: 'string', enum: ['YES', 'NO'] });
  });
  it('reads structured answers that arrive in quotes', () => {
    expect(parseYesNo('"YES"')).toBe(true);
    expect(parseChoice('"2"', [{ index: 7 }, { index: 9 }])).toBe(9);
  });
  it('offers only the same section first, and the stricter check, by default', async () => {
    const prompts = [];
    // Proceed is 1 in order and 2 when the list is reversed; then the check says yes.
    const ask = async (prompt) => (prompts.push(prompt), ['1', '2', 'YES'][prompts.length - 1]);
    const page = [
      { role: 'link', text: 'Home', section: 'Menu' },
      { role: 'button', text: 'Proceed to payment', section: 'Bill details' },
      { role: 'button', text: 'Remind me later', section: 'Bill details' },
    ];
    const res = await refind({ role: 'button', text: 'Pay now', section: 'Bill details' }, page, { task: 'Pay the bill' }, ask);
    expect(prompts[0]).toContain('1. Proceed to payment');
    expect(prompts[0]).not.toContain('Home');
    expect(prompts[2]).toContain('the very same control');
    expect(res.by).toBe('model');
  });
  it('falls back to every control when the section has none or too many', () => {
    const few = [{ role: 'button', text: 'A', section: 'Elsewhere' }];
    expect(narrowToRegion(few, { section: 'Missing' })).toBe(few);
    const many = Array.from({ length: 41 }, (_, i) => ({ role: 'link', text: `L${i}`, section: 'Menu' }));
    expect(narrowToRegion(many, { section: 'Menu' })).toBe(many);
    expect(narrowToRegion(few, { section: '' })).toBe(few);
  });
  it('never offers a control that belongs to another step', async () => {
    const res = await refind(payNow, renamed, { others: ['Remind me later', 'Home'], region: false }, fake(['1', '1', 'YES']));
    expect(res).toEqual({ index: 1, by: 'model' });
  });
});

describe('refindPrompt', () => {
  it('numbers the candidates and states the task', () => {
    const p = refindPrompt(payNow, candidatesFor(payNow, PAGE), { task: 'Pay the electricity bill', previous: 'Check bill' });
    expect(p).toContain('1. Home (link, under "Menu")');
    expect(p).toContain('Pay the electricity bill');
    expect(p).toContain('"Check bill"');
  });
});

describe('practice sites', () => {
  const cases = buildCases();
  it('builds 80 cases with a valid expected answer', () => {
    expect(SITES).toHaveLength(5);
    expect(cases).toHaveLength(80);
    for (const k of cases) {
      if (k.kind === 'removed') expect(k.expected).toBe('none');
      else expect(k.expected).toBeGreaterThanOrEqual(0);
    }
  });
  it('code alone: reports results, and never points at the wrong control', () => {
    const tally = {};
    let wrong = 0;
    for (const k of cases) {
      const res = codeFind(k.step, k.elements);
      const t = (tally[k.kind] ??= { found: 0, unclear: 0 });
      if (res.verdict === 'found') {
        t.found++;
        if (res.index !== k.expected) wrong++;
      } else t.unclear++;
    }
    console.log('code only:', JSON.stringify(tally), 'wrong:', wrong);
    expect(wrong).toBe(0);
    expect(tally.move.found).toBe(25);
  });
});
