import Ajv from 'ajv';
import assessmentSchema from '../../../../schemas/pii-assessment-v1.json';
import supportSchema from '../../../../schemas/pii-support-matrix-v1.json';
import { projectKnownResults } from '../../substrate/public-projection.ts';
import { assessPiiCase, validatePiiAssessment, type PiiAssessment } from './assessment.ts';
import { piiIdentity } from './identity.ts';
import type { PiiCase } from './types.ts';

type Counts = { pass: number; fail: number; 'review-required': number; 'not-measured': number };
export interface PiiSupportEntry { assessment: PiiAssessment; observations: { scanner: string; sampleCount: number; typeIdentity: Counts; sensitivityContext: Counts }[] }
export interface PiiSupportMatrix {
  schemaVersion: 1; reportType: 'pii-support-matrix'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-schema-v1';
  domainAccountingVersion: 'pii-observation-v1'; runId: string; qualificationProfile: { id: 'pii-v1'; version: 1 }; entries: PiiSupportEntry[];
}

const ajv = new Ajv({ strict: true }); ajv.addSchema(assessmentSchema); const validateSchema = ajv.compile(supportSchema);
const statuses = ['pass', 'fail', 'review-required', 'not-measured'] as const;
const count = (outcomes: any[], axis: 'typeIdentity' | 'sensitivityContext'): Counts => Object.fromEntries(statuses.map(status =>
  [status, outcomes.filter(outcome => outcome?.[axis]?.status === status).length])) as Counts;

export function validatePiiSupportMatrix(value: unknown): PiiSupportMatrix {
  if (!validateSchema(value)) throw new Error('Invalid PII support-matrix schema');
  const report = value as unknown as PiiSupportMatrix;
  if (new Set(report.entries.map(entry => entry.assessment.caseId)).size !== report.entries.length) throw new Error('Duplicate PII support-matrix case');
  for (const entry of report.entries) {
    validatePiiAssessment(entry.assessment);
    if (new Set(entry.observations.map(row => row.scanner)).size !== entry.observations.length || entry.observations.some(row =>
      Object.values(row.typeIdentity).reduce((sum, value) => sum + value, 0) !== row.sampleCount ||
      Object.values(row.sensitivityContext).reduce((sum, value) => sum + value, 0) !== row.sampleCount)) throw new Error('Inconsistent PII support observation counts');
  }
  return structuredClone(report);
}

/** Assessment -> evaluation -> public support projection. This emits evidence status, never a support qualification claim. */
export function projectPiiSupportMatrix(raw: any, sources: PiiCase[]): PiiSupportMatrix {
  if (!raw || raw.schemaVersion !== 1 || raw.domain !== piiIdentity.domain || raw.evaluationProfile !== piiIdentity.evaluationProfile ||
      raw.domainAccountingVersion !== piiIdentity.domainAccountingVersion || raw.supportClaims !== false || raw.mode !== 'discovery' ||
      !Array.isArray(raw.results) || !Array.isArray(raw.scanners) || raw.scanners.length === 0 ||
      new Set(raw.scanners.map((row: any) => row?.id)).size !== raw.scanners.length || raw.caseCount !== raw.results.length ||
      new Set(raw.results.map((row: any) => row?.id)).size !== raw.results.length) throw new Error('Unsupported PII evaluation projection source');
  const publicSources = sources.filter(source => source.visibility !== 'holdout');
  const entries = projectKnownResults({ sources: publicSources, results: raw.results,
    accepts: (source, result: any) => JSON.stringify(result.assessment) === JSON.stringify(assessPiiCase(source)) &&
      result.method === source.method && Array.isArray(result.outcomes) && Array.isArray(result.variants),
    project: (source, result: any): PiiSupportEntry => ({ assessment: assessPiiCase(source), observations: raw.scanners.map((scanner: any) => {
      const outcomes = result.outcomes.filter((outcome: any) => outcome.scanner === scanner.id);
      const expected = result.variants.map((variant: any) => variant.id), actual = outcomes.map((outcome: any) => outcome?.variant);
      if (outcomes.length !== result.variants.length || new Set(actual).size !== actual.length || expected.some((variant: string) => !actual.includes(variant)))
        throw new Error('Incomplete PII support observation matrix');
      return { scanner: scanner.id, sampleCount: outcomes.length, typeIdentity: count(outcomes, 'typeIdentity'), sensitivityContext: count(outcomes, 'sensitivityContext') };
    }) }), refusal: 'Unknown, protected or stale PII assessment; projection refused' });
  if (raw.caseCount !== entries.length || publicSources.length !== entries.length) throw new Error('PII support projection totals mismatch');
  return validatePiiSupportMatrix({ schemaVersion: 1, reportType: 'pii-support-matrix', supportClaims: false, domain: 'pii',
    evaluationProfile: piiIdentity.evaluationProfile, domainAccountingVersion: piiIdentity.domainAccountingVersion, runId: raw.runId,
    qualificationProfile: { id: 'pii-v1', version: 1 }, entries });
}
