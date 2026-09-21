import Ajv from 'ajv';
import holdoutSchema from '../../schemas/holdout-report-v1.json';
import qualificationSchema from '../../schemas/qualification-report-v1.json';
import candidateSchema from '../../schemas/candidate-report-v1.json';
import { hash } from './model.ts';
import suite from '../../qualification/suite-v1.json';

const ajv = new Ajv({ allErrors: true, strict: true });
ajv.addSchema(holdoutSchema);
ajv.addSchema(qualificationSchema);
ajv.addSchema(candidateSchema);

/**
 * Why a run is `incomplete` (v1.1 §1, §6). Unresolved assertions and unreviewed
 * disagreements are unfinished measurement. An `open` ledger row is a
 * legitimate standing state and never blocks; only `unknown` does.
 */
export function completenessReasons({ executed, unresolvedGroups, review }: { executed: boolean; unresolvedGroups: string[]; review: { unknown: number } }) {
  return [
    ...(executed ? [] : ['execution-incomplete']),
    ...(unresolvedGroups.length ? ['unresolved-assertions'] : []),
    ...(review.unknown ? ['unreviewed-queue'] : []),
  ];
}

/** Strict public schemas prohibit accidental inclusion of case-level data. */
export function validateEvidence(report: unknown, type: 'holdout' | 'qualification' | 'candidate') {
  const validate = ajv.getSchema(`urn:redact-secret:${type}:1`)!;
  if (!validate(report)) {
    const locations = (validate.errors ?? []).map(error => `${error.instancePath || '/'}:${error.keyword}`).join(',');
    throw new Error(`Evidence schema validation failed${locations ? ` (${locations})` : ''}`);
  }
  const value = report as any;
  if (Date.parse(value.finishedAt) < Date.parse(value.startedAt)) throw new Error('Invalid evidence chronology');
  if (type === 'candidate') {
    const failures = value.failures as unknown[];
    if ((value.status === 'complete') !== (value.completeness.scannedFixtures === value.completeness.selectedFixtures && failures.length === 0))
      throw new Error('Invalid candidate completeness');
    if (value.status === 'complete' && (value.candidate.packageName === 'unknown' || value.candidate.declaredVersion === 'unknown'))
      throw new Error('Missing candidate identity');
    if (value.status === 'complete' && value.corpus.categories.length === 0) throw new Error('Missing candidate corpus identity');
    if (value.selection.filter === null && value.selection.scope !== 'full-suite') throw new Error('Invalid full-suite scope');
    if (value.selection.filter !== null && value.selection.scope !== 'filtered-development') throw new Error('Invalid filtered scope');
    if (value.results.length !== value.completeness.scannedFixtures ||
        new Set(value.results.map((r: any) => r.fixtureId)).size !== value.results.length)
      throw new Error('Invalid candidate result coverage');
    if (value.results.some((r: any) => (r.fixtureId.startsWith('common-formats--')) !== (r.corpusSection === 'fixed-corpus')))
      throw new Error('Invalid candidate corpus section');
    if (value.candidate.expectedArtifactSha256 !== null && value.candidate.expectedArtifactSha256 !== value.candidate.artifactSha256)
      throw new Error('Candidate artifact identity mismatch');
  } else if (type === 'holdout') {
    if (new Set(value.scanners.map((s: any) => s.id)).size !== value.scanners.length || value.caseCount !== value.variantCount)
      throw new Error('Invalid holdout completeness');
    if ((value.corpus.purpose === 'public-conformance') !== (value.independence === 'public-control')) throw new Error('Invalid independence claim');
    for (const s of value.scanners) {
      const sum = { pass: 0, fail: 0, 'review-required': 0 };
      for (const c of Object.values(s.byStratum) as any[]) for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += c[key];
      if (Object.keys(sum).some(k => sum[k as keyof typeof sum] !== s.assertions[k]) || hash(s.configuration) !== s.configurationHash ||
          (s.status === 'complete' ? sum.pass + sum.fail !== value.caseCount || sum['review-required'] !== 0 : Object.values(sum).some(v => v !== 0)))
        throw new Error('Invalid holdout aggregate counts');
    }
    if (value.status === 'complete' && (value.generationErrors || value.scanners.some((s: any) => s.status !== 'complete')))
      throw new Error('Incomplete holdout claimed complete');
  } else {
    validateEvidence(value.holdout, 'holdout');
    const required = ['benign', 'differential', 'holdout', 'metamorphic', 'mutation', 'twin'];
    if (JSON.stringify(value.methods.map((m: any) => m.method).sort()) !== JSON.stringify(required) || value.holdout.runId !== value.runId)
      throw new Error('Missing method or mixed run identity');
    for (const method of value.methods) {
      if (method.variants < method.cases) throw new Error('Missing generated variants');
      if (JSON.stringify(method.scanners.map((s: any) => s.id).sort()) !== JSON.stringify(['gitleaks', 'redact-secret', 'trufflehog']))
        throw new Error('Missing required scanner');
      if (value.status === 'execution-qualified' && (method.generationErrors || method.scanners.some((s: any) => s.status !== 'complete')))
        throw new Error('Incomplete execution claimed qualified');
      for (const scanner of method.scanners) {
        const { 'not-measured': notMeasured = 0, ...observed } = scanner.assertions;
        const total = Object.values(observed).reduce((a: number, b: any) => a + b, 0);
        if ((method.method === 'differential' || scanner.status !== 'complete') ? total !== 0 : total < method.cases)
          throw new Error('Missing assertions or consensus presented as truth');
        // v1.1 §4: an absent scanner is a measured gap; a complete one never carries not-measured rows.
        if (method.method !== 'differential' && method.method !== 'holdout' && (scanner.status === 'complete' ? notMeasured !== 0 : notMeasured < method.cases))
          throw new Error('Unmeasured scanner dropped from the denominator');
      }
    }
    const h = value.methods.find((m: any) => m.method === 'holdout');
    if (h.cases !== value.holdout.caseCount || h.variants !== value.holdout.variantCount ||
        h.scanners.some((s: any) => {
          const actual = value.holdout.scanners.find((x: any) => x.id === s.id);
          return !actual || s.status !== actual.status || Object.keys(s.assertions).some(k => s.assertions[k] !== actual.assertions[k]);
        }) || ['sourceHash', 'lockHash', 'candidateArtifactHash'].some(k => value.provenance[k] !== value.holdout.candidate[k]))
      throw new Error('Mixed candidate or inconsistent holdout evidence');
    if ((value.scope === 'engine-conformance') !== (value.holdout.independence === 'public-control')) throw new Error('Invalid qualification scope');
    if (value.suiteHash !== hash(suite) || value.holdout.scanners.some((s: any) =>
      s.status === 'complete' && s.version !== suite.scanners[s.id as keyof typeof suite.scanners])) throw new Error('Qualification suite or tool version drift');
    const failures = value.methods.filter((m: any) => m.method !== 'holdout').reduce((n: number, m: any) =>
      n + m.scanners.reduce((total: number, s: any) => total + s.assertions.fail, 0), 0);
    if (failures !== value.development.failures) throw new Error('Inconsistent development failure count');
    if (value.status === 'execution-qualified' && value.holdout.status !== 'complete') throw new Error('Missing complete holdout');
    // v1.1 §1/§6: qualified means nothing unresolved below the floor and no disagreement nobody has looked at.
    const a = value.accounting;
    if (a.reasons.includes('unresolved-assertions') !== (a.unresolvedGroups.length > 0) || a.reasons.includes('unreviewed-queue') !== (a.review.unknown > 0) ||
        (value.status === 'execution-qualified') !== (a.reasons.length === 0) || a.review.open + a.review.resolved + a.review.notAssertable + a.review.unknown !== value.development.reviewEntries ||
        (a.review.oldestOpenRun === null) !== (a.review.open === 0))
      throw new Error('Inconsistent accounting evidence');
    if (value.milestone.status === 'closed' && value.milestone.openPrerequisites.length) throw new Error('Open milestone dependencies');
  }
  return report;
}
