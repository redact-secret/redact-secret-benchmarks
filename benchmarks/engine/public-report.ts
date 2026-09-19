import type { runEvaluation } from './runner.ts';
import type { EvaluationCase } from './types.ts';
import type { EvaluationReport } from '../../src/evaluation-types.ts';
import { evaluationProblem } from '../../src/evaluation-model.ts';
import { validateEvidence } from './evidence.ts';
/** The only discovery-to-browser boundary. Do not spread raw case/variant/queue fields. */
export function publicEvaluation(raw: Awaited<ReturnType<typeof runEvaluation>>, sources: EvaluationCase[], corpusHashes: Record<string, string>, qualification: EvaluationReport['qualification'] = null): EvaluationReport {
  if (raw.schemaVersion !== 3 || raw.accountingVersion !== '1.1' || raw.mode !== 'discovery') throw Error('Unsupported discovery report');
  const known = new Map(sources.map(c => [c.id, c]));
  if (qualification) validateEvidence(qualification, 'qualification');
  const cases = raw.results.map(c => {
    const source = known.get(c.id);
    if (!source || !['development','regression'].includes(c.visibility) || c.method === 'holdout' ||
      c.method !== source.method || c.provenance.sourceHash !== source.provenance.sourceHash ||
      c.source.category !== source.source.category || c.source.fixtureId !== source.source.fixtureId)
      throw Error('Unknown, protected or stale discovery source; publication refused');
    return { id: source.id, method: source.method, targets: source.targets, taxonomy: source.taxonomy ?? '',
      sourceSlug: `${source.source.category}--${source.source.fixtureId}`,
      variants: c.variants.map(v => ({ id: v.id, kind: v.kind, tier: v.tier, strategy: v.strategy,
        operator: v.transformation.operator, property: v.transformation.property ?? '', relation: v.transformation.relation ?? '',
        expectationEffect: v.transformation.expectationEffect ?? '', contractMatch: v.transformation.contractMatch ?? null })),
      assertions: c.scanners.flatMap(s => s.assertions.map(a => ({ scanner: s.scanner, type: a.type, status: a.status,
        variant: a.variant ?? '', baseline: a.baseline ?? '', candidate: a.candidate ?? '' }))),
      findings: c.scanners.flatMap(s => s.variants.map(v => ({ scanner: s.scanner, variant: v.id, count: v.row.actual.length, flagged: v.row.flagged ?? null }))),
      generation: c.generation.map(g => ({ operator: g.operator, status: g.status })),
      comparisons: (c.comparisons ?? []).map(c => ({ peer: c.peer, variant: c.variant, status: c.status, disagreement: c.disagreement ?? '', classification: c.classification ?? '' })) };
  });
  const p = raw.provenance as Record<string, unknown>;
  const report: EvaluationReport = { schemaVersion: 2, accountingVersion: '1.1', reportType: 'evaluation-public', supportClaims: false,
    runId: raw.runId, startedAt: raw.startedAt, finishedAt: raw.finishedAt,
    provenance: { revision: String(p.revision ?? 'unknown'), dirty: typeof p.dirty === 'boolean' ? p.dirty : null,
      casesHash: String(p.casesHash), lockHash: String(p.lockHash ?? ''),
      methods: raw.provenance.methods.map(m => ({ id: m.id, version: m.version })),
      operators: raw.provenance.operators.map(o => ({ id: o.id, version: o.version })) }, corpusHashes,
    scanners: raw.scanners.map(s => ({ id: s.id, status: s.status, version: s.version, mode: s.mode, configurationHash: s.configurationHash ?? '' })), cases,
    reviews: raw.reviewQueue.map(q => ({ id: q.id, caseId: q.caseId, variant: q.variant, peer: 'peer' in q ? q.peer ?? '' : '',
      disagreement: 'disagreement' in q ? q.disagreement ?? '' : '' })), review: raw.review,
    byOperator: Object.fromEntries(Object.entries(raw.byOperator).map(([id, o]) => [id, { generated: o.generated, unsupported: o.unsupported, error: o.error,
      assertions: Object.fromEntries(Object.entries(o.assertions).map(([key, c]) => [key, { pass: c.pass, fail: c.fail, 'review-required': c['review-required'], 'not-measured': c['not-measured'] }])) }])), qualification };
  const problem = evaluationProblem(report);
  if (problem || raw.caseCount !== cases.length || raw.variantCount !== cases.reduce((n, c) => n + c.variants.length, 0)) throw Error(problem ?? 'Discovery totals mismatch');
  return report;
}
