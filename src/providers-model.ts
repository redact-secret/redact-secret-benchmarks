import Ajv from 'ajv';
import schema from '../schemas/provider-dossiers-v1.json';
import { taxonomy } from '../benchmarks/support/taxonomy.ts';

/**
 * The UI's read side of the generated provider dossiers roadmap (#478; the
 * artifact is `benchmarks/generate-provider-dossiers.ts`). Nothing here decides a
 * stage: the file carries each family's derived stage, and this module only
 * re-validates it, and checks it back against the checked-in taxonomy, before
 * a page may render it.
 */
const validFile = new Ajv({ strict: true }).compile(schema);

/** The stage vocabulary, in order, taken from the artifact's own schema. */
export const PROVIDER_STAGES = schema.definitions.stage.enum as ProviderStage[];
/** The research verdict vocabulary, taken from the artifact's own schema. */
export const DOSSIER_VERDICTS = schema.definitions.family.properties.verdict.enum as DossierVerdict[];

export type ProviderStage = 'researched' | 'in-taxonomy' | 'benchmarked' | 'core-detector' | 'measured';
export type DossierVerdict = 'unresearched' | 'ready' | 'issuance-gated' | 'date-gated' | 'not-found' | 'rejected';

export interface ProviderDossierFamily {
  family: string; name: string; verdict: DossierVerdict; tier: string | null; researchedAt: string | null; blockedBy: string | null;
  issues: { ref: string; url: string }[]; sources: string[]; evidence: string | null; detectors: string[];
  reached: Record<ProviderStage, boolean>; stage: ProviderStage;
  supportStatus: 'stable' | 'provisional' | 'pending' | 'unsupported' | null;
  fixtureGaps: { detector: string; cell: string; actual: number; required: number }[];
}
export interface ProviderDossiersFile {
  schemaVersion: 1; taxonomySchemaVersion: 1;
  supportMatrix: { runId: string; generatedAt: string; revision: string } | { source: 'qualification-view'; policyRevision: string; populations: { population: string; semanticDigest: string }[] } | null;
  providerCount: number; familyCount: number;
  stageDistribution: Record<ProviderStage, number>; verdictDistribution: Record<DossierVerdict, number>;
  providers: { id: string; name: string; families: ProviderDossierFamily[] }[];
}

/** The stage a set of derived flags reaches; mirrors the generator so a hand-edited file cannot claim more. */
export const stageOf = (reached: Record<ProviderStage, boolean>): ProviderStage =>
  (['measured', 'core-detector', 'benchmarked', 'researched'] as const).find(s => reached[s]) ?? 'in-taxonomy';

/** Reject a malformed, inconsistent or stale roadmap before rendering it. */
export function providerDossiersProblem(value: unknown): string | null {
  try {
    const file = value as ProviderDossiersFile;
    if (file.schemaVersion !== 1) return 'Unsupported provider-dossiers version';
    if (!validFile(value)) return 'Invalid provider-dossiers contract';
    if (file.taxonomySchemaVersion !== taxonomy.schemaVersion) return 'Provider dossiers were generated from a different taxonomy version';
    const families = file.providers.flatMap(p => p.families.map(f => ({ ...f, provider: p.id })));
    if (families.length !== file.familyCount || file.providers.length !== file.providerCount) return 'Provider dossiers count does not match its providers';
    if (new Set(families.map(f => f.family)).size !== families.length) return 'Provider dossiers repeat a family';
    const known = new Map(taxonomy.families.map(f => [f.id, f]));
    if (families.length !== known.size) return 'Stale provider dossiers: the taxonomy changed';
    const stages = Object.fromEntries(PROVIDER_STAGES.map(s => [s, 0])) as Record<ProviderStage, number>;
    const verdicts = Object.fromEntries(DOSSIER_VERDICTS.map(v => [v, 0])) as Record<DossierVerdict, number>;
    for (const entry of families) {
      const family = known.get(entry.family);
      if (!family) return 'Stale provider dossiers: the taxonomy changed';
      if ((family.provider ?? 'generic') !== entry.provider || family.name !== entry.name) return `Provider dossier entry ${entry.family} does not match the taxonomy`;
      if (stageOf(entry.reached) !== entry.stage) return `Provider dossier entry ${entry.family} claims a stage its flags do not reach`;
      if (entry.reached.researched !== (entry.verdict !== 'unresearched') || !entry.reached['in-taxonomy']) return `Provider dossier entry ${entry.family} contradicts its own verdict`;
      if (entry.reached.measured !== (entry.supportStatus === 'stable' || entry.supportStatus === 'provisional')) return `Provider dossier entry ${entry.family} contradicts its own support status`;
      if ((entry.verdict === 'issuance-gated' || entry.verdict === 'date-gated') && !entry.blockedBy) return `Provider dossier entry ${entry.family} is ${entry.verdict} with no blocker`;
      stages[entry.stage]++; verdicts[entry.verdict]++;
    }
    if (PROVIDER_STAGES.some(s => file.stageDistribution[s] !== stages[s]) || DOSSIER_VERDICTS.some(v => file.verdictDistribution[v] !== verdicts[v])) return 'Provider dossiers distribution does not recount from its families';
    return null;
  } catch {
    return 'Missing or invalid provider dossiers';
  }
}
