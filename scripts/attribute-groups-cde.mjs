#!/usr/bin/env node
// `node scripts/attribute-groups-cde.mjs --obs-dir <dir> --out <file>`: supplementary attribution run (groups C, D, E round 1).
// Compares the candidate e1284537 with the intermediate main commit efe71496 (before the five Batch 2 closeout fixes) at 7-byte
// chunks on all four surfaces, so the effect of the five fixes is separated from everything else that changed since beta.13.
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import path from 'node:path';
import { parseArgs } from 'node:util';
import * as C from '../benchmarks/group-c/corpus-group-c.mjs';
import * as D from '../benchmarks/group-d/corpus-group-d.mjs';
import * as E from '../benchmarks/group-e/corpus-e.mjs';
import { scoreCase } from '../benchmarks/batch2/score-r2.mjs';
const { values } = parseArgs({ options: { 'obs-dir': { type: 'string' }, out: { type: 'string' } } });
const load = (p) => JSON.parse(gunzipSync(readFileSync(p)).toString('utf8'));
const sig = (l) => JSON.stringify([...l].map((f) => [f.start, f.end, f.type, f.action]).sort());
const S = ['node', 'wasm', 'python', 'cli'];
const out = { schema: 'groups-cde-attribution-v1', note: 'intermediate = redact-secret efe71496 (main before the five fixes); candidate = e1284537', corpora: {} };
for (const [g, mod] of Object.entries({ c: C, d: D, e: E })) {
  const mid = load(path.join(values['obs-dir'], `observations-intermediate-${g}-c7.json.gz`));
  const cand = load(path.join(values['obs-dir'], `observations-candidate-${g}-c7.json.gz`));
  const pub = load(path.join(values['obs-dir'], `observations-published-${g}-c7.json.gz`));
  const bad = (c, o) => { const s = scoreCase(c, o); return c.kind === 'positive' ? !(s.spanOutcomes.every((x) => x === 'exact') && s.fullyCovered) : c.kind === 'control' ? s.flagged : null; };
  const rec = { cases: mod.cases.length, midVsCandidate: [], publishedVsMid: { fixed: 0, regressed: 0, changedObserved: 0 }, surfacesAgree: true };
  for (const c of mod.cases) {
    for (const s of S) if (sig(mid.surfaces[s].cases[c.id].whole.findings) !== sig(mid.surfaces.node.cases[c.id].whole.findings)) rec.surfacesAgree = false;
    const m = mid.surfaces.node.cases[c.id].whole, k = cand.surfaces.node.cases[c.id].whole, p = pub.surfaces.node.cases[c.id].whole;
    if (sig(m.findings) !== sig(k.findings)) rec.midVsCandidate.push({ id: c.id, kind: c.kind, family: c.family, scoredBefore: c.kind === 'positive' || c.kind === 'control' ? (bad(c, m) ? 'bad' : 'good') : 'observed-only', scoredAfter: c.kind === 'positive' || c.kind === 'control' ? (bad(c, k) ? 'bad' : 'good') : 'observed-only', before: m.findings.map(({ start, end, type, action }) => ({ start, end, type, action })), after: k.findings.map(({ start, end, type, action }) => ({ start, end, type, action })) });
    if (sig(p.findings) !== sig(m.findings)) { if (c.kind === 'positive' || c.kind === 'control') { const bp = bad(c, p), bm = bad(c, m); if (bp && !bm) rec.publishedVsMid.fixed++; else if (!bp && bm) rec.publishedVsMid.regressed++; else rec.publishedVsMid.changedObserved++; } else rec.publishedVsMid.changedObserved++; }
  }
  out.corpora[g] = rec;
  console.log(g, 'mid->candidate changed', rec.midVsCandidate.length, 'published->mid fixed/regressed/changed', JSON.stringify(rec.publishedVsMid), 'surfacesAgree(mid)', rec.surfacesAgree);
  for (const x of rec.midVsCandidate) console.log('  ', x.id, x.kind, x.scoredBefore, '->', x.scoredAfter);
}
writeFileSync(values.out, `${JSON.stringify(out, null, 1)}\n`);
