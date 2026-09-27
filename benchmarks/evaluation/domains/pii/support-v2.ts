import Ajv from 'ajv';
import matrixSchema from '../../../../schemas/pii-support-matrix-v2.json';
import registrySchema from '../../../../schemas/pii-support-registry-v1.json';
import registryData from './support-registry-v1.json';
import { hash } from '../../substrate/hash.ts';
import { validatePiiAuthority } from './contract-model.ts';
import { isPiiJurisdiction } from './jurisdictions.ts';
import {
  buildPiiPopulationReport, comparePiiPopulationReports, piiPopulationContract, validatePiiPopulationReport,
  type PiiPopulationContract, type PiiPopulationId, type PiiPopulationReport, type PiiPopulationValidationOptions,
} from './populations.ts';
import { piiBenignCollisionEvidence, type PiiBenignCollisionEvidence } from './benign-collision-evidence.ts';
import type { PiiAccountingRow } from './accounting.ts';
import type { PiiAuthority, PiiContract } from './types.ts';
import { PII_SUPPORT_REGISTRY_SOURCE, piiSupportRegistryProjection, piiSupportSemanticProblem } from './support-semantics.ts';

export const PII_ACTIVATION_CONTRACT = Object.freeze({
  repository: 'redact-secret/redact-secret' as const,
  decision: 'decision-define-the-pii-domain-scope-arbitration-and-activation-contract' as const,
  mergeCommit: 'eb22bdf587e0079e101fc3ab5aeefada58ba438d' as const,
});
const REGISTRY_DECISION = PII_SUPPORT_REGISTRY_SOURCE.decision;

export type PiiSupportStatus = 'pending' | 'provisional' | 'stable' | 'unsupported';
export interface PiiSupportFamily {
  family: string; displayName: string; identityDomain: PiiContract['identityDomain']; familyContractVersion: number;
  scope: PiiContract['scope']; jurisdiction: string | null; qualificationProfile: { id: 'pii-v1'; version: 1 };
  authority: PiiAuthority[]; contextObligation: PiiContract['context']['obligation']; validatorApplicable: boolean;
}
export interface PiiSupportRegistry {
  schemaVersion: 1; id: 'pii-support-registry-v1'; version: 1; contentCommitment: string;
  source: { repository: 'redact-secret/redact-secret'; decision: typeof REGISTRY_DECISION; mergeCommit: typeof PII_ACTIVATION_CONTRACT.mergeCommit };
  families: PiiSupportFamily[];
}
type PopulationInput = { report: PiiPopulationReport; rows?: PiiAccountingRow[]; contract?: PiiPopulationContract;
  evidence?: PiiBenignCollisionEvidence; validation?: PiiPopulationValidationOptions };
type PopulationComparisonInput = { baseline: PiiPopulationReport; candidate: PiiPopulationReport;
  baselineRows: PiiAccountingRow[]; candidateRows: PiiAccountingRow[]; contract?: PiiPopulationContract;
  evidence?: PiiBenignCollisionEvidence; validation?: PiiPopulationValidationOptions };
export interface PiiSupportBuildOptions {
  registry?: PiiSupportRegistry;
  populations?: readonly PopulationInput[];
  comparisons?: readonly PopulationComparisonInput[];
}
export interface PiiSupportMatrixV2 {
  schemaVersion: 2; reportType: 'pii-support-matrix'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-v1';
  domainAccountingVersion: 'pii-v1'; qualificationProfile: { id: 'pii-v1'; version: 1 }; registryCommitment: string;
  activationContract: typeof PII_ACTIVATION_CONTRACT & { productArtifact: 'not-measured' | 'trusted' };
  populationReports: { id: PiiPopulationId; status: 'measured' | 'partial' | 'not-measured'; contractCommitment: string;
    corpusCommitment: string; reportCommitment: string;
    familyEvidence: { family: string; status: 'measured' | 'partial' | 'not-measured' | 'not-applicable'; strata: number }[] }[];
  populationComparisons: Array<{ id: PiiPopulationId; status: 'not-measured' | 'compared'; contractCommitment: string; corpusCommitment: string;
    baselineObservation: { reportCommitment: string; candidateArtifactHash: string } | null;
    candidateObservation: { reportCommitment: string; candidateArtifactHash: string } | null;
    verdict: 'not-measured' | 'no-regression' | 'regression';
    benignFalseAlarmDeltas: Array<{ family: string; scope: string; contextClass: string; evidenceClass: string; accountingAxis: string | null;
      validatorBacked: boolean; contextDependent: boolean; baselineRate: number | null; candidateRate: number | null; delta: number | null; limit: number; regressed: boolean }>;
    diagnosticDeltas: Array<{ axis: string; applicable: boolean; baselineRate: number | null; candidateRate: number | null; delta: number | null;
      baselineFailed: number; candidateFailed: number; failedDelta: number; regressed: boolean }>;
  }>;
  distribution: Record<PiiSupportStatus, number>;
  families: Array<PiiSupportFamily & {
    activation: { state: 'not-measured' | 'available' | 'unavailable' | 'explicitly-unsupported'; selector: string; activationIdentity: string | null; productArtifactCommitment: string | null };
    status: { state: PiiSupportStatus; profile: { id: 'pii-v1'; version: 1 }; reasonCodes: string[] };
    populationEvidence: { id: PiiPopulationId; reportStatus: 'measured' | 'partial' | 'not-measured';
      status: 'measured' | 'partial' | 'not-measured' | 'not-applicable'; strata: number; reportCommitment: string }[];
    qualificationArtifactCommitment: string | null;
  }>;
  artifactCommitment: string;
}

const ajv = new Ajv({ strict: true });
const validateMatrixSchema = ajv.compile(matrixSchema), validateRegistrySchema = ajv.compile(registrySchema);
const exact = (value: unknown, keys: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const familyId = (value: unknown) => typeof value === 'string' && /^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
const selector = (family: string) => `pii:family:${family.slice('pii:'.length)}`;

function validateFamily(row: PiiSupportFamily) {
  const jurisdiction = row.scope === 'global' ? null : /^jurisdiction:([A-Z]{2})$/.exec(row.scope)?.[1] ?? null;
  if (!exact(row, ['family', 'displayName', 'identityDomain', 'familyContractVersion', 'scope', 'jurisdiction', 'qualificationProfile', 'authority', 'contextObligation', 'validatorApplicable']) ||
      !familyId(row.family) || !/^[A-Za-z0-9][A-Za-z0-9 ()/.+-]{0,79}$/.test(row.displayName) || !Number.isInteger(row.familyContractVersion) || row.familyContractVersion < 1 ||
      !['email', 'payment-card', 'network-address', 'iban', 'phone', 'national-id'].includes(row.identityDomain) ||
      (row.scope !== 'global' && (!jurisdiction || !isPiiJurisdiction(jurisdiction))) || row.jurisdiction !== jurisdiction ||
      row.family.split(':')[1] !== (jurisdiction?.toLowerCase() ?? 'global') || row.qualificationProfile?.id !== 'pii-v1' || row.qualificationProfile.version !== 1 ||
      !Array.isArray(row.authority) || row.authority.length === 0 || !['none', 'reinforcing', 'required-for-sensitive-classification'].includes(row.contextObligation) ||
      typeof row.validatorApplicable !== 'boolean') throw new Error('Invalid PII support family');
  row.authority.forEach(validatePiiAuthority);
}

const registryProjection = (registry: PiiSupportRegistry) => ({ schemaVersion: registry.schemaVersion, id: registry.id, version: registry.version,
  source: registry.source, families: registry.families });
export const piiSupportRegistryCommitment = (registry: PiiSupportRegistry) => hash(JSON.stringify(canonical(registryProjection(registry))));

export function validatePiiSupportRegistry(value: unknown): PiiSupportRegistry {
  if (!validateRegistrySchema(value)) throw new Error('Invalid PII support registry schema');
  const registry = structuredClone(value) as unknown as PiiSupportRegistry;
  if (registry.contentCommitment !== piiSupportRegistryCommitment(registry) || new Set(registry.families.map(row => row.family)).size !== registry.families.length)
    throw new Error('Invalid PII support registry commitment');
  registry.families.forEach(validateFamily);
  if (JSON.stringify(registry.families.map(row => row.family)) !== JSON.stringify([...registry.families.map(row => row.family)].sort()))
    throw new Error('PII support registry must be canonical');
  return registry;
}
export const piiSupportRegistry = Object.freeze(validatePiiSupportRegistry(registryData));

function defaultPopulations(): PopulationInput[] {
  return (['diagnostic-balanced', 'benign-heavy-stress'] as const).map(id => ({
    report: buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, [], id), rows: [],
  }));
}
function comparisonProjection(input: PopulationComparisonInput) {
  const contract = input.contract ?? piiPopulationContract, evidence = input.evidence ?? piiBenignCollisionEvidence;
  const comparison = comparePiiPopulationReports(input.baseline, input.candidate, {
    contract, evidence, baselineRows: input.baselineRows, candidateRows: input.candidateRows, options: input.validation,
  });
  const limit = input.baseline.regressionPolicy.maxAbsoluteIncrease;
  return { id: comparison.population, status: 'compared' as const, contractCommitment: comparison.contractCommitment,
    corpusCommitment: comparison.corpusCommitment,
    baselineObservation: { reportCommitment: comparison.baselineReportCommitment, candidateArtifactHash: comparison.baselineArtifactHash! },
    candidateObservation: { reportCommitment: comparison.candidateReportCommitment, candidateArtifactHash: comparison.candidateArtifactHash! },
    verdict: comparison.verdict as 'not-measured' | 'no-regression' | 'regression',
    benignFalseAlarmDeltas: comparison.deltas.map(({ baseline, candidate, ...row }) => ({ ...row,
      baselineRate: baseline, candidateRate: candidate, limit, regressed: row.delta !== null && row.delta > limit })),
    diagnosticDeltas: comparison.diagnosticDeltas.map(row => {
      const key = row.axis === 'type-identity' ? 'typeIdentity' : row.axis === 'validator-correctness' ? 'validatorCorrectness' : 'contextDiscrimination';
      const applicable = input.baseline.diagnostics[key].eligible > 0;
      const { baseline, candidate, ...delta } = row;
      return { ...delta, baselineRate: baseline, candidateRate: candidate,
        baselineFailed: input.baseline.diagnostics[key].failed, candidateFailed: input.candidate.diagnostics[key].failed, applicable,
        regressed: applicable && row.delta !== null && (row.delta < 0 || row.failedDelta > 0) };
    }),
  };
}
function familyPopulation(report: PiiPopulationReport, family: string) {
  const rows = report.strata.filter(row => row.family === family), applicable = rows.filter(row => row.status !== 'not-applicable');
  const status: 'measured' | 'partial' | 'not-measured' | 'not-applicable' = rows.length === 0 ? 'not-measured' : applicable.length === 0 ? 'not-applicable' :
    applicable.some(row => row.status === 'partial') || (applicable.some(row => row.status === 'measured') && applicable.some(row => row.status === 'not-measured')) ? 'partial' :
      applicable.every(row => row.status === 'measured') ? 'measured' : 'not-measured';
  return { id: report.population, reportStatus: report.status, status, strata: rows.length,
    reportCommitment: report.observation.reportArtifactCommitment };
}
function matrixProjection(matrix: PiiSupportMatrixV2) { const { artifactCommitment: _artifactCommitment, ...rest } = matrix; return rest; }
export const piiSupportMatrixV2Commitment = (matrix: PiiSupportMatrixV2) => hash(JSON.stringify(canonical(matrixProjection(matrix))));

function assemble(options: PiiSupportBuildOptions): PiiSupportMatrixV2 {
  // Product PR855 exposes no sanctioned activation/qualification artifact today. Deliberately accept no caller-authored
  // substitute: registry arrivals and measured populations remain pending until that product-owned boundary exists.
  const registry = validatePiiSupportRegistry(options.registry ?? piiSupportRegistry), inputs = options.populations ?? defaultPopulations();
  if (inputs.length !== 2 || new Set(inputs.map(row => row.report.population)).size !== 2) throw new Error('PII support requires both population reports');
  const reports = inputs.map(input => validatePiiPopulationReport(input.report, input.contract ?? piiPopulationContract,
    input.evidence ?? piiBenignCollisionEvidence, input.validation ?? {}, input.rows));
  const byPopulation = new Map(reports.map(row => [row.population, row]));
  const diagnostic = byPopulation.get('diagnostic-balanced'), stress = byPopulation.get('benign-heavy-stress');
  if (!diagnostic || !stress) throw new Error('Missing PII support population report');
  const observed = reports.filter(row => row.observation.kind === 'product-observation');
  if (observed.length && (observed.length !== 2 || observed.some(row => row.observation.candidateArtifactHash !== observed[0].observation.candidateArtifactHash ||
      row.observation.runId !== observed[0].observation.runId || JSON.stringify(row.observation.scanner) !== JSON.stringify(observed[0].observation.scanner))))
    throw new Error('PII support populations do not share one product observation identity');
  const populationReports = reports.sort((a, b) => a.population.localeCompare(b.population)).map(report => ({ id: report.population,
    status: report.status, contractCommitment: report.contractCommitment, corpusCommitment: report.corpusCommitment,
    reportCommitment: report.observation.reportArtifactCommitment,
    familyEvidence: registry.families.map(family => {
      const { id: _id, reportStatus: _reportStatus, reportCommitment: _reportCommitment, ...summary } = familyPopulation(report, family.family);
      return { family: family.family, ...summary };
    }) }));
  const populationComparisons = options.comparisons ? options.comparisons.map(comparisonProjection).sort((a, b) => a.id.localeCompare(b.id)) :
    reports.map(report => ({ id: report.population, status: 'not-measured' as const, contractCommitment: report.contractCommitment,
      corpusCommitment: report.corpusCommitment, baselineObservation: null, candidateObservation: null, verdict: 'not-measured' as const,
      benignFalseAlarmDeltas: [], diagnosticDeltas: [] })).sort((a, b) => a.id.localeCompare(b.id));
  if (populationComparisons.length !== 2 || new Set(populationComparisons.map(row => row.id)).size !== 2)
    throw new Error('PII support requires one comparison for each population');
  const families = registry.families.map(family => {
    const activationRow = { state: 'not-measured' as const, selector: selector(family.family),
      activationIdentity: null, productArtifactCommitment: null };
    const populationEvidence = reports.map(report => familyPopulation(report, family.family));
    const diagnosticStatus = familyPopulation(diagnostic, family.family).status, stressStatus = familyPopulation(stress, family.family).status;
    const reasonCodes = ['product-activation-not-measured'];
    if (diagnosticStatus !== 'measured') reasonCodes.push('diagnostic-population-not-measured');
    if (stressStatus !== 'measured') reasonCodes.push('benign-heavy-stress-not-measured');
    return { ...family, activation: activationRow, status: { state: 'pending' as const, profile: { id: 'pii-v1' as const, version: 1 as const },
      reasonCodes: [...new Set(reasonCodes)].sort() }, populationEvidence, qualificationArtifactCommitment: null };
  });
  const distribution = Object.fromEntries(['pending', 'provisional', 'stable', 'unsupported'].map(status =>
    [status, families.filter(row => row.status.state === status).length])) as Record<PiiSupportStatus, number>;
  const matrix: PiiSupportMatrixV2 = { schemaVersion: 2, reportType: 'pii-support-matrix', supportClaims: false, domain: 'pii',
    evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1', qualificationProfile: { id: 'pii-v1', version: 1 },
    registryCommitment: registry.contentCommitment, activationContract: { ...PII_ACTIVATION_CONTRACT, productArtifact: 'not-measured' },
    populationReports, populationComparisons, distribution, families, artifactCommitment: '0'.repeat(64) };
  matrix.artifactCommitment = piiSupportMatrixV2Commitment(matrix);
  return matrix;
}

export function buildPiiSupportMatrixV2(options: PiiSupportBuildOptions = {}): PiiSupportMatrixV2 {
  const matrix = assemble(options); return validatePiiSupportMatrixV2(matrix, options);
}

export function validatePiiSupportMatrixV2(value: unknown, bindings?: PiiSupportBuildOptions): PiiSupportMatrixV2 {
  if (!validateMatrixSchema(value)) throw new Error('Invalid PII support-matrix v2 schema');
  const matrix = structuredClone(value) as unknown as PiiSupportMatrixV2;
  const registry: PiiSupportRegistry = { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, contentCommitment: matrix.registryCommitment,
    source: { repository: 'redact-secret/redact-secret', decision: REGISTRY_DECISION, mergeCommit: PII_ACTIVATION_CONTRACT.mergeCommit },
    families: matrix.families.map(({ activation: _activation, status: _status, populationEvidence: _populationEvidence,
      qualificationArtifactCommitment: _qualificationArtifactCommitment, ...family }) => family) };
  if (matrix.artifactCommitment !== piiSupportMatrixV2Commitment(matrix) || piiSupportRegistryCommitment(registry) !== matrix.registryCommitment ||
      new Set(matrix.families.map(row => row.family)).size !== matrix.families.length ||
      Object.entries(matrix.distribution).some(([status, count]) => matrix.families.filter(row => row.status.state === status).length !== count) ||
      matrix.families.some(row => row.activation.selector !== selector(row.family) || row.status.profile.id !== 'pii-v1' || row.status.profile.version !== 1) ||
      /RAW-CANARY|SYNTHETIC-PERSON-ID|"(?:content|candidate|seed|fixture|path|raw|caseId|variant)"/i.test(JSON.stringify(matrix)))
    throw new Error('Inconsistent or unsafe PII support-matrix v2');
  const hasPopulationClaim = matrix.populationReports.some(row => row.status === 'measured' || row.status === 'partial') ||
    matrix.families.some(row => row.populationEvidence.some(entry => entry.status === 'measured' || entry.status === 'partial'));
  const publicComparisonBinding = matrix.populationComparisons.every(comparison => comparison.status === 'compared' && comparison.candidateObservation &&
    matrix.populationReports.some(report => report.id === comparison.id && report.reportCommitment === comparison.candidateObservation!.reportCommitment));
  if (hasPopulationClaim && !bindings && !publicComparisonBinding) throw new Error('PII population claims require bound source reports and accounting rows');
  if (JSON.stringify(piiSupportRegistryProjection(matrix)) !== JSON.stringify(registryProjection(registry)) ||
      piiSupportSemanticProblem(matrix, { allowBoundPopulationEvidence: Boolean(bindings) || publicComparisonBinding }))
    throw new Error('Inconsistent PII support-matrix v2 semantics');
  validatePiiSupportRegistry(registry);
  const hasClaim = matrix.families.some(row => row.status.state !== 'pending');
  if (hasClaim && !bindings) throw new Error('PII support claims require bound trusted inputs');
  if (bindings && JSON.stringify(matrix) !== JSON.stringify(assemble(bindings))) throw new Error('PII support-matrix v2 does not reconcile with bound inputs');
  if (!bindings) {
    const canonicalEmpty = assemble({ registry });
    const withoutComparisons = (candidate: PiiSupportMatrixV2) => {
      const { populationComparisons: _comparisons, artifactCommitment: _commitment, ...rest } = candidate; return rest;
    };
    if (!publicComparisonBinding && JSON.stringify(matrix) !== JSON.stringify(canonicalEmpty))
      throw new Error('Unbound PII support matrix is not the exact canonical empty projection');
    if (publicComparisonBinding && JSON.stringify(withoutComparisons(matrix)) !== JSON.stringify(withoutComparisons(canonicalEmpty))) {
      const emptyWithoutPopulationEvidence = withoutComparisons(canonicalEmpty);
      const publicWithoutPopulationEvidence = withoutComparisons(matrix);
      if (JSON.stringify({ ...publicWithoutPopulationEvidence, populationReports: emptyWithoutPopulationEvidence.populationReports,
        families: emptyWithoutPopulationEvidence.families }) !== JSON.stringify(emptyWithoutPopulationEvidence))
        throw new Error('Public PII support comparison changes fields outside bound population evidence');
    }
  }
  return matrix;
}
