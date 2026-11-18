// "Where is the Pay button?" Finds a control on the open page by the words the person types.
// Plain code, on this computer: the words and the page's control names never leave it.

const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();

// Words people add around the name of the thing they want.
const FILLER = new Set(['where', 'wheres', 'is', 'are', 'the', 'a', 'an', 'my', 'me', 'show', 'find', 'point', 'to', 'at', 'please', 'button', 'link', 'box', 'field', 'option', 'on', 'this', 'page', 'i', 'can', 'see', 'do', 'how', 'get']);

/** The words that name the control, without the question around them. */
export function wanted(query) {
  const words = norm(query).split(' ').filter(Boolean);
  const named = words.filter((w) => !FILLER.has(w));
  return (named.length ? named : words).join(' ');
}

const MAX = 3;

/**
 * @param {string} query what the person typed, for example "where is the pay button"
 * @param {{text: string, section?: string, href?: string}[]} elements the controls read from the page
 * @returns {{verdict: 'found', index: number} | {verdict: 'several', matches: {index: number, text: string, section: string}[]} | {verdict: 'none'}}
 */
export function whereIs(query, elements) {
  const q = wanted(query);
  if (q.replace(/\s/g, '').length < 2) return { verdict: 'none', reason: 'short' };
  const words = q.split(' ');
  const scored = [];
  elements.forEach((el, index) => {
    const t = norm(el.text);
    if (!t) return;
    let tier = 0;
    if (t === q) tier = 3;
    else if (` ${t} `.includes(` ${q} `)) tier = 2;
    else if (words.every((w) => t.split(' ').includes(w))) tier = 1;
    if (tier) scored.push({ index, tier, len: t.length, text: el.text, section: el.section ?? '', href: el.href ?? '' });
  });
  if (!scored.length) return { verdict: 'none' };
  const best = Math.max(...scored.map((s) => s.tier));
  let top = scored.filter((s) => s.tier === best).sort((a, b) => a.len - b.len);
  // The same label that goes to the same address is one control shown twice (a logo and a menu entry).
  const seen = new Set();
  top = top.filter((s) => {
    const key = `${norm(s.text)}|${s.href}`;
    if (s.href && seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (top.length === 1) return { verdict: 'found', index: top[0].index };
  return { verdict: 'several', matches: top.slice(0, MAX).map(({ index, text, section }) => ({ index, text, section })) };
}
