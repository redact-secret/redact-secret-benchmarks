import Ajv from 'ajv';
import contractSchema from '../../../../schemas/pii-population-contract-v1.json';
import data from './populations-v1.json';
import { hash } from '../../substrate/hash.ts';
import { piiBenignCollisionEvidence, type PiiBenignCollisionEntry, type PiiBenignCollisionEvidence } from './benign-collision-contract.ts';
import type { PiiCase } from './types.ts';

export type PiiPopulationId = 'diagnostic-balanced' | 'benign-heavy-stress';
export type PiiPopulationPurpose = 'tuning' | 'evaluation';
export interface PiiPopulationDefinition {
  id: PiiPopulationId; role: 'development-tuning' | 'evaluation-only';
  denominator: { unit: 'authored-evidence-case'; selection: 'explicit-members'; evidenceIds: string[]; caseIds: string[] };
  baseRate: { kind: 'declared-assumption'; totalMass: number; sensitiveMass: number; nonSensitiveMass: number; notEstablishedMass: number; rationaleCode: 'diagnostic-behavior-balance' | 'benign-operational-stress'; strata: PiiPopulationMass[] };
  weighting: { kind: 'equal-evidence-class' | 'authored-case-frequency'; rationaleCode: 'equal-authored-class-influence' | 'retain-authored-case-frequency' };
  regressionPolicy: { metric: 'benign-false-alarm-rate'; maxAbsoluteIncrease: number; locality: 'any-stratum' };
}
export type PiiPopulationDimensions = {
  family: string; scope: string; contextClass: 'sensitive' | 'neutral' | 'non-sensitive'; evidenceClass: PiiBenignCollisionEntry['evidenceClass'];
  accountingAxis: PiiBenignCollisionEntry['accountingClass']; sensitivity: PiiBenignCollisionEntry['sensitivityExpectation'];
  validatorBacked: boolean; contextDependent: boolean;
};
export type PiiPopulationMass = PiiPopulationDimensions & { totalMass: number; sensitiveMass: number; nonSensitiveMass: number; notEstablishedMass: number };
export interface PiiPopulationContract {
  schemaVersion: 1; id: 'pii-populations-v1'; version: 1; contentCommitment: string;
  source: { repository: 'redact-secret/redact-secret-benchmarks'; definitionIssue: 285; evidenceIssue: 269;
    corpus: { id: 'pii-benign-collision-v1'; version: 1; contentCommitment: string } };
  partitionPolicy: { membership: 'explicit-evidence-identities'; overlap: 'forbidden'; tuningVisibility: ['development'];
    holdoutAccess: 'none'; protectedRows: 'reject'; evaluationOnlyTuning: 'reject' };
  strata: ['family', 'scope', 'context-class', 'evidence-class', 'accounting-axis', 'sensitivity', 'classification-basis'];
  evidenceClasses: ['reserved-documentation', 'official-test', 'public-identifier', 'ordinary-reference-account', 'near-miss', 'placeholder',
    'context-negative', 'cross-family-collision'];
  populations: [PiiPopulationDefinition, PiiPopulationDefinition];
}
export type PiiPopulationStratum = PiiPopulationDimensions & {
  denominator: number; assumedMass: number; measured: number; falseAlarms: number;
  status: 'measured' | 'partial' | 'not-measured' | 'not-applicable'; falseAlarmRate: number | null;
};
export type PiiDiagnosticAxis = 'type-identity' | 'validator-correctness' | 'context-discrimination';
export type PiiDiagnosticStratum = PiiPopulationDimensions & { eligible: number; measured: number; passed: number; failed: number;
  status: 'measured' | 'partial' | 'not-measured' | 'not-applicable'; passRate: number | null };
export type PiiDiagnosticMetric = { axis: PiiDiagnosticAxis; eligible: number; measured: number; passed: number; failed: number;
  status: 'measured' | 'partial' | 'not-measured' | 'not-applicable'; passRate: number | null; strata: PiiDiagnosticStratum[] };
export interface PiiPopulationReport {
  schemaVersion: 1; reportType: 'pii-population'; domain: 'pii'; evaluationProfile: 'pii-v1'; domainAccountingVersion: 'pii-v1'; supportClaims: false;
  population: PiiPopulationId; contractCommitment: string; corpusCommitment: string;
  baseRate: PiiPopulationDefinition['baseRate']; weighting: PiiPopulationDefinition['weighting']; regressionPolicy: PiiPopulationDefinition['regressionPolicy'];
  denominator: { unit: 'authored-evidence-case'; declared: number; observed: number };
  partitionPolicy: { role: PiiPopulationDefinition['role']; tuningEligible: boolean; protectedRows: 'rejected' };
  calibration: { status: 'not-used' | 'not-measured'; reasonCode: 'evaluation-does-not-fit-thresholds' | 'empty-committed-population' };
  observation: { kind: 'none' | 'product-observation'; candidateArtifactHash: string | null; runId: string | null;
    scanner: { id: string; version: string; configurationHash: string } | null; accountingInputCommitment: string; reportArtifactCommitment: string };
  status: 'measured' | 'partial' | 'not-measured'; strata: PiiPopulationStratum[];
  diagnostics: { typeIdentity: PiiDiagnosticMetric; validatorCorrectness: PiiDiagnosticMetric; contextDiscrimination: PiiDiagnosticMetric };
}
export interface PiiPopulationValidationOptions { canonical?: boolean; cases?: PiiCase[]; protectedIdentities?: readonly string[] }

const validateContractSchema = new Ajv({ strict: true }).compile(contractSchema);
const canonicalContractCommitment = 'd7025a678969018563b1108cf575a2f718afd749229fcf124eb4c0085c131eb2';
export const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiPopulationProjection = (contract: PiiPopulationContract) => {
  const { contentCommitment: _contentCommitment, ...projection } = contract; return projection;
};
export const piiPopulationCommitment = (contract: PiiPopulationContract) => hash(JSON.stringify(canonicalize(piiPopulationProjection(contract))));
export const protectedMatch = (values: readonly string[], protectedIdentities: readonly string[]) => values.some(value =>
  protectedIdentities.includes(value) || /(?:^|[/_-])(holdout|protected)(?:$|[/_-])/.test(value));
export const strings = (value: unknown, out: string[] = []): string[] => {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach(item => strings(item, out));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, child]) => { out.push(key); strings(child, out); });
  return out;
};

export function validatePiiPopulationContract(value: unknown, evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence,
  options: PiiPopulationValidationOptions = {}): PiiPopulationContract {
  if (!validateContractSchema(value)) throw new Error('Invalid PII population contract schema');
  const contract = structuredClone(value) as unknown as PiiPopulationContract;
  if (piiPopulationCommitment(contract) !== contract.contentCommitment) throw new Error('PII population contract commitment mismatch');
  if (options.canonical !== false && contract.contentCommitment !== canonicalContractCommitment) throw new Error('Canonical PII population contract commitment mismatch');
  if (contract.source.corpus.id !== evidence.id || contract.source.corpus.version !== evidence.version ||
      contract.source.corpus.contentCommitment !== evidence.contentCommitment) throw new Error('PII population corpus commitment mismatch');
  const ids = contract.populations.map(population => population.id);
  if (JSON.stringify(ids) !== JSON.stringify(['diagnostic-balanced', 'benign-heavy-stress']) ||
      contract.populations[0].role !== 'development-tuning' || contract.populations[1].role !== 'evaluation-only' ||
      contract.populations[0].weighting.kind !== 'equal-evidence-class' || contract.populations[1].weighting.kind !== 'authored-case-frequency' ||
      contract.populations[0].baseRate.rationaleCode !== 'diagnostic-behavior-balance' ||
      contract.populations[1].baseRate.rationaleCode !== 'benign-operational-stress' ||
      contract.populations[0].weighting.rationaleCode !== 'equal-authored-class-influence' ||
      contract.populations[1].weighting.rationaleCode !== 'retain-authored-case-frequency')
    throw new Error('PII population identities or roles mismatch');
  const entries = new Map(evidence.entries.map(entry => [entry.id, entry]));
  const assigned: string[] = [];
  const cases = new Map((options.cases ?? []).map(source => [source.id, source]));
  const protectedIdentities = options.protectedIdentities ?? [];
  for (const population of contract.populations) {
    const { totalMass, sensitiveMass, nonSensitiveMass, notEstablishedMass } = population.baseRate;
    if (sensitiveMass + nonSensitiveMass + notEstablishedMass !== totalMass) throw new Error('PII population base-rate mass mismatch');
    if (population.denominator.evidenceIds.length !== population.denominator.caseIds.length) throw new Error('PII population denominator roster mismatch');
    population.denominator.evidenceIds.forEach((evidenceId, index) => {
      const entry = entries.get(evidenceId), caseId = population.denominator.caseIds[index], source = cases.get(caseId);
      if (!entry || entry.caseId !== caseId) throw new Error('Unknown or mismatched PII population evidence identity');
      if (options.cases && (!source || source.visibility !== 'development' || source.metadata?.evidenceId !== evidenceId ||
          protectedMatch([source.id, source.input.path, source.provenance.source, source.provenance.sourceHash], protectedIdentities)))
        throw new Error('Protected or non-development PII population member');
      if (protectedMatch([evidenceId, caseId], protectedIdentities)) throw new Error('Protected PII population identity');
      assigned.push(evidenceId);
    });
    const members = population.denominator.evidenceIds.map(id => entries.get(id)!);
    const roster = [...new Set(members.map(stratumKey))].sort();
    const massKeys = population.baseRate.strata.map(massStratumKey);
    if (JSON.stringify([...massKeys].sort()) !== JSON.stringify(roster) || new Set(massKeys).size !== massKeys.length)
      throw new Error('PII population base-rate strata do not match committed roster');
    if (members.length && (population.baseRate.strata.some(row =>
        row.sensitiveMass + row.nonSensitiveMass + row.notEstablishedMass !== row.totalMass ||
        (row.sensitivity === 'sensitive' && (row.sensitiveMass !== row.totalMass || row.nonSensitiveMass !== 0 || row.notEstablishedMass !== 0)) ||
        (row.sensitivity === 'non-sensitive' && (row.nonSensitiveMass !== row.totalMass || row.sensitiveMass !== 0 || row.notEstablishedMass !== 0)) ||
        (row.sensitivity === 'not-established' && (row.notEstablishedMass !== row.totalMass || row.sensitiveMass !== 0 || row.nonSensitiveMass !== 0))) ||
        population.baseRate.strata.reduce((sum, row) => sum + row.totalMass, 0) !== totalMass ||
        population.baseRate.strata.reduce((sum, row) => sum + row.sensitiveMass, 0) !== sensitiveMass ||
        population.baseRate.strata.reduce((sum, row) => sum + row.nonSensitiveMass, 0) !== nonSensitiveMass ||
        population.baseRate.strata.reduce((sum, row) => sum + row.notEstablishedMass, 0) !== notEstablishedMass))
      throw new Error('PII population base-rate child mass mismatch');
    if (members.length && population.id === 'diagnostic-balanced') {
      const classMass = [...new Set(members.map(entry => entry.evidenceClass))].map(evidenceClass =>
        population.baseRate.strata.filter(row => row.evidenceClass === evidenceClass).reduce((sum, row) => sum + row.totalMass, 0));
      if (new Set(classMass).size !== 1) throw new Error('Diagnostic population is not balanced');
    }
    if (members.length && population.id === 'benign-heavy-stress' && nonSensitiveMass <= sensitiveMass)
      throw new Error('Stress population is not benign-dominant');
    if (members.length && population.weighting.kind === 'authored-case-frequency' && population.baseRate.strata.some(row =>
      row.totalMass * members.length !== totalMass * members.filter(entry => stratumKey(entry) === massStratumKey(row)).length))
      throw new Error('PII population mass does not preserve authored case frequency');
  }
  if (evidence.entries.length && contract.populations.some(population => population.denominator.evidenceIds.length === 0))
    throw new Error('Both PII population views require committed members');
  if (new Set(assigned).size !== assigned.length) throw new Error('PII population overlap is forbidden');
  if (assigned.length !== evidence.entries.length || evidence.entries.some(entry => !assigned.includes(entry.id)))
    throw new Error('PII population roster omits committed evidence');
  return contract;
}

export const dimensions = (entry: PiiBenignCollisionEntry): PiiPopulationDimensions => ({ family: entry.family, scope: entry.scope,
  contextClass: entry.context.class, evidenceClass: entry.evidenceClass, accountingAxis: entry.accountingClass,
  sensitivity: entry.sensitivityExpectation, validatorBacked: entry.validator !== null,
  contextDependent: entry.context.obligation === 'required-for-sensitive-classification' });
export const stratumKey = (entry: PiiBenignCollisionEntry) => JSON.stringify([entry.family, entry.scope, entry.context.class, entry.evidenceClass,
  entry.accountingClass, entry.sensitivityExpectation, entry.validator !== null, entry.context.obligation === 'required-for-sensitive-classification']);
export const dimensionKey = (row: PiiPopulationDimensions) => JSON.stringify([row.family, row.scope, row.contextClass, row.evidenceClass,
  row.accountingAxis, row.sensitivity, row.validatorBacked, row.contextDependent]);
export const reportStratumKey = (row: PiiPopulationStratum) => dimensionKey(row);
export const massStratumKey = (row: PiiPopulationMass) => JSON.stringify([row.family, row.scope, row.contextClass, row.evidenceClass,
  row.accountingAxis, row.sensitivity, row.validatorBacked, row.contextDependent]);

const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
export const piiPopulationContract = deepFreeze(validatePiiPopulationContract(data));
