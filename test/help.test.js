import { describe, it, expect } from 'vitest';
import { controlsForHelp, groupBySection, helpPreview, cleanNote, isLive, kindWord, MAX_HELP_CONTROLS } from '../src/help.js';

const page = [
  { role: 'link', text: 'Pay your bill', section: 'Menu', href: '/bill', name: '' },
  { role: 'field', text: 'Customer ID', section: 'Pay your bill', href: '', name: 'customer' },
  { role: 'button', text: 'maria.lopez@clinic.org', section: 'Menu' },
  { role: 'button', text: 'Check bill', section: 'Pay your bill' },
];

describe('controlsForHelp', () => {
  it('keeps the labels and order, and nothing else', () => {
    const c = controlsForHelp(page);
    expect(c.map((x) => x.text)).toEqual(['Pay your bill', 'Customer ID', '', 'Check bill']);
    expect(Object.keys(c[0]).sort()).toEqual(['at', 'personal', 'role', 'section', 'text']);
    expect(JSON.stringify(c)).not.toContain('/bill');
    expect(JSON.stringify(c)).not.toContain('customer"');
  });
  it('leaves out a label with personal details but keeps its place', () => {
    const c = controlsForHelp(page);
    expect(c[2]).toMatchObject({ text: '', personal: true });
    expect(c).toHaveLength(4);
  });
  it('caps a long page', () => {
    const big = Array.from({ length: 300 }, (_, i) => ({ role: 'link', text: `L${i}` }));
    expect(controlsForHelp(big)).toHaveLength(MAX_HELP_CONTROLS);
  });
});

describe('controlsForHelp on a long page', () => {
  const long = Array.from({ length: 400 }, (_, i) => ({ role: 'link', text: `Link ${i}`, section: 'x', inView: i >= 250 && i < 290 }));
  it('sends the controls on screen, and remembers where each one is on the page', () => {
    const c = controlsForHelp(long);
    expect(c).toHaveLength(40);
    expect(c[0]).toMatchObject({ text: 'Link 250', at: 250 });
    expect(c[39]).toMatchObject({ text: 'Link 289', at: 289 });
  });
  it('keeps at most the limit, and falls back to the start of the page when nothing is marked on screen', () => {
    expect(controlsForHelp(long.map((e) => ({ ...e, inView: true })))).toHaveLength(MAX_HELP_CONTROLS);
    expect(controlsForHelp(long.map((e) => ({ ...e, inView: false })))[0].at).toBe(0);
  });
  it('sends all of a short page, in order, with their positions', () => {
    expect(controlsForHelp(long.slice(0, 5)).map((c) => c.at)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('groupBySection', () => {
  it('groups under headings and keeps the original index', () => {
    const g = groupBySection(controlsForHelp(page));
    expect(g.map((x) => x.section)).toEqual(['Menu', 'Pay your bill']);
    expect(g[1].items.map((i) => [i.index, i.text])).toEqual([[1, 'Customer ID'], [3, 'Check bill']]);
  });
  it('names a control with no heading', () => {
    expect(groupBySection([{ role: 'link', text: 'x', section: '' }])[0].section).toBe('This page');
  });
});

describe('words and limits', () => {
  it('previews what will be sent, including how many labels were left out', () => {
    const t = helpPreview(controlsForHelp(page), 'nea.org.np');
    expect(t).toContain('4 names of buttons and boxes from nea.org.np');
    expect(t).toContain('1 with personal details left out');
    expect(t).toContain('Anything you typed: none');
  });
  it('cleans and limits a note', () => {
    expect(cleanNote('  press   the green one  ')).toBe('press the green one');
    expect(cleanNote('x'.repeat(300))).toHaveLength(100);
  });
  it('knows which requests are still live', () => {
    const now = Date.now();
    expect(isLive({ status: 'open', expiresAt: { toMillis: () => now + 1000 } }, now)).toBe(true);
    expect(isLive({ status: 'open', expiresAt: { toMillis: () => now - 1 } }, now)).toBe(false);
    expect(isLive({ status: 'closed' }, now)).toBe(false);
    expect(isLive(null, now)).toBe(false);
  });
  it('names the kinds of control', () => {
    expect(kindWord('field')).toBe('Box to type in');
    expect(kindWord('unknown')).toBe('Button');
  });
});
