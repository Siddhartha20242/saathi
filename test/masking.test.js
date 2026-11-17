import { describe, it, expect } from 'vitest';
import { maskText, restoreText, restoreDeep, parseJsonLoose } from '../src/masking.js';

const LETTER = `Dear Maria Lopez,
Account 48201937 at 214 Maple Street is past due. Amount: $1,284.50.
Pay by 2026-12-05. Call 973-555-0142 or email billing@clinic.org.
SSN on file: 123-45-6789. Reference A123456789.`;

describe('maskText', () => {
  it('masks structured identifiers', () => {
    const { masked } = maskText(LETTER);
    expect(masked).not.toMatch(/48201937/);
    expect(masked).not.toMatch(/973-555-0142/);
    expect(masked).not.toMatch(/billing@clinic\.org/);
    expect(masked).not.toMatch(/123-45-6789/);
    expect(masked).not.toMatch(/A123456789/);
    expect(masked).not.toMatch(/214 Maple Street/);
  });

  it('keeps money and dates intact', () => {
    const { masked } = maskText(LETTER);
    expect(masked).toContain('$1,284.50');
    expect(masked).toContain('2026-12-05');
  });

  it('masks model-found names only when they appear in the text', () => {
    const { masked, items } = maskText(LETTER, [
      { kind: 'NAME', value: 'Maria Lopez' },
      { kind: 'NAME', value: 'Nobody Here' }, // hallucinated
    ]);
    expect(masked).not.toContain('Maria Lopez');
    expect(items.some((i) => i.value === 'Nobody Here')).toBe(false);
  });

  it('uses one token for repeated values', () => {
    const { masked } = maskText('Ana Ruiz wrote. Later Ana Ruiz called.', [
      { kind: 'NAME', value: 'Ana Ruiz' },
    ]);
    expect(masked).toBe('[NAME_1] wrote. Later [NAME_1] called.');
  });

  it('replaces the longer name before the shorter one', () => {
    const { masked } = maskText('Maria Lopez and Maria.', [
      { kind: 'NAME', value: 'Maria' },
      { kind: 'NAME', value: 'Maria Lopez' },
    ]);
    expect(masked).not.toMatch(/Maria/);
  });

  it('masks user-typed terms', () => {
    const { masked } = maskText('Patient Tilly visited.', [{ kind: 'CUSTOM', value: 'Tilly' }]);
    expect(masked).toBe('Patient [CUSTOM_1] visited.');
  });
});

describe('labelled names', () => {
  it('masks names after common labels without any model', () => {
    const { masked } = maskText('Applicant: Chen Wei   A-Number: A123456789\nDear Maria Lopez,');
    expect(masked).not.toMatch(/Chen Wei|Maria Lopez/);
  });
  it('does not mask ordinary capitalised phrases', () => {
    const { masked } = maskText('Riverside Medical Center sent this notice.');
    expect(masked).toBe('Riverside Medical Center sent this notice.');
  });
  it('does not mask a single greeting word', () => {
    expect(maskText('Dear Customer,').masked).toBe('Dear Customer,');
  });
});

describe('restoreText', () => {
  it('round-trips', () => {
    const { masked, map } = maskText(LETTER, [{ kind: 'NAME', value: 'Maria Lopez' }]);
    expect(restoreText(masked, map)).toBe(LETTER);
  });

  it('restores tokens even if the model drops brackets or changes case', () => {
    const map = { '[NAME_1]': 'Maria Lopez', '[ID_1]': '48201937' };
    expect(restoreText('Hi name_1, your account ID_1 is due', map)).toBe(
      'Hi Maria Lopez, your account 48201937 is due',
    );
  });

  it('restores deep inside JSON', () => {
    const map = { '[NAME_1]': 'Maria' };
    expect(restoreDeep({ a: ['[NAME_1]'], b: { c: 'x [NAME_1]' }, n: 3 }, map)).toEqual({
      a: ['Maria'],
      b: { c: 'x Maria' },
      n: 3,
    });
  });
});

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 }));
  it('parses fenced JSON with chatter', () =>
    expect(parseJsonLoose('Sure!\n```json\n{"a":[1,2]}\n```\nDone')).toEqual({ a: [1, 2] }));
  it('parses arrays', () => expect(parseJsonLoose('names: ["A","B"]')).toEqual(['A', 'B']));
  it('returns null on garbage', () => {
    expect(parseJsonLoose('no json here')).toBeNull();
    expect(parseJsonLoose('{broken')).toBeNull();
    expect(parseJsonLoose('')).toBeNull();
  });
});
