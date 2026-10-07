/**
 * The publication-side consumer check of the view support matrix (#657).
 *
 * `matrix-artifact.ts` builds the matrix from a validated view and refuses a wrong one at build time. A publication reads that file again later (the
 * publisher, the provider roadmap, the domain index), possibly from another checkout than the one that built it, so each reader runs the same check
 * on the bytes it is about to publish: the mode is `published`, the artifact is public, the populations are canonical runs of the registry at the
 * current engine, the policy revision is the one this checkout computes, the families are the taxonomy's (a matrix of another taxonomy is stale) and the
 * file holds the allowlisted keys and nothing else. The legacy matrix keeps its own validator (`supportMatrixProblem`), which asks for provenance the
 * view cannot carry; neither validator accepts the other's file (tests/publication-switch.test.mjs). Spec: docs/specs/qualification-adapter.md.
 */
import { taxonomy } from '../support/taxonomy.ts';
import { MATRIX_ARTIFACT_SCHEMA, matrixArtifactProblems, type MatrixArtifact, type RegistryForMatrix } from './matrix-artifact.ts';
import { readScannerRoster, rosterFor, type RosterEntry } from './scanner-roster.ts';

export interface ViewSupportContext {
  registry: RegistryForMatrix;
  /** The taxonomy families a matrix must list, exactly. */
  taxonomy: { id: string; provider: string | null; name: string }[];
  /** The policy revision this checkout computes from its benchmark-owned inputs. */
  policyRevision: string;
  /** The scanner roster of the official run class (benchmarks/support/scanner-roster.json): what a recorded population must have measured, and what it may add (#812). */
  roster: RosterEntry;
}

export const isViewMatrix = (value: unknown): value is MatrixArtifact => (value as { schema?: unknown } | null)?.schema === MATRIX_ARTIFACT_SCHEMA;

const TOP_LEVEL_KEYS = ['schema', 'mode', 'publication', 'source', 'providerCount', 'familyCount', 'distribution', 'stableDistribution', 'families'];

/** Every reason a view matrix must not be published or read by a publisher as it stands (empty: it is a public, current, canonical matrix). Pure. */
export function viewMatrixProblems(value: unknown, context: ViewSupportContext): string[] {
  if (!isViewMatrix(value)) return [`not a ${MATRIX_ARTIFACT_SCHEMA} artifact`];
  const problems: string[] = [];
  const extra = Object.keys(value).filter(key => !TOP_LEVEL_KEYS.includes(key));
  if (extra.length) problems.push(`carries keys outside the allowlist: ${extra.join(', ')}`);
  if (value.mode !== 'published' || value.publication !== 'public') problems.push(`is a ${String(value.mode)} matrix (${String(value.publication)}): only a published, public matrix is read by a publication`);
  problems.push(...matrixArtifactProblems(value, context.registry));
  if (value.source?.view?.policyRevision !== context.policyRevision) problems.push(`was built under policy ${String(value.source?.view?.policyRevision)}, this checkout computes ${context.policyRevision}`);
  // The scanner configuration binding: every recorded population measured all the official required scanners and no scanner outside the roster.
  for (const population of value.source?.populations ?? []) {
    const measured = Object.keys(population.scannerBuilds ?? {});
    for (const id of context.roster.required) if (!measured.includes(id)) problems.push(`${population.population} did not measure the required scanner ${id}`);
    for (const id of measured) if (!context.roster.required.includes(id) && !context.roster.optional.includes(id)) problems.push(`${population.population} measured ${id}, which is not in the official scanner roster`);
  }
  const families = Array.isArray(value.families) ? value.families : [];
  const known = new Map(context.taxonomy.map(f => [f.id, f]));
  if (families.length !== known.size) problems.push(`lists ${families.length} families, the taxonomy has ${known.size}`);
  for (const entry of families) {
    const family = known.get(entry.family);
    if (!family) problems.push(`lists ${entry.family}, which the taxonomy does not hold`);
    else if (family.provider !== entry.provider || family.name !== entry.familyName) problems.push(`entry ${entry.family} does not match the taxonomy`);
  }
  return problems;
}

/** The context a publisher checks against: the registry, the taxonomy and the policy revision of this checkout. */
export async function loadViewSupportContext(): Promise<ViewSupportContext> {
  const { loadPolicyRevision, loadRegistry } = await import('./inputs.ts');
  const { registry } = await loadRegistry();
  return { registry, taxonomy: taxonomy.families.map(f => ({ id: f.id, provider: f.provider, name: f.name })), policyRevision: (await loadPolicyRevision()).revision,
    roster: rosterFor(readScannerRoster(), 'official') };
}

/** The family and status pairs and the identity a roadmap reads from a published view matrix. */
export function viewMatrixIdentity(matrix: MatrixArtifact) {
  return {
    source: 'qualification-view' as const,
    policyRevision: matrix.source.view.policyRevision,
    populations: matrix.source.populations.map(p => ({ population: p.population, semanticDigest: p.semanticDigest })),
  };
}
