/**
 * What the release's review state does to the measurement (credential-evidence ADR 0020, solo-maintainer period): fixtures that moved out of not-assertable
 * (T0, outside every denominator) and fixtures that are `maintainer-only` (finalized by the sole maintainer, never reviewed, never independent validation). Adds
 * `replay.reviewStateEffect` to a change report. Reporting only: it settles nothing, it does not turn a maintainer decision into a review, and it asserts nothing
 * about the product.
 *
 *   node --import tsx scripts/summarize-review-state-effect.ts --report FILE --snapshot NEW_SNAPSHOT --previous-snapshot OLD_SNAPSHOT --candidate DIR
 *
 * `previous-snapshot` is the release the previous candidate was made from, so the moved fixtures are those whose tier left T0 between the two. `candidate` holds the
 * candidate's plain `artifact.json`. The maintainer-only fixture ids come from the change report (`reviewState.candidate.maintainerOnlyFixtureIds`).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { outcomeSignature } from './evidence-adoption.mjs';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const arg = (name: string) => { const i = process.argv.indexOf(`--${name}`); if (i < 0) throw new Error(`--${name} is required`); return process.argv[i + 1]; };
const report: Json = JSON.parse(readFileSync(arg('report'), 'utf8'));
const snap = (f: string): Json => JSON.parse(readFileSync(f, 'utf8'));
const now = snap(arg('snapshot')), before = snap(arg('previous-snapshot'));
const artifact: Json = readRunArtifact(readFileSync(path.join(arg('candidate'), 'artifact.json'))).artifact;
const tierBefore = new Map<string, string>(before.cases.map((c: Json) => [c.id, c.grouping?.tier]));
const moved = new Set<string>(now.cases.filter((c: Json) => tierBefore.get(c.id) === 'T0' && c.grouping?.tier !== 'T0').map((c: Json) => c.id));
const movedIntoT0 = now.cases.filter((c: Json) => tierBefore.has(c.id) && tierBefore.get(c.id) !== 'T0' && c.grouping?.tier === 'T0').length;
const maintainerOnly = new Set<string>(report.reviewState?.candidate?.maintainerOnlyFixtureIds ?? []);
const familyOf = new Map<string, string>(now.cases.map((c: Json) => [c.id, c.grouping?.family ?? '(none)']));

const bucket = (r: Json): string => {
  const sig = outcomeSignature(r);
  if (sig === 'pending' || sig === 'not-measured') return sig;
  if (sig.startsWith('positive:')) { const o = sig.slice(9).split(','); return o.every(x => x === 'EXACT') ? 'positive:exact' : o.every(x => x === 'MISS') ? 'positive:miss' : 'positive:other'; }
  return sig;
};
const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
const sorted = (o: Record<string, number>) => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));

const byScanner = (ids: Set<string>) => Object.fromEntries(artifact.scanners.map((s: Json) => {
  const b: Record<string, number> = {}; let n = 0;
  for (const c of s.cases) if (ids.has(c.case_id)) { n++; bump(b, bucket(c)); }
  return [s.scanner, { cases: n, outcomes: sorted(b) }];
}));
const reference = artifact.scanners.find((s: Json) => s.scanner === 'redact-secret') ?? artifact.scanners[0];
const familyRows = (ids: Set<string>) => {
  const f: Record<string, { cases: number; scored: number }> = {};
  for (const c of reference.cases) if (ids.has(c.case_id)) { const k = familyOf.get(c.case_id) ?? '(none)'; (f[k] ??= { cases: 0, scored: 0 }).cases++; if (bucket(c) !== 'pending') f[k].scored++; }
  return Object.fromEntries(Object.keys(f).sort().map(k => [k, f[k]]));
};
const kinds = (ids: Set<string>) => { const o: Record<string, number> = {}; for (const c of now.cases) if (ids.has(c.id)) bump(o, `${c.grouping?.kind}/${c.grouping?.tier}`); return sorted(o); };

report.replay = {
  ...(report.replay ?? {}),
  reviewStateEffect: {
    note: 'The release\'s review state apart from the corpus and the engine. A fixture that left not-assertable (T0) is now a scored case; a maintainer-only fixture was finalized by the sole maintainer alone, never reviewed and never independent validation, and rests on that single decision. Neither is a settled review decision of this repository, and no gate here treats a maintainer decision as one. Counts are of cases in the plain run.',
    release: report.reviewState?.candidate ? { rule: report.reviewState.candidate.rule, fixtures: report.reviewState.candidate.fixtures, maintainerOnly: report.reviewState.candidate.maintainerOnly, attributedFixtures: report.reviewState.candidate.attributedFixtures, unattributedFixtures: report.reviewState.candidate.unattributedFixtures } : null,
    movedOutOfNotAssertable: { cases: moved.size, movedIntoNotAssertable: movedIntoT0, byKindAndTier: kinds(moved), outcomesByScanner: byScanner(moved), byFamily: familyRows(moved) },
    maintainerOnly: { cases: maintainerOnly.size, byKindAndTier: kinds(maintainerOnly), outcomesByScanner: byScanner(maintainerOnly), byFamily: familyRows(maintainerOnly), overlapWithMoved: [...maintainerOnly].filter(id => moved.has(id)).length, notInTheEvalSnapshot: [...maintainerOnly].filter(id => !familyOf.has(id)).length },
  },
};
writeFileSync(arg('report'), `${JSON.stringify(report, null, 2)}\n`);
const e = report.replay.reviewStateEffect;
console.log(JSON.stringify({ moved: e.movedOutOfNotAssertable.cases, movedByKind: e.movedOutOfNotAssertable.byKindAndTier, maintainerOnly: e.maintainerOnly.cases, mo: e.maintainerOnly.byKindAndTier, overlap: e.maintainerOnly.overlapWithMoved }, null, 1));
