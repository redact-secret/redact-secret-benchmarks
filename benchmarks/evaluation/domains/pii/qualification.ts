import Ajv from 'ajv';
import accountingSchema from '../../../../schemas/pii-accounting-report-v1.json';
import qualificationSchema from '../../../../schemas/pii-qualification-report-v1.json';
import { PII_METRIC_IDS, piiV1Profile, validatePiiQualificationProfile, type PiiMetricId, type PiiQualificationProfile } from './profile.ts';
import { validatePiiAccountingReport, type PiiAccountingReport } from './accounting.ts';
import { validatePiiHoldoutReport, type PiiHoldoutReport } from './holdout.ts';

export interface PiiQualificationEvidenceInput { protected: PiiHoldoutReport | null; independent: PiiHoldoutReport | null }
export interface PiiExternalEvidence { role: 'protected' | 'independent'; trust: 'unresolved'; status: 'complete' | 'incomplete'; domain: 'pii';
  evaluationProfile: 'pii-schema-v1'; domainAccountingVersion: 'pii-observation-v1'; runId: string; planHash: string;
  purpose: 'public-conformance' | 'protected'; independence: 'public-control' | 'custodian-declared'; corpusHash: string;
  candidateArtifactHash: string; outcomesClean: boolean }
export interface PiiQualificationEvidence { protected: PiiExternalEvidence | null; independent: PiiExternalEvidence | null }
export interface PiiQualificationGate { id: string; status: 'met' | 'not-met' | 'unresolved' | 'not-applicable'; population: string; requirement: string }
export interface PiiQualificationReport { schemaVersion: 1; reportType: 'pii-qualification'; domain: 'pii'; evaluationProfile: 'pii-v1';
  domainAccountingVersion: 'pii-v1'; profile: { id: 'pii-v1'; version: 1 }; status: 'stable' | 'provisional' | 'not-applicable';
  evidence: PiiQualificationEvidence; gates: PiiQualificationGate[]; accounting: PiiAccountingReport }

const ajv = new Ajv({ strict: true }); ajv.addSchema(accountingSchema); const validateSchema = ajv.compile(qualificationSchema);
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const gate = (id: string, status: PiiQualificationGate['status'], population: string, requirement: string): PiiQualificationGate => ({ id, status, population, requirement });

function project(value: unknown, role: 'protected' | 'independent'): PiiExternalEvidence | null {
  if (value === null) return null;
  const report = validatePiiHoldoutReport(structuredClone(value) as PiiHoldoutReport);
  if ((report.corpus.purpose === 'public-conformance') !== (report.independence === 'public-control')) throw new Error('PII holdout purpose and independence disagree');
  if (role === 'protected' && report.corpus.purpose !== 'protected') throw new Error('PII protected evidence must use a protected corpus');
  if (role === 'independent' && report.independence !== 'custodian-declared') throw new Error('PII independent evidence must be custodian-declared');
  return { role, trust: 'unresolved', status: report.status, domain: 'pii', evaluationProfile: 'pii-schema-v1', domainAccountingVersion: 'pii-observation-v1',
    runId: report.runId, planHash: report.planHash, purpose: report.corpus.purpose, independence: report.independence,
    corpusHash: report.corpus.corpusHash, candidateArtifactHash: report.candidate.candidateArtifactHash,
    outcomesClean: report.scanners.every(scanner => scanner.status === 'complete' && scanner.axes.typeIdentity.fail === 0 &&
      scanner.axes.sensitivityContext.fail === 0 && scanner.axes.typeIdentity['review-required'] === 0 && scanner.axes.sensitivityContext['review-required'] === 0 &&
      scanner.axes.typeIdentity['not-measured'] === 0 && scanner.axes.sensitivityContext['not-measured'] === 0) };
}
function validateProjection(value: unknown, role: 'protected' | 'independent'): PiiExternalEvidence | null {
  if (value === null) return null;
  const row = value as PiiExternalEvidence, digests = (candidate: unknown) => typeof candidate === 'string' && /^[a-f0-9]{64}$/.test(candidate);
  if (!row || !exact(row, ['role', 'trust', 'status', 'domain', 'evaluationProfile', 'domainAccountingVersion', 'runId', 'planHash', 'purpose', 'independence',
      'corpusHash', 'candidateArtifactHash', 'outcomesClean']) || row.role !== role || row.trust !== 'unresolved' || !['complete', 'incomplete'].includes(row.status) ||
      row.domain !== 'pii' || row.evaluationProfile !== 'pii-schema-v1' || row.domainAccountingVersion !== 'pii-observation-v1' || !/^[a-f0-9-]{36}$/.test(row.runId) ||
      ![row.planHash, row.corpusHash, row.candidateArtifactHash].every(digests) || !['public-conformance', 'protected'].includes(row.purpose) ||
      !['public-control', 'custodian-declared'].includes(row.independence) || (row.purpose === 'public-conformance') !== (row.independence === 'public-control') ||
      typeof row.outcomesClean !== 'boolean') throw new Error('Invalid PII external evidence projection');
  return structuredClone(row);
}
function metricGate(id: PiiMetricId, accounting: PiiAccountingReport, profile: PiiQualificationProfile, sourceTrusted: boolean) {
  const metric = accounting.metrics[id], rule = profile.metrics[id], requirement = `${rule.direction} confidence bound ${rule.direction === 'upper' ? '≤' : '≥'} ${rule.threshold}`;
  if (metric.status === 'not-applicable') return gate(id, rule.applicability === 'required' ? 'unresolved' : 'not-applicable', metric.population, requirement);
  if (metric.rate === null || metric.rate === 'insufficient-evidence') return gate(id, 'unresolved', metric.population, `complete denominator ≥ ${profile.mechanics.minDenominator}`);
  if (metric.status !== 'measured' && !(id === 'measurable-share' && metric.status === 'partial'))
    return gate(id, 'unresolved', metric.population, `complete denominator ≥ ${profile.mechanics.minDenominator}`);
  const meetsThreshold = rule.direction === 'upper' ? metric.rate.bound! <= rule.threshold : metric.rate.bound! >= rule.threshold;
  return gate(id, meetsThreshold ? sourceTrusted ? 'met' : 'unresolved' : 'not-met', metric.population,
    `${requirement}; n=${metric.rate.n}${sourceTrusted ? '' : '; accounting source trust unresolved'}`);
}

function assemble(accounting: PiiAccountingReport, evidence: PiiQualificationEvidence, profile: PiiQualificationProfile): PiiQualificationReport {
  const candidates = new Set(accounting.sources.map(source => source.provenance.candidateArtifactHash).filter(value => value !== null));
  for (const artifact of [evidence.protected, evidence.independent]) if (artifact &&
      (candidates.size !== 1 || !candidates.has(artifact.candidateArtifactHash)))
    throw new Error('PII qualification evidence does not match accounting source');
  if (evidence.protected && evidence.independent) {
    if (evidence.protected.runId === evidence.independent.runId || evidence.protected.corpusHash === evidence.independent.corpusHash || evidence.protected.planHash === evidence.independent.planHash)
      throw new Error('PII qualification evidence artifacts must be distinct');
    if (evidence.protected.candidateArtifactHash !== evidence.independent.candidateArtifactHash) throw new Error('PII qualification evidence candidate mismatch');
  }
  const sourceTrusted = !profile.gates.requireTrustedAccountingSource || accounting.commitmentTrust === 'trusted';
  const gates: PiiQualificationGate[] = PII_METRIC_IDS.map(id => metricGate(id, accounting, profile, sourceTrusted)), present = new Set(accounting.evidence.methods);
  gates.push(gate('accounting-source-trust', sourceTrusted ? 'met' : 'unresolved', accounting.commitmentTrust,
    'trusted resolver binds the input commitment to the accounting source'));
  gates.push(gate('required-methods', profile.gates.requiredMethods.every(method => present.has(method)) ? 'met' : 'not-met', accounting.evidence.methods.join(',') || 'none', `methods ${profile.gates.requiredMethods.join(',')}`));
  const authority = accounting.evidence.authority;
  gates.push(gate('authoritative-provenance', authority.total === 0 ? 'not-applicable' : authority.qualified === authority.total ? 'met' : 'not-met', `${authority.qualified}/${authority.total}`, 'each occurrence has an authority claim matching its own obligation'));
  const validators = accounting.evidence.validators;
  gates.push(gate('validator-qualification', validators.applicable === 0 ? 'not-applicable' : validators.evaluated === validators.applicable ? 'met' : 'unresolved', `${validators.evaluated}/${validators.applicable}`, 'every applicable validator primitive is measured'));
  gates.push(gate('benign-case-count', accounting.evidence.benign.cases >= profile.gates.minBenignCases ? 'met' : 'not-met', String(accounting.evidence.benign.cases), `≥ ${profile.gates.minBenignCases} distinct authored cases`));
  gates.push(gate('benign-axis-diversity', accounting.evidence.benign.axes.length >= profile.gates.minBenignAxes ? 'met' : 'not-met', accounting.evidence.benign.axes.join(',') || 'none', `≥ ${profile.gates.minBenignAxes} benign axes`));
  gates.push(gate('semantic-controls', accounting.evidence.semanticControls > 0 ? 'met' : 'not-met', String(accounting.evidence.semanticControls), 'semantic controls separate from invalid neighbours'));
  for (const [id, evidenceRow, requirement] of [['context-obligations', accounting.evidence.context, 'complete context trios per obligation'], ['jurisdiction-collisions', accounting.evidence.jurisdiction, 'collision target and competitors per jurisdiction']] as const)
    gates.push(gate(id, evidenceRow.applicable === 0 ? 'not-applicable' : evidenceRow.evaluated === evidenceRow.applicable ? 'met' : 'unresolved', `${evidenceRow.evaluated}/${evidenceRow.applicable}`, requirement));
  const reference = accounting.evidence.reference;
  gates.push(gate('reference-differential', reference.applicable === 0 ? 'not-applicable' : reference.evaluated === reference.applicable && reference.unavailable === 0 ? 'met' : 'unresolved', `${reference.evaluated}/${reference.applicable}; unavailable ${reference.unavailable}`, 'independent reference observation where meaningful'));
  gates.push(gate('protected-evidence', 'unresolved', evidence.protected ? `${evidence.protected.status}; trust unresolved` : 'not-measured', 'trusted resolution of protected evidence (no trust store in #284)'));
  gates.push(gate('independent-evidence', 'unresolved', evidence.independent ? `${evidence.independent.status}; trust unresolved` : 'not-measured', 'trusted resolution of independent evidence (no trust store in #284)'));
  const status = accounting.rowCount === 0 ? 'not-applicable' : gates.every(row => row.status === 'met' || row.status === 'not-applicable') ? 'stable' : 'provisional';
  return { schemaVersion: 1, reportType: 'pii-qualification', domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1',
    profile: { id: 'pii-v1', version: 1 }, status, evidence, gates, accounting };
}
export function qualifyPii(accountingInput: PiiAccountingReport, evidenceInput: PiiQualificationEvidenceInput, profile: PiiQualificationProfile = piiV1Profile) {
  validatePiiQualificationProfile(profile); const accounting = validatePiiAccountingReport(structuredClone(accountingInput));
  return validatePiiQualificationReport(assemble(accounting, { protected: project(evidenceInput?.protected, 'protected'), independent: project(evidenceInput?.independent, 'independent') }, profile));
}
export function validatePiiQualificationReport(value: unknown): PiiQualificationReport {
  if (!validateSchema(value)) throw new Error('Invalid PII qualification report schema');
  const report = value as unknown as PiiQualificationReport, accounting = validatePiiAccountingReport(report.accounting);
  const evidence = { protected: validateProjection(report.evidence.protected, 'protected'), independent: validateProjection(report.evidence.independent, 'independent') };
  const expected = assemble(accounting, evidence, piiV1Profile);
  if (JSON.stringify(report) !== JSON.stringify(expected) || Object.hasOwn(report, 'overallScore')) throw new Error('Inconsistent PII qualification report');
  return report;
}
