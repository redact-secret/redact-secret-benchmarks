import Ajv from 'ajv';
import contractSchema from '../../../../schemas/pii-population-contract-v1.json';
import reportSchema from '../../../../schemas/pii-population-report-v1.json';
import comparisonSchema from '../../../../schemas/pii-population-comparison-v1.json';
import data from './populations-v1.json';
import { hash } from '../../substrate/hash.ts';
import {
  piiBenignCollisionEvidence, type PiiBenignCollisionEntry, type PiiBenignCollisionEvidence,
} from './benign-collision-evidence.ts';
import { accountPiiRows, type PiiAccountingRow } from './accounting.ts';
import type { PiiCase } from './types.ts';
import { validateTuningManifest, type RepositoryState, type TuningManifest } from '../../../lib/tuning-manifest.ts';

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
export interface PiiPopulationSelectionOptions extends PiiPopulationValidationOptions {
  purpose: PiiPopulationPurpose; tuningManifest?: TuningManifest; repositoryState?: RepositoryState;
}

const validateContractSchema = new Ajv({ strict: true }).compile(contractSchema);
const validateReportSchema = new Ajv({ strict: true }).compile(reportSchema);
const validateComparisonSchema = new Ajv({ strict: true }).compile(comparisonSchema);
const canonicalContractCommitment = 'ff2a8a456a4a09b31d09b7ebf88fce55a2deb5328009a50f0e1cfbbe78975fbd';
const canonicalize = (value: unknown): unknown => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonicalize(child)])) : value;
export const piiPopulationProjection = (contract: PiiPopulationContract) => {
  const { contentCommitment: _contentCommitment, ...projection } = contract; return projection;
};
export const piiPopulationCommitment = (contract: PiiPopulationContract) => hash(JSON.stringify(canonicalize(piiPopulationProjection(contract))));
const protectedMatch = (values: readonly string[], protectedIdentities: readonly string[]) => values.some(value =>
  protectedIdentities.includes(value) || /(?:^|[/_-])(holdout|protected)(?:$|[/_-])/.test(value));
const strings = (value: unknown, out: string[] = []): string[] => {
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

const definition = (contract: PiiPopulationContract, id: PiiPopulationId) => contract.populations.find(population => population.id === id)!;
export function selectPiiPopulationRows(contractValue: unknown, evidence: PiiBenignCollisionEvidence, rows: PiiAccountingRow[], id: PiiPopulationId,
  options: PiiPopulationSelectionOptions): PiiAccountingRow[] {
  const contract = validatePiiPopulationContract(contractValue, evidence, options), population = definition(contract, id);
  if (!population) throw new Error('Unknown PII population');
  if (rows.length) accountPiiRows(rows);
  if (options.purpose === 'tuning') {
    if (population.role !== 'development-tuning' || !options.tuningManifest || !options.repositoryState || !options.cases || !options.protectedIdentities)
      throw new Error('PII tuning requires validated manifest, repository state, and complete case/protected inventories');
    const problems = validateTuningManifest(options.tuningManifest, options.repositoryState);
    if (problems.length) throw new Error(`Invalid PII tuning manifest: ${problems.join('; ')}`);
  }
  const members = new Map(population.denominator.caseIds.map((caseId, index) => [caseId, population.denominator.evidenceIds[index]]));
  const selected = rows.filter(row => members.has(row.caseId)).map(row => structuredClone(row));
  for (const row of selected) {
    const entry = evidence.entries.find(candidate => candidate.id === members.get(row.caseId));
    if (!entry || row.strategy !== 'authored' || row.methodEvidence.evidenceClass !== entry.evidenceClass || row.methodEvidence.controlClass !== entry.accountingClass ||
        row.family !== entry.family || row.scope !== entry.scope || row.expectation.contextClass !== entry.context.class ||
        row.expectation.sensitivity !== entry.sensitivityExpectation || row.expectation.validatorApplicable !== (entry.validator !== null) ||
        row.source.scanner.mode === 'holdout' || protectedMatch(strings(row), [...(options.protectedIdentities ?? []), ...(options.repositoryState?.holdoutIdentifiers ?? [])]))
      throw new Error('PII population row does not match its authored evidence identity');
  }
  if (options.purpose === 'tuning') {
    // Repository tuning sources bind file-byte hashes from pin-manifest.json. The
    // PII population contract currently binds a different, inner semantic
    // commitment and has no dedicated tuning category. Until one source binds
    // both identities, accepting a caller-selected category would be ambiguous.
    throw new Error('PII tuning is unavailable until a dedicated population source is commitment-bound');
  }
  return selected;
}

const dimensions = (entry: PiiBenignCollisionEntry): PiiPopulationDimensions => ({ family: entry.family, scope: entry.scope,
  contextClass: entry.context.class, evidenceClass: entry.evidenceClass, accountingAxis: entry.accountingClass,
  sensitivity: entry.sensitivityExpectation, validatorBacked: entry.validator !== null,
  contextDependent: entry.context.obligation === 'required-for-sensitive-classification' });
const stratumKey = (entry: PiiBenignCollisionEntry) => JSON.stringify([entry.family, entry.scope, entry.context.class, entry.evidenceClass,
  entry.accountingClass, entry.sensitivityExpectation, entry.validator !== null, entry.context.obligation === 'required-for-sensitive-classification']);
const dimensionKey = (row: PiiPopulationDimensions) => JSON.stringify([row.family, row.scope, row.contextClass, row.evidenceClass,
  row.accountingAxis, row.sensitivity, row.validatorBacked, row.contextDependent]);
const reportStratumKey = (row: PiiPopulationStratum) => dimensionKey(row);
const massStratumKey = (row: PiiPopulationMass) => JSON.stringify([row.family, row.scope, row.contextClass, row.evidenceClass,
  row.accountingAxis, row.sensitivity, row.validatorBacked, row.contextDependent]);
const accountingProjection = (rows: PiiAccountingRow[]) => rows.map(row => ({ source: row.source, caseId: row.caseId, method: row.method,
  family: row.family, scope: row.scope, variant: row.variant, strategy: row.strategy, scanner: row.scanner,
  qualificationProfile: row.qualificationProfile, authority: row.authority, expectation: row.expectation,
  methodEvidence: row.methodEvidence, outcome: row.outcome }));
const reportProjection = (report: PiiPopulationReport) => {
  const copy = structuredClone(report); copy.observation.reportArtifactCommitment = '0'.repeat(64); return copy;
};
const reportCommitment = (report: PiiPopulationReport) => hash(JSON.stringify(canonicalize(reportProjection(report))));
const diagnosticStatus = (eligible: number, measured: number) => eligible === 0 ? 'not-applicable' as const : measured === 0 ? 'not-measured' as const :
  measured < eligible ? 'partial' as const : 'measured' as const;
function diagnosticMetric(axis: PiiDiagnosticAxis, members: PiiBenignCollisionEntry[], selected: PiiAccountingRow[]): PiiDiagnosticMetric {
  const eligible = members.filter(entry => axis === 'type-identity' ||
    (axis === 'validator-correctness' ? entry.validator !== null : entry.context.obligation === 'required-for-sensitive-classification'));
  const groups = new Map<string, PiiBenignCollisionEntry[]>();
  for (const entry of eligible) groups.set(stratumKey(entry), [...(groups.get(stratumKey(entry)) ?? []), entry]);
  const evaluate = (entry: PiiBenignCollisionEntry) => {
    const rows = selected.filter(row => row.caseId === entry.caseId);
    if (axis === 'type-identity') {
      const measured = rows.length > 0 && rows.every(row => ['pass', 'fail'].includes(row.outcome.typeIdentity.status));
      return { measured, passed: measured && rows.every(row => row.outcome.typeIdentity.status === 'pass') };
    }
    if (axis === 'validator-correctness') {
      const measured = rows.length > 0 && rows.every(row => row.methodEvidence.validatorState !== null && row.methodEvidence.validatorState !== 'unavailable' &&
        ['pass', 'fail'].includes(row.outcome.typeIdentity.status));
      return { measured, passed: measured && rows.every(row => row.methodEvidence.validatorState === entry.validator!.expected && row.outcome.typeIdentity.status === 'pass') };
    }
    const measured = rows.length > 0 && rows.every(row => ['pass', 'fail'].includes(row.outcome.sensitivityContext.status));
    return { measured, passed: measured && rows.every(row => row.outcome.sensitivityContext.status === 'pass') };
  };
  const strata = [...groups.values()].map(entries => {
    const results = entries.map(evaluate), measured = results.filter(row => row.measured).length, passed = results.filter(row => row.passed).length;
    const status = diagnosticStatus(entries.length, measured);
    return { ...dimensions(entries[0]), eligible: entries.length, measured, passed, failed: measured - passed, status,
      passRate: status === 'measured' ? passed / entries.length : null };
  }).sort((a, b) => dimensionKey(a).localeCompare(dimensionKey(b)));
  const measured = strata.reduce((sum, row) => sum + row.measured, 0), passed = strata.reduce((sum, row) => sum + row.passed, 0);
  const status = diagnosticStatus(eligible.length, measured);
  return { axis, eligible: eligible.length, measured, passed, failed: measured - passed, status,
    passRate: status === 'measured' ? passed / eligible.length : null, strata };
}
const buildDiagnostics = (members: PiiBenignCollisionEntry[], selected: PiiAccountingRow[]) => ({
  typeIdentity: diagnosticMetric('type-identity', members, selected),
  validatorCorrectness: diagnosticMetric('validator-correctness', members, selected),
  contextDiscrimination: diagnosticMetric('context-discrimination', members, selected),
});

function derivePiiPopulationReport(contract: PiiPopulationContract, evidence: PiiBenignCollisionEvidence, rows: PiiAccountingRow[], id: PiiPopulationId,
  options: PiiPopulationValidationOptions = {}): PiiPopulationReport {
  const population = definition(contract, id), members = population.denominator.evidenceIds.map(evidenceId => evidence.entries.find(entry => entry.id === evidenceId)!);
  const selected = selectPiiPopulationRows(contract, evidence, rows, id, { ...options, purpose: 'evaluation' });
  const groups = new Map<string, PiiBenignCollisionEntry[]>();
  for (const entry of members) groups.set(stratumKey(entry), [...(groups.get(stratumKey(entry)) ?? []), entry]);
  const strata = [...groups.values()].map(entries => {
    const representative = entries[0], caseRows = entries.map(entry => selected.filter(row => row.caseId === entry.caseId));
    const resolved = caseRows.filter(group => group.length > 0 && group.every(row => ['pass', 'fail'].includes(row.outcome.sensitivityContext.status)));
    const falseAlarms = resolved.filter(group => group.some(row => row.outcome.sensitivityContext.state === 'false-positive')).length;
    const applicable = representative.sensitivityExpectation === 'non-sensitive';
    const mass = population.baseRate.strata.find(row => massStratumKey(row) === stratumKey(representative))!;
    return { ...dimensions(representative), denominator: entries.length, assumedMass: mass.totalMass,
      measured: resolved.length, falseAlarms: applicable ? falseAlarms : 0,
      status: !applicable ? 'not-applicable' as const : resolved.length === 0 ? 'not-measured' as const : resolved.length < entries.length ? 'partial' as const : 'measured' as const,
      falseAlarmRate: applicable && resolved.length === entries.length ? falseAlarms / entries.length : null };
  }).sort((a, b) => reportStratumKey(a).localeCompare(reportStratumKey(b)));
  const sourceKeys = new Set(selected.map(row => JSON.stringify(row.source)));
  const source = selected[0]?.source, product = selected.length > 0 && sourceKeys.size === 1 && source?.scanner.status === 'complete' &&
    ['candidate', 'published'].includes(source.scanner.mode) && /^[a-f0-9]{64}$/.test(source.provenance.candidateArtifactHash ?? '') &&
    typeof source.scanner.version === 'string' && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(source.scanner.version) &&
    /^[a-f0-9]{64}$/.test(source.scanner.configurationHash);
  const observed = new Set(selected.map(row => row.caseId)).size;
  const applicableComplete = strata.filter(row => row.sensitivity === 'non-sensitive').every(row => row.status === 'measured');
  const diagnostics = buildDiagnostics(id === 'diagnostic-balanced' ? members : [], selected);
  const diagnosticsComplete = Object.values(diagnostics).every(metric => metric.status === 'measured' || metric.status === 'not-applicable');
  const status = !product || members.length === 0 ? 'not-measured' :
    observed === members.length && applicableComplete && diagnosticsComplete ? 'measured' : 'partial';
  const report: PiiPopulationReport = { schemaVersion: 1, reportType: 'pii-population', domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1', supportClaims: false,
    population: id, contractCommitment: contract.contentCommitment, corpusCommitment: evidence.contentCommitment,
    baseRate: structuredClone(population.baseRate), weighting: structuredClone(population.weighting), regressionPolicy: structuredClone(population.regressionPolicy),
    denominator: { unit: 'authored-evidence-case', declared: members.length, observed },
    partitionPolicy: { role: population.role, tuningEligible: population.role === 'development-tuning', protectedRows: 'rejected' },
    calibration: { status: members.length === 0 ? 'not-measured' : 'not-used',
      reasonCode: members.length === 0 ? 'empty-committed-population' : 'evaluation-does-not-fit-thresholds' },
    observation: { kind: product ? 'product-observation' : 'none', candidateArtifactHash: product ? source.provenance.candidateArtifactHash : null,
      runId: product ? source.runId : null, scanner: product ? { id: source.scanner.id, version: source.scanner.version!, configurationHash: source.scanner.configurationHash } : null,
      accountingInputCommitment: hash(JSON.stringify(canonicalize(accountingProjection(selected)))), reportArtifactCommitment: '0'.repeat(64) },
    status, strata, diagnostics };
  report.observation.reportArtifactCommitment = reportCommitment(report);
  return report;
}

export function validatePiiPopulationReport(value: unknown, contractValue: unknown = piiPopulationContract,
  evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence, options: PiiPopulationValidationOptions = {}, rows?: PiiAccountingRow[]): PiiPopulationReport {
  if (!validateReportSchema(value)) throw new Error('Invalid PII population report schema');
  const report = structuredClone(value) as unknown as PiiPopulationReport, contract = validatePiiPopulationContract(contractValue, evidence, options);
  const population = definition(contract, report.population);
  if (!population || report.contractCommitment !== contract.contentCommitment || report.corpusCommitment !== evidence.contentCommitment ||
      JSON.stringify(report.baseRate) !== JSON.stringify(population.baseRate) || JSON.stringify(report.weighting) !== JSON.stringify(population.weighting) ||
      JSON.stringify(report.regressionPolicy) !== JSON.stringify(population.regressionPolicy) ||
      report.denominator.declared !== population.denominator.evidenceIds.length || report.denominator.observed > report.denominator.declared ||
      report.partitionPolicy.role !== population.role || report.partitionPolicy.tuningEligible !== (population.role === 'development-tuning') ||
      (report.observation.kind === 'none') !== (report.observation.candidateArtifactHash === null && report.observation.runId === null && report.observation.scanner === null) ||
      report.observation.reportArtifactCommitment !== reportCommitment(report) ||
      report.strata.some(row => row.falseAlarms > row.measured || row.measured > row.denominator ||
        (row.falseAlarmRate === null) !== (row.measured !== row.denominator || row.sensitivity !== 'non-sensitive') ||
        (row.falseAlarmRate !== null && row.falseAlarmRate !== row.falseAlarms / row.denominator))) throw new Error('Inconsistent PII population report');
  const members = population.denominator.evidenceIds.map(id => evidence.entries.find(entry => entry.id === id)!);
  const roster = [...new Set(members.map(stratumKey))].sort();
  if (JSON.stringify(report.strata.map(reportStratumKey).sort()) !== JSON.stringify(roster)) throw new Error('Incomplete PII population stratum roster');
  const expectedSizes = new Map(roster.map(key => [key, members.filter(entry => stratumKey(entry) === key).length]));
  const product = report.observation.kind === 'product-observation';
  const metricEntries = Object.entries(report.diagnostics) as [keyof PiiPopulationReport['diagnostics'], PiiDiagnosticMetric][];
  const expectedAxes: Record<keyof PiiPopulationReport['diagnostics'], PiiDiagnosticAxis> = {
    typeIdentity: 'type-identity', validatorCorrectness: 'validator-correctness', contextDiscrimination: 'context-discrimination',
  };
  if (metricEntries.some(([name, metric]) => metric.axis !== expectedAxes[name] || metric.measured !== metric.passed + metric.failed ||
      metric.measured > metric.eligible || metric.status !== diagnosticStatus(metric.eligible, metric.measured) ||
      (metric.passRate === null) !== (metric.status !== 'measured') ||
      (metric.passRate !== null && metric.passRate !== metric.passed / metric.eligible) ||
      metric.strata.reduce((sum, row) => sum + row.eligible, 0) !== metric.eligible ||
      metric.strata.reduce((sum, row) => sum + row.measured, 0) !== metric.measured ||
      metric.strata.reduce((sum, row) => sum + row.passed, 0) !== metric.passed ||
      metric.strata.reduce((sum, row) => sum + row.failed, 0) !== metric.failed ||
      new Set(metric.strata.map(dimensionKey)).size !== metric.strata.length || metric.strata.some(row =>
        row.measured !== row.passed + row.failed || row.measured > row.eligible || row.status !== diagnosticStatus(row.eligible, row.measured) ||
        (row.passRate === null) !== (row.status !== 'measured') || (row.passRate !== null && row.passRate !== row.passed / row.eligible))))
    throw new Error('Inconsistent PII diagnostic metrics');
  const diagnosticMembers = report.population === 'diagnostic-balanced' ? members : [];
  const expectedDiagnosticMembers: Record<keyof PiiPopulationReport['diagnostics'], PiiBenignCollisionEntry[]> = {
    typeIdentity: diagnosticMembers,
    validatorCorrectness: diagnosticMembers.filter(entry => entry.validator !== null),
    contextDiscrimination: diagnosticMembers.filter(entry => entry.context.obligation === 'required-for-sensitive-classification'),
  };
  if (metricEntries.some(([name, metric]) => {
    const expected = expectedDiagnosticMembers[name], expectedKeys = [...new Set(expected.map(stratumKey))].sort();
    return metric.eligible !== expected.length || JSON.stringify(metric.strata.map(dimensionKey).sort()) !== JSON.stringify(expectedKeys) ||
      metric.strata.some(row => row.eligible !== expected.filter(entry => stratumKey(entry) === dimensionKey(row)).length);
  })) throw new Error('Incomplete PII diagnostic stratum roster');
  if (report.population === 'benign-heavy-stress' && metricEntries.some(([, metric]) => metric.eligible !== 0))
    throw new Error('Benign-heavy report cannot claim diagnostic metrics');
  const diagnosticsComplete = metricEntries.every(([, metric]) => metric.status === 'measured' || metric.status === 'not-applicable');
  const expectedStatus = !product || report.denominator.declared === 0 ? 'not-measured' :
    report.denominator.observed === report.denominator.declared &&
      report.strata.filter(row => row.sensitivity === 'non-sensitive').every(row => row.status === 'measured') && diagnosticsComplete ? 'measured' : 'partial';
  if (report.status !== expectedStatus || report.calibration.status !== (report.denominator.declared === 0 ? 'not-measured' : 'not-used') ||
      report.strata.some(row => row.denominator !== expectedSizes.get(reportStratumKey(row)) ||
        row.assumedMass !== population.baseRate.strata.find(mass => massStratumKey(mass) === reportStratumKey(row))?.totalMass))
    throw new Error('Inconsistent PII population status or denominator');
  if (product && !rows) throw new Error('Product observation requires bound accounting rows');
  if (rows && JSON.stringify(report) !== JSON.stringify(derivePiiPopulationReport(contract, evidence, rows, report.population, options)))
    throw new Error('PII population report does not reconcile with observations');
  if (/RAW-CANARY|SYNTHETIC-PERSON-ID|"(?:content|candidate|seed|fixture|path|raw|rationale)"/i.test(JSON.stringify(report)))
    throw new Error('PII population report exposes raw evidence');
  return report;
}

export function buildPiiPopulationReport(contractValue: unknown, evidence: PiiBenignCollisionEvidence, rows: PiiAccountingRow[], id: PiiPopulationId,
  options: PiiPopulationValidationOptions = {}): PiiPopulationReport {
  const contract = validatePiiPopulationContract(contractValue, evidence, options);
  return validatePiiPopulationReport(derivePiiPopulationReport(contract, evidence, rows, id, options), contract, evidence, options, rows);
}

export function comparePiiPopulationReports(baselineValue: unknown, candidateValue: unknown, bindings: {
  contract: PiiPopulationContract; evidence: PiiBenignCollisionEvidence; baselineRows: PiiAccountingRow[]; candidateRows: PiiAccountingRow[];
  options?: PiiPopulationValidationOptions;
}) {
  if (!bindings) throw new Error('PII population comparison requires bound accounting inputs');
  const baseline = validatePiiPopulationReport(baselineValue, bindings.contract, bindings.evidence, bindings.options, bindings.baselineRows);
  const candidate = validatePiiPopulationReport(candidateValue, bindings.contract, bindings.evidence, bindings.options, bindings.candidateRows);
  if (baseline.population !== candidate.population || baseline.contractCommitment !== candidate.contractCommitment ||
      baseline.corpusCommitment !== candidate.corpusCommitment || JSON.stringify(baseline.baseRate) !== JSON.stringify(candidate.baseRate) ||
      JSON.stringify(baseline.weighting) !== JSON.stringify(candidate.weighting) || JSON.stringify(baseline.regressionPolicy) !== JSON.stringify(candidate.regressionPolicy) ||
      baseline.denominator.declared !== candidate.denominator.declared)
    throw new Error('PII population comparison commitments differ');
  if (baseline.observation.scanner === null || candidate.observation.scanner === null ||
      JSON.stringify(baseline.observation.scanner) !== JSON.stringify(candidate.observation.scanner) ||
      baseline.observation.runId === candidate.observation.runId ||
      baseline.observation.candidateArtifactHash === candidate.observation.candidateArtifactHash ||
      baseline.observation.reportArtifactCommitment === candidate.observation.reportArtifactCommitment)
    throw new Error('PII population comparison source identity mismatch');
  const baselineByKey = new Map(baseline.strata.map(row => [reportStratumKey(row), row]));
  if (candidate.strata.length !== baseline.strata.length || candidate.strata.some(row => !baselineByKey.has(reportStratumKey(row))))
    throw new Error('PII population comparison strata differ');
  const deltas = candidate.strata.filter(row => row.sensitivity === 'non-sensitive').map(row => {
    const before = baselineByKey.get(reportStratumKey(row))!;
    return { family: row.family, scope: row.scope, contextClass: row.contextClass, evidenceClass: row.evidenceClass,
      accountingAxis: row.accountingAxis, validatorBacked: row.validatorBacked, contextDependent: row.contextDependent,
      baseline: before.falseAlarmRate, candidate: row.falseAlarmRate,
      delta: before.falseAlarmRate === null || row.falseAlarmRate === null ? null : row.falseAlarmRate - before.falseAlarmRate };
  });
  const diagnosticDeltas = baseline.population === 'diagnostic-balanced' ?
    (['typeIdentity', 'validatorCorrectness', 'contextDiscrimination'] as const).map(name => {
      const before = baseline.diagnostics[name], after = candidate.diagnostics[name];
      return { axis: before.axis, baseline: before.passRate, candidate: after.passRate,
        delta: before.passRate === null || after.passRate === null ? null : after.passRate - before.passRate,
        failedDelta: after.failed - before.failed };
    }) : [];
  const product = [baseline, candidate].every(report => report.status === 'measured' && report.observation.kind === 'product-observation');
  const diagnosticMetrics = [baseline.diagnostics.typeIdentity, baseline.diagnostics.validatorCorrectness, baseline.diagnostics.contextDiscrimination];
  const diagnosticUnmeasured = diagnosticDeltas.some((row, index) => diagnosticMetrics[index].eligible > 0 && row.delta === null);
  const verdict = !product || deltas.length === 0 || deltas.some(row => row.delta === null) || diagnosticUnmeasured ? 'not-measured' :
    deltas.some(row => row.delta! > baseline.regressionPolicy.maxAbsoluteIncrease) ||
      diagnosticDeltas.some(row => row.delta! < 0 || row.failedDelta > 0) ? 'regression' : 'no-regression';
  const comparison = { schemaVersion: 1 as const, reportType: 'pii-population-comparison' as const, domain: 'pii' as const,
    population: baseline.population, contractCommitment: baseline.contractCommitment, corpusCommitment: baseline.corpusCommitment,
    baselineReportCommitment: baseline.observation.reportArtifactCommitment,
    candidateReportCommitment: candidate.observation.reportArtifactCommitment,
    baselineArtifactHash: baseline.observation.candidateArtifactHash, candidateArtifactHash: candidate.observation.candidateArtifactHash,
    verdict, deltas, diagnosticDeltas };
  if (!validateComparisonSchema(comparison)) throw new Error('Invalid PII population comparison');
  return comparison;
}

const deepFreeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(deepFreeze); Object.freeze(value); } return value; };
export const piiPopulationContract = deepFreeze(validatePiiPopulationContract(data));
