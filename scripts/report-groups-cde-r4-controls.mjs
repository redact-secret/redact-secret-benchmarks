#!/usr/bin/env node
// `node scripts/report-groups-cde-r4-controls.mjs --obs-dir evidence/groups-cde/round4-published-beta14/controls --out evidence/groups-cde/round4-published-beta14/controls`
// Round 4 regression controls (#752, #753, #754): the published 0.1.0-beta.14 on the unchanged Batch 1 (82 cases), Batch 2 round-1 (486) and round-2 (1935)
// corpora, compared with the accepted Batch 2 round-3 observations of the candidate 4e004108 (evidence/739/round3). Unchanged scorers (Batch 1: benchmarks/batch1/score.mjs; Batch 2: score-r2.mjs); no matched text.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as B1 from '../benchmarks/batch1/corpus.mjs';
import * as R1 from '../benchmarks/batch2/corpus.mjs';
import * as R2 from '../benchmarks/batch2/corpus-r2.mjs';
import { scoreCase as scoreR2 } from '../benchmarks/batch2/score-r2.mjs';
import { scoreCase as scoreB1 } from '../benchmarks/batch1/score.mjs';

const { values } = parseArgs({ options: { 'obs-dir': { type: 'string' }, out: { type: 'string' } } });
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const load = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const SURF = ['node', 'wasm', 'python', 'cli'];
const sigDet = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action, f.detector]).sort());
const sig = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action]).sort());
const CORP = { b1: B1, r1: R1, r2: R2 };
const bad = (c, s) => (c.kind === 'positive' ? !s.pass : c.kind === 'control' ? s.flagged : false);
const res = { schema: 'groups-cde-round4-controls-v1', published: '0.1.0-beta.14', reference: 'candidate 4e0041081aad22d0101bd52db52017b67b5bd3db (evidence/739/round3)', corpora: {} };
for (const [k, mod] of Object.entries(CORP)) {
  const sums = { cases: mod.cases.length, sha256: mod.corpusDigest(), positives: 0, positivesFailing: 0, controls: 0, controlsFlagged: 0, unsupported: 0, conflict: 0, parityDivergent: 0, streamNotEqualWhole: 0, regressionsVsAccepted: [], improvementsVsAccepted: [], casesWithDifferentFindings: 0, differentFindingCases: [] };
  const obs = {};
  for (const ch of [7, 1]) {
    obs[`pub${ch}`] = load(path.join(values['obs-dir'], `observations-published-${k}-c${ch}.json.gz`));
    obs[`ref${ch}`] = load(path.join(root, 'evidence/739/round3', `observations-candidate-${k}c${ch}.json.gz`));
    for (const id of ['pub', 'ref']) { const o = obs[`${id}${ch}`]; if (o.corpus.sha256 !== sums.sha256) throw new Error(`${k}/${id}/${ch}: corpus digest mismatch`); for (const s of SURF) if (!o.surfaces[s]) throw new Error(`${k}/${id}/${ch}: missing ${s}`); }
  }
  const runs = (id, c) => SURF.flatMap((s) => [7, 1].flatMap((ch) => { const ob = obs[`${id}${ch}`].surfaces[s].cases[c.id]; return [ob.whole, ob.stream]; }));
  for (const c of mod.cases) {
    const p = runs('pub', c), r = runs('ref', c);
    if (c.kind === 'positive') sums.positives++; else if (c.kind === 'control') sums.controls++; else sums[c.kind]++;
    const scoreCase = k === 'b1' ? scoreB1 : scoreR2; // Batch 1 keeps its own scorer (exact span and redact action); Batch 2 uses score-r2
    const pb = p.some((ob) => bad(c, scoreCase(c, ob))), rb = r.some((ob) => bad(c, scoreCase(c, ob)));
    if (c.kind === 'positive' && pb) sums.positivesFailing++;
    if (c.kind === 'control' && pb) sums.controlsFlagged++;
    if (new Set(p.map((ob) => sig(ob.findings))).size !== 1) sums.parityDivergent++;
    for (const s of SURF) for (const ch of [7, 1]) { const ob = obs[`pub${ch}`].surfaces[s].cases[c.id]; if (sig(ob.whole.findings) !== sig(ob.stream.findings)) { sums.streamNotEqualWhole++; break; } }
    if (p.some((ob, i) => sigDet(ob.findings) !== sigDet(r[i].findings)) ) { sums.casesWithDifferentFindings++; sums.differentFindingCases.push({ id: c.id, kind: c.kind, before: r[0].findings.map((f) => [f.start, f.end, f.type, f.action]), after: p[0].findings.map((f) => [f.start, f.end, f.type, f.action]) }); }
    if (c.kind === 'positive' || c.kind === 'control') { if (pb && !rb) sums.regressionsVsAccepted.push(c.id); if (!pb && rb) sums.improvementsVsAccepted.push(c.id); }
  }
  res.corpora[k] = sums;
}
writeFileSync(path.join(values.out, 'controls.json'), `${JSON.stringify(res, null, 1)}\n`);
for (const [k, s] of Object.entries(res.corpora)) console.log(k, JSON.stringify({ ...s, regressionsVsAccepted: s.regressionsVsAccepted.length, improvementsVsAccepted: s.improvementsVsAccepted.length }));
