/**
 * The fixture catalog and the credential taxonomy, read from the committed
 * corpora. This is the same catalog the existing site builds in `src/catalog.ts`;
 * that module reads the corpora through Vite's `import.meta.glob` and cannot run
 * under Next, so the files are read here and handed to the same `buildCatalog`
 * (src/model.mjs) and the same index validator (benchmarks/lib/fixture-index.ts).
 * Nothing is re-scored or re-classified.
 *
 * The generated corpora (`fixtures/generated/*.json`) are materialised by
 * `npm run fixtures:generate`, which `npm ci` runs as its `prepare` step. A build
 * without them fails here with the missing file's name rather than rendering a
 * partial catalog.
 */
import { buildCatalog } from '../../src/model.mjs';
import { fixtureIndexProblems, type FixtureIndex } from '../../benchmarks/lib/fixture-index';
import type { Family, Provider, Taxonomy } from '../../benchmarks/support/taxonomy';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { once, readJson, REPO_ROOT } from './repo';

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
}

export interface Catalog {
  fixtures: CatalogFixture[];
  bySlug: Map<string, CatalogFixture>;
  taxonomy: Taxonomy;
  providerById: Map<string, Provider>;
  familyById: Map<string, Family>;
  /** Fixtures with exactly one family relationship, by family id. A fixture with two relationships is listed under both. */
  fixturesByFamily: Map<string, CatalogFixture[]>;
  detectorCount: number;
}

interface CategoryEntry { id: string; corpus: string; calibrationOnly?: boolean }
interface CorpusFile { fixtures: { id: string; group: string; twinOf?: string; assessment: { kind: Kind; tier: Tier } }[] }
interface DetectorRegistry { detectors: { id: string }[] }
/** A fixture as `buildCatalog` returns it, with the bytes and ground truth `reportProblem` re-checks reports against. */
export type BuiltFixture = { id: string; slug: string; category: string; group: string; path: string; content: string; expected: unknown[]; twinOf?: string; assessment: { kind: Kind; tier: Tier; contract?: string } };

export interface CatalogSources {
  /** Published suite ids, in registry order. */
  categories: string[];
  /** sha256 of each corpus file's text: the `corpusHash` a suite report must carry. */
  hashes: Record<string, string>;
  fixtures: BuiltFixture[];
}

function taxonomyProblems(taxonomy: Taxonomy): string[] {
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

interface Loaded extends CatalogSources {
  index: FixtureIndex;
  taxonomy: Taxonomy;
  registry: DetectorRegistry;
}

function loadSources(): Promise<Loaded> {
  return once('catalog-sources', async () => {
    const [categoriesAll, registry, assignments, index, taxonomy] = await Promise.all([
      readJson<CategoryEntry[]>('benchmarks/categories.json'),
      readJson<DetectorRegistry>('benchmarks/detectors.json'),
      readJson<Record<string, string[]>>('benchmarks/fixture-detectors.json'),
      readJson<FixtureIndex>('benchmarks/fixture-index.json'),
      readJson<Taxonomy>('benchmarks/support/taxonomy.json'),
    ]);
    const categories = categoriesAll.filter(c => !c.calibrationOnly);
    const texts = await Promise.all(categories.map(async c => [c.id, await readFile(path.join(REPO_ROOT, c.corpus), 'utf8')] as const));
    const corpora = Object.fromEntries(texts.map(([id, text]) => [id, JSON.parse(text) as CorpusFile]));
    const hashes = Object.fromEntries(texts.map(([id, text]) => [id, createHash('sha256').update(new TextEncoder().encode(text)).digest('hex')]));

    const indexIssues = fixtureIndexProblems(index);
    if (indexIssues.length) throw new Error(`benchmarks/fixture-index.json is invalid: ${indexIssues.join('; ')}`);
    const taxonomyIssues = taxonomyProblems(taxonomy);
    if (taxonomyIssues.length) throw new Error(`benchmarks/support/taxonomy.json is invalid: ${taxonomyIssues.join('; ')}`);

    const built = buildCatalog(categories, corpora, assignments, registry.detectors) as BuiltFixture[];
    if (index.identity.fixtureCount !== built.length) throw new Error('Fixture semantic index membership does not match the fixture corpora');
    return { categories: categories.map(c => c.id), hashes, fixtures: built, index, taxonomy, registry };
  });
}

/** What `reportProblem` needs to re-validate a suite report. Used by services/run.ts. */
export async function loadCatalogSources(): Promise<CatalogSources> {
  const { categories, hashes, fixtures } = await loadSources();
  return { categories, hashes, fixtures };
}

export function loadCatalog(): Promise<Catalog> {
  return once('catalog', async () => {
    const { fixtures: built, index, taxonomy, registry } = await loadSources();
    const semantic = new Map(index.fixtures.map(entry => [entry.slug, entry]));
    const providerById = new Map(taxonomy.providers.map(p => [p.id, p]));
    const familyById = new Map(taxonomy.families.map(f => [f.id, f]));

    const fixtures: CatalogFixture[] = built.map(f => {
      const entry = semantic.get(f.slug);
      if (!entry) throw new Error(`Missing fixture semantic index entry: ${f.slug}`);
      for (const id of entry.familyIds) if (!familyById.has(id)) throw new Error(`Fixture semantic index has unknown family ${id}: ${f.slug}`);
      if (!entry.familyIds.length && !entry.unscopedReason) throw new Error(`Fixture semantic index has no unscoped reason: ${f.slug}`);
      return {
        slug: f.slug, category: f.category, id: f.id, group: f.group,
        kind: f.assessment.kind, tier: f.assessment.tier,
        ...(f.twinOf ? { twinOf: `${f.category}--${f.twinOf}` } : {}),
        familyIds: entry.familyIds,
        ...(entry.unscopedReason ? { unscopedReason: entry.unscopedReason } : {}),
      };
    });

    const fixturesByFamily = new Map<string, CatalogFixture[]>();
    for (const f of fixtures) for (const id of f.familyIds) (fixturesByFamily.get(id) ?? fixturesByFamily.set(id, []).get(id)!).push(f);

    return {
      fixtures, bySlug: new Map(fixtures.map(f => [f.slug, f])), taxonomy, providerById, familyById, fixturesByFamily,
      detectorCount: registry.detectors.length,
    };
  });
}
