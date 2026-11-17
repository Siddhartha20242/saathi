// Replays real pages (saved by tools/capture-scans.mjs) against the on-device model.
// For each case a control is renamed, with its link address and name removed so only the model can
// find it, or removed from the page. The right answer is the renamed control, or "not sure".

import { run, deviceStatus } from './firebase.js';
import { refind, narrowToRegion } from './refind.js';
import { CASES } from '../tools/real-model/cases.js';
import wiki from '../tools/real-model/scans/wiki.json';
import py from '../tools/real-model/scans/py.json';
import nea from '../tools/real-model/scans/nea.json';
import bd from '../tools/real-model/scans/bd.json';
import wikilong from '../tools/real-model/scans/wikilong.json';

const SCANS = { wiki, py, nea, bd, wikilong };
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const region = params.get('region') !== '0';
const strictVerify = params.get('verify') !== 'loose';
const only = params.get('pages')?.split(',');

// ?engine=cloud asks the cloud model instead of the on-device one, the way the panel does after the
// person agrees. The cloud sees one list of the 60 controls nearest the step, so there is no second stage.
const cloud = params.get('engine') === 'cloud';
const single = params.get('single') === '1'; // one call per find, no second ordering or yes/no check
const oneOrder = params.get('oneorder') === '1'; // no second ordering, but the yes/no check stays
let lastError = '';
const ask = async (prompt) => {
  try {
    return (await run({ mode: cloud ? 'ONLY_IN_CLOUD' : 'ONLY_ON_DEVICE', prompt })).text;
  } catch (err) {
    lastError = String(err.message || err).slice(0, 120);
    return '';
  }
};

function build(c) {
  const els = SCANS[c.page].elements;
  const index = els.findIndex((e) => e.text === c.label && (c.role === 'button' ? e.role === 'button' : e.role === 'link'));
  if (index < 0) return null;
  const step = { ...els[index], at: index }; // a recorded step remembers its place on the page
  const after =
    c.variant === 'removed'
      ? els.filter((_, i) => i !== index)
      : els.map((e, i) => (i === index ? { ...e, text: c.renamed, href: '', name: '' } : e));
  return { step, after, index };
}

function render(rows, done) {
  const tally = {};
  for (const r of rows) {
    const key = `${r.page}/${r.variant}`;
    const t = (tally[key] ??= { right: 0, 'not sure': 0, WRONG: 0, other: 0 });
    t[r.result.startsWith('right') ? 'right' : r.result in t ? r.result : 'other']++;
  }
  const sum = (v) => ['right', 'not sure', 'WRONG'].map((k) => `${k} ${Object.entries(tally).filter(([key]) => key.endsWith(`/${v}`)).reduce((n, [, t]) => n + t[k], 0)}`).join(', ');
  $('summary').textContent = [
    `Engine: ${cloud ? 'cloud' : 'on-device'}, region=${cloud ? false : region}, verify=${params.get('verify') ?? 'default'}${lastError ? ` | last error: ${lastError}` : ''}`,
    `Renamed controls: ${sum('renamed')}`,
    `Removed controls (right answer is "not sure"): right ${rows.filter((r) => r.variant === 'removed' && r.result.startsWith('right')).length} of ${rows.filter((r) => r.variant === 'removed').length}, WRONG ${rows.filter((r) => r.variant === 'removed' && r.result === 'WRONG').length}`,
    ...Object.entries(tally).map(([k, t]) => `  ${k}: right ${t.right}, not sure ${t['not sure']}, WRONG ${t.WRONG}`),
    done ? 'Finished.' : 'Running…',
  ].join('\n');
  $('rows').innerHTML = rows
    .map((r) => `<tr><td>${r.page}</td><td>${r.variant}</td><td>${r.label}</td><td>${r.renamed ?? ''}</td><td class="${r.result.startsWith('right') ? 'ok' : r.result === 'WRONG' ? 'bad' : ''}">${r.result}${r.reason ? ` (${r.reason})` : ''}</td><td>${r.picked ?? ''}</td><td>${r.pool}</td><td>${r.ms}</td></tr>`)
    .join('');
  window.__real = { done, rows, tally, region };
}

async function start() {
  $('run').disabled = true;
  const rows = [];
  render(rows, false);
  for (const c of CASES.filter((k) => !only || only.includes(k.page))) {
    const built = build(c);
    const row = { page: c.page, variant: c.variant, label: c.label, renamed: c.renamed ?? null };
    rows.push(row);
    if (!built) {
      row.result = 'target not in scan';
      row.pool = '';
      continue;
    }
    const started = performance.now();
    const res = await refind(built.step, built.after, { task: SCANS[c.page].title, region: cloud ? false : region, strictVerify, single, oneOrder }, ask);
    row.ms = Math.round(performance.now() - started);
    row.pool = region ? narrowToRegion(built.after.filter((e) => (e.role === 'button' || e.role === 'link')), built.step).length : built.after.filter((e) => e.role === 'button' || e.role === 'link').length;
    row.reason = res.reason ?? null;
    if (res.index === null) {
      row.result = c.variant === 'removed' ? 'right (not sure)' : 'not sure';
    } else {
      row.picked = built.after[res.index].text;
      row.result = c.variant === 'renamed' && res.index === built.index ? 'right' : 'WRONG';
    }
    render(rows, false);
  }
  render(rows, true);
  $('run').disabled = false;
}

$('run').addEventListener('click', start);
deviceStatus().then((s) => ($('status').textContent = `On-device model: ${s}`));
