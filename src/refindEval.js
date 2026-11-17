// Test page: can a saved step be found again after a site changes?
// Runs the guide's real re-find (code first, then the on-device model asked twice plus a yes/no check)
// two ways: with free-text answers, and with structured output, where the model may only answer
// with an allowed value. Moved-only cases are solved by code and are counted but not re-asked.
//
// A case ends as:
//   right   - pointed at the correct control, or correctly said it is gone
//   unsure  - said "not sure" when the control was there (safe: the guide shows a hint instead)
//   wrong   - pointed at a different control (harmful)

import { codeFind, refind } from './refind.js';
import { buildCases } from './refindCases.js';
import { run, deviceStatus } from './firebase.js';

const $ = (id) => document.getElementById(id);
const KINDS = ['rename', 'both', 'removed'];
const WAYS = [
  ['text', 'Free-text answers'],
  ['structured', 'Structured output for both questions'],
  ['mixed', 'Structured output for the yes/no check only'],
];

// ?ways=text runs only the free-text way (the one the guide uses); with no parameter all three run.
const only = new URLSearchParams(location.search).get('ways')?.split(',');
const active = (id) => !only || only.includes(id);
const stats = Object.fromEntries(WAYS.map(([id]) => [id, { calls: 0, ms: 0, errors: 0 }]));
const isYesNo = (schema) => schema?.enum?.[0] === 'YES';
const schemaFor = (way, schema) => (way === 'structured' ? schema : way === 'mixed' && isYesNo(schema) ? schema : null);

function asker(way) {
  return async (prompt, schema) => {
    const started = performance.now();
    try {
      const { text } = await run({ mode: 'ONLY_ON_DEVICE', prompt, schema: schemaFor(way, schema) });
      return text.trim();
    } catch (err) {
      stats[way].errors++;
      stats[way].lastError = err.message;
      return '';
    } finally {
      stats[way].calls++;
      stats[way].ms += performance.now() - started;
    }
  };
}

const outcome = (res) => (res.index === null ? 'none' : res.index);
const grade = (choice, k) => (choice === k.expected ? 'right' : choice === 'none' ? 'unsure' : 'wrong');

function summarise(rows) {
  const s = {};
  for (const [id] of WAYS) {
    s[id] = { right: 0, unsure: 0, wrong: 0, byKind: {} };
    for (const kind of KINDS) s[id].byKind[kind] = { right: 0, cases: 0 };
  }
  for (const r of rows) {
    for (const [id] of WAYS) {
      if (r[id] === undefined) continue;
      const g = grade(r[id], r.case);
      s[id][g]++;
      s[id].byKind[r.case.kind].cases++;
      if (g === 'right') s[id].byKind[r.case.kind].right++;
    }
  }
  return s;
}

function render(rows, moved, done) {
  const s = summarise(rows);
  const lines = WAYS.map(([id, label]) => {
    const t = s[id];
    const st = stats[id];
    const kinds = KINDS.map((k) => `${k} ${t.byKind[k].right}/${t.byKind[k].cases}`).join(', ');
    return `${label}: right ${t.right}, unsure ${t.unsure}, wrong ${t.wrong} (${kinds}) · ${st.calls} calls, avg ${st.calls ? Math.round(st.ms / st.calls) : 0} ms, ${st.errors} errors${st.lastError ? ` (${st.lastError.slice(0, 90)})` : ''}`;
  });
  $('summary').textContent = [
    `Moved, same label: ${moved.right} of ${moved.cases} found by code alone (no model).`,
    `Model cases done: ${rows.filter((r) => r.text !== undefined).length} of ${rows.length}`,
    ...lines,
    done ? 'Finished.' : 'Running…',
  ].join('\n');

  const name = (choice, k) => (choice === undefined ? '' : choice === 'none' ? 'none' : k.elements[choice].text);
  $('rows').innerHTML = rows
    .filter((r) => r.text !== undefined)
    .map((r) => {
      const k = r.case;
      const cells = WAYS.map(([id]) => {
        if (r[id] === undefined) return '<td></td>';
        const g = grade(r[id], k);
        return `<td class="${g === 'right' ? 'ok' : g === 'wrong' ? 'bad' : ''}">${name(r[id], k)}</td>`;
      }).join('');
      return `<tr><td>${k.site}</td><td>${k.kind}</td><td>${k.step.text}</td><td>${name(k.expected, k)}</td>${cells}</tr>`;
    })
    .join('');
  window.__refindEval = { done, summary: s, moved, stats, rows };
}

async function start() {
  $('run').disabled = true;
  for (const id of Object.keys(stats)) Object.assign(stats[id], { calls: 0, ms: 0, errors: 0, lastError: undefined });
  const cases = buildCases();
  const movedCases = cases.filter((k) => k.kind === 'move');
  const moved = {
    cases: movedCases.length,
    right: movedCases.filter((k) => {
      const res = codeFind(k.step, k.elements);
      return res.verdict === 'found' && res.index === k.expected;
    }).length,
  };
  const rows = cases.filter((k) => k.kind !== 'move').map((k) => ({ case: k }));
  render(rows, moved, false);
  for (const row of rows) {
    const k = row.case;
    for (const [id] of WAYS) {
      if (active(id)) row[id] = outcome(await refind(k.step, k.elements, k.context, asker(id)));
    }
    render(rows, moved, false);
  }
  render(rows, moved, true);
  $('run').disabled = false;
}

$('run').addEventListener('click', start);
deviceStatus().then((st) => ($('status').textContent = `On-device model: ${st}`));
