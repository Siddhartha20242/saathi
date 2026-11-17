import { describe, it, expect } from 'vitest';
import { registrable, lookalikeOf, pretendsToBe, secretKind, assess, BRANDS } from '../src/guard.js';
import { warning, reasonText, alertSentence, pickLang } from '../src/guardText.js';
import { SCAMS, ORDINARY } from './guard.fixtures.js';

describe('registrable', () => {
  it('finds the part one owner registers', () => {
    expect(registrable('login.nabilbank.com')).toBe('nabilbank.com');
    expect(registrable('taxpayerportal.ird.gov.np')).toBe('ird.gov.np');
    expect(registrable('www.nea.org.np')).toBe('nea.org.np');
    expect(registrable('irctc-refund.co.in')).toBe('irctc-refund.co.in');
    expect(registrable('203.0.113.7')).toBe('203.0.113.7');
    expect(registrable('LOCALHOST')).toBe('localhost');
  });
});

describe('lookalikeOf', () => {
  it('spots typos and brand names hidden inside another address', () => {
    expect(lookalikeOf('nabi1bank.com')?.id).toBe('nabil');
    expect(lookalikeOf('nabilbank-kyc-update.top')?.id).toBe('nabil');
    expect(lookalikeOf('login.nabilbank.com.verify-secure.top')?.id).toBe('nabil');
    expect(lookalikeOf('nepalpassport-gov.com')?.id).toBe('passport-np');
  });
  it('never calls the real address, or an unrelated one, an imitation', () => {
    expect(lookalikeOf('ebanking.nabilbank.com')).toBeNull();
    expect(lookalikeOf('nabilbank.com')).toBeNull();
    expect(lookalikeOf('en.wikipedia.org')).toBeNull();
    expect(lookalikeOf('github.com')).toBeNull();
  });
});

describe('pretendsToBe', () => {
  it('needs the brand in the title or heading, and a different address', () => {
    expect(pretendsToBe('fake.top', 'Nabil Bank Login', '')?.id).toBe('nabil');
    expect(pretendsToBe('nabilbank.com', 'Nabil Bank Login', '')).toBeNull();
    expect(pretendsToBe('fake.top', 'Weather today', 'Nabil Bank Account Login')?.id).toBe('nabil'); // the main heading counts too
    expect(pretendsToBe('fake.top', 'Weather today', 'Rain in Pokhara')).toBeNull();
  });
});

describe('secretKind', () => {
  it('goes by what the box is, never by what is typed', () => {
    expect(secretKind({ type: 'password' })).toBe('password');
    expect(secretKind({ type: 'text', autocomplete: 'one-time-code' })).toBe('otp');
    expect(secretKind({ type: 'text', label: 'Enter OTP' })).toBe('secret');
    expect(secretKind({ type: 'text', label: 'ओटीपी' })).toBe('secret');
    expect(secretKind({ type: 'text', label: 'Customer ID' })).toBeNull();
    expect(secretKind({ type: 'search', label: 'Search' })).toBeNull();
  });
});

describe('assess, on made-up pages', () => {
  for (const { name, want, page } of [...SCAMS, ...ORDINARY]) {
    it(`${name}: ${want}`, () => expect(assess(page).level).toBe(want));
  }
  it('stops every scam fixture marked stop and never stops an ordinary page', () => {
    const stops = SCAMS.filter((s) => s.want === 'stop');
    expect(stops.every((s) => assess(s.page).level === 'stop')).toBe(true);
    expect(ORDINARY.every((o) => assess(o.page).level !== 'stop')).toBe(true);
  });
  it('explains itself with reasons, and names the brand it thinks is being imitated', () => {
    const r = assess(SCAMS[0].page);
    expect(r.brand).toBe('Nabil Bank');
    expect(r.reasons.map((x) => x.code)).toEqual(expect.arrayContaining(['lookalike', 'pretends', 'asksSecret', 'urgency']));
  });
  it('says nothing about an ordinary page', () => {
    expect(assess(ORDINARY[0].page)).toMatchObject({ level: 'ok', reasons: [] });
  });
  it('knows only real brand names, and one made-up for the practice page', () => {
    expect(BRANDS.filter((b) => b.id === 'himal')).toHaveLength(1);
    expect(new Set(BRANDS.map((b) => b.id)).size).toBe(BRANDS.length);
  });
});

describe('words', () => {
  it('writes the warning in three languages', () => {
    const a = assess(SCAMS[0].page);
    expect(warning(a, 'en').headline).toMatch(/^Stop\./);
    expect(warning(a, 'ne').headline).toContain('रोकिनुहोस्');
    expect(warning(a, 'hi').headline).toContain('रुकिए');
    expect(warning(a, 'ne').reasons.length).toBe(a.reasons.length);
  });
  it('puts the brand into a reason, and falls back to English for an unknown language', () => {
    expect(reasonText({ code: 'pretends', brand: 'Nabil Bank' }, 'en')).toBe('This page says it is Nabil Bank, but its address is not Nabil Bank.');
    expect(pickLang('fr')).toBe('en');
    expect(warning(assess(SCAMS[0].page), 'fr').headline).toMatch(/^Stop\./);
  });
  it('has a reason for every code the rules can give, in every language', () => {
    const codes = new Set(SCAMS.flatMap((s) => assess(s.page).reasons.map((r) => r.code)));
    for (const lang of ['en', 'ne', 'hi']) for (const code of codes) expect(reasonText({ code, brand: 'X' }, lang)).not.toBe(code);
  });
  it('says how to reach the family button when the panel is closed, in every language', () => {
    for (const lang of ['en', 'ne', 'hi']) expect(warning(assess(SCAMS[0].page), lang).openPanel.length).toBeGreaterThan(10);
  });
  it('writes the family alert from codes, without page content', () => {
    const s = alertSentence({ host: 'fake.top', brand: 'Nabil Bank', reasons: ['pretends', 'asksSecret'] });
    expect(s).toContain('a page pretending to be Nabil Bank (fake.top)');
    expect(s).toContain('asks for a password');
  });
});
