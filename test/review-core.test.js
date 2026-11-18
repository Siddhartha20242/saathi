import { describe, it, expect } from 'vitest';
import { maskText, isPersonalText, isPersonalControl, normaliseDigits } from '../src/masking.js';
import { sanitizeStep, safePath } from '../src/path.js';
import { controlsForHelp, cleanTitle } from '../src/help.js';
import { explainPrompt, explainPayloadSummary } from '../src/explain.js';
import { codeFind, anchorFind, refind, textSimilarity } from '../src/refind.js';

// Cases from an independent review of the older code. Each one failed before the fix.

describe('personal labels are recognised', () => {
  const personal = [
    'Hello, Ram Sharma', 'Welcome back Sita', 'Sign out Ram Sharma', 'Logged in as ram_sharma', 'Profile: ram.sharma', 'Hello Ram',
    'नमस्ते, राम शर्मा', 'खाता ९८४१२३४५६७', '**** 1234', 'Card ending 4321', 'xxxx 4321', 'Account 0123456789', 'ram@gmail.com', '9841234567',
  ];
  for (const label of personal) {
    it(`hides "${label}"`, () => expect(isPersonalText(label)).toBe(true));
  }
  const ordinary = [
    'Pay your bill', 'Sign out', 'Log out All Devices', 'Welcome Back', 'Profile Settings', 'Check bill', 'View dues',
    'Proceed to payment', 'बिल तिर्नुहोस्', 'खाता हेर्नुहोस्', 'Download statement', 'Branch office',
  ];
  for (const label of ordinary) {
    it(`keeps "${label}"`, () => expect(isPersonalText(label)).toBe(false));
  }
  it('turns Devanagari digits into ordinary digits', () => {
    expect(normaliseDigits('खाता ९८४१२३४५६७')).toBe('खाता 9841234567');
  });
  it('treats a name-only label in the account corner as personal, but keeps plain words there', () => {
    expect(isPersonalControl('Ram Sharma', true)).toBe(true);
    expect(isPersonalControl('Ram Sharma', false)).toBe(false); // not in the account corner: cannot tell from "Pay Bill"
    expect(isPersonalControl('Sign out', true)).toBe(false);
    expect(isPersonalControl('Settings', true)).toBe(false);
  });
});

describe('what is stored and sent', () => {
  it('a step drops a personal label, a personal path, a personal href and a personal name', () => {
    const s = sanitizeStep({ role: 'link', text: 'Hello, Ram Sharma', section: 'Account 0123456789', page: '/u/ram.sharma/reset/abcDEF123tok', href: '/accounts/0123456789/statement', name: 'ram@gmail.com' });
    expect(s.text).toBe('');
    expect(s.personal).toBe(true);
    expect(s.section).toBe('');
    expect(s.page).not.toMatch(/ram|abcDEF|\d{3,}/);
    expect(s.href).not.toMatch(/\d{3,}/);
    expect(s.name).toBe('');
  });
  it('a name-only label from the account corner is dropped', () => {
    expect(sanitizeStep({ role: 'button', text: 'Ram Sharma', acct: true }).personal).toBe(true);
    expect(sanitizeStep({ role: 'button', text: 'Pay your bill', acct: false }).text).toBe('Pay your bill');
  });
  it('safePath keeps ordinary paths and hides tokens, numbers and names', () => {
    expect(safePath('/pay/bill')).toBe('/pay/bill');
    expect(safePath('/reset-password/abcDEF123tok')).toBe('/reset-password/~');
    expect(safePath('/accounts/0123456789/statement')).toBe('/accounts/~/statement');
    expect(safePath('/u/ram@gmail.com/inbox')).toBe('/u/~/inbox');
    expect(safePath('/u/ram.sharma/reset/abcDEF123tok')).toBe('/u/~/reset/~');
    expect(safePath('/pay/index.html')).toBe('/pay/index.html');
    expect(safePath('/wiki/Main_Page')).toBe('/wiki/Main_Page');
    expect(safePath('/wiki/Talk:Main_Page')).toBe('/wiki/Talk:Main_Page');
    expect(safePath('/user/ram_sharma/settings')).toBe('/user/~/settings');
  });
  it('the help list leaves out personal labels and sections, and a personal page title', () => {
    const c = controlsForHelp([{ role: 'button', text: 'Hello, Ram Sharma', section: 'Account 0123456789' }, { role: 'button', text: 'Pay now', section: 'Bills' }]);
    expect(c[0]).toMatchObject({ text: '', section: '', personal: true });
    expect(c[1]).toMatchObject({ text: 'Pay now', section: 'Bills', personal: false });
    expect(cleanTitle('Inbox (ram@gmail.com) - Gmail', 'mail.example.com')).toBe('mail.example.com');
    expect(cleanTitle('Pay your bill', 'x.com')).toBe('Pay your bill');
  });
  it('the explain prompt leaves out a personal title, label and heading', () => {
    const page = { title: 'Inbox (ram@gmail.com) - Gmail', elements: [{ role: 'button', text: 'Ram Sharma', acct: true, section: 'Account 0123456789', inView: true }, { role: 'link', text: 'Compose', section: 'Mail', inView: true }] };
    const p = explainPrompt(page);
    expect(p).not.toMatch(/ram@gmail|Ram Sharma|0123456789/);
    expect(p).toMatch(/Compose/);
    expect(explainPayloadSummary(page).hidden).toBe(1);
  });
});

describe('finding a step again never guesses between near-twins', () => {
  const el = (text, extra = {}) => ({ role: 'button', text, section: 'x', ...extra });
  const step = (text, extra = {}) => ({ role: 'button', text, section: 'x', ...extra });
  it('does not accept a label that is one character away', () => {
    for (const [a, b] of [['Send money to Sita', 'Send money to Gita'], ['Pay Rs 500 now', 'Pay Rs 5000 now'], ['Turn on notifications', 'Turn off notifications'], ['Delete selected messages', 'Delete selected message']]) {
      expect(textSimilarity(a, b)).toBeGreaterThan(0.85); // alike in spelling
      expect(codeFind(step(a), [el(b)]).verdict).not.toBe('found');
    }
  });
  it('still accepts the same label with different capitals or punctuation', () => {
    expect(codeFind(step('Pay now'), [el('PAY NOW!')]).verdict).toBe('found');
  });
  it('lets the link address decide before a close label', async () => {
    const found = await refind(step('Pay Rs 500 now', { role: 'link', href: '/pay/500' }), [el('Pay Rs 5000 now', { role: 'link', href: '/pay/5000' }), el('Pay now', { role: 'link', href: '/pay/500' })], {}, async () => '0');
    expect(found.index).toBe(1);
    expect(found.by).toBe('anchor');
  });
  it('declines when two controls have the same label and nothing tells them apart', async () => {
    const res = await refind(step('Edit'), [el('Edit', { dups: 3 })], {}, async () => '1');
    expect(res.index).toBe(null);
    const res2 = await refind(step('Edit'), [el('Edit'), el('Edit', { section: 'y' })], {}, async () => '1');
    expect(res2.index).not.toBe(1);
  });
  it('picks one of several same-label links when they all go to the same address, but not when they differ', () => {
    const link = (text, href) => ({ role: 'link', text, section: 'x', href });
    expect(codeFind({ role: 'link', text: 'Main Page', section: 'x' }, [link('Main Page', '/wiki/Main_Page'), link('Main page', '/wiki/Main_Page')]).verdict).toBe('found');
    expect(codeFind({ role: 'link', text: 'Edit', section: 'x' }, [link('Edit', '/a/1'), link('Edit', '/a/2'), link('Edit', '/a/3')]).verdict).toBe('ambiguous');
  });
  it('tells three same-label rows apart by their link address', async () => {
    const link = (text, href) => ({ role: 'link', text, section: 'x', href });
    const res = await refind({ role: 'link', text: 'Edit', section: 'x', href: '/a/3' }, [link('Edit', '/a/1'), link('Edit', '/a/2'), link('Edit', '/a/3')], {}, async () => '1');
    expect(res.index).toBe(2);
    expect(res.by).toBe('anchor');
  });
  it('does not ask a model about a step that was saved without a label', async () => {
    let asked = 0;
    const res = await refind(step('', { personal: true }), [el('Cancel payment'), el('Confirm payment')], {}, async () => { asked++; return '1'; });
    expect(res.index).toBe(null);
    expect(asked).toBe(0);
  });
  it('does not trust a generic internal name', () => {
    expect(anchorFind(step('Pay', { name: 'submit' }), [el('Cancel', { name: 'submit' })])).toBe(null);
    expect(anchorFind(step('Pay', { name: 'customer_id', role: 'field' }), [{ role: 'field', text: 'Customer number', section: 'x', name: 'customer_id' }])).toBe(0);
  });
  it('does not treat a typing box and a tick box as the same kind', async () => {
    const res = await refind({ role: 'field', text: 'Remember me', section: '' }, [{ role: 'checkbox', text: 'Remember me', section: '' }], {}, async () => '1');
    expect(res.index).toBe(null);
  });
});
