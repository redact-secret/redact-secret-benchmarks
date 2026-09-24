import categories from '../benchmarks/categories.json';
import registry from '../benchmarks/detectors.json';
import assignments from '../benchmarks/fixture-detectors.json';
import { buildCatalog } from './model.mjs';
import { compareBaselineNames } from '../benchmarks/lib/baselines.ts';
import type { Baseline, Kind, Span, Tier } from './types';

export interface Fixture {
  id: string; slug: string; category: string; path: string; group: string;
  content: string; expected: Span[];
  detectors: string[]; issue?: number;
  twinOf?: string; mutation?: string; mutationKind?: string;
  assessment: { kind: Kind; tier: Tier; reason: string; contract?: string; sources: string[] };
}
const files = import.meta.glob('../fixtures/**/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const rawCorpora = Object.fromEntries(categories.map(c => [c.id, files[`../${c.corpus}`]]));
export const corpora = Object.fromEntries(categories.map(c => [c.id, JSON.parse(rawCorpora[c.id])]));
export const fixtures = buildCatalog(categories, corpora, assignments, registry.detectors) as Fixture[];
const baselineFiles = import.meta.glob('../baselines/*.json', { import: 'default', eager: true }) as Record<string, Baseline>;
/** Newest released comparison point, by the file-name order candidate evidence also uses (benchmarks/lib/baselines.ts). */
export const baselines: Baseline[] = Object.entries(baselineFiles).sort(([a], [b]) => compareBaselineNames(a, b)).map(([, b]) => b);
export const baseline: Baseline | undefined = baselines.at(-1);
export { categories, registry };
export async function corpusHashes(): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(Object.entries(rawCorpora).map(async ([id, text]) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [id, Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')];
  })));
}
