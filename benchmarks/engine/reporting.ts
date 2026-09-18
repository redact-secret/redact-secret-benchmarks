import type { EvaluationCase, GeneratedVariant, CaseResult, Summary, AssertionStatus } from './types.ts';
import { hash, safeParameters } from './model.ts';

// Explicit allowlist: never spread a fixture or raw scanner error into reports.
export function describeVariant(v: GeneratedVariant) {
  const t = v.transformation;
  return { id: v.id, path: v.fixture.path, strategy: v.strategy,
    kind: v.fixture.assessment.kind, tier: v.fixture.assessment.tier,
    transformation: { method: t.method, methodVersion: t.methodVersion,
      operator: t.operator, operatorVersion: t.operatorVersion,
      parameters: safeParameters(t.parameters ?? {}), parametersHash: hash(t.parameters ?? {}),
      property: t.property, relation: t.relation, expectationEffect: t.expectationEffect,
      ...(t.integrity ? { integrity: t.integrity } : {}),
      ...(t.contractMatch === undefined ? {} : { contractMatch: t.contractMatch }) },
    provenance: v.provenance };
}

export function describeCase(c: EvaluationCase) {
  return { id: c.id, method: c.method, targets: c.targets, visibility: c.visibility,
    taxonomy: c.taxonomy, source: c.source,
    provenance: { source: c.provenance.source, sourceHash: c.provenance.sourceHash,
      seed: c.provenance.seed, reviewStatus: c.provenance.reviewStatus, sources: c.provenance.sources,
      rationaleHash: hash(c.provenance.rationale) } };
}

export function summaries(results: CaseResult[]) {
  const byMethod: Summary = {}, byDetector: Record<string, Summary> = {}, byTaxonomy: Record<string, Summary> = {};
  const byOperator: Record<string, { generated: number; unsupported: number; error: number; assertions: Summary }> = {};
  const add = (destination: Summary, method: string, scanner: string, stratum: string, type: string, status: AssertionStatus) => {
    const key = `${method}/${scanner}/${stratum}/${type}`;
    const row = destination[key] ??= { pass: 0, fail: 0, 'review-required': 0 };
    row[status]++;
  };
  for (const r of results) {
    for (const attempt of r.generation) {
      const row = byOperator[attempt.operator] ??= { generated: 0, unsupported: 0, error: 0, assertions: {} };
      row[attempt.status]++;
    }
    const variants = new Map(r.variants.map(v => [v.id, v]));
    const stratum = (id: string) => { const v = variants.get(id)!; return `${v.kind}:${v.tier}`; };
    for (const scanner of r.scanners) {
      for (const a of scanner.assertions) {
        const group = a.variant ? stratum(a.variant) : `${stratum(a.baseline!)}->${stratum(a.candidate!)}`;
        add(byMethod, r.method, scanner.scanner, group, a.type, a.status);
        const operator = variants.get(a.variant ?? a.candidate!)?.transformation.operator;
        if (operator && byOperator[operator]) add(byOperator[operator].assertions, r.method, scanner.scanner, group, a.type, a.status);
        if (r.taxonomy) {
          byTaxonomy[r.taxonomy] ??= {};
          add(byTaxonomy[r.taxonomy], r.method, scanner.scanner, group, a.type, a.status);
        }
        for (const target of r.targets.length ? r.targets : ['unassigned']) {
          byDetector[target] ??= {};
          add(byDetector[target], r.method, scanner.scanner, group, a.type, a.status);
        }
      }
    }
  }
  return { byMethod, byDetector, byTaxonomy, byOperator };
}
