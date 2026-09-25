/**
 * Builds the maintainer-local candidate-feature dataset (#254). Reads the
 * development and regression corpora only, never holdout, runs no scanner and
 * leaves the measurement-v4 scorer untouched.
 *
 *   npm run features:extract                      # -> results-output/calibration/candidate-features-v1.json
 *   npm run features:extract -- --output=results-output/calibration/other.json
 *
 * The output is refused anywhere outside results-output/ (git-ignored, never
 * projected to the site). stdout carries counts and hashes only.
 * Spec: docs/specs/candidate-features.md.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFAULT_OUTPUT, buildDataset, extractorSourceHash, holdoutIdentifiers, loadCategoryInputs, resolveNonPublicOutput,
} from './lib/candidate-features.ts';

const root = fileURLToPath(new URL('../', import.meta.url));

function git(args: string[]) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

const options: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  const match = /^--(output)=(.+)$/.exec(arg);
  if (!match || match[1] in options) throw new Error('Usage: npm run features:extract -- [--output=results-output/calibration/<name>.json]');
  options[match[1]] = match[2];
}

const output = resolveNonPublicOutput(root, options.output ?? DEFAULT_OUTPUT);
const dataset = buildDataset(loadCategoryInputs(root), {
  sourceHash: extractorSourceHash(root),
  commit: git(['rev-parse', 'HEAD']) ?? 'unknown',
  dirty: git(['status', '--porcelain']) !== '',
  holdoutIdentifiers: holdoutIdentifiers(root, readdirSync(path.join(root, 'holdout'))),
});
mkdirSync(path.dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(dataset, null, 2) + '\n', { mode: 0o600 });

const tuning = dataset.rows.filter(r => r.tuningEligible).length;
console.log([
  `Candidate feature dataset written to ${path.relative(root, output)} (maintainer-local; never publish it).`,
  `  extractor ${dataset.extractor.version}, source ${dataset.extractor.sourceHash}`,
  `  features ${dataset.featureSchema.id} (redact-secret ${dataset.featureSchema.sourceRevision.slice(0, 12)})`,
  `  dataset ${dataset.datasetHash}${dataset.benchmark.dirty ? ' (benchmark tree dirty: not citable in a tuning manifest)' : ''}`,
  `  rows: ${dataset.rows.length} (${tuning} development/tuning-eligible, ${dataset.rows.length - tuning} regression/evaluation-only) from ${dataset.corpora.length} categories; holdout read: none`,
].join('\n'));
