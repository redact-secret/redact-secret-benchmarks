import type { runEvaluation } from './runner.ts';
import type { EvaluationCase } from '../../model/types.ts';
import type { EvaluationReport } from '../../../shared/evaluation-types.ts';
import { evaluationProblem } from '../../../shared/evaluation-model.ts';
import { validateQualificationEvidence } from './qualification.ts';
import { projectKnownResults } from '../../substrate/public-projection.ts';
import { readCredentialAccountingIdentity } from './accounting.ts';
type Raw = Awaited<ReturnType<typeof runEvaluation>>;
/** The discovery fields the public summary reads: everything of the discovery report except the three record lists (a store header has exactly these). */
export type DiscoveryHeader = Omit<Raw, 'results' | 'failures' | 'reviewQueue'>;
type RawCase = Raw['results'][number];
type RawReview = Raw['reviewQueue'][number];

export function assertPublicDiscovery(raw: Pick<Raw, 'schemaVersion' | 'accountingVersion' | 'mode'>): void {
  if (raw.schemaVersion !== 3 || raw.accountingVersion !== '1.1' || raw.mode !== 'discovery') throw Error('Unsupported discovery report');
}
export const publicCaseAccepted = (source: EvaluationCase, c: RawCase) => ['development','regression'].includes(c.visibility) && c.method !== 'holdout' &&
  c.method === source.method && c.provenance.sourceHash === source.provenance.sourceHash &&
  c.source.category === source.source.category && c.source.fixtureId === source.source.fixtureId;
/** One reviewed source and its discovery result to the public case: the only case-level discovery-to-browser boundary. */
export const projectPublicCase = (source: EvaluationCase, c: RawCase): EvaluationReport['cases'][number] => ({ id: source.id, method: source.method, targets: source.targets, taxonomy: source.taxonomy ?? '',
  sourceSlug: `${source.source.category}--${source.source.fixtureId}`,
  variants: c.variants.map(v => ({ id: v.id, kind: v.kind, tier: v.tier, strategy: v.strategy,
    operator: v.transformation.operator, property: v.transformation.property ?? '', relation: v.transformation.relation ?? '',
    expectationEffect: v.transformation.expectationEffect ?? '', contractMatch: v.transformation.contractMatch ?? null })),
  assertions: c.scanners.flatMap(s => s.assertions.map(a => ({ scanner: s.scanner, type: a.type, status: a.status,
    variant: a.variant ?? '', baseline: a.baseline ?? '', candidate: a.candidate ?? '' }))),
  findings: c.scanners.flatMap(s => s.variants.map(v => ({ scanner: s.scanner, variant: v.id, count: v.row.actual.length, flagged: v.row.flagged ?? null,
    ...(v.row.actionCounts ? { actionCounts: v.row.actionCounts } : {}) }))),
  generation: c.generation.map(g => ({ operator: g.operator, status: g.status })),
  comparisons: (c.comparisons ?? []).map(c => ({ peer: c.peer, variant: c.variant, status: c.status, disagreement: c.disagreement ?? '', classification: c.classification ?? '' })) });
export const projectPublicReview = (q: RawReview): EvaluationReport['reviews'][number] => ({ id: q.id, caseId: q.caseId, variant: q.variant, peer: 'peer' in q ? q.peer ?? '' : '',
  disagreement: 'disagreement' in q ? q.disagreement ?? '' : '' });
/** The public report without its two record lists: identity, provenance, scanners, review state, operator totals, qualification. `byOperator` is the producer's recomputation from the cases it saw. */
export function publicEvaluationSummary(raw: DiscoveryHeader, byOperator: EvaluationReport['byOperator'], corpusHashes: Record<string, string>, qualification: EvaluationReport['qualification'] = null): Omit<EvaluationReport, 'cases' | 'reviews'> {
  assertPublicDiscovery(raw);
  readCredentialAccountingIdentity(raw as unknown as Record<string, unknown>, 'evaluation-v1');
  if (qualification) validateQualificationEvidence(qualification);
  const p = raw.provenance as Record<string, unknown>;
  return { schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false,
    runId: raw.runId, startedAt: raw.startedAt, finishedAt: raw.finishedAt,
    provenance: { revision: String(p.revision ?? 'unknown'), dirty: typeof p.dirty === 'boolean' ? p.dirty : null,
      casesHash: String(p.casesHash), lockHash: String(p.lockHash ?? ''),
      methods: raw.provenance.methods.map(m => ({ id: m.id, version: m.version })),
      operators: raw.provenance.operators.map(o => ({ id: o.id, version: o.version })) }, corpusHashes,
    scanners: raw.scanners.map(s => ({ id: s.id, status: s.status, version: s.version, mode: s.mode, configurationHash: s.configurationHash ?? '',
      observation: s.observation ?? { source: 'fresh', observedAt: raw.startedAt, sourceRunId: raw.runId } })),
    review: raw.review,
    byOperator: Object.fromEntries(Object.entries(byOperator).map(([id, o]) => [id, { generated: o.generated, unsupported: o.unsupported, error: o.error,
      assertions: Object.fromEntries(Object.entries(o.assertions).map(([key, c]) => [key, { pass: c.pass, fail: c.fail, 'review-required': c['review-required'], 'not-measured': c['not-measured'] }])) }])), qualification };
}
/** The whole public report from a whole discovery report: the legacy, in-memory path (small selections, tests, the supported evaluation-v1 contract). The bundle writer composes the same pieces per record. */
export function publicEvaluation(raw: Raw, sources: EvaluationCase[], corpusHashes: Record<string, string>, qualification: EvaluationReport['qualification'] = null): EvaluationReport {
  assertPublicDiscovery(raw);
  const cases = projectKnownResults({ sources, results: raw.results, accepts: publicCaseAccepted, project: projectPublicCase,
    refusal: 'Unknown, protected or stale discovery source; publication refused' });
  const reviews = raw.reviewQueue.map(projectPublicReview);
  const summary = publicEvaluationSummary(raw, raw.byOperator as EvaluationReport['byOperator'], corpusHashes, qualification);
  // Key order is that of the original report: scanners, cases, reviews, review, byOperator, qualification.
  const { scanners, review, byOperator, qualification: q, ...head } = summary;
  const report: EvaluationReport = { ...head, scanners, cases, reviews, review, byOperator, qualification: q };
  const problem = evaluationProblem(report);
  if (problem || raw.caseCount !== cases.length || raw.variantCount !== cases.reduce((n, c) => n + c.variants.length, 0)) throw Error(problem ?? 'Discovery totals mismatch');
  return report;
}
