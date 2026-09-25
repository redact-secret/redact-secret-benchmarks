/**
 * CI gate (#256): every statistical scorer tuning manifest under
 * tuning/manifests/ satisfies schemas/tuning-manifest-v1.json and the rules in
 * benchmarks/lib/tuning-manifest.ts: tuning uses development categories only,
 * no holdout identity or path appears, the scoring identity matches its
 * component hashes, benchmark-generated rows stay under the cap overall and per
 * family, strata are consistent, and an active manifest's corpus hashes match
 * the current tree. Rules: docs/specs/statistical-tuning.md.
 *
 * Run: npm run tuning:check
 */
import { fileURLToPath } from 'node:url';
import {
  loadRepositoryState, loadTuningManifests, manifestSetProblems, TUNING_MANIFEST_DIRECTORY, validateTuningManifest,
} from '../benchmarks/lib/tuning-manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = loadRepositoryState(root);
const manifests = loadTuningManifests(root);
const failures = [
  ...manifestSetProblems(manifests),
  ...manifests.flatMap(({ file, manifest }) => validateTuningManifest(manifest, repo).map(p => `${file}: ${p}`)),
];

if (failures.length) {
  console.error(`Tuning manifest check failed:\n${failures.map(f => `  - ${f}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Tuning manifest check passed: ${manifests.length} manifest(s) under ${TUNING_MANIFEST_DIRECTORY}/ valid; holdout is referenced by none.`);
}
