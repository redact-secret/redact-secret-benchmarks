import categories from '../benchmarks/categories.json';
import registry from '../benchmarks/detectors.json';
import assignments from '../benchmarks/fixture-detectors.json';
import { buildCatalog } from './model.mjs';

export interface Fixture {
  id: string; slug: string; category: string; path: string; group: string;
  content: string; expected: { start: number; end: number; note?: string }[];
  detectors: string[]; issue?: number;
  assessment: { cohort: 'common-format' | 'masking' | 'malformed-example' | 'unreviewed'; reason: string; contract?: string; sources: string[] };
}
const files = import.meta.glob('../fixtures/**/*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const rawCorpora = Object.fromEntries(categories.map(c => [c.id, files[`../${c.corpus}`]]));
export const corpora = Object.fromEntries(categories.map(c => [c.id, JSON.parse(rawCorpora[c.id])]));
export const fixtures = buildCatalog(categories, corpora, assignments, registry.detectors) as Fixture[];
export { categories, registry };
export async function corpusHashes(): Promise<Record<string, string>> {
  return Object.fromEntries(await Promise.all(Object.entries(rawCorpora).map(async ([id, text]) => {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [id, Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')];
  })));
}
