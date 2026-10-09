// Bounded TypeScript oracle: retained for raw reconciliation, historical comparison and rollback only.
import Ajv from 'ajv';
import comparisonSchema from '../../../../schemas/pii-population-comparison-v1.json';
import { hash } from '../../substrate/hash.ts';
import {
  piiBenignCollisionEvidence, type PiiBenignCollisionEntry, type PiiBenignCollisionEvidence,
} from './benign-collision-evidence.ts';
import { accountPiiRows, type PiiAccountingRow } from './accounting.ts';
import type { PiiCase } from './types.ts';
import { validateTuningManifest, type RepositoryState, type TuningManifest } from '../../../lib/tuning-manifest.ts';

export * from './population-contracts.ts';
import { piiPopulationContract, validatePiiPopulationContract, piiPopulationProjection, piiPopulationCommitment, canonicalize, protectedMatch, strings, dimensions, stratumKey, dimensionKey, reportStratumKey, massStratumKey, type PiiPopulationContract, type PiiPopulationId, type PiiPopulationPurpose, type PiiPopulationReport, type PiiPopulationDimensions, type PiiPopulationMass, type PiiPopulationStratum, type PiiDiagnosticAxis, type PiiDiagnosticStratum, type PiiDiagnosticMetric, type PiiPopulationValidationOptions } from './population-contracts.ts';
import { validatePiiPopulationStructure } from './population-artifacts.ts';
export interface PiiPopulationSelectionOptions extends PiiPopulationValidationOptions {
  purpose: PiiPopulationPurpose; tuningManifest?: TuningManifest; repositoryState?: RepositoryState;
}

const validateComparisonSchema = new Ajv({ strict: true }).compile(comparisonSchema);
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
  const report = validatePiiPopulationStructure(value, contractValue, evidence, options);
  const contract = validatePiiPopulationContract(contractValue, evidence, options);
  const product = report.observation.kind === 'product-observation';
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
  // One scanner identity (same adapter id and requested-selection config) must have produced both sides, but a
  // baseline (released package) and candidate (build under test) legitimately declare different versions -- that
  // is the comparison's whole purpose, so version is excluded from this check.
  if (baseline.observation.scanner === null || candidate.observation.scanner === null ||
      baseline.observation.scanner.id !== candidate.observation.scanner.id ||
      baseline.observation.scanner.configurationHash !== candidate.observation.scanner.configurationHash ||
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
