/** Current catalog indexing and product-owned labels; no oracle corpus/run reader (#868). */
import type { Family, Provider, Taxonomy } from '../../benchmarks/support/taxonomy';
import { once, readJson } from './repo';
interface DetectorRegistry { detectors: { id: string; title: string }[] }

export type Kind = 'must-redact' | 'must-not-flag' | 'policy';
export type Tier = 'T0' | 'T1' | 'T2' | 'T3';

export interface CatalogFixture {
  slug: string;
  category: string;
  id: string;
  group: string;
  kind: Kind;
  tier: Tier;
  twinOf?: string;
  /** Reviewed family relationships; empty for a global fixture. */
  familyIds: string[];
  unscopedReason?: string;
  /** Detector families the fixture is assigned to (`benchmarks/fixture-detectors.json`); assignments overlap. */
  detectors: string[];
  /** Reviewed scenarios (`benchmarks/scenarios.json`), from the fixture index. */
  scenarioIds?: string[];
  /** The release milestone that added the fixture ("beta.8"), when the fixture index records one. */
  milestone?: string;
  /** The release the fixture index records with that milestone (`provenance.release`, "0.1.0-beta.8"), when it records one (#595). Never inferred from the milestone. */
  release?: string;
}

/** A published suite of the corpus, in registry order. */
export interface CatalogSuite { id: string; title: string; description: string; reviewStatus: string }
export interface CatalogDetector { id: string; title: string }

export interface Catalog {
  fixtures: CatalogFixture[];
  bySlug: Map<string, CatalogFixture>;
  taxonomy: Taxonomy;
  providerById: Map<string, Provider>;
  familyById: Map<string, Family>;
  /** Fixtures with exactly one family relationship, by family id. A fixture with two relationships is listed under both. */
  fixturesByFamily: Map<string, CatalogFixture[]>;
  detectorCount: number;
  suites: CatalogSuite[];
  detectors: CatalogDetector[];
  /** Fixtures assigned to a detector. A fixture can be under several, so these are never summed. */
  fixturesByDetector: Map<string, CatalogFixture[]>;
  fixturesBySuite: Map<string, CatalogFixture[]>;
  /** Scenario titles by id (`benchmarks/scenarios.json`). */
  scenarioTitles: Map<string, string>;
}

export type BuiltFixture = {
  id: string; slug: string; category: string; group: string; path: string; content: string; expected: unknown[]; twinOf?: string;
  detectors: string[]; issue?: number; mutation?: string; mutationKind?: string;
  /** Authored where the corpus has one: where in a file the fixture sits (`sdk-config`), the action a policy fixture expects. */
  contextAxis?: string; expectedAction?: string;
  /** `false` when the source carries no bytes for the fixture (the qualification view carries none, by design): `content` is then empty and the page says the bytes are not recorded. */
  contentRecorded?: false;
  /**
   * An authored title and one-sentence description, and who authored them (#593; docs/specs/fixture-metadata.md): a public evidence case's are
   * credential-evidence's case record, a product-owned fixture's are `benchmarks/fixture-descriptions.json`. Absent when neither records one.
   */
  title?: string; description?: string; describedBy?: string;
  assessment: { kind: Kind; tier: Tier; contract?: string; reason?: string; sources?: string[] };
};

export function taxonomyProblems(taxonomy: Taxonomy): string[] {
  const problems: string[] = [];
  const providers = new Set<string>();
  for (const p of taxonomy.providers) {
    if (providers.has(p.id)) problems.push(`duplicate provider ${p.id}`);
    providers.add(p.id);
  }
  const families = new Set<string>();
  for (const f of taxonomy.families) {
    if (families.has(f.id)) problems.push(`duplicate family ${f.id}`);
    families.add(f.id);
    if (f.provider !== null && !providers.has(f.provider)) problems.push(`family ${f.id} names unknown provider ${f.provider}`);
  }
  return problems;
}

/** The committed taxonomy, validated: product-owned, so both authorities read it. */
export function loadTaxonomy(): Promise<Taxonomy> {
  return once('taxonomy', async () => {
    const taxonomy = await readJson<Taxonomy>('benchmarks/support/taxonomy.json');
    const issues = taxonomyProblems(taxonomy);
    if (issues.length) throw new Error(`benchmarks/support/taxonomy.json is invalid: ${issues.join('; ')}`);
    return taxonomy;
  });
}

/** The detector registry (`benchmarks/detectors.json`): ids and titles, the one list of detector names both authorities draw titles from. */
export function loadDetectorTitles(): Promise<Map<string, string>> {
  return once('detector-titles', async () => new Map((await readJson<DetectorRegistry>('benchmarks/detectors.json')).detectors.map(d => [d.id, d.title])));
}

export interface CatalogParts {
  fixtures: CatalogFixture[];
  taxonomy: Taxonomy;
  suites: CatalogSuite[];
  detectors: CatalogDetector[];
  scenarioTitles: Map<string, string>;
}

/** Index a set of fixtures, suites and detectors into the `Catalog` the resolvers read. Both authorities build theirs here. */
export function assembleCatalog({ fixtures, taxonomy, suites, detectors, scenarioTitles }: CatalogParts): Catalog {
  const providerById = new Map(taxonomy.providers.map(p => [p.id, p]));
  const familyById = new Map(taxonomy.families.map(f => [f.id, f]));
  const fixturesByFamily = new Map<string, CatalogFixture[]>();
  for (const f of fixtures) for (const id of f.familyIds) (fixturesByFamily.get(id) ?? fixturesByFamily.set(id, []).get(id)!).push(f);
  const fixturesByDetector = new Map<string, CatalogFixture[]>(detectors.map(d => [d.id, []]));
  for (const f of fixtures) for (const id of f.detectors) fixturesByDetector.get(id)?.push(f);
  const fixturesBySuite = new Map<string, CatalogFixture[]>(suites.map(s => [s.id, []]));
  for (const f of fixtures) fixturesBySuite.get(f.category)?.push(f);
  return {
    fixtures, bySlug: new Map(fixtures.map(f => [f.slug, f])), taxonomy, providerById, familyById, fixturesByFamily,
    detectorCount: detectors.length, suites, detectors, fixturesByDetector, fixturesBySuite, scenarioTitles,
  };
}
