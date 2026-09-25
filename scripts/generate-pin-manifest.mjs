import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildPinManifest, mergePinSources, packPinEntries } from '../benchmarks/lib/pin-manifest.ts';
import { loadPacks } from '../benchmarks/lib/adversarial-packs.ts';

const root = new URL('../', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, root), 'utf8'));

const [categories, registry, inventory, packageJson, assignments] = await Promise.all([
  read('benchmarks/categories.json'),
  read('benchmarks/detectors.json'),
  read('benchmarks/detector-inventory.json'),
  read('package.json'),
  read('benchmarks/fixture-detectors.json'),
]);

const corpusHashes = Object.fromEntries(await Promise.all(
  categories.map(async c => [c.id, createHash('sha256').update(await readFile(new URL(c.corpus, root), 'utf8')).digest('hex')]),
));

const pins = {
  sourceRevision: registry.sourceRevision,
  redactSecretRevision: inventory.redactSecretRevision,
  redactSecretVersion: inventory.redactSecretVersion,
  packageVersion: packageJson.dependencies['@redact-secret/core'],
};

const target = new URL('../benchmarks/pin-manifest.json', import.meta.url);
const currentText = await readFile(target, 'utf8').catch(error => {
  if (error.code === 'ENOENT') return null;
  throw error;
});
const current = currentText ? JSON.parse(currentText) : null;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fileURLToPath(root), encoding: 'utf8' }).trim();

// Frozen adversarial packs are pinned alongside the corpus categories (#310).
const sources = mergePinSources(
  { corpusHashes, fixtureIds: Object.keys(assignments) },
  packPinEntries(loadPacks(fileURLToPath(root)).map(pack => pack.record)),
);
const manifest = buildPinManifest({ pins, ...sources }, current, revision);
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;

if (process.argv.includes('--check')) {
  if (currentText !== serialized) throw new Error('Pin manifest drift. Run `npm run pins:manifest` and commit benchmarks/pin-manifest.json.');
  console.log('Pin manifest is up to date.');
} else if (currentText !== serialized) {
  await writeFile(target, serialized);
  console.log('Wrote benchmarks/pin-manifest.json');
} else {
  console.log('Pin manifest already up to date.');
}
