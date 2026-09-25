/**
 * CI gate (#254): candidate-level feature vectors never reach the public site.
 *
 * The site is built from public/ and published from dist/. This check fails
 * when any file under either directory is, or embeds, a candidate-feature
 * dataset (by name or by its `"datasetType":"candidate-features"` /
 * `candidate-features-v1.json` schema marker), and when the default output
 * path under results-output/ is not git-ignored. Run it after `npm run build`
 * so dist/ is covered. Rules: docs/specs/candidate-features.md §5.
 *
 * Run: npm run features:check-public [-- --root=<dir>]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_DIRECTORIES = ['public', 'dist'];
const NAME = /candidate-features/i;
const MARKERS = [/"datasetType"\s*:\s*"candidate-features"/, /datasetType:\s*["']candidate-features["']/, /candidate-features-v1\.json/, /"manifestBinding"\s*:/];
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
      if (MARKERS.some(marker => marker.test(text))) problems.push(`${relative}: embeds candidate-feature dataset content; candidate-level vectors are maintainer-local only`);
    }
  }
  if (checkIgnore) {
    try {
      execFileSync('git', ['check-ignore', '-q', 'results-output/calibration/candidate-features-v1.json'], { cwd: root, stdio: 'ignore' });
    } catch {
      problems.push('.gitignore: results-output/ must stay ignored so a local feature dataset cannot be committed');
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
    console.log(`Candidate-feature publication check passed: nothing under ${PUBLIC_DIRECTORIES.join('/, ')}/ carries a feature dataset; results-output/ is ignored.`);
  }
}
