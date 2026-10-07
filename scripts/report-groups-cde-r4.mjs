#!/usr/bin/env node
// `node scripts/report-groups-cde-r4.mjs --r3 evidence/groups-cde/round3 --obs-dir evidence/groups-cde/round4-published-beta14 --out evidence/groups-cde/round4-published-beta14`
// Round 4 (#752, #753, #754): compares the PUBLISHED 0.1.0-beta.14 observations with the round-3 observations of the unpublished candidate c6dd6859
// on the unchanged frozen corpora. Applies the unchanged benchmarks/batch2/score-r2.mjs; adds no scoring rule; runs no scanner; records no matched text.
// The comparison is on the full finding signature (start, end, type, action, detector) per case, surface and mode (whole and stream, 7-byte and 1-byte).
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';
import { scoreCase } from '../benchmarks/batch2/score-r2.mjs';

const { values } = parseArgs({ options: { r3: { type: 'string' }, 'obs-dir': { type: 'string' }, out: { type: 'string' } } });
const MODS = { c: C, d: D, e: E };
const EXPECTED = { c: '16036d043fc0dad0e45ec42e2513d2ffec2020da3458a95ed57f09f44fb0e02d', d: 'aa173111a8b7142dc4f378ebd29875605658112eae6553dcfce6287cbaf8e72e', e: '6aa6221022b94418183f706f8034705d8c6050b5c657e309980832f6231691aa' };
const SURF = ['node', 'wasm', 'python', 'cli'];
const load = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const sigDet = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action, f.detector]).sort());
const sig = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action]).sort());
for (const g of 'cde') if (MODS[g].corpusDigest() !== EXPECTED[g]) throw new Error(`group ${g}: digest mismatch`);

const OBS = {};
for (const g of 'cde') for (const ch of [7, 1]) for (const id of ['r3', 'r4']) {
  const o = load(path.join(id === 'r3' ? values.r3 : values['obs-dir'], `observations-candidate-${g}-c${ch}.json.gz`));
  if (o.corpus.sha256 !== EXPECTED[g]) throw new Error(`${id}/${g}/${ch}: observation digest ${o.corpus.sha256}`);
  for (const s of SURF) if (!o.surfaces[s]) throw new Error(`${id}/${g}/${ch}: missing surface ${s}`);
  OBS[`${id}/${g}/${ch}`] = o;
}
function runsOf(id, g, key) {
  const out = [];
  for (const s of SURF) for (const ch of [7, 1]) { const c = OBS[`${id}/${g}/${ch}`].surfaces[s].cases[key]; out.push({ s, m: `whole${ch}`, ob: c.whole }, { s, m: `stream${ch}`, ob: c.stream }); }
  return out;
}
const good = (r) => (r.kind === 'positive' ? r.exact && r.fullyCovered : r.kind === 'control' ? !r.flagged : null);
function perCase(id, g, c) {
  const runs = runsOf(id, g, c.id);
  const sc = runs.map((r) => scoreCase(c, r.ob));
  const r = { id: c.id, kind: c.kind, family: c.family, identical: new Set(runs.map((x) => sig(x.ob.findings))).size === 1, identicalDet: new Set(runs.map((x) => sigDet(x.ob.findings))).size === 1, observed: runs[0].ob.findings.map((f) => ({ start: f.start, end: f.end, type: f.type, action: f.action, detector: f.detector })), runSigs: runs.map((x) => sigDet(x.ob.findings)) };
  if (c.kind === 'positive') { r.exact = sc.every((x) => x.spanOutcomes.every((y) => y === 'exact')); r.fullyCovered = sc.every((x) => x.fullyCovered); r.miss = sc.some((x) => x.spanOutcomes.includes('miss')); r.pass = sc.every((x) => x.pass); r.typeOk = sc.every((x) => x.typeOk); r.actionOk = sc.every((x) => x.actionOk); }
  else if (c.kind === 'control') r.flagged = sc.some((x) => x.flagged);
  return r;
}
const empty = () => ({ positives: 0, exact: 0, fullyCovered: 0, misses: 0, pass: 0, typeOk: 0, actionOk: 0, controls: 0, controlFlagged: 0, unsupported: 0, conflict: 0 });
const add = (t, r) => { if (r.kind === 'positive') { t.positives++; r.exact && t.exact++; r.fullyCovered && t.fullyCovered++; r.miss && t.misses++; r.pass && t.pass++; r.typeOk && t.typeOk++; r.actionOk && t.actionOk++; } else if (r.kind === 'control') { t.controls++; r.flagged && t.controlFlagged++; } else t[r.kind]++; };

const res = { schema: 'groups-cde-round4-scores-v1', identity: 'published @redact-secret/core 0.1.0-beta.14 (npm), PyPI redact-secret 0.1.0b14, crates.io redact-secret-cli 0.1.0-beta.14', against: 'round 3 candidate c6dd685974b8df6a84514e07e41e35afa711a2ac', digests: EXPECTED, corpora: {}, parity: {}, regressions: [], improvements: [], differentFindings: [], observationsDifferingByRun: 0, casesCompared: 0 };
for (const g of 'cde') {
  const t3 = empty(), t4 = empty(); let par = 0, parDet = 0;
  const divergent = [];
  for (const c of MODS[g].cases) {
    const a = perCase('r3', g, c), b = perCase('r4', g, c);
    add(t3, a); add(t4, b); res.casesCompared++;
    if (b.identical) par++; else divergent.push({ id: c.id, kind: c.kind });
    if (b.identicalDet) parDet++;
    for (let i = 0; i < a.runSigs.length; i++) if (a.runSigs[i] !== b.runSigs[i]) res.observationsDifferingByRun++;
    const same = a.runSigs.every((s, i) => s === b.runSigs[i]);
    if (!same) res.differentFindings.push({ corpus: g.toUpperCase(), id: c.id, kind: c.kind, family: c.family, r3: a.observed, r4: b.observed });
    if (c.kind === 'positive' || c.kind === 'control') {
      if (good(a) && !good(b)) res.regressions.push({ corpus: g.toUpperCase(), id: c.id, kind: c.kind, family: c.family, r4: b.observed });
      if (!good(a) && good(b)) res.improvements.push({ corpus: g.toUpperCase(), id: c.id, kind: c.kind, family: c.family });
    }
  }
  res.corpora[g] = { r3: t3, r4: t4 };
  res.parity[g] = { cases: MODS[g].cases.length, identical: par, identicalWithDetector: parDet, divergent };
}
writeFileSync(path.join(values.out, 'scores.json'), `${JSON.stringify(res, null, 1)}\n`);

const f = (t) => `${t.positives} | ${t.exact} | ${t.fullyCovered} | ${t.misses} | ${t.controls} | ${t.controlFlagged} | ${t.unsupported} | ${t.conflict}`;
const lines = [];
for (const g of 'cde') for (const id of ['r3', 'r4']) lines.push(`| ${g.toUpperCase()} | ${id === 'r3' ? 'R3 candidate c6dd6859' : 'R4 published beta.14'} | ${f(res.corpora[g][id])} |`);
const tot = (id) => { const t = empty(); for (const g of 'cde') for (const k of Object.keys(t)) t[k] += res.corpora[g][id][k]; return t; };
lines.push(`| all | R3 candidate c6dd6859 | ${f(tot('r3'))} |`, `| all | R4 published beta.14 | ${f(tot('r4'))} |`);
const md = `${lines.join('\n')}\n`;
writeFileSync(path.join(values.out, 'headline.md'), md);
console.log(md);
console.log('cases compared', res.casesCompared, 'observations differing (case x 16 runs)', res.observationsDifferingByRun, 'cases with any different finding', res.differentFindings.length);
console.log('regressions', res.regressions.length, 'improvements', res.improvements.length);
for (const g of 'cde') console.log('parity', g, `${res.parity[g].identical}/${res.parity[g].cases}`, `detector ${res.parity[g].identicalWithDetector}`);
