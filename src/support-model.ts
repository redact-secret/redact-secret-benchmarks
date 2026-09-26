import Ajv from 'ajv';
import schema from '../schemas/support-matrix-v1.json';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';
import type { SupportMatrixEntry } from '../benchmarks/support/matrix.ts';
import { statusCriteria, type SupportStatus } from '../benchmarks/support/status.ts';
import { fixtureProfiles } from '../benchmarks/support/profiles.ts';

/** An empirical entry's basis must be one its recorded evidence can carry, never an asserted label. */
function empiricalBasisHolds(entry: SupportMatrixEntry): boolean {
  const e = entry.empiricalEvidence, s = statusCriteria.stable.empirical;
  if (!e || e.contradictions > s.unresolvedContradictions.value) return false;
  if (entry.evidenceBasis === 'empirically-observed') return e.observations >= s.minimumObservations.value && e.subjects >= s.minimumSubjects.value && e.issuanceDates >= s.minimumIssuanceDates.value;
  if (entry.evidenceBasis === 'independently-corroborated') return e.corroborationReferences >= s.corroborated.minimumReferences.value && e.corroborationOwners >= s.corroborated.minimumOwners.value;
  return false;
}

/**
 * The UI's read side of the generated support matrix (issue #50, A9; the
 * artifact is #509/A8, `docs/specs/support-matrix.md`). Nothing here decides a
 * status: `support-matrix.json` carries one per provider x credential family,
 * and this module only re-validates it before a page may render it.
 */
const ajv = new Ajv({ strict: true });
const validMatrix = ajv.compile(schema);

/** The published matrix, exactly as `benchmarks/generate-support-matrix.ts` writes it. */
export interface SupportMatrixFile {
  schemaVersion: 1;
  taxonomySchemaVersion: 1;
  sourceReport: {
    schemaVersion: 1; generatedAt: string; runId: string; revision: string; dirty: boolean | null; criteriaSchemaVersion: 1;
    /** The redact-secret candidate build measured; absent means the published package. */
    product?: { sourceCommit: string; packageName: string; declaredVersion: string; artifacts: { role: string; sha256: string }[] };
    /** Published mode: the released package the run loaded (absent in matrices generated before #213). */
    publishedPackage?: { packageName: string; version: string };
    scannerObservations: Record<string, { source: 'fresh' | 'snapshot'; observedAt: string; sourceRunId: string; snapshotDigest?: string; inputDigest?: string }>;
  };
  providerCount: number;
  familyCount: number;
  distribution: Record<SupportStatus, number>;
  stableDistribution: { documented: number; empirical: number };
  families: SupportMatrixEntry[];
}

/**
 * The only support vocabulary the UI may render, taken from the artifact's own
 * schema. A status the matrix cannot carry has nowhere to come from.
 */
export const SUPPORT_STATUSES = schema.properties.families.items.properties.status.enum as SupportStatus[];

/** The statuses one published matrix actually reports on, in schema order. */
export const statusesOf = (matrix: SupportMatrixFile): SupportStatus[] =>
  SUPPORT_STATUSES.filter(status => Object.hasOwn(matrix.distribution, status));

export function countStatuses(families: SupportMatrixEntry[]): Record<SupportStatus, number> {
  const counts = Object.fromEntries(SUPPORT_STATUSES.map(status => [status, 0])) as Record<SupportStatus, number>;
  for (const entry of families) counts[entry.status]++;
  return counts;
}

/**
 * Reject an incompatible, malformed or stale matrix before rendering it. The
 * published distribution is never trusted: it is recounted from the families,
 * and every family is checked back against the checked-in taxonomy, so a
 * matrix generated before a taxonomy change reads as stale rather than as a
 * silently wrong status.
 */
export function supportMatrixProblem(value: unknown): string | null {
  try {
    const matrix = value as SupportMatrixFile;
    if (matrix.schemaVersion !== 1) return 'Unsupported support-matrix version';
    if (!validMatrix(value)) return 'Invalid support-matrix contract';
    if (matrix.taxonomySchemaVersion !== taxonomy.schemaVersion) return 'Support matrix was generated from a different taxonomy version';
    for (const observation of Object.values(matrix.sourceReport.scannerObservations)) {
      if (!Number.isFinite(Date.parse(observation.observedAt)) || !observation.sourceRunId ||
        (observation.source === 'snapshot') !== Boolean(observation.snapshotDigest && observation.inputDigest))
        return 'Support matrix carries invalid scanner observation provenance';
    }
    if (matrix.familyCount !== matrix.families.length) return 'Support matrix family count does not match its families';
    if (new Set(matrix.families.map(f => f.family)).size !== matrix.families.length) return 'Support matrix repeats a family';
    const counted = countStatuses(matrix.families);
    if (SUPPORT_STATUSES.some(status => matrix.distribution[status] !== counted[status])) return 'Support matrix distribution does not recount from its families';
    const stableProfiles = {
      documented: matrix.families.filter(entry => entry.status === 'stable' && entry.qualificationProfile === 'documented').length,
      empirical: matrix.families.filter(entry => entry.status === 'stable' && entry.qualificationProfile === 'empirical').length,
    };
    if (matrix.stableDistribution.documented !== stableProfiles.documented || matrix.stableDistribution.empirical !== stableProfiles.empirical ||
        stableProfiles.documented + stableProfiles.empirical !== counted.stable) return 'Support matrix stable distribution does not recount from its families';
    const known = new Map(taxonomy.families.map(f => [f.id, f]));
    if (matrix.families.length !== known.size || matrix.providerCount !== taxonomy.providers.length) return 'Stale support matrix: the taxonomy changed';
    for (const entry of matrix.families) {
      const family = known.get(entry.family);
      if (!family) return 'Stale support matrix: the taxonomy changed';
      if (family.provider !== entry.provider || family.name !== entry.familyName) return `Support matrix entry ${entry.family} does not match the taxonomy`;
      // Every status but `stable` owes the reader a reason; `buildSupportMatrix`
      // enforces it upstream, and a published file is checked again here.
      if (entry.status !== 'stable' && !entry.reason) return `Support matrix entry ${entry.family} carries ${entry.status} with no reason`;
      if (entry.profileCoverage && entry.profileCoverage.profilesVersion !== fixtureProfiles.profilesVersion) return `Support matrix entry ${entry.family} was measured under different fixture profiles`;
      if (!entry.detectors.length && (entry.evidenceTier || entry.evidenceBasis !== 'none' || entry.qualificationProfile || entry.twinCoverage || entry.unresolvedCriticalItems || entry.empiricalEvidence || entry.fixtureProfile || entry.profileCoverage)) return `Support matrix entry ${entry.family} has no detector but carries evidence`;
      if (entry.detectors.length && !entry.evidenceTier) return `Support matrix entry ${entry.family} has a detector but no format evidence tier`;
      if (entry.status === 'stable' && !entry.qualificationProfile) return `Support matrix entry ${entry.family} is stable without a qualification profile`;
      if (entry.status !== 'stable' && entry.qualificationProfile) return `Support matrix entry ${entry.family} is not stable but carries a qualification profile`;
      // Empirical stable stays T2, on a basis its own records carry: provider-issued
      // observations, or independent corroboration (#177 as amended 2026-09-24).
      if (entry.qualificationProfile === 'empirical' && (entry.evidenceTier !== 'T2' || !empiricalBasisHolds(entry))) return `Support matrix entry ${entry.family} masquerades as empirically qualified`;
      if (entry.qualificationProfile === 'documented' && entry.evidenceTier !== 'T1') return `Support matrix entry ${entry.family} masquerades as documented`;
    }
    return null;
  } catch {
    return 'Missing or invalid support matrix';
  }
}

/** Display name for a provider id; `null` is the taxonomy's non-provider-specific bucket. */
export const providerName = (id: string | null): string =>
  id === null ? 'Not provider-specific' : taxonomy.providers.find(p => p.id === id)?.name ?? id;

/** Families in reading order: by provider name, then family name, with the non-provider-specific formats last. */
export function orderedFamilies(matrix: SupportMatrixFile, status: SupportStatus | 'all' = 'all'): SupportMatrixEntry[] {
  const selected = status === 'all' ? matrix.families : matrix.families.filter(entry => entry.status === status);
  return [...selected].sort((a, b) => {
    if ((a.provider === null) !== (b.provider === null)) return a.provider === null ? 1 : -1;
    return providerName(a.provider).localeCompare(providerName(b.provider)) || a.familyName.localeCompare(b.familyName) || a.family.localeCompare(b.family);
  });
}
