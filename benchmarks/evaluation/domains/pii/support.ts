import Ajv from 'ajv';
import assessmentSchema from '../../../../schemas/pii-assessment-v1.json';
import supportSchema from '../../../../schemas/pii-support-matrix-v1.json';
import { projectKnownResults } from '../../substrate/public-projection.ts';
import { assessPiiCase, validatePiiAssessment, type PiiAssessment } from './assessment.ts';
import { piiIdentity } from './identity.ts';
import { validatePiiOutcome } from './outcome-validation.ts';
import type { PiiCase } from './types.ts';

type Counts = { pass: number; fail: number; 'review-required': number; 'not-measured': number };
export interface PiiSupportEntry { assessment: PiiAssessment; observations: { scanner: string; sampleCount: number; typeIdentity: Counts; sensitivityContext: Counts }[] }
export interface PiiSupportMatrix {
  schemaVersion: 1; reportType: 'pii-support-matrix'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-schema-v1';
  domainAccountingVersion: 'pii-observation-v1'; runId: string; qualificationProfile: { id: 'pii-v1'; version: 1 }; entries: PiiSupportEntry[];
}

const ajv = new Ajv({ strict: true }); ajv.addSchema(assessmentSchema); const validateSchema = ajv.compile(supportSchema);
const statuses = ['pass', 'fail', 'review-required', 'not-measured'] as const;
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const slug = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9-]{1,79}$/.test(value);
const scannerId = (value: unknown) => typeof value === 'string' && /^[a-z][a-z0-9.-]+$/.test(value);
const count = (outcomes: any[], axis: 'typeIdentity' | 'sensitivityContext'): Counts => Object.fromEntries(statuses.map(status =>
  [status, outcomes.filter(outcome => outcome?.[axis]?.status === status).length])) as Counts;

type ProjectionExpectation = { type: 'valid' | 'invalid'; sensitivity: 'sensitive' | 'non-sensitive' | 'not-established';
  contextObligation: 'none' | 'reinforcing' | 'required-for-sensitive-classification'; contextClass: 'sensitive' | 'neutral' | 'non-sensitive';
  validatorApplicable: boolean; referenceApplicable: boolean };
type ProjectionVariant = { id: string; expectation: ProjectionExpectation };

function validateProjectionVariant(value: any): ProjectionVariant {
  const expectation = value?.expectation;
  if (!exact(value, ['id', 'strategy', 'transformation', 'expectation']) || !slug(value.id) ||
      !['authored', 'derived', 'review-required'].includes(value.strategy) ||
      !exact(expectation, ['type', 'sensitivity', 'contextObligation', 'contextClass', 'validatorApplicable', 'referenceApplicable']) ||
      !['valid', 'invalid'].includes(expectation?.type) || !['sensitive', 'non-sensitive', 'not-established'].includes(expectation?.sensitivity) ||
      !['none', 'reinforcing', 'required-for-sensitive-classification'].includes(expectation?.contextObligation) ||
      !['sensitive', 'neutral', 'non-sensitive'].includes(expectation?.contextClass) ||
      typeof expectation?.validatorApplicable !== 'boolean' || typeof expectation?.referenceApplicable !== 'boolean')
    throw new Error('Invalid PII support projection variant');
  return { id: value.id, expectation };
}

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
      raw.scanners.some((row: any) => !scannerId(row?.id) || !['complete', 'unsupported', 'unavailable', 'error', 'unstable'].includes(row?.status)) ||
      new Set(raw.scanners.map((row: any) => row.id)).size !== raw.scanners.length || raw.caseCount !== raw.results.length ||
      new Set(raw.results.map((row: any) => row?.id)).size !== raw.results.length) throw new Error('Unsupported PII evaluation projection source');
  const publicSources = sources.filter(source => source.visibility !== 'holdout');
  const entries = projectKnownResults({ sources: publicSources, results: raw.results,
    accepts: (source, result: any) => JSON.stringify(result.assessment) === JSON.stringify(assessPiiCase(source)) &&
      result.method === source.method && Array.isArray(result.outcomes) && Array.isArray(result.variants),
    project: (source, result: any): PiiSupportEntry => {
      const variants: ProjectionVariant[] = result.variants.map(validateProjectionVariant);
      if (variants.length === 0 || new Set(variants.map(variant => variant.id)).size !== variants.length ||
          result.outcomes.length !== raw.scanners.length * variants.length) throw new Error('Incomplete PII support observation matrix');
      const observations = raw.scanners.map((scanner: any) => {
        const outcomes = result.outcomes.filter((outcome: any) => outcome?.scanner === scanner.id);
        if (outcomes.length !== variants.length) throw new Error('Incomplete PII support observation matrix');
        const validated = variants.map(variant => {
          const matches = outcomes.filter((outcome: any) => outcome?.variant === variant.id);
          if (matches.length !== 1) throw new Error('Incomplete PII support observation matrix');
          return validatePiiOutcome(matches[0], { scanner: scanner.id, scannerStatus: scanner.status, variant: variant.id,
            expectation: { type: variant.expectation.type, sensitivity: variant.expectation.sensitivity } });
        });
        return { scanner: scanner.id, sampleCount: validated.length, typeIdentity: count(validated, 'typeIdentity'),
          sensitivityContext: count(validated, 'sensitivityContext') };
      });
      return { assessment: assessPiiCase(source), observations };
    }, refusal: 'Unknown, protected or stale PII assessment; projection refused' });
  if (raw.caseCount !== entries.length || publicSources.length !== entries.length) throw new Error('PII support projection totals mismatch');
  return validatePiiSupportMatrix({ schemaVersion: 1, reportType: 'pii-support-matrix', supportClaims: false, domain: 'pii',
    evaluationProfile: piiIdentity.evaluationProfile, domainAccountingVersion: piiIdentity.domainAccountingVersion, runId: raw.runId,
    qualificationProfile: { id: 'pii-v1', version: 1 }, entries });
}
