/**
 * CI gate (#254, #255): candidate-level feature vectors and calibration
 * decision-boundary detail never reach the public site.
 *
 * The site is built from public/ and published from dist/. This check fails
 * when any file under either directory is, or embeds, a candidate-feature
 * dataset (by name or by its `"datasetType":"candidate-features"` /
 * `candidate-features-v1.json` schema marker), and when the default output
 * path under results-output/ is not git-ignored. Run it after `npm run build`
 * so dist/ is covered. Rules: docs/specs/candidate-features.md §5.
 *
 * #255 extends it to the calibration experiments: the maintainer-local result
 * and the tuning-manifest draft (weights, caps, thresholds, per-configuration
 * ids) must not appear on a public surface at all, and a calibration public
 * projection that does appear must pass the projection whitelist
 * (benchmarks/lib/calibration-projection.mjs). Rules:
 * docs/specs/calibration-experiments.md §6.
 *
 * Run: npm run features:check-public [-- --root=<dir>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTION_TYPE, projectionProblems } from '../benchmarks/lib/calibration-projection.mjs';

export const PUBLIC_DIRECTORIES = ['public', 'dist'];
const NAME = /candidate-features|calibration-experiments|tuning-manifest-draft/i;
const MARKERS = [
  /"datasetType"\s*:\s*"candidate-features"/, /datasetType:\s*["']candidate-features["']/, /candidate-features-v1\.json/, /"manifestBinding"\s*:/,
  /"datasetType"\s*:\s*"calibration-experiments"/, /datasetType:\s*["']calibration-experiments["']/, /calibration-experiments-v1\.(json|md)/, /"draftNotes"\s*:/,
];
const PROJECTION = new RegExp(`"datasetType"\\s*:\\s*"${PROJECTION_TYPE}"`);
/** Local outputs that must stay git-ignored. */
export const IGNORED_OUTPUTS = [
  'results-output/calibration/candidate-features-v1.json',
  'results-output/calibration/calibration-experiments-v1.json',
  'results-output/calibration/calibration-experiments-v1.md',
  'results-output/calibration/tuning-manifest-draft.json',
];
const TEXT = /\.(json|js|mjs|cjs|html|css|txt|map|md|csv|jsonl|svg|xml)$/i;

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(file);
    else if (entry.isFile()) yield file;
  }
}

/** Problems for one repository root; empty when no public surface carries a feature dataset. */
export function exclusionProblems(root, { checkIgnore = true } = {}) {
  const problems = [];
  for (const name of PUBLIC_DIRECTORIES) {
    const directory = path.join(root, name);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) continue;
    for (const file of walk(directory)) {
      const relative = path.relative(root, file);
      if (NAME.test(path.basename(file))) { problems.push(`${relative}: a candidate-feature dataset file is on the public surface`); continue; }
      if (!TEXT.test(file)) continue;
      const text = readFileSync(file, 'utf8');
      if (MARKERS.some(marker => marker.test(text))) { problems.push(`${relative}: embeds candidate-feature dataset or calibration experiment content; both are maintainer-local only`); continue; }
      if (PROJECTION.test(text)) {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { problems.push(`${relative}: embeds a calibration projection that is not a standalone JSON document, so its shape cannot be checked`); continue; }
        for (const problem of projectionProblems(parsed)) problems.push(`${relative}: ${problem}`);
      }
    }
  }
  if (checkIgnore) {
    for (const output of IGNORED_OUTPUTS) {
      try {
        execFileSync('git', ['check-ignore', '-q', output], { cwd: root, stdio: 'ignore' });
      } catch {
        problems.push(`.gitignore: ${output} must stay ignored so local calibration data cannot be committed`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootArgument = process.argv.slice(2).find(a => a.startsWith('--root='));
  const root = rootArgument ? path.resolve(rootArgument.slice('--root='.length)) : fileURLToPath(new URL('../', import.meta.url));
  const problems = exclusionProblems(root);
  if (problems.length) {
    console.error(`Candidate-feature publication check failed:\n${problems.map(p => `  - ${p}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Candidate-feature and calibration publication check passed: nothing under ${PUBLIC_DIRECTORIES.join('/, ')}/ carries a feature dataset or calibration boundary detail; results-output/ is ignored.`);
  }
}
