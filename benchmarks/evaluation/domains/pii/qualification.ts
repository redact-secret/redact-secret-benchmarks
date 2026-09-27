import Ajv from 'ajv';
import accountingSchema from '../../../../schemas/pii-accounting-report-v1.json';
import qualificationSchema from '../../../../schemas/pii-qualification-report-v1.json';
import { PII_METRIC_IDS, piiV1Profile, validatePiiQualificationProfile, type PiiMetricId, type PiiQualificationProfile } from './profile.ts';
import { validatePiiAccountingReport, type PiiAccountingReport } from './accounting.ts';

export interface PiiExternalEvidence { status: 'complete' | 'incomplete' | 'not-measured'; artifactHash: string | null }
export interface PiiQualificationEvidence { protected: PiiExternalEvidence; independent: PiiExternalEvidence }
export interface PiiQualificationGate { id: string; status: 'met' | 'not-met' | 'unresolved' | 'not-applicable'; population: string; requirement: string }
export interface PiiQualificationReport {
  schemaVersion: 1; reportType: 'pii-qualification'; domain: 'pii'; evaluationProfile: 'pii-v1'; domainAccountingVersion: 'pii-v1';
  profile: { id: 'pii-v1'; version: 1 }; status: 'stable' | 'provisional' | 'not-applicable';
  evidence: PiiQualificationEvidence; gates: PiiQualificationGate[]; accounting: PiiAccountingReport;
}

const ajv = new Ajv({ strict: true });
ajv.addSchema(accountingSchema);
const validateSchema = ajv.compile(qualificationSchema);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const gate = (id: string, status: PiiQualificationGate['status'], population: string, requirement: string): PiiQualificationGate =>
  ({ id, status, population, requirement });

function validateExternal(value: unknown): PiiExternalEvidence {
  const row = value as PiiExternalEvidence;
  if (!row || typeof row !== 'object' || Array.isArray(row) || !exact(row, ['status', 'artifactHash']) ||
      !['complete', 'incomplete', 'not-measured'].includes(row.status) ||
      (row.artifactHash !== null && (typeof row.artifactHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.artifactHash))) ||
      (row.status === 'complete') !== (row.artifactHash !== null)) throw new Error('Invalid PII external qualification evidence');
  return structuredClone(row);
}

function metricGate(id: PiiMetricId, accounting: PiiAccountingReport, profile: PiiQualificationProfile): PiiQualificationGate {
  const metric = accounting.metrics[id], rule = profile.metrics[id];
  const conditional = rule.applicability !== 'required';
  if (metric.status === 'not-applicable') return gate(id, conditional ? 'not-applicable' : 'unresolved', metric.population,
    `${rule.direction} confidence bound ${rule.direction === 'upper' ? '≤' : '≥'} ${rule.threshold}; denominator ≥ ${profile.mechanics.minDenominator}`);
  if (metric.status !== 'measured' || metric.rate === null || metric.rate === 'insufficient-evidence') return gate(id, 'unresolved', metric.population,
    `complete denominator ≥ ${profile.mechanics.minDenominator}`);
  const bound = metric.rate.bound!;
  const met = rule.direction === 'upper' ? bound <= rule.threshold : bound >= rule.threshold;
  return gate(id, met ? 'met' : 'not-met', metric.population,
    `${rule.direction} confidence bound ${rule.direction === 'upper' ? '≤' : '≥'} ${rule.threshold}; n=${metric.rate.n}`);
}

function buildPiiQualification(accountingInput: PiiAccountingReport, evidenceInput: PiiQualificationEvidence,
  profile: PiiQualificationProfile = piiV1Profile): PiiQualificationReport {
  validatePiiQualificationProfile(profile);
  const accounting = validatePiiAccountingReport(structuredClone(accountingInput));
  const evidence = { protected: validateExternal(evidenceInput?.protected), independent: validateExternal(evidenceInput?.independent) };
  const gates: PiiQualificationGate[] = PII_METRIC_IDS.map(id => metricGate(id, accounting, profile));
  const present = new Set(accounting.evidence.methods);
  gates.push(gate('required-methods', profile.gates.requiredMethods.every(method => present.has(method)) ? 'met' : 'not-met',
    accounting.evidence.methods.join(',') || 'none', `methods ${profile.gates.requiredMethods.join(',')}`));
  gates.push(gate('authoritative-provenance', accounting.evidence.authority.total > 0 &&
    accounting.evidence.authority.qualified === accounting.evidence.authority.total ? 'met' : accounting.evidence.authority.total ? 'not-met' : 'not-applicable',
  `${accounting.evidence.authority.qualified}/${accounting.evidence.authority.total}`, 'every occurrence has structured authoritative provenance'));
  const validators = accounting.evidence.validators;
  gates.push(gate('validator-qualification', validators.applicable === 0 ? 'not-applicable' : validators.evaluated === validators.applicable ? 'met' : 'unresolved',
    `${validators.evaluated}/${validators.applicable}`, 'every applicable validator primitive is measured'));
  gates.push(gate('benign-case-count', accounting.evidence.benign.cases >= profile.gates.minBenignCases ? 'met' : 'not-met',
    String(accounting.evidence.benign.cases), `≥ ${profile.gates.minBenignCases} distinct semantic benign cases`));
  gates.push(gate('benign-axis-diversity', accounting.evidence.benign.axes.length >= profile.gates.minBenignAxes ? 'met' : 'not-met',
    accounting.evidence.benign.axes.join(',') || 'none', `≥ ${profile.gates.minBenignAxes} benign axes`));
  gates.push(gate('semantic-controls', accounting.evidence.semanticControls > 0 ? 'met' : 'not-met', String(accounting.evidence.semanticControls),
    'semantic controls separate from checksum-invalid neighbours'));
  const context = accounting.evidence.context;
  gates.push(gate('context-obligations', context.applicable === 0 ? 'not-applicable' : context.evaluated === context.applicable ? 'met' : 'unresolved',
    `${context.evaluated}/${context.applicable}`, 'context-discrimination evidence when context is required'));
  const jurisdiction = accounting.evidence.jurisdiction;
  gates.push(gate('jurisdiction-collisions', jurisdiction.applicable === 0 ? 'not-applicable' : jurisdiction.evaluated === jurisdiction.applicable ? 'met' : 'unresolved',
    `${jurisdiction.evaluated}/${jurisdiction.applicable}`, 'collision evidence for jurisdictional identifiers'));
  const reference = accounting.evidence.reference;
  gates.push(gate('reference-differential', reference.applicable === 0 ? 'not-applicable' :
    reference.evaluated === reference.applicable && reference.unavailable === 0 ? 'met' : 'unresolved',
    `${reference.evaluated}/${reference.applicable}; unavailable ${reference.unavailable}`, 'independent reference observation where declared meaningful'));
  gates.push(gate('protected-evidence', evidence.protected.status === 'complete' ? 'met' : 'unresolved', evidence.protected.status,
    'complete protected evidence artifact'));
  gates.push(gate('independent-evidence', evidence.independent.status === 'complete' ? 'met' : 'unresolved', evidence.independent.status,
    'complete independent evidence artifact'));
  const status = accounting.rowCount === 0 ? 'not-applicable' : gates.every(row => row.status === 'met' || row.status === 'not-applicable') ? 'stable' : 'provisional';
  return { schemaVersion: 1, reportType: 'pii-qualification', domain: 'pii', evaluationProfile: 'pii-v1',
    domainAccountingVersion: 'pii-v1', profile: { id: 'pii-v1', version: 1 }, status, evidence, gates, accounting };
}

export function qualifyPii(accountingInput: PiiAccountingReport, evidenceInput: PiiQualificationEvidence,
  profile: PiiQualificationProfile = piiV1Profile): PiiQualificationReport {
  return validatePiiQualificationReport(buildPiiQualification(accountingInput, evidenceInput, profile));
}

export function validatePiiQualificationReport(value: unknown): PiiQualificationReport {
  if (!validateSchema(value)) throw new Error('Invalid PII qualification report schema');
  const report = value as unknown as PiiQualificationReport;
  validatePiiAccountingReport(report.accounting);
  validateExternal(report.evidence.protected); validateExternal(report.evidence.independent);
  const expected = buildPiiQualification(report.accounting, report.evidence, piiV1Profile);
  if (new Set(report.gates.map(row => row.id)).size !== report.gates.length ||
      JSON.stringify(report.gates) !== JSON.stringify(expected.gates) || report.status !== expected.status || Object.hasOwn(report, 'overallScore'))
    throw new Error('Inconsistent PII qualification report');
  return report;
}
