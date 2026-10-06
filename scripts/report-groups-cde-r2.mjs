#!/usr/bin/env node
// `node scripts/report-groups-cde-r2.mjs --r1 evidence/groups-cde/round1 --obs-dir evidence/groups-cde/round2 --old-c <dir with the freeze-a7350c51 copy of benchmarks/group-c> --out <dir>`
// Round 2: scores the replayed candidate (e1cc1f31) on the unchanged group D and E corpora and on the group C errata-1 corpus with
// the unchanged benchmarks/batch2/score-r2.mjs; compares with the round-1 candidate (e1284537) and the published baseline (round-1 observations,
// reused after checking that the C case texts are byte-identical between the freeze and errata-1). Runs no scanner; records no matched text.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';
import { scoreCase } from '../benchmarks/batch2/score-r2.mjs';

const { values } = parseArgs({ options: { r1: { type: 'string' }, 'obs-dir': { type: 'string' }, 'old-c': { type: 'string' }, out: { type: 'string' } } });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const MODS = { c: C, d: D, e: E };
const EXPECTED = { c: '16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d', d: 'aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e', e: '6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa' };
for (const g of 'cde') if (MODS[g].corpusDigest() !== EXPECTED[g]) throw new Error(`group ${g}: digest mismatch`);
const SURF = ['node', 'wasm', 'python', 'cli'];
const load = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const sig = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action]).sort());

// C texts: freeze vs errata-1
const oldC = await import(pathToFileURL(path.join(values['old-c'], 'benchmarks/group-c/corpus-group-c.mjs')).href);
const oldById = new Map(oldC.cases.map((c) => [c.id, c]));
const kindChanges = [];
// the nine downgraded cases changed their id suffix (:control -> :unsupported); the round-1 observations are keyed by the old id
const oldIdOf = (id) => (oldById.has(id) ? id : id.replace(/:unsupported$/, ':control'));
for (const c of C.cases) { const o = oldById.get(oldIdOf(c.id)); if (!o) throw new Error(`new C id ${c.id}`); if (o.text !== c.text) throw new Error(`C text changed: ${c.id}`); if (o.kind !== c.kind) kindChanges.push({ id: c.id, oldId: o.id, from: o.kind, to: c.kind }); }
if (oldC.cases.length !== C.cases.length) throw new Error('C case count changed');

const OBS = {};
for (const g of 'cde') {
  for (const ch of [7, 1]) {
    OBS[`r2/${g}/${ch}`] = load(path.join(values['obs-dir'], `observations-candidate-${g}-c${ch}.json.gz`));
    OBS[`b1/${g}/${ch}`] = load(path.join(values.r1, `observations-candidate-${g}-c${ch}.json.gz`));
    OBS[`a/${g}/${ch}`] = load(path.join(values.r1, `observations-published-${g}-c${ch}.json.gz`));
  }
  for (const id of ['r2', 'b1', 'a']) for (const ch of [7, 1]) { const o = OBS[`${id}/${g}/${ch}`]; const want = id === 'r2' || g !== 'c' ? EXPECTED[g] : oldC.corpusDigest(); if (o.corpus.sha256 !== want) throw new Error(`${id}/${g}/${ch}: observation digest ${o.corpus.sha256}`); for (const s of SURF) if (!o.surfaces[s]) throw new Error('missing surface'); }
}

function perCase(id, g, c) {
  const key = id !== 'r2' && g === 'c' ? oldIdOf(c.id) : c.id;
  const runs = [];
  for (const s of SURF) {
    const a = OBS[`${id}/${g}/7`].surfaces[s].cases[key], b = OBS[`${id}/${g}/1`].surfaces[s].cases[key];
    runs.push({ s, m: 'whole7', ob: a.whole }, { s, m: 'stream7', ob: a.stream }, { s, m: 'whole1', ob: b.whole }, { s, m: 'stream1', ob: b.stream });
  }
  const sc = runs.map((r) => scoreCase(c, r.ob));
  const sigs = new Set(runs.map((r) => sig(r.ob.findings)));
  const sigsDet = new Set(runs.map((x) => JSON.stringify([...x.ob.findings].map((f) => [f.start, f.end, f.type, f.action, f.detector]).sort())));
  const r = { id: c.id, kind: c.kind, family: c.family, identical: sigs.size === 1, identicalDet: sigsDet.size === 1, observed: runs[0].ob.findings.map((f) => ({ start: f.start, end: f.end, type: f.type, action: f.action, detector: f.detector })) };
  if (c.kind === 'positive') { r.exact = sc.every((x) => x.spanOutcomes.every((y) => y === 'exact')); r.fullyCovered = sc.every((x) => x.fullyCovered); r.miss = sc.some((x) => x.spanOutcomes.includes('miss')); r.pass = sc.every((x) => x.pass); r.typeOk = sc.every((x) => x.typeOk); r.actionOk = sc.every((x) => x.actionOk); r.spanOutcomes = sc[0].spanOutcomes; r.leakedBytes = Math.max(...sc.map((x) => x.leakedBytes)); }
  else if (c.kind === 'control') r.flagged = sc.some((x) => x.flagged);
  if (!r.identical) r.divergence = runs.map((x) => ({ surface: x.s, mode: x.m, sig: sig(x.ob.findings).length }));
  return r;
}
const good = (r) => (r.kind === 'positive' ? r.exact && r.fullyCovered : r.kind === 'control' ? !r.flagged : null);
const empty = () => ({ positives: 0, exact: 0, fullyCovered: 0, misses: 0, pass: 0, typeOk: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 });
const add = (t, r) => { if (r.kind === 'positive') { t.positives++; r.exact && t.exact++; r.fullyCovered && t.fullyCovered++; r.miss && t.misses++; r.pass && t.pass++; r.typeOk && t.typeOk++; r.actionOk && t.actionOk++; } else if (r.kind === 'control') { t.controls++; r.flagged && t.controlFlagged++; } else t[r.kind]++; };

const res = { schema: 'groups-cde-round2-scores-v1', digests: EXPECTED, cErrata: { downgradedKinds: kindChanges.length, kindChanges: [...new Set(kindChanges.map((k) => `${k.from}->${k.to}`))], textsIdentical: true, reusedAObservations: true }, corpora: {}, parity: {}, regressions: [], newBad: [], observedChanged: {}, perCase: {} };
const rows = {};
for (const g of 'cde') {
  const cases = MODS[g].cases;
  for (const id of ['r2', 'b1', 'a']) {
    const rs = cases.map((c) => perCase(id, g, c)); rows[`${id}/${g}`] = rs;
    const tot = empty(), byRow = {};
    for (const r of rs) { add(tot, r); add((byRow[r.family] ??= empty()), r); }
    (res.corpora[g] ??= {})[id] = { total: tot, byRow };
  }
  const R2 = new Map(rows[`r2/${g}`].map((r) => [r.id, r])), B1 = new Map(rows[`b1/${g}/`.slice(0, -1)].map((r) => [r.id, r])), A = new Map(rows[`a/${g}`].map((r) => [r.id, r]));
  const rs = rows[`r2/${g}`];
  res.parity[g] = { cases: rs.length, identical: rs.filter((r) => r.identical).length, identicalWithDetector: rs.filter((r) => r.identicalDet).length, divergent: rs.filter((r) => !r.identical).map((r) => ({ id: r.id, kind: r.kind, divergence: r.divergence })) };
  res.observedChanged[g] = [];
  for (const [cid, r] of R2) {
    const b = B1.get(cid), a = A.get(cid);
    if (r.kind === 'positive' || r.kind === 'control') {
      const wasGood = good(b) || good(a);
      if (!good(r) && wasGood) res.regressions.push({ corpus: g.toUpperCase(), id: cid, kind: r.kind, family: r.family, goodOnB1: good(b), goodOnA: good(a), observed: r.observed, exact: r.exact ?? null, fullyCovered: r.fullyCovered ?? null });
      else if (!good(r) && !good(b) && sig(b.observed) !== sig(r.observed)) res.newBad.push({ corpus: g.toUpperCase(), id: cid, kind: r.kind, family: r.family, note: 'was already failing on round-1 B; findings changed', before: b.observed, after: r.observed });
    } else if (sig(b.observed) !== sig(r.observed)) res.observedChanged[g].push({ id: cid, kind: r.kind, family: r.family, before: b.observed, after: r.observed });
  }
  res.perCase[g] = Object.fromEntries(rs.map((r) => [r.id, { kind: r.kind, family: r.family, good: good(r), exact: r.exact ?? null, fullyCovered: r.fullyCovered ?? null, miss: r.miss ?? null, flagged: r.flagged ?? null, observed: r.observed, spanOutcomes: r.spanOutcomes ?? null, goodOnB1: good(B1.get(cid_(r))), changed: sig(B1.get(r.id).observed) !== sig(r.observed) }]));
  function cid_(r) { return r.id; }
}
// scored cases that are good now and were bad on round-1 B (fixed), by round-1 gap group
const gaps = JSON.parse(readFileSync(path.join(values.r1, 'gaps.json'), 'utf8'));
res.groups = {};
for (const [k, v] of Object.entries(gaps.groups)) {
  const rec = { title: v.title, triage: v.triage, total: v.cases.length, closed: [], open: [], erratumDowngraded: [] };
  for (const c of v.cases) {
    const g = c.corpus.toLowerCase(); const nid = res.perCase[g][c.id] ? c.id : c.id.replace(/:control$/, ':unsupported'); const pc = res.perCase[g][nid];
    if (pc.kind === 'unsupported') rec.erratumDowngraded.push(nid);
    else if (pc.good) rec.closed.push(c.id); else rec.open.push({ corpus: c.corpus, id: c.id, kind: pc.kind, family: c.family, expected: c.expected, observed: pc.observed, spanOutcomes: pc.spanOutcomes });
  }
  res.groups[k] = rec;
}
writeFileSync(path.join(values.out, 'scores.json'), `${JSON.stringify(res, null, 1)}\n`);
const T = (g, id) => res.corpora[g][id].total;
for (const g of 'cde') console.log(g, 'r2', JSON.stringify(T(g, 'r2')), '\n  b1', JSON.stringify(T(g, 'b1')), '\n  parity', res.parity[g].identical + '/' + res.parity[g].cases);
console.log('regressions', res.regressions.length); for (const r of res.regressions) console.log(' ', r.corpus, r.id, JSON.stringify(r.observed));
console.log('newBad', res.newBad.length, 'observedChanged', Object.fromEntries(Object.entries(res.observedChanged).map(([g, v]) => [g, v.length])));
for (const [k, v] of Object.entries(res.groups)) console.log(k.padEnd(20), 'total', v.total, 'closed', v.closed.length, 'open', v.open.length, 'downgraded', v.erratumDowngraded.length);
