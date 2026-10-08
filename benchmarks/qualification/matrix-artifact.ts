/**
 * The support matrix as an artifact of the qualification view (#657): the provider x credential-family projection that
 * `npm run eval:matrix` writes from the legacy engine, read here from a validated view and benchmark policy only.
 *
 * Two modes, never mixed:
 *  - `published`: built from a view whose every population is a public official run and whose every artifact is one the registry
 *    (`benchmarks/official-runs.json`) records as canonical, byte-for-byte by semantic digest. A candidate build in any scanner
 *    manifest, an internal run class or an unrecorded digest is refused: a released public artifact never holds candidate data.
 *  - `candidate-projection`: an explicit staging projection of an internal view. It carries the allowlisted matrix fields only (no
 *    case rows, no spans, no bytes, no raw observation) and names itself internal; it can never be published.
 *
 * It re-derives nothing: the view's supportMatrix is carried through, and `matrixArtifactProblems` recounts the distributions from
 * the families and binds the identity to the registry. Spec: docs/specs/qualification-adapter.md.
 */
import type { SupportMatrix } from './support-matrix.ts';
import type { PiiCurrentQualification } from '../support/pii-current-qualification.ts';
import { findingTypeSource, findingTypesFor, type FindingTypeKey, type FindingTypeSource } from '../support/finding-types.ts';

export const MATRIX_ARTIFACT_SCHEMA = 'redact-secret/support-matrix-from-view/v1';
export type MatrixMode = 'published' | 'candidate-projection';

export interface ViewForMatrix {
  schema: string;
  publication: 'public' | 'internal';
  policy: { revision: string };
  adapter: { id: string; version: number };
  populations: { population: string; runClass: 'public' | 'internal'; artifact: { semanticDigest: string; artifactDigest: string; engine: { name: string; version: string }; scanners: { id: string; version: string | null; build: string | null }[] } }[];
  supportMatrix: SupportMatrix;
}
export interface RegistryForMatrix {
  engine: { version: string };
  scanners?: { id: string; version: string }[];
  runs: { id: string; population: string; canonical?: boolean; kind?: string; platform: string; runClass: string; artifact: { semanticDigest: string } }[];
}

export interface MatrixArtifact {
  schema: typeof MATRIX_ARTIFACT_SCHEMA;
  mode: MatrixMode;
  /** `public` may be published; `internal` is a staging projection and is never published. */
  publication: 'public' | 'internal';
  source: {
    view: { schema: string; adapter: { id: string; version: number }; policyRevision: string };
    populations: { population: string; runClass: string; semanticDigest: string; artifactDigest: string; engineVersion: string; scannerBuilds: Record<string, string | null>; scannerVersions: Record<string, string | null> }[];
    publishedPackage?: { packageName: '@redact-secret/core'; version: string };
  };
  providerCount: number;
  familyCount: number;
  distribution: SupportMatrix['distribution'];
  stableDistribution: SupportMatrix['stableDistribution'];
  families: (SupportMatrix['families'][number] & { findingTypes: FindingTypeKey[] | null })[];
  findingTypeSource: FindingTypeSource;
  /** Separate exact-target PII preparation; it never changes credential populations or counts. */
  piiCurrentQualification?: PiiCurrentQualification;
}

/** The matrix entry fields, and only these, leave the view: an extra key a view might carry (a case row, a span, a raw observation) is dropped, never copied. */
const ENTRY_FIELDS = ['provider', 'family', 'familyName', 'status', 'evidenceTier', 'evidenceBasis', 'qualificationProfile', 'providerSource', 'corroboratingScanners', 'twinCoverage', 'unresolvedCriticalItems', 'empiricalEvidence', 'policyQualification', 'fixtureProfile', 'detectors', 'reason', 'profileCoverage'] as const;
const project = (entry: SupportMatrix['families'][number]) => Object.fromEntries(ENTRY_FIELDS.filter(k => k in entry).map(k => [k, (entry as any)[k]])) as SupportMatrix['families'][number];

const providersOf = (families: SupportMatrix['families']) => new Set(families.map(f => f.provider)).size;

export function buildMatrixArtifact(view: ViewForMatrix, mode: MatrixMode): MatrixArtifact {
  const productVersions = view.populations.map(p => p.artifact.scanners.find(s => s.id === 'redact-secret')?.version);
  const released = view.populations.every(p => p.artifact.scanners.find(s => s.id === 'redact-secret')?.build === 'released');
  const version = productVersions[0];
  return {
    schema: MATRIX_ARTIFACT_SCHEMA,
    mode,
    publication: mode === 'published' ? 'public' : 'internal',
    source: {
      view: { schema: view.schema, adapter: view.adapter, policyRevision: view.policy.revision },
      populations: view.populations.map(p => ({
        population: p.population, runClass: p.runClass, semanticDigest: p.artifact.semanticDigest, artifactDigest: p.artifact.artifactDigest,
        engineVersion: p.artifact.engine.version, scannerBuilds: Object.fromEntries(p.artifact.scanners.map(s => [s.id, s.build])),
        scannerVersions: Object.fromEntries(p.artifact.scanners.map(s => [s.id, s.version])),
      })),
      ...(mode === 'published' && released && version && productVersions.every(v => v === version)
        ? { publishedPackage: { packageName: '@redact-secret/core' as const, version } } : {}),
    },
    providerCount: providersOf(view.supportMatrix.families),
    familyCount: view.supportMatrix.families.length,
    distribution: view.supportMatrix.distribution,
    stableDistribution: view.supportMatrix.stableDistribution,
    // The allowlist: exactly the matrix entry fields, nothing from the cases.
    families: view.supportMatrix.families.map(entry => ({ ...project(entry), findingTypes: findingTypesFor(entry.detectors) })),
    findingTypeSource,
  };
}

/** Every reason the artifact must not be used as it stands (empty: it is what its mode says it is). Pure; reads no file. */
export function matrixArtifactProblems(artifact: MatrixArtifact, registry: RegistryForMatrix): string[] {
  const problems: string[] = [];
  if (artifact?.schema !== MATRIX_ARTIFACT_SCHEMA) return [`not a ${MATRIX_ARTIFACT_SCHEMA} artifact`];
  if (artifact.mode !== 'published' && artifact.mode !== 'candidate-projection') return [`unknown mode ${String(artifact.mode)}`];
  if ((artifact.mode === 'published') !== (artifact.publication === 'public')) problems.push(`mode ${artifact.mode} cannot be ${artifact.publication}`);
  const families = artifact.families ?? [];
  if (JSON.stringify(artifact.findingTypeSource) !== JSON.stringify(findingTypeSource)) problems.push('finding-type source is not the pinned inventory');
  for (const entry of families) if (!Array.isArray(entry.detectors) || JSON.stringify(entry.findingTypes) !== JSON.stringify(findingTypesFor(entry.detectors)))
    problems.push(`${entry.family} finding-type keys differ from the pinned inventory`);
  if (artifact.familyCount !== families.length) problems.push('family count does not match its families');
  if (new Set(families.map(f => f.family)).size !== families.length) problems.push('a family is repeated');
  const counted: Record<string, number> = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  for (const f of families) counted[f.status] = (counted[f.status] ?? 0) + 1;
  for (const key of Object.keys(counted)) if ((artifact.distribution as Record<string, number>)[key] !== counted[key]) problems.push(`distribution.${key} does not recount from the families`);
  const profiles: Record<string, number> = {};
  for (const f of families) if (f.status === 'stable' && f.qualificationProfile) profiles[f.qualificationProfile] = (profiles[f.qualificationProfile] ?? 0) + 1;
  for (const [key, n] of Object.entries(artifact.stableDistribution as Record<string, number>)) if ((profiles[key] ?? 0) !== n) problems.push(`stableDistribution.${key} does not recount from the families`);
  if (Object.values(profiles).reduce((a, b) => a + b, 0) !== counted.stable) problems.push('a stable family carries no qualification profile');
  for (const f of families) if (f.status !== 'stable' && !f.reason) problems.push(`${f.family} is ${f.status} with no reason`);
  const populations = artifact.source?.populations ?? [];
  if (!populations.length) problems.push('no population identity');
  if (artifact.mode === 'published') {
    const product = artifact.source?.publishedPackage;
    if (!product || product.packageName !== '@redact-secret/core' || !product.version ||
      populations.some(p => p.scannerBuilds?.['redact-secret'] !== 'released' || p.scannerVersions?.['redact-secret'] !== product.version))
      problems.push('published package identity is absent or differs across the measured populations');
    const recorded = new Set(registry.runs.filter(r => r.canonical && r.platform === 'linux-x64' && r.kind !== 'methods').map(r => `${r.population}|${r.artifact.semanticDigest}`));
    const seen = new Set<string>();
    for (const p of populations) {
      if (JSON.stringify(Object.keys(p.scannerVersions ?? {}).sort()) !== JSON.stringify(Object.keys(p.scannerBuilds ?? {}).sort()))
        problems.push(`${p.population} scanner version roster differs from the measured builds`);
      for (const pin of registry.scanners ?? []) if (Object.hasOwn(p.scannerVersions ?? {}, pin.id) && p.scannerVersions[pin.id] !== pin.version)
        problems.push(`${p.population} scanner version ${pin.id} differs from the recorded pin`);
      seen.add(p.population);
      if (p.runClass !== 'public') problems.push(`${p.population} is ${p.runClass}: a published matrix reads public runs only`);
      if (!recorded.has(`${p.population}|${p.semanticDigest}`)) problems.push(`${p.population} artifact ${p.semanticDigest} is not a canonical official run of the registry`);
      if (p.engineVersion !== registry.engine.version) problems.push(`${p.population} ran engine ${p.engineVersion}, the pin is ${registry.engine.version}`);
      for (const [scanner, build] of Object.entries(p.scannerBuilds)) if (build === 'candidate') problems.push(`${p.population} measured a candidate build of ${scanner}: a published matrix never carries one`);
    }
    for (const id of new Set(registry.runs.filter(r => r.canonical && r.kind !== 'methods').map(r => r.population))) if (!seen.has(id)) problems.push(`${id} is recorded but absent from the matrix source`);
  } else {
    if (!populations.some(p => p.runClass === 'internal')) problems.push('a candidate projection names no internal run');
  }
  return problems;
}
