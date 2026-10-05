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
import { PII_SUPPORT_REGISTRY_SOURCE, piiProtectedRouteProblem, piiProtectedRouteReasonCodes, piiReviewedProtectedRoute, piiSupportRegistryProjection,
  piiSupportSemanticProblem, type PiiProtectedRoute } from './support-semantics.ts';
import { validatePiiProductBinding, type PiiTrustedProductBinding } from './product-binding.ts';

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
export type PiiEvalViewId = 'oracle-plan' | 'qualification-plan' | 'diagnostic-balanced' | 'benign-heavy-stress';
export type PiiEvalMode = 'official' | 'exploratory';
export interface PiiEvalProjectionCounts { authoredCases: number; occurrences: number; variants: number }
export interface PiiEvalProjectionStratum<K extends string> { counts: PiiEvalProjectionCounts; metrics: unknown[] }
/** The schema 1.2 product projection of one population artifact, exactly as the strict consumer validated it. */
export interface PiiEvalProjection {
  requiredViews: PiiEvalViewId[]; rosterDigest: string;
  rows: Array<{
    family: string; view: PiiEvalViewId; mode: PiiEvalMode; counts: PiiEvalProjectionCounts;
    binding: { scannerId: string; configurationDigest: string; activationDigest: string; product: Record<string, unknown>;
      population: { populationId: string; populationVersion: number; populationDigest: string; visibility: 'public-synthetic' } };
    methodCoverage: Array<{ method: { id: string; version: number }; cases: number; variants: number }>;
    metrics: unknown[];
    byLanguage?: Array<PiiEvalProjectionStratum<'language'> & { language: string }>;
    byControlClass?: Array<PiiEvalProjectionStratum<'controlClass'> & { controlClass: string }>;
  }>;
}
export interface PiiEvalMeasurement {
  schema: 'pii-eval-consumer-report/1'; complete: true; decision: 'none'; pooling: 'none'; rejections: [];
  build: { repository: 'redact-secret/pii-eval'; commit: string; cargoLockSha256: string; binarySha256: string;
    sourceArchiveSha256: string; binding: 'out-of-band-build-provenance' };
  populations: Array<{ label: string; populationId: string; artifactDigest: string; file: string; status: 'accepted';
    /** The public artifact schema this population was read under. 1.1 cannot carry a projection; 1.2 carries it in `productProjection`. */
    schemaVersion: '1.1' | '1.2';
    population: { populationId: string; populationVersion: number; populationDigest: string; visibility: 'public-synthetic' };
    populationCounts: { authoredCases: number; variants: number; occurrences: number };
    /** How the measured scanner relates to the product this publication measured. A candidate is never a release. */
    productBinding: { state: 'measures-publication-product' | 'other-product' | 'publication-product-not-measured'; candidateSourceCommit: string | null };
    scanners: Array<{ scannerId: string; status: 'complete'; identity: Record<string, unknown>; metrics: unknown[] }>;
    productProjection?: PiiEvalProjection;
    unavailable?: { familyProjection: 'schema-1.1-does-not-carry'; populationViews: 'schema-1.1-does-not-carry';
      languageBreakdown: 'schema-1.1-does-not-carry'; controlClassBreakdown: 'schema-1.1-does-not-carry';
      officialOrExploratoryMode: 'schema-1.1-does-not-carry' } }>;
}
export interface CustodianConformance {
  schema: 'redact-secret-benchmarks.custodian-conformance/1'; syntheticConformance: true; supportClaims: false;
  source: { repository: 'redact-secret/private-custodian'; commit: string }; bundleSha256: string;
  candidateDigest: string; configurationDigest: string; configurationBinding: 'bridge-request-only-not-signed-projection'; destination: string;
  feed: { feedId: string; sequence: number; freshUntil: number };
  projections: Array<{ digest: string; projectionId: string; receiptId: string; population: Record<string, unknown>;
    policy: Record<string, unknown>; standing: 'valid'; destinationBinding: 'destination-bound'; attestation: Record<string, unknown>;
    cells: Array<{ metric: string; stratum: string; value: { state: 'suppressed' } | { state: 'reported'; numerator: number; denominator: number } }> }>;
  qualification: 'not-live-support-evidence'; reason: 'synthetic-signature-conformance-is-not-independent-ground-truth';
}
export interface PiiSupportBuildOptions {
  registry?: PiiSupportRegistry;
  populations?: readonly PopulationInput[];
  comparisons?: readonly PopulationComparisonInput[];
  product?: PiiTrustedProductBinding;
  /** A reviewed v2 protected-disposition entry, already re-derived from committed evidence by `bindPiiProtectedSupport`. */
  protectedRoute?: PiiProtectedRoute;
  /** Strictly validated scanner-neutral evidence. It cannot change a family verdict while schema 1.1 lacks family projections. */
  piiEvalMeasurement?: PiiEvalMeasurement;
  /** Synthetic signature/revocation conformance only. It is never live protected support evidence. */
  custodianConformance?: CustodianConformance;
}
export interface PiiSupportMatrixV2 {
  schemaVersion: 2; reportType: 'pii-support-matrix'; supportClaims: false; domain: 'pii'; evaluationProfile: 'pii-v1';
  domainAccountingVersion: 'pii-v1'; qualificationProfile: { id: 'pii-v1'; version: 1 }; registryCommitment: string;
  activationContract: typeof PII_ACTIVATION_CONTRACT & { productArtifact: 'not-measured' | 'trusted'; productSourceCommit: string | null;
    productArtifactCommitment: string | null; candidateEvidenceCommitment: string | null; activationArtifactCommitment: string | null };
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
  piiEvalMeasurement?: PiiEvalMeasurement;
  custodianConformance?: CustodianConformance;
  protectedRoute?: PiiProtectedRoute;
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
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const PII_EVAL_METRICS = [
  'benign-suppression-rate', 'context-discrimination-rate', 'jurisdiction-collision-rate', 'measurable-share',
  'non-sensitive-flag-rate', 'range-collateral-rate', 'sensitive-miss-rate', 'type-miss-rate',
  'wrong-family-rate', 'wrong-jurisdiction-rate',
] as const;

function validPiiEvalIdentity(value: Record<string, unknown>, scannerId: string) {
  if (!exact(value, ['activationDigest', 'adapter', 'artifactDigest', 'configurationDigest', 'product', 'scannerId', 'scannerVersion']) ||
      value.scannerId !== scannerId || !digest(value.activationDigest) || !digest(value.artifactDigest) || !digest(value.configurationDigest) ||
      typeof value.scannerVersion !== 'string' || !value.scannerVersion || !exact(value.adapter, ['adapterId', 'adapterVersion', 'normalizationVersion'])) return false;
  const adapter = value.adapter as Record<string, unknown>;
  if (typeof adapter.adapterId !== 'string' || typeof adapter.adapterVersion !== 'string' ||
      !Number.isInteger(adapter.normalizationVersion) || (adapter.normalizationVersion as number) < 0) return false;
  const product = value.product as Record<string, unknown>;
  return exact(product, ['kind']) && product.kind === 'released' ||
    exact(product, ['candidateDigest', 'kind']) && product.kind === 'candidate' && digest(product.candidateDigest) && product.candidateDigest === value.artifactDigest;
}

function validScaledDecimal(value: unknown) {
  if (!exact(value, ['mantissa', 'scale'])) return false;
  const decimal = value as Record<string, unknown>;
  return Number.isSafeInteger(decimal.mantissa) && (decimal.mantissa as number) >= 0 &&
    Number.isSafeInteger(decimal.scale) && (decimal.scale as number) >= 0 && (decimal.scale as number) <= 18 &&
    (decimal.mantissa as number) <= 10 ** (decimal.scale as number);
}

function validPiiEvalMetric(value: unknown) {
  if (!exact(value, ['counts', 'effectiveN', 'metric', 'status', 'value'])) return false;
  const row = value as Record<string, unknown>, metric = row.metric as Record<string, unknown>, counts = row.counts as Record<string, unknown>;
  const countFields = ['eligible', 'measured', 'notApplicable', 'notMeasured', 'numerator', 'total', 'unresolved'];
  if (!exact(metric, ['id', 'version']) || !PII_EVAL_METRICS.includes(metric.id as typeof PII_EVAL_METRICS[number]) || metric.version !== 1 ||
      !exact(counts, countFields) || countFields.some(field => !Number.isSafeInteger(counts[field]) || (counts[field] as number) < 0) ||
      !Number.isSafeInteger(row.effectiveN) || (row.effectiveN as number) < 0 ||
      !['measured', 'partial', 'unresolved', 'not-measured', 'not-applicable'].includes(row.status as string) ||
      counts.total !== (counts.eligible as number) + (counts.notApplicable as number) ||
      counts.eligible !== (counts.measured as number) + (counts.unresolved as number) + (counts.notMeasured as number) ||
      (counts.numerator as number) > (counts.measured as number)) return false;
  const result = row.value as Record<string, unknown>;
  return exact(result, ['bound', 'point', 'state']) && result.state === 'measured' && validScaledDecimal(result.point) && validScaledDecimal(result.bound) ||
    exact(result, ['reason', 'state']) && result.state === 'withheld' &&
      ['zero-denominator', 'insufficient-evidence'].includes(result.reason as string);
}

const PII_EVAL_VIEWS: readonly string[] = ['benign-heavy-stress', 'diagnostic-balanced', 'oracle-plan', 'qualification-plan'];
const PII_EVAL_MODES: readonly string[] = ['exploratory', 'official'];
const COUNT_FIELDS = ['authoredCases', 'occurrences', 'variants'] as const;
const validCounts = (value: unknown): value is PiiEvalProjectionCounts => exact(value, [...COUNT_FIELDS]) &&
  COUNT_FIELDS.every(field => Number.isSafeInteger((value as Record<string, unknown>)[field]) && (value as Record<string, number>)[field] >= 0) &&
  (value as PiiEvalProjectionCounts).variants >= (value as PiiEvalProjectionCounts).authoredCases &&
  (value as PiiEvalProjectionCounts).occurrences >= (value as PiiEvalProjectionCounts).variants;
/** Every metric of a cell is one of the ten, and none counts more samples than the cell holds (one per case, two assertions for measurable-share). */
const validCellMetrics = (metrics: unknown, cases: number) => Array.isArray(metrics) && metrics.length === 10 &&
  new Set(metrics.map(metric => (metric as { metric?: { id?: string } })?.metric?.id)).size === 10 && metrics.every(metric => validPiiEvalMetric(metric) &&
    (metric as { counts: { total: number } }).counts.total <= cases * ((metric as { metric: { id: string } }).metric.id === 'measurable-share' ? 2 : 1));

/**
 * The strict consumer already refuses duplicate family/view rows, absent required views, pooled denominators, unknown modes
 * and views and rows bound to another artifact. A published matrix is read again by the site without that consumer, so the same
 * rules hold here: a hand-edited or stale matrix cannot show a projection the consumer would have refused.
 */
function bad(): never { throw new Error('Invalid pii-eval product projection'); }
function validatePiiEvalProjection(population: PiiEvalMeasurement['populations'][number]) {
  const block = population.productProjection;
  if (!block || !exact(block, ['requiredViews', 'rosterDigest', 'rows']) || !digest(block.rosterDigest) || !Array.isArray(block.requiredViews) ||
      !block.requiredViews.length || block.requiredViews.some((view, index) => !PII_EVAL_VIEWS.includes(view) || index > 0 && !(block.requiredViews[index - 1] < view)) ||
      !Array.isArray(block.rows) || !block.rows.length) bad();
  const seen = new Set<string>(), sums = new Map<string, PiiEvalProjectionCounts>();
  let previous = '';
  const modes = new Set<string>();
  for (const row of block.rows) {
    if (!exact(row, ['binding', 'counts', 'family', 'methodCoverage', 'metrics', 'mode', 'view'].concat(
          row && 'byControlClass' in row ? ['byControlClass'] : [], row && 'byLanguage' in row ? ['byLanguage'] : [])) ||
        !PII_EVAL_MODES.includes(row.mode) || !PII_EVAL_VIEWS.includes(row.view) || !block.requiredViews.includes(row.view) || !familyId(row.family) ||
        !validCounts(row.counts) || !exact(row.binding, ['activationDigest', 'configurationDigest', 'population', 'product', 'scannerId']) ||
        !Array.isArray(row.methodCoverage) || row.methodCoverage.some(item => !exact(item, ['cases', 'method', 'variants']) || !Number.isSafeInteger(item.cases) ||
          !Number.isSafeInteger(item.variants) || !exact(item.method, ['id', 'version']))) bad();
    modes.add(row.mode);
    const key = `${row.binding.scannerId}\0${row.view}\0${row.family}`;
    // Rows are ascending by (scanner, view, family) with every key once: duplicates cannot hide as an ordering accident.
    if (seen.has(key) || key < previous) bad();
    seen.add(key); previous = key;
    const scanner = population.scanners.find(item => item.scannerId === row.binding.scannerId);
    if (!scanner || row.binding.configurationDigest !== scanner.identity.configurationDigest || row.binding.activationDigest !== scanner.identity.activationDigest ||
        JSON.stringify(canonical(row.binding.product)) !== JSON.stringify(canonical(scanner.identity.product)) ||
        JSON.stringify(canonical(row.binding.population)) !== JSON.stringify(canonical(population.population))) bad();
    if (row.methodCoverage.reduce((n, item) => n + item.cases, 0) !== row.counts.authoredCases || row.methodCoverage.reduce((n, item) => n + item.variants, 0) !== row.counts.variants ||
        !validCellMetrics(row.metrics, row.counts.authoredCases)) bad();
    for (const [name, partition] of [['byLanguage', true], ['byControlClass', false]] as const) {
      const strata = row[name] as Array<PiiEvalProjectionStratum<string>> | undefined;
      if (strata === undefined) continue;
      if (!Array.isArray(strata) || !strata.length || strata.some(item => !validCounts(item.counts) || !validCellMetrics(item.metrics, item.counts.authoredCases))) bad();
      const total = (field: typeof COUNT_FIELDS[number]) => strata.reduce((n, item) => n + item.counts[field], 0);
      if (COUNT_FIELDS.some(field => total(field) > row.counts[field]) || partition && COUNT_FIELDS.some(field => total(field) !== row.counts[field])) bad();
    }
    const sum = sums.get(row.binding.scannerId) ?? { authoredCases: 0, occurrences: 0, variants: 0 };
    for (const field of COUNT_FIELDS) sum[field] += row.counts[field];
    sums.set(row.binding.scannerId, sum);
  }
  // One mode for the artifact; every required view has rows for every scanner; the rows add up to the population exactly, never beyond it.
  if (modes.size !== 1) bad();
  for (const scanner of population.scanners) {
    for (const view of block.requiredViews) if (!block.rows.some(row => row.binding.scannerId === scanner.scannerId && row.view === view)) bad();
    const sum = sums.get(scanner.scannerId);
    if (!sum || COUNT_FIELDS.some(field => sum[field] !== population.populationCounts[field])) bad();
  }
}

function validatePiiEvalMeasurement(value: PiiEvalMeasurement): PiiEvalMeasurement {
  const unavailable = 'schema-1.1-does-not-carry';
  if (value.schema !== 'pii-eval-consumer-report/1' || value.complete !== true || value.decision !== 'none' || value.pooling !== 'none' ||
      value.rejections.length !== 0 || value.build.repository !== 'redact-secret/pii-eval' || !/^[a-f0-9]{40}$/.test(value.build.commit) ||
      ![value.build.cargoLockSha256, value.build.binarySha256, value.build.sourceArchiveSha256].every(digest) ||
      value.build.binding !== 'out-of-band-build-provenance' || !value.populations.length ||
      new Set(value.populations.map(row => row.populationId)).size !== value.populations.length || value.populations.some(row =>
        row.status !== 'accepted' || row.populationId !== row.population.populationId || row.population.visibility !== 'public-synthetic' ||
        !['1.1', '1.2'].includes(row.schemaVersion) ||
        !['measures-publication-product', 'other-product', 'publication-product-not-measured'].includes(row.productBinding?.state) ||
        !(row.productBinding.candidateSourceCommit === null || /^[a-f0-9]{40}$/.test(row.productBinding.candidateSourceCommit)) ||
        !digest(row.artifactDigest) || !Number.isInteger(row.population.populationVersion) || !digest(row.population.populationDigest) ||
        Object.values(row.populationCounts).some(count => !Number.isInteger(count) || count < 0) || !row.scanners.length ||
        row.scanners.some(scanner => scanner.status !== 'complete' || !validPiiEvalIdentity(scanner.identity, scanner.scannerId) ||
          scanner.metrics.length !== 10 || new Set(scanner.metrics.map(metric => (metric as { metric?: { id?: string } }).metric?.id)).size !== 10 ||
          scanner.metrics.some(metric => !validPiiEvalMetric(metric))) ||
        // Exactly one of the two: a 1.1 artifact states what it cannot carry, a 1.2 artifact carries it.
        (row.schemaVersion === '1.1'
          ? row.productProjection !== undefined || !row.unavailable || Object.values(row.unavailable).some(state => state !== unavailable) || Object.keys(row.unavailable).length !== 5
          : row.unavailable !== undefined || row.productProjection === undefined))) throw new Error('Invalid pii-eval measurement evidence');
  for (const row of value.populations) if (row.schemaVersion === '1.2') validatePiiEvalProjection(row);
  return structuredClone(value);
}

function validateCustodianConformance(value: CustodianConformance): CustodianConformance {
  if (value.schema !== 'redact-secret-benchmarks.custodian-conformance/1' || value.syntheticConformance !== true || value.supportClaims !== false ||
      value.source.repository !== 'redact-secret/private-custodian' || !/^[a-f0-9]{40}$/.test(value.source.commit) || !digest(value.bundleSha256) ||
      !/^sha256:[a-f0-9]{64}$/.test(value.candidateDigest) || !/^sha256:[a-f0-9]{64}$/.test(value.configurationDigest) ||
      value.configurationBinding !== 'bridge-request-only-not-signed-projection' || !value.projections.length ||
      value.qualification !== 'not-live-support-evidence' || value.reason !== 'synthetic-signature-conformance-is-not-independent-ground-truth' ||
      value.projections.some(projection => projection.standing !== 'valid' || projection.destinationBinding !== 'destination-bound' ||
        projection.attestation.ground_truth !== 'not_established' || projection.attestation.organisational_independence !== 'not_claimed' ||
        projection.cells.some(cell => cell.value.state === 'reported' &&
          (!Number.isSafeInteger(cell.value.numerator) || !Number.isSafeInteger(cell.value.denominator) || cell.value.numerator < 0 ||
            cell.value.denominator < 0 || cell.value.numerator > cell.value.denominator)))) throw new Error('Invalid custodian conformance evidence');
  return structuredClone(value);
}

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
  const registry = validatePiiSupportRegistry(options.registry ?? piiSupportRegistry), boundPopulations = options.populations !== undefined,
    inputs = options.populations ?? defaultPopulations();
  const product = options.product ? validatePiiProductBinding(options.product, registry.families.map(row => row.family)) : null;
  const route = options.protectedRoute ? structuredClone(options.protectedRoute) : null;
  const piiEvalMeasurement = options.piiEvalMeasurement ? validatePiiEvalMeasurement(options.piiEvalMeasurement) : null;
  const custodianConformance = options.custodianConformance ? validateCustodianConformance(options.custodianConformance) : null;
  if (route) {
    const reviewed = piiReviewedProtectedRoute(route.id);
    if (!reviewed || JSON.stringify(canonical(reviewed)) !== JSON.stringify(canonical(route))) throw new Error('PII protected route is not a reviewed binding');
    const problem = piiProtectedRouteProblem(route, registry.families);
    if (problem) throw new Error(problem);
    if (product) throw new Error('PII v1 product record and v2 protected route cannot bind one matrix');
  }
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
      if (!boundPopulations) return { family: family.family, status: 'not-measured' as const, strata: 0 };
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
    const available = product?.availableFamilies.includes(family.family) ?? false;
    const activationRow = product ? { state: available ? 'available' as const : 'unavailable' as const, selector: selector(family.family),
      activationIdentity: product.activationIdentity, productArtifactCommitment: product.artifactCommitment } :
      { state: 'not-measured' as const, selector: selector(family.family), activationIdentity: null, productArtifactCommitment: null };
    const populationEvidence = reports.map(report => boundPopulations ? familyPopulation(report, family.family) :
      ({ id: report.population, reportStatus: report.status, status: 'not-measured' as const, strata: 0,
        reportCommitment: report.observation.reportArtifactCommitment }));
    const diagnosticStatus = populationEvidence.find(row => row.id === 'diagnostic-balanced')!.status,
      stressStatus = populationEvidence.find(row => row.id === 'benign-heavy-stress')!.status;
    const qualification = product?.qualification.find(row => row.family === family.family);
    const comparisons = new Map(populationComparisons.map(row => [row.id, row.verdict]));
    const reasonCodes: string[] = [];
    if (!product) reasonCodes.push('product-activation-not-measured');
    else if (!available) reasonCodes.push('product-family-unavailable');
    if (diagnosticStatus !== 'measured') reasonCodes.push('diagnostic-population-not-measured');
    if (stressStatus !== 'measured') reasonCodes.push('benign-heavy-stress-not-measured');
    if (comparisons.get('diagnostic-balanced') !== 'no-regression' || comparisons.get('benign-heavy-stress') !== 'no-regression')
      reasonCodes.push('population-comparison-not-qualified');
    if (!qualification) reasonCodes.push('qualification-not-measured');
    else if (qualification.status !== 'qualified') reasonCodes.push(...qualification.reasonCodes);
    const qualified = available && diagnosticStatus === 'measured' && stressStatus === 'measured' && qualification?.status === 'qualified' &&
      comparisons.get('diagnostic-balanced') === 'no-regression' && comparisons.get('benign-heavy-stress') === 'no-regression';
    const routed = route?.families.find(row => row.family === family.family) ?? null;
    const state: 'pending' | 'provisional' = routed ? routed.status : qualified ? 'provisional' : 'pending';
    return { ...family, activation: activationRow, status: { state,
      profile: { id: 'pii-v1' as const, version: 1 as const }, reasonCodes: routed ? piiProtectedRouteReasonCodes(routed) : [...new Set(reasonCodes)].sort() }, populationEvidence,
      qualificationArtifactCommitment: qualification?.artifactCommitment ?? null };
  });
  const distribution = Object.fromEntries(['pending', 'provisional', 'stable', 'unsupported'].map(status =>
    [status, families.filter(row => row.status.state === status).length])) as Record<PiiSupportStatus, number>;
  const matrix: PiiSupportMatrixV2 = { schemaVersion: 2, reportType: 'pii-support-matrix', supportClaims: false, domain: 'pii',
    evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-v1', qualificationProfile: { id: 'pii-v1', version: 1 },
    registryCommitment: registry.contentCommitment, activationContract: { ...PII_ACTIVATION_CONTRACT, productArtifact: product ? 'trusted' : 'not-measured',
      productSourceCommit: product?.sourceCommit ?? null, productArtifactCommitment: product?.artifactCommitment ?? null,
      candidateEvidenceCommitment: product?.candidateEvidenceCommitment ?? null, activationArtifactCommitment: product?.activationArtifactCommitment ?? null },
    populationReports, populationComparisons, distribution, ...(route ? { protectedRoute: route } : {}),
    ...(piiEvalMeasurement ? { piiEvalMeasurement } : {}), ...(custodianConformance ? { custodianConformance } : {}),
    families, artifactCommitment: '0'.repeat(64) };
  matrix.artifactCommitment = piiSupportMatrixV2Commitment(matrix);
  return matrix;
}

export function buildPiiSupportMatrixV2(options: PiiSupportBuildOptions = {}): PiiSupportMatrixV2 {
  const matrix = assemble(options); return validatePiiSupportMatrixV2(matrix, options);
}

export function validatePiiSupportMatrixV2(value: unknown, bindings?: PiiSupportBuildOptions): PiiSupportMatrixV2 {
  if (!validateMatrixSchema(value)) throw new Error(`Invalid PII support-matrix v2 schema: ${JSON.stringify(validateMatrixSchema.errors)}`);
  const matrix = structuredClone(value) as unknown as PiiSupportMatrixV2;
  const registry: PiiSupportRegistry = { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, contentCommitment: matrix.registryCommitment,
    source: { repository: 'redact-secret/redact-secret', decision: REGISTRY_DECISION, mergeCommit: PII_ACTIVATION_CONTRACT.mergeCommit },
    families: matrix.families.map(({ activation: _activation, status: _status, populationEvidence: _populationEvidence,
      qualificationArtifactCommitment: _qualificationArtifactCommitment, ...family }) => family) };
  if (matrix.artifactCommitment !== piiSupportMatrixV2Commitment(matrix) || piiSupportRegistryCommitment(registry) !== matrix.registryCommitment ||
      new Set(matrix.families.map(row => row.family)).size !== matrix.families.length ||
      Object.entries(matrix.distribution).some(([status, count]) => matrix.families.filter(row => row.status.state === status).length !== count) ||
      matrix.families.some(row => row.activation.selector !== selector(row.family) || row.status.profile.id !== 'pii-v1' || row.status.profile.version !== 1) ||
      /RAW-CANARY|SYNTHETIC-PERSON-ID|"(?:content|candidate|seed|fixture|path|raw|caseId|variant)"\s*:/i.test(JSON.stringify(matrix)))
    throw new Error('Inconsistent or unsafe PII support-matrix v2');
  if (matrix.piiEvalMeasurement) validatePiiEvalMeasurement(matrix.piiEvalMeasurement);
  if (matrix.custodianConformance) validateCustodianConformance(matrix.custodianConformance);
  const hasPopulationClaim = matrix.populationReports.some(row => row.status === 'measured' || row.status === 'partial') ||
    matrix.families.some(row => row.populationEvidence.some(entry => entry.status === 'measured' || entry.status === 'partial'));
  const publicComparisonBinding = matrix.populationComparisons.every(comparison => comparison.status === 'compared' && comparison.candidateObservation &&
    matrix.populationReports.some(report => report.id === comparison.id && report.reportCommitment === comparison.candidateObservation!.reportCommitment));
  if (hasPopulationClaim && !bindings && !publicComparisonBinding) throw new Error('PII population claims require bound source reports and accounting rows');
  if (JSON.stringify(piiSupportRegistryProjection(matrix)) !== JSON.stringify(registryProjection(registry)) ||
      piiSupportSemanticProblem(matrix, { allowBoundPopulationEvidence: Boolean(bindings) || publicComparisonBinding }))
    throw new Error('Inconsistent PII support-matrix v2 semantics');
  validatePiiSupportRegistry(registry);
  if (bindings && JSON.stringify(matrix) !== JSON.stringify(assemble(bindings))) throw new Error('PII support-matrix v2 does not reconcile with bound inputs');
  if (!bindings) {
    // A reviewed protected route is part of the canonical projection; an unknown one is refused before comparison.
    const routeValue = (matrix as { protectedRoute?: unknown }).protectedRoute;
    const reviewedRoute = routeValue === undefined ? undefined : piiReviewedProtectedRoute((routeValue as { id?: unknown })?.id);
    if (reviewedRoute === null) throw new Error('PII protected route is not a reviewed binding');
    const canonicalEmpty = assemble({ registry, ...(reviewedRoute ? { protectedRoute: reviewedRoute } : {}),
      ...(matrix.piiEvalMeasurement ? { piiEvalMeasurement: matrix.piiEvalMeasurement } : {}),
      ...(matrix.custodianConformance ? { custodianConformance: matrix.custodianConformance } : {}) });
    const withoutComparisons = (candidate: PiiSupportMatrixV2) => {
      const { populationComparisons: _comparisons, artifactCommitment: _commitment, ...rest } = candidate; return rest;
    };
    if (!publicComparisonBinding && matrix.activationContract.productArtifact === 'not-measured' && JSON.stringify(matrix) !== JSON.stringify(canonicalEmpty))
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
