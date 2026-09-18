import Ajv from 'ajv';
import publicSchema from '../schemas/evaluation-public-v1.json';
import qualificationSchema from '../schemas/qualification-report-v1.json';
import holdoutSchema from '../schemas/holdout-report-v1.json';
const ajv = new Ajv({ strict: true });
ajv.addSchema(holdoutSchema); ajv.addSchema(qualificationSchema);
const validPublicReport = ajv.compile(publicSchema);
import type { EvaluationReport, EvaluationCase, Counts, EvidenceRow } from './evaluation-types';
export const METHODS = ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'];
export const counts = (): Counts => ({ pass: 0, fail: 0, 'review-required': 0 });
export function assertionRows(cases: EvaluationCase[]): EvidenceRow[] {
  return cases.flatMap(c => c.assertions.map(a => {
    const v = c.variants.find(v => v.id === (a.variant || a.candidate))!;
    return { caseId: c.id, method: c.method, detector: c.targets.join(', ') || 'unassigned', scanner: a.scanner,
      tier: v.tier, kind: v.kind, type: a.type, operator: v.operator, status: a.status,
      variant: a.variant || a.candidate, baseline: a.baseline, sourceSlug: c.sourceSlug, taxonomy: c.taxonomy,
      property: v.property, effect: v.expectationEffect, contract: v.contractMatch === null ? 'not specified' : String(v.contractMatch),
      overlap: Boolean(a.baseline && c.assertions.some(b => b.scanner === a.scanner && b.status === 'fail' && b.variant && [a.baseline, a.candidate].includes(b.variant))),
      peer: '', disagreement: '' };
  }));
}
export function reviewRows(report: EvaluationReport, cases = report.cases): EvidenceRow[] {
  const selected = new Map(cases.map(c => [c.id, c]));
  return report.reviews.filter(r => selected.has(r.caseId)).map(r => {
    const c = selected.get(r.caseId)!, v = c.variants.find(v => v.id === r.variant)!;
    return { caseId: c.id, method: c.method, detector: c.targets.join(', ') || 'unassigned', scanner: r.peer ? 'redact-secret' : '',
      tier: v.tier, kind: v.kind, type: r.peer ? 'differential disagreement' : 'mutation review-required',
      operator: v.operator, status: 'review-required', variant: r.variant, baseline: '', sourceSlug: c.sourceSlug,
      taxonomy: c.taxonomy, property: v.property, effect: v.expectationEffect,
      contract: v.contractMatch === null ? 'not specified' : String(v.contractMatch), overlap: false, peer: r.peer, disagreement: r.disagreement };
  });
}
export function summarizeEvaluation(cases: EvaluationCase[]) {
  const assertions = counts(), affected = new Set<string>(), reviewed = new Set<string>();
  for (const c of cases) for (const a of c.assertions) {
    assertions[a.status]++;
    if (a.status === 'fail') affected.add(c.id);
    if (a.status === 'review-required') reviewed.add(c.id);
  }
  return { cases: cases.length, variants: cases.reduce((n, c) => n + c.variants.length, 0), assertions,
    affected: affected.size, reviewed: reviewed.size,
    generationErrors: cases.reduce((n, c) => n + c.generation.filter(g => g.status === 'error').length, 0),
    unsupported: cases.reduce((n, c) => n + c.generation.filter(g => g.status === 'unsupported').length, 0) };
}
/** Recompute operator summaries from the same public cases used by explorers. */
export function operatorEvidence(cases: EvaluationCase[]): EvaluationReport['byOperator'] {
  const result: EvaluationReport['byOperator'] = {};
  for (const c of cases) {
    for (const g of c.generation) {
      const bucket = result[g.operator] ??= { generated: 0, unsupported: 0, error: 0, assertions: {} };
      bucket[g.status]++;
    }
    for (const a of c.assertions) {
      const v = c.variants.find(v => v.id === (a.variant || a.candidate))!;
      const b = c.variants.find(v => v.id === a.baseline);
      const bucket = result[v.operator];
      if (!bucket) continue;
      const stratum = b ? `${b.kind}:${b.tier}->${v.kind}:${v.tier}` : `${v.kind}:${v.tier}`;
      const key = `${c.method}/${a.scanner}/${stratum}/${a.type}`;
      (bucket.assertions[key] ??= counts())[a.status]++;
    }
  }
  return result;
}
const canonical = (value: unknown): string => JSON.stringify(value, function(_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item;
});
/** Reject incompatible/malformed evidence before rendering, including T0 scoring. */
export function evaluationProblem(value: unknown, corpusHashes?: Record<string, string>): string | null {
  try {
    const r = value as EvaluationReport;
    if (r.schemaVersion !== 1 || r.reportType !== 'evaluation-public' || r.supportClaims !== false) return 'Unsupported evaluation report version';
    if (!validPublicReport(value)) return 'Invalid public evaluation contract';
    if (!r.runId || !Number.isFinite(Date.parse(r.startedAt)) || !Number.isFinite(Date.parse(r.finishedAt)) || Date.parse(r.finishedAt) < Date.parse(r.startedAt)) throw Error();
    if (!r.cases.length || new Set(r.cases.map(c => c.id)).size !== r.cases.length || !r.scanners.length) throw Error();
    const scannerIds = new Set(r.scanners.map(s => s.id));
    if (scannerIds.size !== r.scanners.length || r.scanners.some(s => !['complete','unavailable','error','unsupported'].includes(s.status))) throw Error();
    for (const c of r.cases) {
      if (!METHODS.slice(0, 5).includes(c.method) || !/^[a-z0-9-]+$/.test(c.id) || !/^[a-z0-9-]+--[a-z0-9-]+$/.test(c.sourceSlug) || !Array.isArray(c.targets)) throw Error();
      const variants = new Map(c.variants.map(v => [v.id, v]));
      if (!variants.size || variants.size !== c.variants.length) throw Error();
      for (const a of c.assertions) {
        const v = variants.get(a.variant || a.candidate), b = a.baseline ? variants.get(a.baseline) : null;
        if (!v || (a.baseline && !b) || !scannerIds.has(a.scanner) || r.scanners.find(s => s.id === a.scanner)?.status !== 'complete' || !['pass','fail','review-required'].includes(a.status)) throw Error();
        if ([v, b].some(x => x && (x.tier === 'T0' || x.strategy === 'review-required')) && a.status !== 'review-required') throw Error();
      }
      if (c.method === 'differential' && c.assertions.length) throw Error();
      if (c.generation.some(g => !['generated','unsupported','error'].includes(g.status))) throw Error();
      if (c.findings.some(f => !Number.isInteger(f.count) || f.count < 0 || !variants.has(f.variant))) throw Error();
      if (!Array.isArray(c.comparisons)) throw Error();
    }
    if (new Set(r.reviews.map(x => x.id)).size !== r.reviews.length) throw Error();
    for (const q of r.reviews) {
      const c = r.cases.find(c => c.id === q.caseId);
      if (!c || !c.variants.some(v => v.id === q.variant) || !['mutation','differential'].includes(c.method)) throw Error();
      if (c.method === 'mutation' && (q.peer || q.disagreement || !c.variants.some(v => v.id === q.variant && v.strategy === 'review-required'))) throw Error();
      if (c.method === 'differential' && (!q.peer || !q.disagreement || !c.comparisons.some(x => x.peer === q.peer && x.variant === q.variant && x.disagreement === q.disagreement && x.status === 'complete'))) throw Error();
    }
    if (canonical(r.byOperator) !== canonical(operatorEvidence(r.cases))) return 'Operator totals do not match case evidence';
    if (!r.byOperator || !r.provenance || !Object.keys(r.corpusHashes).length) throw Error();
    if (corpusHashes && Object.entries(r.corpusHashes).some(([id, hash]) => corpusHashes[id] !== hash)) return 'Stale evaluation: fixture corpus changed';
    if (r.qualification && (r.qualification.supportClaims !== false || r.qualification.reportType !== 'qualification')) throw Error();
    return null;
  } catch { return 'Missing or invalid evaluation evidence'; }
}
