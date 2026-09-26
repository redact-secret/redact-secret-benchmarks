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
 * #289 extends it to the score-evasion evaluation: the maintainer-local
 * variants, raw shadow-evaluation output, plain-scan output and per-variant
 * detail (scores, bands, signals, which operators moved a band) must not
 * appear on a public surface, and must not be committed anywhere in the
 * tree. Only the closed aggregate (schemas/score-evasion-aggregate-v1.json)
 * may be; tests/score-evasion.test.mjs validates every committed copy. Rules:
 * docs/specs/score-evasion.md §5.
 *
 * Run: npm run features:check-public [-- --root=<dir>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECTION_TYPE, projectionProblems } from '../benchmarks/lib/calibration-projection.mjs';

export const PUBLIC_DIRECTORIES = ['public', 'dist'];
const NAME = /candidate-features|calibration-experiments|tuning-manifest-draft|score-evasion-(?:detail|inputs)|shadow-run-\d/i;
const MARKERS = [
  /"datasetType"\s*:\s*"candidate-features"/, /datasetType:\s*["']candidate-features["']/, /candidate-features-v1\.json/, /"manifestBinding"\s*:/,
  /"datasetType"\s*:\s*"calibration-experiments"/, /datasetType:\s*["']calibration-experiments["']/, /calibration-experiments-v1\.(json|md)/, /"draftNotes"\s*:/,
];
/** Maintainer-local score-evasion content (#289): raw shadow-evaluation records and the per-variant detail. */
export const EVASION_MARKERS = [
  /"record"\s*:\s*"shadow-(?:comparison|evaluation|error)"/, /"evaluationVersion"\s*:\s*"score-evasion\//, /"movedVariants"\s*:/, /"boundarySweeps"\s*:/,
];
const PROJECTION = new RegExp(`"datasetType"\\s*:\\s*"${PROJECTION_TYPE}"`);
/** Local outputs that must stay git-ignored. */
export const IGNORED_OUTPUTS = [
  'results-output/calibration/candidate-features-v1.json',
  'results-output/calibration/calibration-experiments-v1.json',
  'results-output/calibration/calibration-experiments-v1.md',
  'results-output/calibration/tuning-manifest-draft.json',
  'results-output/score-evasion/detail.json',
  'results-output/score-evasion/inputs.jsonl',
  'results-output/score-evasion/shadow-run-1.jsonl',
  'results-output/score-evasion/plain-scan.json',
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
/** Tracked files anywhere in the tree that carry maintainer-local score-evasion content (#289). */
export function trackedEvasionProblems(root) {
  let files;
  try { files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 26 }).split('\0').filter(Boolean); } catch { return []; }
  const problems = [];
  for (const relative of files) {
    if (!TEXT.test(relative) || relative.startsWith('node_modules/')) continue;
    const file = path.join(root, relative);
    if (!existsSync(file) || statSync(file).size > 1 << 24) continue;
    const text = readFileSync(file, 'utf8');
    if (EVASION_MARKERS.some(marker => marker.test(text))) problems.push(`${relative}: tracked file carries score-evasion variants, shadow-evaluation records or per-variant detail; keep them under results-output/`);
  }
  return problems;
}

export function exclusionProblems(root, { checkIgnore = true, checkTracked = true } = {}) {
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
      if (EVASION_MARKERS.some(marker => marker.test(text))) { problems.push(`${relative}: embeds score-evasion variants, shadow-evaluation records or per-variant detail; only the aggregate may be published`); continue; }
      if (PROJECTION.test(text)) {
        let parsed = null;
        try { parsed = JSON.parse(text); } catch { problems.push(`${relative}: embeds a calibration projection that is not a standalone JSON document, so its shape cannot be checked`); continue; }
        for (const problem of projectionProblems(parsed)) problems.push(`${relative}: ${problem}`);
      }
    }
  }
  if (checkTracked) problems.push(...trackedEvasionProblems(root));
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
    console.log(`Candidate-feature, calibration and score-evasion publication check passed: nothing under ${PUBLIC_DIRECTORIES.join('/, ')}/ carries a feature dataset, calibration boundary detail or score-evasion detail, no tracked file carries score-evasion detail, and results-output/ is ignored.`);
  }
}
