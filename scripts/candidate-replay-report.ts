/**
 * The effect of a registered unpublished product candidate against its published control, on identical evidence, peers, methods and configuration (#698).
 *
 *   node --import tsx scripts/candidate-replay-report.ts --control <dir> --candidate <dir> --candidate-id <id> --out <dir>
 *     [--snapshot <credential-eval-corpus-snapshot.json>] [--effect <compare-replay-effects.json>]
 *
 * <control> and <candidate> hold <population>/artifact.json (regression-corpus, policy-corpus, public-evidence-snapshot), public-evidence-snapshot/methods/artifact.json
 * and the run records. It reads the semantic part of each artifact only and writes, into <out>:
 *   candidate-effect.json  per population and for the methods run: cases fixed, regressed (worse), changed and still failing, with the findings (UTF-8 byte ranges,
 *                          families, actions) of both builds, the sanitized view of every differing plain case, the repeat-run agreement of both sides, and the peers'
 *                          unchanged check. `worsened` is true when anything got worse.
 *   candidate-effect.md    the same, for review.
 * It states what was measured and decides nothing: no ledger row, no status, and no evidence expectation is touched. A difference is "worse" only by the recorded
 * measurement (a pass that now fails, more leaked or collateral bytes, a control that is now flagged, an assertion that now fails), never by a judgement.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { controlFor } from './candidate-control.mjs';
import { candidateOf, readRegistry } from './install-product-candidate.mjs';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const control = path.resolve(need('control')), candidateDir = path.resolve(need('candidate')), out = path.resolve(need('out'));
const candidateId = need('candidate-id');
const registered = candidateOf(readRegistry(), candidateId);
const adoption = controlFor(JSON.parse(readFileSync(new URL('../benchmarks/evidence-adoption.json', import.meta.url), 'utf8')), { evidenceTag: option('evidence-tag'), manifestDigest: option('evidence-manifest-digest') });
const PRODUCT = 'redact-secret';

interface Finding { start: number; end: number; family?: string; action?: string }
interface Measurement { type?: string; span_outcomes?: string[]; flagged?: boolean; leaked_bytes?: number; collateral_bytes?: number; findings?: number }
interface CaseRow { case_id: string; kind?: string; tier?: string; family?: string | null; group?: string; evidence_class?: string; expected?: unknown[]; actual?: Finding[]; measurement?: Measurement }
interface Assertion { case_id: string; method: string; variant?: string; baseline?: string; candidate?: string; assertion: string; status: string }
interface Scanner { scanner: string; cases: CaseRow[]; assertions?: Assertion[] }

const passes = (m?: Measurement): boolean | null => {
  if (!m) return null;
  if (m.type === 'positive') return (m.span_outcomes ?? []).length > 0 && (m.span_outcomes ?? []).every(o => o === 'EXACT');
  if (m.type === 'control') return m.flagged === false;
  return null; // pending, not-measured: outside every denominator, never a pass or a fail
};
const worse = (a?: Measurement, b?: Measurement): boolean => {
  const pa = passes(a), pb = passes(b);
  if (pa === true && pb === false) return true;
  if (pa === false && pb === false) return (b?.leaked_bytes ?? 0) > (a?.leaked_bytes ?? 0) || (b?.collateral_bytes ?? 0) > (a?.collateral_bytes ?? 0) || (b?.findings ?? 0) > (a?.findings ?? 0);
  return pa === true && pb === true ? (b?.collateral_bytes ?? 0) > (a?.collateral_bytes ?? 0) : false;
};
// A case the control and the candidate both pass whose unexpected output the candidate reduces: fewer findings or fewer collateral bytes, with nothing expected lost and nothing leaked. The scored
// outcome does not change (a `warn` on a control reads clear, an extra redaction beside exact spans is collateral, not a miss), so it is not `fixed`; it is an improvement the findings show.
const better = (a?: Measurement, b?: Measurement): boolean => {
  if (passes(a) !== true || passes(b) !== true || worse(a, b)) return false;
  return (b?.collateral_bytes ?? 0) < (a?.collateral_bytes ?? 0) || (b?.findings ?? 0) < (a?.findings ?? 0);
};
const same = (x: unknown, y: unknown) => JSON.stringify(x) === JSON.stringify(y);

const POPULATIONS = ['public-evidence-snapshot', 'regression-corpus', 'policy-corpus'] as const;
const sanitize = (content: string, findings: Finding[]): string => {
  const bytes = Buffer.from(content, 'utf8');
  let result = '', at = 0;
  for (const f of [...findings].filter(x => x.action === 'redact' || x.action === 'block').sort((x, y) => x.start - y.start)) {
    if (f.start < at) continue;
    result += bytes.subarray(at, f.start).toString('utf8') + `[${f.action}:${f.family ?? 'finding'}]`;
    at = f.end;
  }
  return result + bytes.subarray(at).toString('utf8');
};
const snapshot = option('snapshot') && existsSync(option('snapshot')!) ? new Map<string, string>((JSON.parse(readFileSync(option('snapshot')!, 'utf8')).cases as Array<{ id: string; content: string }>).map(c => [c.id, c.content])) : new Map<string, string>();
const recordOf = (dir: string, rel: string) => { const f = path.join(dir, rel, 'run-record.json'); return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null; };

const result: Record<string, any> = {};
let worsened = false;
const fixedSeeds = new Set<string>(), stillFailing = new Set<string>(), regressedSeeds = new Set<string>();
for (const population of POPULATIONS) {
  const fa = path.join(control, population, 'artifact.json'), fb = path.join(candidateDir, population, 'artifact.json');
  if (!existsSync(fa) || !existsSync(fb)) { result[population] = { skipped: 'missing on one side' }; continue; }
  const A = readRunArtifact(readFileSync(fa)).artifact, B = readRunArtifact(readFileSync(fb)).artifact;
  const sa = new Map((A.scanners as unknown as Scanner[]).map(s => [s.scanner, s])), sb = new Map((B.scanners as unknown as Scanner[]).map(s => [s.scanner, s]));
  const peers: Record<string, { casesIdentical: boolean; differing: number }> = {};
  for (const [id, scanner] of sa) if (id !== PRODUCT) {
    const other = sb.get(id);
    const bc = new Map((other?.cases ?? []).map(c => [c.case_id, c]));
    const differing = scanner.cases.filter(c => !same({ a: c.actual, m: c.measurement }, { a: bc.get(c.case_id)?.actual, m: bc.get(c.case_id)?.measurement })).length;
    peers[id] = { casesIdentical: !!other && other.cases.length === scanner.cases.length && differing === 0, differing };
  }
  const pa = sa.get(PRODUCT)!, pb = sb.get(PRODUCT)!;
  const cb = new Map(pb.cases.map(c => [c.case_id, c]));
  const fixed: string[] = [], regressed: string[] = [], changed: string[] = [], improved: string[] = [], failing: string[] = [];
  const differing: unknown[] = [];
  let unchanged = 0;
  for (const c of pa.cases) {
    const n = cb.get(c.case_id);
    const before = passes(c.measurement), after = passes(n?.measurement);
    if (after === false) failing.push(c.case_id);
    if (same({ a: c.actual, m: c.measurement }, { a: n?.actual, m: n?.measurement })) { unchanged += 1; continue; }
    const direction = before === false && after === true ? 'fixed' : worse(c.measurement, n?.measurement) ? 'regressed' : better(c.measurement, n?.measurement) ? 'improved' : 'changed';
    (direction === 'fixed' ? fixed : direction === 'regressed' ? regressed : direction === 'improved' ? improved : changed).push(c.case_id);
    const content = snapshot.get(c.case_id);
    differing.push({
      case_id: c.case_id, direction, kind: c.kind, tier: c.tier, family: c.family, group: c.group, evidence_class: c.evidence_class, expected: c.expected,
      control: { measurement: c.measurement, actual: c.actual }, candidate: { measurement: n?.measurement, actual: n?.actual },
      ...(content !== undefined ? { sanitized: { control: sanitize(content, c.actual ?? []), candidate: sanitize(content, n?.actual ?? []) } } : {}),
    });
  }
  if (pb.cases.length !== pa.cases.length) regressed.push(`(case count ${pa.cases.length} -> ${pb.cases.length})`);
  worsened ||= regressed.length > 0;
  if (population === 'public-evidence-snapshot') { for (const id of fixed) fixedSeeds.add(id); for (const id of failing) stillFailing.add(id); for (const id of regressed) regressedSeeds.add(id); }
  const recA = recordOf(control, population), recB = recordOf(candidateDir, population);
  result[population] = {
    cases: pa.cases.length, fixed, regressed, improved, changed, unchanged, stillFailing: failing.length,
    aggregatesIdentical: same(pa.aggregates, pb.aggregates), status: { control: pa.status, candidate: pb.status }, peers,
    repeat: { control: recA?.determinism ?? null, candidate: recB?.determinism ?? null, semanticDigest: { control: recA?.artifact?.semanticDigest ?? null, candidate: recB?.artifact?.semanticDigest ?? null } },
    differing,
  };
  worsened ||= Object.values(peers).some(p => !p.casesIdentical);
}

// The methods run (floors population): the product's assertions and the review occurrences, by semantic key.
const ma = path.join(control, 'public-evidence-snapshot/methods/artifact.json'), mb = path.join(candidateDir, 'public-evidence-snapshot/methods/artifact.json');
if (existsSync(ma) && existsSync(mb)) {
  const A = readRunArtifact(readFileSync(ma), { forceBytes: true }).artifact, B = readRunArtifact(readFileSync(mb), { forceBytes: true }).artifact;
  const asKey = (a: Assertion) => `${a.case_id}|${a.method}|${a.assertion}|${a.variant ?? ''}|${a.baseline ?? ''}|${a.candidate ?? ''}`;
  const product = (art: typeof A) => (art.scanners as unknown as Scanner[]).find(s => s.scanner === PRODUCT)!;
  const assertionsA = new Map((product(A).assertions ?? []).map(a => [asKey(a), a])), assertionsB = new Map((product(B).assertions ?? []).map(a => [asKey(a), a]));
  const fixed: string[] = [], regressed: string[] = [];
  for (const [k, a] of assertionsA) { const b = assertionsB.get(k); if (!b) regressed.push(`${k} (absent in the candidate)`); else if (a.status !== b.status) (a.status !== 'pass' && b.status === 'pass' ? fixed : regressed).push(k); }
  for (const [k, b] of assertionsB) if (!assertionsA.has(k)) (b.status === 'pass' ? [] : regressed).push(`${k} (new)`);
  const rq = (art: typeof A) => new Set(((art as unknown as { review_queue: Array<Record<string, unknown>> }).review_queue ?? []).map(e => [e.case_id, e.peer, e.disagreement, e.variant, e.content_digest ?? e.contentDigest ?? '', e.method].join('|')));
  const ra = rq(A), rb = rq(B);
  const added = [...rb].filter(k => !ra.has(k)), removed = [...ra].filter(k => !rb.has(k));
  const failingNow = [...assertionsB.values()].filter(a => a.status !== 'pass');
  // A review occurrence that appears on a case the candidate fixed follows that fix (the reference now matches the evidence, so a peer that differs is the peer's divergence);
  // one that appears anywhere else is a change nothing explains and counts as worse until adjudicated.
  const seedOf = (k: string) => k.split('|')[0].replace(/--(differential|metamorphic|mutation)(--.*)?$/, '');
  const fixedSet = new Set<string>(result['public-evidence-snapshot']?.fixed ?? []);
  const addedOnFixed = added.filter(k => fixedSet.has(seedOf(k))), addedElsewhere = added.filter(k => !fixedSet.has(seedOf(k)));
  worsened ||= regressed.length > 0 || addedElsewhere.length > 0;
  const recA = recordOf(control, 'public-evidence-snapshot/methods'), recB = recordOf(candidateDir, 'public-evidence-snapshot/methods');
  const casesA = new Map(product(A).cases.map(c => [c.case_id, c]));
  const caseChanges = product(B).cases.filter(c => !same({ a: casesA.get(c.case_id)?.actual, m: casesA.get(c.case_id)?.measurement }, { a: c.actual, m: c.measurement })).map(c => ({
    case_id: c.case_id, control: { measurement: casesA.get(c.case_id)?.measurement, actual: casesA.get(c.case_id)?.actual }, candidate: { measurement: c.measurement, actual: c.actual },
    direction: passes(casesA.get(c.case_id)?.measurement) === false && passes(c.measurement) === true ? 'fixed' : worse(casesA.get(c.case_id)?.measurement, c.measurement) ? 'regressed' : 'changed' }));
  worsened ||= caseChanges.some(c => c.direction === 'regressed');
  result['methods'] = {
    assertions: { control: assertionsA.size, candidate: assertionsB.size, fixed: fixed.length, regressed: regressed.length, stillFailing: failingNow.length, fixedKeys: fixed.slice(0, 500), regressedKeys: regressed.slice(0, 500) },
    reviewOccurrences: { control: ra.size, candidate: rb.size, added, removed, addedOnFixedCases: addedOnFixed.length, addedElsewhere: addedElsewhere.length },
    variantCases: { changed: caseChanges.length, fixed: caseChanges.filter(c => c.direction === 'fixed').length, regressed: caseChanges.filter(c => c.direction === 'regressed').length, changes: caseChanges.slice(0, 500) },
    repeat: { control: recA?.determinism ?? null, candidate: recB?.determinism ?? null, semanticDigest: { control: recA?.artifact?.semanticDigest ?? null, candidate: recB?.artifact?.semanticDigest ?? null } },
  };
} else result['methods'] = { skipped: 'missing on one side' };

const plain = result['public-evidence-snapshot'];
const report = {
  schema: 'redact-secret/product-candidate-effect/v1',
  commit: registered.product.commit, candidate: candidateId, pr: registered.product.changes,
  build: registered.product.build, tarballSha256: Object.fromEntries(registered.packages.map((p: { name: string; sha256: string }) => [p.name, p.sha256])),
  control: { product: adoption.product, archive: adoption.replay?.archive, ciRun: adoption.replay?.ciRun, runClass: 'official' },
  replay: { engine: `credential-eval ${adoption.engine.tag} (${adoption.engine.revision.slice(0, 8)})`, runClass: registered.runClass, publication: registered.publication, platform: registered.platform, evidence: adoption.evidenceRelease,
    scope: 'plain, methods (floors population), policy and regression populations; every scanner and the engine configuration as the control; only the product build differs' },
  worsened, fixed: plain?.fixed ?? [], improved: plain?.improved ?? [], regressed: POPULATIONS.flatMap(p => (result[p]?.regressed ?? []).map((id: string) => `${p}:${id}`)), stillFailing: [...stillFailing].sort(), populations: result,
  note: 'An exploratory, internal measurement of an unpublished build: never an accepted run, never public evidence. It decides nothing: no ledger row, status or evidence expectation is changed.',
};
mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, 'candidate-effect.json'), `${JSON.stringify(report, null, 1)}\n`);

const m = (x?: Measurement) => (x ? (x.type === 'positive' ? (x.span_outcomes ?? []).join('/') : x.type === 'control' ? (x.flagged ? 'flagged' : 'clear') : String(x.type)) : '-');
const f = (x?: Finding[]) => (x?.length ? x.map(y => `${y.start}-${y.end} ${y.family ?? ''} ${y.action ?? ''}`).join('; ') : 'none');
const lines = [
  `# Product candidate ${candidateId} against the published control (#698)`, '',
  `Candidate: \`@redact-secret/core\` built from redact-secret ${registered.product.commit} (${registered.product.changes.join(', ')}), **unpublished**, exploratory/internal. Control: published ${adoption.product.version} (${adoption.replay?.archive?.release ?? 'archive'}). Same engine ${adoption.engine.tag}, evidence ${adoption.evidenceRelease}, peers and configuration; only the product build differs.`, '',
  `**Worsened: ${worsened ? 'YES, see the regressed rows' : 'no'}.** Fixed is a failing case that now passes; improved is a case that passed before and passes now with fewer unexpected findings or less collateral. This is a measurement, not a decision: no ledger row, status or evidence expectation changes.`, '',
  '| Population | Cases | Fixed | Improved | Regressed | Changed | Unchanged | Still failing | Peers identical | Repeat runs equal (control / candidate) |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ...POPULATIONS.filter(p => !result[p]?.skipped).map(p => { const r = result[p]; return `| ${p} | ${r.cases} | ${r.fixed.length} | ${r.improved.length} | ${r.regressed.length} | ${r.changed.length} | ${r.unchanged} | ${r.stillFailing} | ${Object.values(r.peers).every((x: any) => x.casesIdentical) ? 'yes' : 'NO'} | ${r.repeat.control?.semanticDigestsEqual ?? '?'} / ${r.repeat.candidate?.semanticDigestsEqual ?? '?'} |`; }), '',
];
if (result.methods && !result.methods.skipped) {
  const x = result.methods;
  lines.push('## Methods run (floors population)', '', `Assertions of the product: control ${x.assertions.control}, candidate ${x.assertions.candidate}; fixed ${x.assertions.fixed}, regressed ${x.assertions.regressed}, still failing ${x.assertions.stillFailing}. Review occurrences: control ${x.reviewOccurrences.control}, candidate ${x.reviewOccurrences.candidate} (added ${x.reviewOccurrences.added.length}, of which ${x.reviewOccurrences.addedOnFixedCases} on cases the candidate fixed and ${x.reviewOccurrences.addedElsewhere} elsewhere; removed ${x.reviewOccurrences.removed.length}). Generated variant cases changed: ${x.variantCases.changed} (fixed ${x.variantCases.fixed}, regressed ${x.variantCases.regressed}). Repeat runs equal: ${x.repeat.control?.semanticDigestsEqual ?? '?'} / ${x.repeat.candidate?.semanticDigestsEqual ?? '?'}.`, '');
}
for (const p of POPULATIONS) {
  const r = result[p];
  if (!r || r.skipped || !r.differing.length) continue;
  lines.push(`## ${p}: differing cases`, '', '| Case | Direction | Control | Candidate | Control findings | Candidate findings |', '| --- | --- | --- | --- | --- | --- |',
    ...r.differing.map((d: any) => `| \`${d.case_id}\` | ${d.direction} | ${m(d.control.measurement)} | ${m(d.candidate.measurement)} | ${f(d.control.actual)} | ${f(d.candidate.actual)} |`), '');
}
writeFileSync(path.join(out, 'candidate-effect.md'), `${lines.join('\n')}\n`);
console.error(`candidate ${candidateId}: worsened=${worsened}; plain fixed ${plain?.fixed?.length ?? 0}, improved ${plain?.improved?.length ?? 0}, regressed ${plain?.regressed?.length ?? 0}`);
if (args.includes('--strict') && worsened) process.exit(1);
