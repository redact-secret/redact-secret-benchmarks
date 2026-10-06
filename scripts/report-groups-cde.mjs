#!/usr/bin/env node
// `node scripts/report-groups-cde.mjs --obs-dir <dir with observations-<published|candidate>-<c|d|e>-c<7|1>.json.gz> --out <dir>`
// Scores the frozen Group C, D and E corpora (#752-#754) with the unchanged benchmarks/batch2/score-r2.mjs against the
// observations written by scripts/measure-batch1.mjs. Runs no scanner, records no matched text, edits no corpus.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';
import { scoreCase, summarize, parity } from '../benchmarks/batch2/score-r2.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ options: { 'obs-dir': { type: 'string' }, out: { type: 'string' } } });
const CORPORA = { c: { mod: C, file: 'FROZEN-group-c.json', dir: 'group-c' }, d: { mod: D, file: 'FROZEN-group-d.json', dir: 'group-d' }, e: { mod: E, file: 'FROZEN-group-e.json', dir: 'group-e' } };
const IDS = ['published', 'candidate'];
const SURFACES = ['node', 'wasm', 'python', 'cli'];
const load = p => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const sig = list => JSON.stringify([...list].map(f => [f.start, f.end, f.type, f.action]).sort());
const family = c => c.family;

const obs = {};
const frozenDigest = {};
for (const [g, k] of Object.entries(CORPORA)) {
  const frozen = JSON.parse(readFileSync(path.join(root, 'benchmarks', k.dir, k.file), 'utf8'));
  frozenDigest[g] = frozen.sha256 ?? frozen.digest;
  if (k.mod.corpusDigest() !== frozenDigest[g]) throw new Error(`group ${g}: corpus differs from the frozen manifest`);
  for (const id of IDS) for (const ch of [7, 1]) {
    const o = load(path.join(values['obs-dir'], `observations-${id}-${g}-c${ch}.json.gz`));
    if (o.corpus.sha256 !== frozenDigest[g]) throw new Error(`${id} ${g} c${ch}: observation from a different corpus`);
    for (const s of SURFACES) if (!o.surfaces[s]) throw new Error(`${id} ${g} c${ch}: missing surface ${s}`);
    obs[`${id}/${g}/${ch}`] = o;
  }
}

/** One case on one identity: every surface x {whole, 7-byte, 1-byte}. */
function perCase(id, g, c) {
  const runs = [];
  for (const s of SURFACES) {
    const a = obs[`${id}/${g}/7`].surfaces[s].cases[c.id];
    const b = obs[`${id}/${g}/1`].surfaces[s].cases[c.id];
    runs.push({ surface: s, mode: 'whole', ob: a.whole }, { surface: s, mode: 'stream7', ob: a.stream }, { surface: s, mode: 'stream1', ob: b.stream });
    // the whole-input scan is run again in the 1-byte file; it must equal the first
    runs.push({ surface: s, mode: 'whole(c1 file)', ob: b.whole });
  }
  const scores = runs.map(r => scoreCase(c, r.ob));
  const sigs = new Set(runs.map(r => sig(r.ob.findings)));
  const divergent = sigs.size > 1;
  const worstBy = (pred) => scores.some(pred);
  const out = { id: c.id, kind: c.kind, family: family(c), identical: !divergent, observed: runs[0].ob.findings.map(f => ({ start: f.start, end: f.end, type: f.type, action: f.action, detector: f.detector })) };
  if (c.kind === 'positive') {
    out.exact = scores.every(s => s.spanOutcomes.every(x => x === 'exact'));
    out.fullyCovered = scores.every(s => s.fullyCovered);
    out.miss = worstBy(s => s.spanOutcomes.some(x => x === 'miss'));
    out.pass = scores.every(s => s.pass);
    out.typeOk = scores.every(s => s.typeOk);
    out.actionOk = scores.every(s => s.actionOk);
    out.spanOutcomes = scores[0].spanOutcomes;
    out.leakedBytes = Math.max(...scores.map(s => s.leakedBytes));
    out.observedType = scores[0].type; out.observedAction = scores[0].action;
  } else if (c.kind === 'control') {
    out.flagged = worstBy(s => s.flagged);
  }
  if (divergent) out.divergence = runs.map(r => ({ surface: r.surface, mode: r.mode, sig: createHash('sha256').update(sig(r.ob.findings)).digest('hex').slice(0, 8) }));
  return out;
}

const result = { schema: 'groups-cde-scores-v1', corpora: {}, parity: {}, delta: {}, gaps: {}, observedOnly: {} };
const empty = () => ({ positives: 0, exact: 0, fullyCovered: 0, misses: 0, pass: 0, typeOk: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 });
function add(t, r) {
  if (r.kind === 'positive') { t.positives++; if (r.exact) t.exact++; if (r.fullyCovered) t.fullyCovered++; if (r.miss) t.misses++; if (r.pass) t.pass++; if (r.typeOk) t.typeOk++; if (r.actionOk) t.actionOk++; }
  else if (r.kind === 'control') { t.controls++; if (r.flagged) t.controlFlagged++; }
  else t[r.kind]++;
}
const perId = {};
for (const [g, k] of Object.entries(CORPORA)) {
  result.corpora[g] = { cases: k.mod.cases.length, sha256: frozenDigest[g] };
  for (const id of IDS) {
    const rows = k.mod.cases.map(c => perCase(id, g, c));
    perId[`${id}/${g}`] = rows;
    const total = empty(); const byRow = {};
    for (const r of rows) { add(total, r); add(byRow[r.family] ??= empty(), r); }
    // the unchanged summarize() on one surface/mode as a cross-check (Node whole)
    const nodeWhole = Object.fromEntries(k.mod.cases.map(c => [c.id, obs[`${id}/${g}/7`].surfaces.node.cases[c.id].whole]));
    const cross = summarize(k.mod.cases, nodeWhole);
    (result.corpora[g][id] ??= {}).total = total;
    result.corpora[g][id].byRow = byRow;
    result.corpora[g][id].summarizeNodeWhole = cross;
    result.parity[`${id}/${g}`] = { cases: rows.length, identicalAcrossSurfacesAndModes: rows.filter(r => r.identical).length, divergent: rows.filter(r => !r.identical).map(r => ({ id: r.id, kind: r.kind, divergence: r.divergence })) };
    result.corpora[g][id].versions = Object.fromEntries(SURFACES.map(s => [s, obs[`${id}/${g}/7`].surfaces[s].version]));
    result.corpora[g][id].sourceCommit = obs[`${id}/${g}/7`].sourceCommit;
  }
  // delta, gaps
  const A = new Map(perId[`published/${g}`].map(r => [r.id, r])); const B = new Map(perId[`candidate/${g}`].map(r => [r.id, r]));
  const good = r => (r.kind === 'positive' ? r.exact && r.fullyCovered : r.kind === 'control' ? !r.flagged : null);
  const caseOf = new Map(k.mod.cases.map(c => [c.id, c]));
  const delta = { fixed: [], regressed: [], changedObserved: [] };
  for (const [idc, b] of B) {
    const a = A.get(idc);
    if (b.kind === 'positive' || b.kind === 'control') {
      if (good(a) !== good(b)) (good(b) ? delta.fixed : delta.regressed).push({ id: idc, family: b.family, kind: b.kind });
      else if (sig(a.observed) !== sig(b.observed)) delta.changedObserved.push({ id: idc, family: b.family, kind: b.kind, note: 'scored status unchanged, findings differ' });
    } else if (sig(a.observed) !== sig(b.observed)) delta.changedObserved.push({ id: idc, family: b.family, kind: b.kind, note: 'observed-only case changed', published: a.observed, candidate: b.observed });
  }
  result.delta[g] = delta;
  const gaps = [];
  for (const [idc, b] of B) {
    if (b.kind === 'positive' && !(b.exact && b.fullyCovered)) gaps.push({ ...b, expected: caseOf.get(idc).expected, expectedExtra: caseOf.get(idc).expectedExtra ?? [], expectedType: caseOf.get(idc).expectedType, expectedAction: caseOf.get(idc).expectedAction, layout: caseOf.get(idc).layout, publishedGood: good(A.get(idc)) });
    if (b.kind === 'control' && b.flagged) gaps.push({ ...b, layout: caseOf.get(idc).layout, publishedGood: good(A.get(idc)) });
  }
  result.gaps[g] = gaps;
  result.observedOnly[g] = B.size && [...B.values()].filter(r => r.kind === 'unsupported' || r.kind === 'conflict').map(r => ({ id: r.id, kind: r.kind, family: r.family, candidate: r.observed, published: A.get(r.id).observed }));
  // type/action reported separately for C only is derived from the totals (typeOk, actionOk, pass)
}
writeFileSync(path.join(values.out, 'scores.json'), `${JSON.stringify(result, null, 1)}\n`);
console.log(JSON.stringify({ totals: Object.fromEntries(Object.entries(result.corpora).map(([g, v]) => [g, { A: v.published.total, B: v.candidate.total }])), parity: Object.fromEntries(Object.entries(result.parity).map(([k, v]) => [k, `${v.identicalAcrossSurfacesAndModes}/${v.cases}`])), delta: Object.fromEntries(Object.entries(result.delta).map(([g, d]) => [g, { fixed: d.fixed.length, regressed: d.regressed.length, changedObserved: d.changedObserved.length }])), gaps: Object.fromEntries(Object.entries(result.gaps).map(([g, v]) => [g, v.length])) }, null, 1));
