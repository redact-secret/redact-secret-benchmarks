/**
 * Authored fixture titles and descriptions (#593; docs/specs/fixture-metadata.md).
 *
 *   npm run evidence:case-metadata               derive benchmarks/evidence-case-metadata.json from the pinned credential-evidence release
 *   npm run evidence:case-metadata -- --verify   re-derive it and fail unless the committed file is byte-identical (network: gh release download)
 *   npm run fixture-metadata:check               offline: the projection is bound to the registry's pin and well formed, and every authored
 *                                                 description in benchmarks/fixture-descriptions.json names a fixture of a product-owned category
 *
 * The release files are downloaded into results-output/evidence-case-metadata/ (or --dir <dir>) and checked against the release manifest
 * whose digest the registry pins (benchmarks/official-runs.json, population public-evidence-snapshot). Nothing upstream is written, and no
 * corpus, fixture index or hash manifest is read for writing: the titles are display text only.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  EVIDENCE_CASE_METADATA_FILE, EVIDENCE_REPOSITORY, FIXTURE_DESCRIPTIONS_FILE, MATERIALIZED_MANIFEST_ASSET, RECORDS_BUNDLE_ASSET,
  deriveEvidenceCaseMetadata, evidenceCaseMetadataProblems, fixtureDescriptionsProblems, serializeCaseMetadata,
} from '../benchmarks/lib/fixture-metadata.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = rel => JSON.parse(readFileSync(path.join(root, rel), 'utf8'));
const args = process.argv.slice(2);
const option = name => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const mode = args.includes('--check') ? 'check' : args.includes('--verify') ? 'verify' : 'write';

const pin = read('benchmarks/official-runs.json').populations.find(p => p.id === 'public-evidence-snapshot')?.evidence;
if (!pin?.release?.tag) throw new Error('benchmarks/official-runs.json pins no evidence release for public-evidence-snapshot');

/** Every fixture slug of a product-owned category: the only fixtures this repository may author a description for. */
function productSlugs() {
  const populations = read('benchmarks/generated-populations.json').populations.filter(p => p.ownership === 'product');
  const owned = new Set(populations.flatMap(p => p.categories));
  const slugs = new Set();
  for (const c of read('benchmarks/categories.json').filter(c => owned.has(c.id))) {
    if (!existsSync(path.join(root, c.corpus))) throw new Error(`${c.corpus} is missing: run npm run fixtures:ensure:product first`);
    for (const f of read(c.corpus).fixtures) slugs.add(`${c.id}--${f.id}`);
  }
  return slugs;
}

if (mode === 'check') {
  const problems = [
    ...evidenceCaseMetadataProblems(read(EVIDENCE_CASE_METADATA_FILE), pin).map(p => `${EVIDENCE_CASE_METADATA_FILE}: ${p}`),
    ...fixtureDescriptionsProblems(read(FIXTURE_DESCRIPTIONS_FILE), productSlugs()).map(p => `${FIXTURE_DESCRIPTIONS_FILE}: ${p}`),
  ];
  if (problems.length) { console.error(problems.map(p => `  - ${p}`).join('\n')); process.exit(1); }
  const meta = read(EVIDENCE_CASE_METADATA_FILE);
  console.log(`Fixture metadata ok: ${Object.keys(meta.fixtures).length} public fixtures carry the title of one of ${Object.keys(meta.cases).length} case records of ${meta.source.tag}; ${Object.keys(read(FIXTURE_DESCRIPTIONS_FILE).fixtures).length} product-owned descriptions authored here`);
} else {
  const dir = path.resolve(option('dir') ?? path.join(root, 'results-output/evidence-case-metadata'));
  mkdirSync(dir, { recursive: true });
  const assets = ['release-manifest.json', RECORDS_BUNDLE_ASSET, MATERIALIZED_MANIFEST_ASSET];
  if (!assets.every(a => existsSync(path.join(dir, a))))
    execFileSync('gh', ['release', 'download', pin.release.tag, '-R', EVIDENCE_REPOSITORY, '-D', dir, ...assets.flatMap(a => ['-p', a]), '--clobber'], { stdio: 'inherit' });
  const derived = serializeCaseMetadata(deriveEvidenceCaseMetadata({
    pin, manifestBytes: readFileSync(path.join(dir, 'release-manifest.json')),
    recordsBundleBytes: readFileSync(path.join(dir, RECORDS_BUNDLE_ASSET)), materializedBytes: readFileSync(path.join(dir, MATERIALIZED_MANIFEST_ASSET)),
  }));
  const target = path.join(root, EVIDENCE_CASE_METADATA_FILE);
  if (mode === 'verify') {
    if (!existsSync(target) || readFileSync(target, 'utf8') !== derived) { console.error(`${EVIDENCE_CASE_METADATA_FILE} is not the derivation of ${pin.release.tag}: run npm run evidence:case-metadata`); process.exit(1); }
    console.log(`${EVIDENCE_CASE_METADATA_FILE} is the derivation of ${pin.release.tag}`);
  } else {
    writeFileSync(target, derived);
    console.log(`Wrote ${EVIDENCE_CASE_METADATA_FILE} from ${pin.release.tag}`);
  }
}
