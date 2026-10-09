import Ajv from 'ajv';
import reportSchema from '../../../../schemas/pii-population-report-v1.json';
import unmeasured from './population-unmeasured-v1.json';
import { hash } from '../../substrate/hash.ts';
import { piiBenignCollisionEvidence, type PiiBenignCollisionEntry, type PiiBenignCollisionEvidence } from './benign-collision-contract.ts';
import { canonicalize, dimensionKey, stratumKey, reportStratumKey, massStratumKey,
  piiPopulationContract, validatePiiPopulationContract,
  type PiiPopulationContract, type PiiPopulationReport, type PiiPopulationValidationOptions,
  type PiiDiagnosticMetric, type PiiDiagnosticAxis, type PiiPopulationId } from './population-contracts.ts';

const validateReportSchema = new Ajv({ strict: true }).compile(reportSchema);
const definition = (contract: PiiPopulationContract, id: PiiPopulationId) => contract.populations.find(population => population.id === id)!;
const reportProjection = (report: PiiPopulationReport) => {
  const copy = structuredClone(report); copy.observation.reportArtifactCommitment = '0'.repeat(64); return copy;
};
export const piiPopulationReportCommitment = (report: PiiPopulationReport) => hash(JSON.stringify(canonicalize(reportProjection(report))));
const diagnosticStatus = (eligible: number, measured: number) => eligible === 0 ? 'not-applicable' as const : measured === 0 ? 'not-measured' as const :
  measured < eligible ? 'partial' as const : 'measured' as const;
export function validatePiiPopulationStructure(value: unknown, contractValue: unknown = piiPopulationContract,
  evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence, options: PiiPopulationValidationOptions = {}): PiiPopulationReport {
  if (!validateReportSchema(value)) throw new Error('Invalid PII population report schema');
  const report = structuredClone(value) as unknown as PiiPopulationReport, contract = validatePiiPopulationContract(contractValue, evidence, options);
  const population = definition(contract, report.population);
  if (!population || report.contractCommitment !== contract.contentCommitment || report.corpusCommitment !== evidence.contentCommitment ||
      JSON.stringify(report.baseRate) !== JSON.stringify(population.baseRate) || JSON.stringify(report.weighting) !== JSON.stringify(population.weighting) ||
      JSON.stringify(report.regressionPolicy) !== JSON.stringify(population.regressionPolicy) ||
      report.denominator.declared !== population.denominator.evidenceIds.length || report.denominator.observed > report.denominator.declared ||
      report.partitionPolicy.role !== population.role || report.partitionPolicy.tuningEligible !== (population.role === 'development-tuning') ||
      (report.observation.kind === 'none') !== (report.observation.candidateArtifactHash === null && report.observation.runId === null && report.observation.scanner === null) ||
      report.observation.reportArtifactCommitment !== piiPopulationReportCommitment(report) ||
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
  if (/RAW-CANARY|SYNTHETIC-PERSON-ID|"(?:content|candidate|seed|fixture|path|raw|rationale)"/i.test(JSON.stringify(report)))
    throw new Error('PII population report exposes raw evidence');
  return report;
}


/** Structural consistency is not raw-observation reconciliation or product qualification. */
export function validatePiiPopulationArtifact(value: unknown, contract: unknown = piiPopulationContract,
  evidence: PiiBenignCollisionEvidence = piiBenignCollisionEvidence, options: PiiPopulationValidationOptions = {}): PiiPopulationReport {
  const report = validatePiiPopulationStructure(value, contract, evidence, options);
  if (report.observation.kind !== 'none' || report.denominator.observed !== 0 || report.status !== 'not-measured' ||
      report.strata.some(row => row.measured !== 0 || row.falseAlarms !== 0) ||
      Object.values(report.diagnostics).some(metric => metric.measured !== 0 || metric.passed !== 0 || metric.failed !== 0))
    throw new Error('Legacy PII product observations require the bounded oracle; current publication uses validated pii-eval artifacts');
  return report;
}

/** A frozen absence artifact keeps the old report contract without executing its measurement engine. */
export function unmeasuredPiiPopulationArtifacts(): PiiPopulationReport[] {
  return unmeasured.map(report => validatePiiPopulationArtifact(report));
}
