/**
 * Write the credential-eval inputs of one product-owned qualification population (#604): the corpus snapshot, a
 * release manifest in the shape credential-eval's evidence verifier reads, and the product-side case metadata.
 * Deterministic: the same corpus writes the same bytes. Reads fixtures only, never scanner output.
 *
 *   npm run qualification:export -- --population regression-corpus --out results-output/official/regression-corpus
 *
 * Files written to --out: credential-eval-corpus-snapshot.json, release-manifest.json, release-manifest.json.sha256,
 * case-metadata.json (policy facts keyed by case id; never part of the snapshot) and population.json (the identity).
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { exportPopulation, PRODUCT_POPULATIONS, type ProductPopulation } from '../benchmarks/qualification/population-snapshot.ts';

const usage = `Usage: qualification:export --population <${PRODUCT_POPULATIONS.join('|')}> --out <dir>`;
const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};
const population = option('population') as ProductPopulation | undefined;
const out = option('out');
if (!population || !PRODUCT_POPULATIONS.includes(population) || !out || args.length !== 4) throw new Error(usage);

const exported = await exportPopulation(population);
await mkdir(out, { recursive: true });
const write = (name: string, bytes: string) => writeFile(path.join(out, name), bytes);
await write('credential-eval-corpus-snapshot.json', exported.snapshotBytes);
await write('release-manifest.json', exported.manifestBytes);
await write('release-manifest.json.sha256', `${exported.manifestDigest.slice('sha256:'.length)}  release-manifest.json\n`);
await write('case-metadata.json', `${JSON.stringify(exported.metadata)}\n`);
await write('population.json', `${JSON.stringify({
  population, categories: exported.categories, caseCount: exported.caseCount, tag: exported.tag,
  corpusDigest: exported.corpusDigest, manifestDigest: exported.manifestDigest, revision: (exported.snapshot.identity as { revision: string }).revision,
  source: (exported.snapshot.identity as { source: string }).source,
}, null, 2)}\n`);
console.log(`${population}: ${exported.caseCount} cases from ${exported.categories.length} categories; tag ${exported.tag}; corpus ${exported.corpusDigest}; manifest ${exported.manifestDigest}`);
