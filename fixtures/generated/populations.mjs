import { readFileSync } from 'node:fs';

/**
 * Ownership of the generated credential categories (#659, docs/specs/generated-populations.md). Pure: no corpus is built here, and no count or hash is read.
 * `benchmarks/generated-populations.json` lists the product populations' categories explicitly; the one population marked `remainder` (the public evidence population's legacy
 * development output) owns every other generated category, so a new family needs no edit here and a product category can never be absorbed silently.
 */
export const POPULATIONS_FILE = new URL('../../benchmarks/generated-populations.json', import.meta.url);

export function loadPopulations(file = POPULATIONS_FILE) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/** The categories of one population among `generatedIds`, in generation order. */
export function categoriesOf(manifest, id, generatedIds) {
  const population = manifest.populations.find(p => p.id === id);
  if (!population) throw new Error(`Unknown generated population ${id}; known: ${manifest.populations.map(p => p.id).join(', ')}`);
  if (population.remainder) {
    const claimed = new Set(manifest.populations.filter(p => !p.remainder).flatMap(p => p.categories ?? []));
    return generatedIds.filter(c => !claimed.has(c));
  }
  return generatedIds.filter(c => population.categories.includes(c));
}

/**
 * Problems of the partition. `generatedIds` are the categories buildCorpora() returned; `qualificationInputs` is benchmarks/qualification-inputs.json;
 * `regressionManifest` is corpora/regression/manifest.json. Each is a parsed object.
 */
export function populationProblems({ manifest, generatedIds, qualificationInputs, regressionManifest }) {
  const problems = [];
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.populations)) return ['generated-populations.json: schemaVersion 1 and a populations array are required'];
  const ids = manifest.populations.map(p => p.id);
  if (new Set(ids).size !== ids.length) problems.push('generated-populations.json: a population id is repeated');
  const known = new Set((qualificationInputs?.populations ?? []).map(p => p.id));
  for (const id of ids) if (!known.has(id)) problems.push(`population ${id} is not a population of benchmarks/qualification-inputs.json`);
  const remainders = manifest.populations.filter(p => p.remainder);
  if (remainders.length !== 1) problems.push(`exactly one population owns the remainder, found ${remainders.length}`);
  const seen = new Map();
  for (const p of manifest.populations) {
    if (p.remainder && p.categories !== undefined) problems.push(`population ${p.id} owns the remainder and lists no categories`);
    if (!p.remainder && (!Array.isArray(p.categories) || !p.categories.length)) problems.push(`population ${p.id} lists no categories`);
    for (const c of p.categories ?? []) {
      if (seen.has(c)) problems.push(`category ${c} is in ${seen.get(c)} and ${p.id}`);
      seen.set(c, p.id);
      if (!generatedIds.includes(c)) problems.push(`population ${p.id} names ${c}, which no generator builds`);
    }
    for (const c of p.qualificationOnlyCategories ?? []) if (generatedIds.includes(c)) problems.push(`population ${p.id} lists ${c} as qualification-only, but a generator writes it`);
  }
  // The product populations agree with the files that already name them.
  const regression = manifest.populations.find(p => p.id === 'regression-corpus');
  if (regression && regressionManifest) {
    const listed = regressionManifest.categories.filter(c => generatedIds.includes(c)).sort();
    if (JSON.stringify(listed) !== JSON.stringify([...(regression.categories ?? [])].sort())) problems.push('regression-corpus categories differ from the generated categories of corpora/regression/manifest.json');
    const extra = [...(regressionManifest.qualificationCategories ?? [])].sort();
    if (JSON.stringify(extra) !== JSON.stringify([...(regression.qualificationOnlyCategories ?? [])].sort())) problems.push('regression-corpus qualificationOnlyCategories differ from corpora/regression/manifest.json');
  }
  const policy = manifest.populations.find(p => p.id === 'policy-corpus');
  const policyCategory = qualificationInputs?.populations?.find(p => p.id === 'policy-corpus')?.currentLocation?.category;
  if (policy && policyCategory && JSON.stringify(policy.categories) !== JSON.stringify([policyCategory])) problems.push('policy-corpus category differs from benchmarks/qualification-inputs.json');
  return problems;
}
