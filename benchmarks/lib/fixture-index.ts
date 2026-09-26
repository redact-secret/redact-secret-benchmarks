import { createHash } from 'node:crypto';

export interface ScenarioDefinition { id: string; title: string; description: string }
export interface ScenarioRegistry { schemaVersion: 1; scenarios: ScenarioDefinition[] }
export interface ReviewedFixtureSemantic {
  slug: string;
  familyIds: string[];
  scenarioIds: string[];
  unscopedReason?: string;
}
export interface ReviewedFixtureSemantics {
  schemaVersion: 1;
  reviewedAt: string;
  fixtures: ReviewedFixtureSemantic[];
}
export interface FixtureSemanticIdentity {
  schemaVersion: 1;
  algorithm: 'sha256';
  digest: string;
  fixtureCount: number;
}
export interface FixtureIndexEntry {
  slug: string;
  source: { categoryId: string; fixtureId: string; corpus: string; path: string };
  familyIds: string[];
  scenarioIds: string[];
  unscopedReason?: string;
  provenance: { categoryId: string; issue?: number; milestone?: string; release?: string };
  relations?: { twinOf?: string };
}
export interface FixtureIndex {
  schemaVersion: 1;
  identity: FixtureSemanticIdentity;
  truth: {
    source: 'category-corpora';
    fields: ['content', 'expected', 'assessment.kind', 'assessment.tier', 'assessment.sources'];
  };
  sources: {
    reviewedMetadata: { algorithm: 'sha256'; digest: string };
    scenarios: { algorithm: 'sha256'; digest: string };
    taxonomy: { algorithm: 'sha256'; digest: string };
  };
  fixtures: FixtureIndexEntry[];
}

interface Category { id: string; corpus: string; calibrationOnly?: boolean }
interface CorpusFixture {
  id: string; path: string; twinOf?: string; issue?: number;
  expected: unknown[];
  assessment: { kind: string; tier: string; sources: string[] };
}
interface Corpus { fixtures: CorpusFixture[] }
interface Taxonomy { schemaVersion: number; families: { id: string; provider: string | null }[]; providers: { id: string }[] }

const ID = /^[a-z0-9]+(?:[a-z0-9-]*[a-z0-9])?$/;
const SHA256 = /^[a-f0-9]{64}$/;
const truthFields = ['content', 'expected', 'assessment.kind', 'assessment.tier', 'assessment.sources'] as const;

function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, normalized(v)]));
  return value;
}

/** Canonical JSON identity used by fixture-index generation and peer snapshot inputs (#336). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalized(value));
}

export function digestJson(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

export function fixtureSemanticIdentity(index: FixtureIndex): FixtureSemanticIdentity {
  return { ...index.identity };
}

const duplicate = (values: string[]) => values.find((value, i) => values.indexOf(value) !== i);
const sortedUnique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b));

export function buildFixtureIndex(input: {
  categories: Category[];
  corpora: Record<string, Corpus>;
  taxonomy: Taxonomy;
  scenarios: ScenarioRegistry;
  reviewed: ReviewedFixtureSemantics;
}): FixtureIndex {
  const { categories, corpora, taxonomy, scenarios, reviewed } = input;
  if (scenarios.schemaVersion !== 1 || reviewed.schemaVersion !== 1) throw new Error('Unsupported fixture semantic source schema');
  const scenarioIds = scenarios.scenarios.map(s => s.id);
  const familyIds = taxonomy.families.map(f => f.id);
  if (duplicate(scenarioIds)) throw new Error(`Duplicate scenario id: ${duplicate(scenarioIds)}`);
  if (duplicate(familyIds)) throw new Error(`Duplicate taxonomy family id: ${duplicate(familyIds)}`);
  if (scenarios.scenarios.some(s => !ID.test(s.id) || !s.title || !s.description)) throw new Error('Invalid scenario definition');
  const knownScenarios = new Set(scenarioIds), knownFamilies = new Set(familyIds);
  const published = categories.filter(c => !c.calibrationOnly);
  const fixtureRows = published.flatMap(category => {
    const corpus = corpora[category.id];
    if (!corpus?.fixtures) throw new Error(`Missing corpus for category: ${category.id}`);
    if (category.corpus.startsWith('holdout/') || category.corpus.includes('/holdout/')) throw new Error(`Protected holdout cannot enter fixture index: ${category.id}`);
    return corpus.fixtures.map(fixture => ({ category, fixture, slug: `${category.id}--${fixture.id}` }));
  });
  const slugs = fixtureRows.map(row => row.slug);
  const reviewedSlugs = reviewed.fixtures.map(row => row.slug);
  if (duplicate(slugs)) throw new Error(`Duplicate canonical fixture slug: ${duplicate(slugs)}`);
  if (duplicate(reviewedSlugs)) throw new Error(`Duplicate reviewed fixture slug: ${duplicate(reviewedSlugs)}`);
  const missing = slugs.filter(slug => !reviewedSlugs.includes(slug));
  const orphan = reviewedSlugs.filter(slug => !slugs.includes(slug));
  if (missing.length || orphan.length) throw new Error(`Reviewed fixture membership mismatch: ${missing.length} missing, ${orphan.length} orphan`);
  const reviewedBySlug = new Map(reviewed.fixtures.map(row => [row.slug, row]));
  const sourceBySlug = new Map(fixtureRows.map(row => [row.slug, row]));

  const fixtures = fixtureRows.map(({ category, fixture, slug }): FixtureIndexEntry => {
    const semantic = reviewedBySlug.get(slug)!;
    if (!semantic.scenarioIds.length) throw new Error(`Fixture has no reviewed scenario: ${slug}`);
    if (duplicate(semantic.familyIds)) throw new Error(`Duplicate family relation: ${slug}`);
    if (duplicate(semantic.scenarioIds)) throw new Error(`Duplicate scenario relation: ${slug}`);
    for (const family of semantic.familyIds) if (!knownFamilies.has(family)) throw new Error(`Unknown family ${family}: ${slug}`);
    for (const scenario of semantic.scenarioIds) if (!knownScenarios.has(scenario)) throw new Error(`Unknown scenario ${scenario}: ${slug}`);
    if (!semantic.familyIds.length && !semantic.unscopedReason) throw new Error(`Unscoped fixture needs a reason: ${slug}`);
    if (semantic.familyIds.length && semantic.unscopedReason) throw new Error(`Scoped fixture cannot carry an unscoped reason: ${slug}`);
    const twinOf = fixture.twinOf ? `${category.id}--${fixture.twinOf}` : undefined;
    if (twinOf) {
      const positive = sourceBySlug.get(twinOf);
      if (!positive || positive.fixture.twinOf) throw new Error(`Invalid positive/twin relation: ${slug} -> ${twinOf}`);
      if (positive.fixture.assessment.kind === 'must-not-flag' || !positive.fixture.expected.length) throw new Error(`Twin target is not a positive fixture: ${slug} -> ${twinOf}`);
    }
    const beta8 = /^beta8-/.test(category.id);
    const provenance: FixtureIndexEntry['provenance'] = {
      categoryId: category.id,
      ...(fixture.issue ? { issue: fixture.issue } : {}),
      ...(beta8 ? { milestone: 'beta.8', release: '0.1.0-beta.8' } : {}),
    };
    return {
      slug,
      source: { categoryId: category.id, fixtureId: fixture.id, corpus: category.corpus, path: fixture.path },
      familyIds: sortedUnique(semantic.familyIds),
      scenarioIds: sortedUnique(semantic.scenarioIds),
      ...(semantic.unscopedReason ? { unscopedReason: semantic.unscopedReason } : {}),
      provenance,
      ...(twinOf ? { relations: { twinOf } } : {}),
    };
  }).sort((a, b) => a.slug.localeCompare(b.slug));

  const sources = {
    reviewedMetadata: { algorithm: 'sha256' as const, digest: digestJson(reviewed) },
    scenarios: { algorithm: 'sha256' as const, digest: digestJson(scenarios) },
    taxonomy: { algorithm: 'sha256' as const, digest: digestJson(taxonomy) },
  };
  const truth = { source: 'category-corpora' as const, fields: [...truthFields] as typeof truthFields extends readonly [...infer T] ? T : never };
  const payload = { schemaVersion: 1 as const, truth, sources, fixtures };
  return {
    ...payload,
    identity: { schemaVersion: 1, algorithm: 'sha256', digest: digestJson(payload), fixtureCount: fixtures.length },
  };
}

export function fixtureIndexProblems(index: FixtureIndex): string[] {
  const problems: string[] = [];
  if (index.schemaVersion !== 1 || index.identity?.schemaVersion !== 1) problems.push('unsupported schema version');
  if (index.identity?.algorithm !== 'sha256' || !SHA256.test(index.identity?.digest ?? '')) problems.push('invalid semantic identity digest');
  if (index.identity?.fixtureCount !== index.fixtures?.length) problems.push('fixture count does not match index entries');
  const payload = { schemaVersion: index.schemaVersion, truth: index.truth, sources: index.sources, fixtures: index.fixtures };
  if (index.identity?.digest !== digestJson(payload)) problems.push('semantic identity does not match index content');
  const slugs = index.fixtures?.map(f => f.slug) ?? [];
  if (duplicate(slugs)) problems.push(`duplicate fixture slug: ${duplicate(slugs)}`);
  for (const [name, source] of Object.entries(index.sources ?? {})) {
    if (source.algorithm !== 'sha256' || !SHA256.test(source.digest)) problems.push(`invalid ${name} source digest`);
  }
  return problems;
}
