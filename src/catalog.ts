import allCategories from '../benchmarks/categories.json';
import registry from '../benchmarks/detectors.json';
import assignments from '../benchmarks/fixture-detectors.json';
import generatedFixtureIndex from '../benchmarks/fixture-index.json';
import scenarioRegistry from '../benchmarks/scenarios.json';
import { buildCatalog } from './model.mjs';
import { compareBaselineNames } from '../benchmarks/lib/baselines.ts';
import type { Baseline, Kind, Span, Tier } from './types';

export interface Fixture {
  id: string; slug: string; category: string; path: string; group: string;
  content: string; expected: Span[];
  detectors: string[]; issue?: number;
  twinOf?: string; mutation?: string; mutationKind?: string;
  assessment: { kind: Kind; tier: Tier; reason: string; contract?: string; sources: string[] };
  familyIds: string[]; scenarioIds: string[]; unscopedReason?: string;
  provenance: { categoryId: string; issue?: number; milestone?: string; release?: string };
}
export interface Scenario { id: string; title: string; description: string }
const files = import.meta.glob('../fixtures/**/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const categories = allCategories.filter(category => !('calibrationOnly' in category && category.calibrationOnly));
export const rawCorpora = Object.fromEntries(categories.map(c => [c.id, files[`../${c.corpus}`]]));
export const corpora = Object.fromEntries(categories.map(c => [c.id, JSON.parse(rawCorpora[c.id])]));
export const fixtureIndex = generatedFixtureIndex;
export const scenarios = scenarioRegistry.scenarios as Scenario[];
const semanticBySlug = new Map(fixtureIndex.fixtures.map(entry => [entry.slug, entry]));
const catalogFixtures = buildCatalog(categories, corpora, assignments, registry.detectors);
if (fixtureIndex.identity.fixtureCount !== catalogFixtures.length || semanticBySlug.size !== catalogFixtures.length) throw new Error('Fixture semantic index membership does not match the public catalog');
export const fixtures = catalogFixtures.map((fixture: Omit<Fixture, 'familyIds' | 'scenarioIds' | 'unscopedReason' | 'provenance'>) => {
  const semantic = semanticBySlug.get(fixture.slug);
  if (!semantic) throw new Error(`Missing fixture semantic index entry: ${fixture.slug}`);
  return { ...fixture, familyIds: semantic.familyIds, scenarioIds: semantic.scenarioIds, ...('unscopedReason' in semantic ? { unscopedReason: semantic.unscopedReason } : {}), provenance: semantic.provenance };
}) as Fixture[];
const baselineFiles = import.meta.glob('../baselines/*.json', { import: 'default', eager: true }) as Record<string, Baseline>;
/** Newest released comparison point, by the file-name order candidate evidence also uses (benchmarks/lib/baselines.ts). */
export const baselines: Baseline[] = Object.entries(baselineFiles).sort(([a], [b]) => compareBaselineNames(a, b)).map(([, b]) => b);
export const baseline: Baseline | undefined = baselines.at(-1);
export { registry };
export async function corpusHashes(): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(Object.entries(rawCorpora).map(async ([id, text]) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [id, Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')];
  })));
}
