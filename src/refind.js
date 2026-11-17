// Finding a recorded step again on a page that may have changed.
// Layer one is plain code: if the same label is still there, use it.
// Only when the label is gone does the on-device model choose among the candidates.

// An element on a page: { role, text, section }
//   role: 'button' | 'link' | 'field' | 'select' | 'checkbox'
//   section: the nearest heading above it

const CLICKABLE = new Set(['button', 'link']);
const sameKind = (a, b) => CLICKABLE.has(a) === CLICKABLE.has(b);

// Letters and digits of any script are kept, so Nepali, Hindi and Bengali labels compare correctly.
const norm = (s) =>
  String(s ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();

function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** How alike two labels look, 0 to 1. Spelling only; it knows nothing about meaning. */
export function textSimilarity(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const edit = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  const xs = new Set(x.split(' '));
  const ys = new Set(y.split(' '));
  const shared = [...xs].filter((t) => ys.has(t)).length;
  const overlap = shared / (xs.size + ys.size - shared);
  return Math.max(edit, overlap);
}

export const THRESHOLDS = { found: 0.9, lead: 0.015 };

/** Elements the step could be: same kind of control (something you press, or something you fill). */
export function candidatesFor(step, elements) {
  return elements.map((el, index) => ({ ...el, index })).filter((el) => sameKind(el.role, step.role));
}

/**
 * Layer one. Returns the element's index when the label is still clearly there,
 * otherwise 'unclear' with the candidates for the model.
 * @returns {{verdict: 'found', index: number, score: number} | {verdict: 'unclear', candidates: object[]}}
 */
export function codeFind(step, elements) {
  const candidates = candidatesFor(step, elements);
  const scored = candidates
    .map((el) => ({
      el,
      // The same section breaks ties between two controls with the same label.
      score: textSimilarity(step.text, el.text) + (norm(el.section) === norm(step.section) ? 0.02 : 0),
    }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  // Accept when one control clearly has the saved label. Two equally good ones stay unclear,
  // unless the saved section singles one of them out.
  const clear = best && best.score >= THRESHOLDS.found && (!second || second.score < THRESHOLDS.found || best.score - second.score >= THRESHOLDS.lead);
  if (clear) {
    return { verdict: 'found', index: best.el.index, score: best.score };
  }
  return { verdict: 'unclear', candidates };
}

/** The question for the on-device model. Candidates are numbered from 1; 0 means "none of these". */
export function refindPrompt(step, candidates, context = {}) {
  const kind = CLICKABLE.has(step.role) ? 'press' : 'fill in';
  const list = candidates.map((c, i) => `${i + 1}. ${c.text} (${c.role}, under "${c.section}")`).join('\n');
  return `A person is following saved steps on a website. The website has changed, and one step's control now has a different label.

Task they are doing: ${context.task ?? 'unknown'}
${context.previous ? `The step before this one was: "${context.previous}"\n` : ''}The saved step: ${kind} "${step.text}" (${step.role}, under "${step.section}")

Controls on the page now:
${list}

Which control does the same job as the saved step? Choose the one a person would use to do the same thing.
If none of them does the same job, answer 0.
Answer with the number only.`;
}

/**
 * A path knows all of its steps. A control that is still clearly another step's
 * control cannot be the one we are looking for, so it is taken off the list.
 */
export function withoutOtherSteps(candidates, otherLabels = []) {
  const taken = new Set(otherLabels.map(norm));
  return candidates.filter((c) => !taken.has(norm(c.text)));
}

/**
 * A shorter question that asks about meaning only. Sections are left out,
 * because a control that moved would make them misleading.
 */
export function meaningPrompt(step, candidates, context = {}) {
  const kind = CLICKABLE.has(step.role) ? 'button or link' : 'form field';
  const list = candidates.map((c, i) => `${i + 1}. ${c.text}`).join('\n');
  return `A website changed the wording of one ${kind}.

The person's task on this website: ${context.task ?? 'unknown'}
Old wording: "${step.text}"

Current ${kind}s on the page:
${list}

Which one is the old "${step.text}" under a new name? It must do exactly the same job, not a related or later job.
Answer with the number only. Answer 0 if none of them is it.`;
}

/** A second, yes-or-no question about one pick. It catches picks that are only loosely related. */
export function verifyPrompt(step, pickedText, context = {}) {
  return `A website for this task: ${context.task ?? 'unknown'}

Old label: "${step.text}"
New label: "${pickedText}"

Could the new label be the same control as the old label, just reworded? They must do the same job.
Answer YES or NO only.`;
}

/**
 * A stricter yes-or-no question. "Could it be the same control?" is too easy to say yes to when a
 * similar control exists, so this one says that a related control is not enough.
 */
export function strictVerifyPrompt(step, pickedText, context = {}) {
  return `A website was redesigned. The person's task: ${context.task ?? 'unknown'}

Old control: "${step.text}"
A control on the redesigned page: "${pickedText}"

Is the control on the redesigned page the very same control as the old one, only renamed? If it is merely related, nearby or similar, answer NO. Answer YES only if you are sure it is the same control.
Answer YES or NO only.`;
}

/** Reads YES or NO. Returns null when the answer is neither. */
export function parseYesNo(text) {
  const t = String(text ?? '').toUpperCase();
  const yes = t.search(/\bYES\b/);
  const no = t.search(/\bNO\b/);
  if (yes === -1 && no === -1) return null;
  if (no === -1) return true;
  if (yes === -1) return false;
  return yes < no;
}

// A link address of "/" or nothing points at too many controls to tell them apart.
const usable = (href) => Boolean(href) && href !== '/';

/**
 * Layer two, also plain code: the label is gone, but the control may still have the same link
 * address or internal name.
 *
 * A link address is trusted when exactly one control has it, or when every control that has it
 * carries the same label (the same link shown twice, such as a menu and a page body). Links that
 * share an address but have different labels are not told apart, so none is chosen. A control's
 * internal name is trusted only when exactly one control has it.
 * @returns {number|null} the element's index
 */
export function anchorFind(step, elements) {
  const same = (el) => sameKind(el.role, step.role);
  const indexed = elements.map((el, index) => ({ el, index })).filter(({ el }) => same(el));

  if (usable(step.href)) {
    const links = indexed.filter(({ el }) => el.href === step.href);
    const labels = new Set(links.map(({ el }) => norm(el.text)));
    if (links.length === 1 || (links.length > 1 && labels.size === 1 && !labels.has(''))) {
      const here = links.find(({ el }) => norm(el.section) === norm(step.section));
      return (here ?? links[0]).index;
    }
  }
  const named = indexed.filter(({ el }) => step.name && el.name && el.name === step.name);
  return named.length === 1 ? named[0].index : null;
}

export const MAX_REGION = 40;
export const MAX_MODEL = 60;

/**
 * However long the page is, the model is shown at most MAX_MODEL controls. When there are more, the
 * ones nearest the step's original position on the page (its recorded `at`) are kept, in page order.
 * A step recorded before positions were saved has no `at`, so the first MAX_MODEL are kept.
 */
export function nearestTo(candidates, step, max = MAX_MODEL) {
  if (candidates.length <= max) return candidates;
  if (!Number.isInteger(step.at)) return candidates.slice(0, max);
  return candidates
    .map((c) => ({ c, d: Math.abs(c.index - step.at) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, max)
    .map(({ c }) => c)
    .sort((a, b) => a.index - b.index);
}

/**
 * On a long page the model is shown too many controls to choose from. A redesign usually keeps a
 * control in the same part of the page, so offer only the controls in the step's own section when
 * there is a manageable number of them. If the section is unknown, empty or still too large, offer
 * them all.
 */
export function narrowToRegion(candidates, step) {
  if (!step.section) return candidates;
  const here = candidates.filter((c) => norm(c.section) === norm(step.section));
  return here.length >= 1 && here.length <= MAX_REGION ? here : candidates;
}

// Structured output: the model may only answer with one of these values.
export const YES_NO_SCHEMA = { type: 'string', enum: ['YES', 'NO'] };
/** "0" (none) or the number of one of n candidates. */
export const choiceSchema = (n) => ({ type: 'string', enum: Array.from({ length: n + 1 }, (_, i) => String(i)) });

/**
 * The full re-find used by the guide. Code first; if the label is gone, the model is asked
 * twice with the list in different orders, and its pick is then checked with a yes/no question.
 * The guide only points at a control when all three agree. Otherwise it says it is not sure.
 *
 * @param {(prompt: string, schema: object) => Promise<string>} ask runs a prompt on the on-device
 *   model; the schema is the set of answers it is allowed to give
 * @returns {Promise<{index: number, by: 'code'|'model'} | {index: null, by: 'model', reason: string}>}
 */
export async function refind(step, elements, context, ask) {
  const first = codeFind(step, elements);
  if (first.verdict === 'found') return { index: first.index, by: 'code' };

  const anchored = anchorFind(step, elements);
  if (anchored !== null) return { index: anchored, by: 'anchor' };

  const open = withoutOtherSteps(first.candidates, context?.others);
  if (!open.length) return { index: null, by: 'model', reason: 'no candidates' };

  // A model pick, with the guards: two orders must agree, and a strict yes/no check must say yes.
  const verify = context?.strictVerify === false ? verifyPrompt : strictVerifyPrompt;
  const pickAmong = async (all) => {
    const candidates = nearestTo(all, step);
    const schema = choiceSchema(candidates.length);
    const pickA = parseChoice(await ask(meaningPrompt(step, candidates, context), schema), candidates);
    if (pickA === null || pickA === 'none') return { index: null, reason: 'no match' };
    const reversed = candidates.slice().reverse();
    const pickB = parseChoice(await ask(meaningPrompt(step, reversed, context), schema), reversed);
    if (pickB !== pickA) return { index: null, reason: 'answers disagreed' };
    const yes = parseYesNo(await ask(verify(step, elements[pickA].text, context), YES_NO_SCHEMA));
    return yes === true ? { index: pickA } : { index: null, reason: 'check failed' };
  };

  // Stage one: the controls in the step's own section, so the model has few to choose from.
  // Stage two, only if stage one found nothing: every control, since a redesign may also move it.
  const region = context?.region === false ? open : narrowToRegion(open, step);
  let res = await pickAmong(region);
  if (res.index === null && region.length < open.length) res = await pickAmong(open);
  return res.index === null ? { index: null, by: 'model', reason: res.reason } : { index: res.index, by: 'model' };
}

/** Reads the model's number. Returns the element index, 'none' for 0, or null if unreadable. */
export function parseChoice(text, candidates) {
  const m = String(text ?? '').match(/\d+/);
  if (!m) return null;
  const n = Number(m[0]);
  if (n === 0) return 'none';
  return n >= 1 && n <= candidates.length ? candidates[n - 1].index : null;
}
