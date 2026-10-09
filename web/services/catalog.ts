/**
 * The fixture catalog and the credential taxonomy, read from the committed
 * corpora. This is the same catalog the legacy Vite site builds in its catalog module;
 * that module reads the corpora through Vite's `import.meta.glob` and cannot run
 * under Next, so the files are read here and handed to the same `buildCatalog`
 * (benchmarks/shared/report-model.mjs) and the same index validator (benchmarks/lib/fixture-index.ts).
 * Nothing is re-scored or re-classified.
 *
 * The generated corpora (`fixtures/generated/*.json`) are materialised by
 * `npm run fixtures:generate`, which `npm ci` runs as its `prepare` step. A build
 * without them fails here with the missing file's name rather than rendering a
 * partial catalog.
 */
import { buildCatalog } from '../../benchmarks/shared/report-model.mjs';
import { fixtureIndexProblems, type FixtureIndex } from '../../benchmarks/lib/fixture-index';
import { FIXTURE_DESCRIPTIONS_FILE, fixtureDescriptionsProblems, type FixtureDescriptions } from '../../benchmarks/lib/fixture-metadata';
import type { Taxonomy } from '../../benchmarks/support/taxonomy';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { once, readJson, REPO_ROOT } from './repo';

export { assembleCatalog, loadTaxonomy, loadDetectorTitles } from './credential-catalog';
export type { Kind, Tier, CatalogFixture, CatalogSuite, CatalogDetector, Catalog, BuiltFixture, CatalogParts } from './credential-catalog';
import { assembleCatalog, loadTaxonomy, taxonomyProblems } from './credential-catalog';
import type { Kind, Tier, CatalogFixture, CatalogSuite, CatalogDetector, Catalog, BuiltFixture } from './credential-catalog';

interface CategoryEntry { id: string; title: string; description: string; corpus: string; calibrationOnly?: boolean }
interface CorpusFile { reviewStatus?: string; fixtures: { id: string; group: string; twinOf?: string; assessment: { kind: Kind; tier: Tier } }[] }
interface DetectorRegistry { detectors: { id: string; title: string }[] }
/** A fixture as `buildCatalog` returns it, with the bytes and ground truth `reportProblem` re-checks reports against. */
export interface CatalogSources {
  /** Published suite ids, in registry order. */
  categories: string[];
  /** sha256 of each corpus file's text: the `corpusHash` a suite report must carry. */
  hashes: Record<string, string>;
  fixtures: BuiltFixture[];
}

interface Loaded extends CatalogSources {
  index: FixtureIndex;
  taxonomy: Taxonomy;
  registry: DetectorRegistry;
  suites: CatalogSuite[];
  scenarios: { id: string; title: string }[];
}

interface Corpora { categories: CategoryEntry[]; corpora: Record<string, CorpusFile>; hashes: Record<string, string> }

/**
 * The titles and descriptions this repository authors for its own product-owned fixtures (`benchmarks/fixture-descriptions.json`), validated: a slug
 * outside a product-owned category is refused, since a public evidence case's text belongs to credential-evidence. Display text: it changes no hash.
 */
export async function applyFixtureDescriptions(built: BuiltFixture[]): Promise<BuiltFixture[]> {
  const [file, populations] = await Promise.all([
    readJson<FixtureDescriptions>(FIXTURE_DESCRIPTIONS_FILE),
    readJson<{ populations: { ownership: string; categories?: string[] }[] }>('benchmarks/generated-populations.json'),
  ]);
  const owned = new Set(populations.populations.filter(p => p.ownership === 'product').flatMap(p => p.categories ?? []));
  const problems = fixtureDescriptionsProblems(file, new Set(built.filter(f => owned.has(f.category)).map(f => f.slug)));
  if (problems.length) throw new Error(`${FIXTURE_DESCRIPTIONS_FILE} is invalid: ${problems.join('; ')} (npm run fixture-metadata:check)`);
  return built.map(f => {
    const d = file.fixtures[f.slug];
    return d ? { ...f, title: d.title, description: d.description, describedBy: `Authored in this repository for a product-owned fixture (${FIXTURE_DESCRIPTIONS_FILE}, ${d.authoredOn}).` } : f;
  });
}

/**
 * The published corpus files and their sha256, read from `benchmarks/categories.json` and the corpora it names, and nothing else: no fixture index, detector
 * assignment or scenario file. Both authorities need it (the evaluation bundle states the corpus hashes it was measured over), so it is the one read of the
 * corpora; the legacy catalog (`loadSources`) builds on it.
 */
function loadCorpora(): Promise<Corpora> {
  return once('corpora', async () => {
    const categoriesAll = await readJson<CategoryEntry[]>('benchmarks/categories.json');
    const categories = categoriesAll.filter(c => !c.calibrationOnly);
    const texts = await Promise.all(categories.map(async c => [c.id, await readFile(path.join(REPO_ROOT, c.corpus), 'utf8')] as const));
    const corpora = Object.fromEntries(texts.map(([id, text]) => [id, JSON.parse(text) as CorpusFile]));
    const hashes = Object.fromEntries(texts.map(([id, text]) => [id, createHash('sha256').update(new TextEncoder().encode(text)).digest('hex')]));
    return { categories, corpora, hashes };
  });
}

/** sha256 of each published corpus file's text, by suite id: the `corpusHash` a suite report or an evaluation bundle must carry. Reads no legacy catalog file. */
export async function loadCorpusHashes(): Promise<Record<string, string>> {
  return (await loadCorpora()).hashes;
}

/** The legacy catalog's sources: the corpora plus `fixture-index.json`, `fixture-detectors.json` and `scenarios.json`. Only the `legacy` authority and the legacy run reader come here (#658). */
function loadSources(): Promise<Loaded> {
  return once('catalog-sources', async () => {
    const [{ categories, corpora, hashes }, registry, assignments, index, taxonomy, scenarioRegistry] = await Promise.all([
      loadCorpora(),
      readJson<DetectorRegistry>('benchmarks/detectors.json'),
      readJson<Record<string, string[]>>('benchmarks/fixture-detectors.json'),
      readJson<FixtureIndex>('benchmarks/fixture-index.json'),
      readJson<Taxonomy>('benchmarks/support/taxonomy.json'),
      readJson<{ scenarios: { id: string; title: string }[] }>('benchmarks/scenarios.json'),
    ]);

    const indexIssues = fixtureIndexProblems(index);
    if (indexIssues.length) throw new Error(`benchmarks/fixture-index.json is invalid: ${indexIssues.join('; ')}`);
    const taxonomyIssues = taxonomyProblems(taxonomy);
    if (taxonomyIssues.length) throw new Error(`benchmarks/support/taxonomy.json is invalid: ${taxonomyIssues.join('; ')}`);

    const built = await applyFixtureDescriptions(buildCatalog(categories, corpora, assignments, registry.detectors) as BuiltFixture[]);
    if (index.identity.fixtureCount !== built.length) throw new Error('Fixture semantic index membership does not match the fixture corpora');
    const suites = categories.map(c => ({ id: c.id, title: c.title, description: c.description, reviewStatus: corpora[c.id].reviewStatus ?? '' }));
    return { categories: categories.map(c => c.id), hashes, fixtures: built, index, taxonomy, registry, suites, scenarios: scenarioRegistry.scenarios.map(s => ({ id: s.id, title: s.title })) };
  });
}

/**
 * The fixture bytes, expected spans and assessments as `buildCatalog` returns them,
 * by slug: what the fixture page shows and what `reportProblem` re-checks reports
 * against. Held apart from `Catalog` so a list never carries the bytes.
 */
export async function loadFixtureBytes(): Promise<Map<string, BuiltFixture>> {
  const { fixtures } = await loadSources();
  return new Map(fixtures.map(f => [f.slug, f]));
}

/** sha256 of each fixture's bytes (UTF-8), by slug. What the fixture page shows as the file's hash. */
export function loadFixtureHashes(): Promise<Map<string, string>> {
  return once('fixture-hashes', async () => {
    const { fixtures } = await loadSources();
    return new Map(fixtures.map(f => [f.slug, createHash('sha256').update(new TextEncoder().encode(f.content)).digest('hex')]));
  });
}

/** The published suites, in registry order, with the review status the corpus carries. */
export async function loadSuites(): Promise<CatalogSuite[]> {
  return (await loadSources()).suites;
}

/** What `reportProblem` needs to re-validate a suite report. Used by services/run.ts. */
export async function loadCatalogSources(): Promise<CatalogSources> {
  const { categories, hashes, fixtures } = await loadSources();
  return { categories, hashes, fixtures };
}

export function loadCatalog(): Promise<Catalog> {
  return once('catalog', async () => {
    const { fixtures: built, index, taxonomy, registry, suites, scenarios } = await loadSources();
    const semantic = new Map(index.fixtures.map(entry => [entry.slug, entry]));
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
        detectors: f.detectors,
        ...(entry.scenarioIds.length ? { scenarioIds: entry.scenarioIds } : {}),
        ...(entry.provenance.milestone ? { milestone: entry.provenance.milestone } : {}),
        ...(entry.provenance.release ? { release: entry.provenance.release } : {}),
      };
    });

    return assembleCatalog({
      fixtures, taxonomy, suites, detectors: registry.detectors.map(d => ({ id: d.id, title: d.title })),
      scenarioTitles: new Map(scenarios.map(s => [s.id, s.title])),
    });
  });
}
