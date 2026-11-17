import { describe, it, expect } from 'vitest';
import {
  newGroupCode, GROUP_RE, normaliseGroup, pathOnly, hostOf, originMatches, sanitizeStep, sameStep,
  stepInstruction, validatePath, MAX_STEPS,
} from '../src/path.js';

describe('group codes', () => {
  it('makes 8-character codes without look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(newGroupCode()).toMatch(GROUP_RE);
    expect(GROUP_RE.test('ABCD0123')).toBe(false); // 0 and 1 are not in the alphabet
  });
  it('cleans typed codes', () => {
    expect(normaliseGroup(' abcd-2345 ')).toBe('ABCD2345');
  });
});

describe('addresses', () => {
  it('keeps only the path of a page', () => {
    expect(pathOnly('https://bank.example/pay?customer=123#top')).toBe('/pay');
    expect(pathOnly('/bill.html?id=9')).toBe('/bill.html');
  });
  it('compares hosts without www and case', () => {
    expect(originMatches('www.NEA.org.np', 'nea.org.np')).toBe(true);
    expect(originMatches('nea.org.np', 'nea-login.example')).toBe(false);
    expect(originMatches('', '')).toBe(false);
    expect(hostOf('https://www.nea.org.np/x')).toBe('www.nea.org.np');
  });
});

describe('sanitizeStep', () => {
  it('keeps the known fields and drops anything else, such as a typed value', () => {
    const s = sanitizeStep({ role: 'field', text: 'Customer ID', value: '48201937', password: 'x', page: '/bill?x=1', name: 'customer' });
    expect(s).toEqual({ role: 'field', text: 'Customer ID', section: '', page: '/bill', href: '', name: 'customer' });
    expect(JSON.stringify(s)).not.toContain('48201937');
  });
  it('does not save a label that holds personal details', () => {
    const s = sanitizeStep({ role: 'button', text: 'maria.lopez@clinic.org', name: 'account' });
    expect(s.text).toBe('');
    expect(s.personal).toBe(true);
  });
  it('falls back to button for an unknown kind and trims long text', () => {
    expect(sanitizeStep({ role: 'weird', text: 'x'.repeat(200) }).text).toHaveLength(80);
    expect(sanitizeStep({ role: 'weird' }).role).toBe('button');
  });
  it('drops a link address that says nothing', () => {
    expect(sanitizeStep({ role: 'link', text: 'Home', href: '/' }).href).toBe('');
    expect(sanitizeStep({ role: 'link', text: 'Pay', href: '/pay?x=1' }).href).toBe('/pay');
  });
  it('remembers where on the page the control was, when that is a sensible number', () => {
    expect(sanitizeStep({ role: 'link', text: 'Pay', at: 4098 }).at).toBe(4098);
    expect(sanitizeStep({ role: 'link', text: 'Pay' }).at).toBeUndefined();
    expect(sanitizeStep({ role: 'link', text: 'Pay', at: -1 }).at).toBeUndefined();
    expect(sanitizeStep({ role: 'link', text: 'Pay', at: '5' }).at).toBeUndefined();
  });
  it('recognises the same step twice', () => {
    const a = sanitizeStep({ role: 'link', text: 'Pay', href: '/pay', page: '/' });
    expect(sameStep(a, { ...a })).toBe(true);
    expect(sameStep(a, { ...a, href: '/other' })).toBe(false);
  });
});

describe('stepInstruction', () => {
  it('writes a plain sentence per kind', () => {
    expect(stepInstruction({ role: 'button', text: 'Pay now' })).toBe('Press the button "Pay now".');
    expect(stepInstruction({ role: 'field', text: 'Customer ID' })).toContain('type your own answer');
    expect(stepInstruction({ role: 'link', text: '' })).toBe('Press the highlighted link.');
  });
});

describe('validatePath', () => {
  const ok = { title: 'Pay bill', host: 'a.example', steps: [{}] };
  it('accepts a complete path', () => expect(validatePath(ok)).toBeNull());
  it('explains what is missing', () => {
    expect(validatePath({ ...ok, title: ' ' })).toMatch(/name/);
    expect(validatePath({ ...ok, steps: [] })).toMatch(/Nothing/);
    expect(validatePath({ ...ok, steps: Array(MAX_STEPS + 1).fill({}) })).toMatch(/at most/);
  });
});
