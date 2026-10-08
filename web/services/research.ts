/**
 * The research projection (`benchmarks/support/research-projection.json`, #590, #591; docs/specs/research-records.md): the canonical
 * credential-evidence records for the taxonomy's families, from the evidence release `benchmarks/official-runs.json` pins. It is read
 * and validated at build time with the functions `npm run research:check` runs; a projection that fails the schema or names a family the
 * taxonomy does not have fails the build.
 *
 * States: `recorded` (valid and taken from the pinned release), `stale` (valid, but from another release than the pin: the pages show no
 * record and say why, never an old record as current), `absent` (no projection file). A family the projection does not hold is "not
 * recorded" on its page. The records describe the research, never a scanner, the product or support status.
 */
import { bindingProblems, evidencePin, projectionProblems } from '../../benchmarks/support/research-projection.mjs';
import { loadTaxonomy } from './catalog';
import { once, readJson, readJsonIfPresent } from './repo';

export const RESEARCH_PROJECTION_FILE = 'benchmarks/support/research-projection.json';

export type Lifecycle = 'draft' | 'maintainer-only' | 'reviewed' | 'deprecated' | 'withdrawn';
export type EvidenceClass = 'provider-documented' | 'tool-corroborated' | 'project-policy' | 'unresolved';

export interface ProjectedRevision {
  id: string;
  revision: number;
  period: 'current' | 'historical' | 'proposed';
  lifecycle: Lifecycle;
  supersedes: string | null;
  validity: { from: string | null; until: string | null };
  current: boolean;
}

export interface ProjectedClaim {
  id: string;
  statement: string;
  evidenceClass: EvidenceClass;
  temporality: 'current' | 'historical';
  /** `YYYY-MM-DD`: when the claim was last confirmed against its sources. */
  observedAt: string;
  sources: { sourceId: string; supports: string; locator?: string }[];
}

export interface ProjectedStructure {
  prefixes?: string[];
  alphabet?: { name?: string; characters?: string };
  length?: { exact?: number; min?: number; max?: number };
  separators?: string[];
  components?: { name: string; role: string; description?: string }[];
  descriptivePattern?: string;
  checksum?: string;
}

export interface ProjectedFamily {
  name: string;
  aliases?: string[];
  /** The family record's own review state (credential-evidence lifecycle). */
  lifecycle: Lifecycle;
  /** The record's path at the release's commit. */
  record: string;
  research: {
    state: 'unresearched' | 'researched' | 'not-found' | 'rejected';
    researchedAt: string | null;
    blockers: { kind: string; summary: string }[];
    issues: string[];
  };
  review: {
    history: string | null;
    events: number;
    byType: Record<string, number>;
    latest: { seq: number; type: string; at: string; role: string; affiliation: string } | null;
    /** Policy rulings, by their stable reference `<history id>#<seq>`. */
    decided: { ref: string; at: string; note: string }[];
  };
  currentContract: string | null;
  revisions: ProjectedRevision[];
  /** The current revision, or the latest when none is current; `null` when the family has no format contract. */
  contract: { id: string; structure: ProjectedStructure; claims: ProjectedClaim[]; openQuestions: { id: string; question: string; raisedAt: string }[] } | null;
}

export interface ProjectedSource {
  title: string;
  publisher?: string;
  sourceType: string;
  url: string;
  pin: string;
  /** `YYYY-MM-DD` of the last successful read, or `null` when the source was never read successfully. */
  lastReadAt: string | null;
  lastOutcome: string;
}

export interface ResearchRelease {
  repository: string;
  release: string;
  manifestDigest: string;
  recordsBundleDigest: string;
  commit: string;
  recordsTree: string;
  schemaRevision: string;
}

export interface ResearchProjection {
  schema: string;
  spec: string;
  source: ResearchRelease;
  families: Record<string, ProjectedFamily>;
  sources: Record<string, ProjectedSource>;
}

export type Research =
  | { state: 'recorded'; release: ResearchRelease; families: Map<string, ProjectedFamily>; sources: Map<string, ProjectedSource> }
  | { state: 'stale'; release: ResearchRelease; pinned: string; problems: string[] }
  | { state: 'absent' };

export function loadResearch(): Promise<Research> {
  return once('research', async () => {
    const projection = await readJsonIfPresent<ResearchProjection>(RESEARCH_PROJECTION_FILE);
    if (!projection) return { state: 'absent' };
    const taxonomy = await loadTaxonomy();
    const problems = projectionProblems(projection, { familyIds: taxonomy.families.map(f => f.id) });
    if (problems.length) throw new Error(`${RESEARCH_PROJECTION_FILE} is invalid; run npm run research:check: ${problems.join('; ')}`);
    const pin = evidencePin(await readJson('benchmarks/official-runs.json'));
    const unbound = bindingProblems(projection, pin);
    if (unbound.length) return { state: 'stale', release: projection.source, pinned: pin.release.tag, problems: unbound };
    return {
      state: 'recorded', release: projection.source,
      families: new Map(Object.entries(projection.families)), sources: new Map(Object.entries(projection.sources)),
    };
  });
}
