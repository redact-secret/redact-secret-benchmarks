/**
 * Runs the maintainer-local calibration experiments (#255) over the #254
 * candidate-feature dataset. Tunes on the authored development partition,
 * evaluates on held-out development and regression rows, never reads holdout,
 * and changes no product threshold or enforcement.
 *
 *   npm run features:extract && npm run calibration:run
 *   npm run calibration:run -- --dataset=results-output/calibration/candidate-features-v1.json
 *   npm run calibration:run -- --product=results-output/calibration/product.json   # bind a frozen candidate
 *
 * Writes, all under results-output/calibration/ (git-ignored, never published):
 *   calibration-experiments-v1.json       full result: weights, caps, thresholds, strata (maintainer-local)
 *   calibration-experiments-v1.md         the same as a readable report (maintainer-local)
 *   tuning-manifest-draft.json            #256 manifest draft for the selected configuration (hashes and counts only)
 *   calibration-public-projection-v1.json aggregate outcomes and identities only; checked against the projection whitelist
 * stdout carries identities, counts and hashes only. Spec: docs/specs/calibration-experiments.md.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalJson } from './lib/adversarial-intake.ts';
import { DEFAULT_OUTPUT as DEFAULT_DATASET, resolveNonPublicOutput, type CandidateFeatureDataset } from './lib/candidate-features.ts';
import {
  DEFAULT_MANIFEST_DRAFT, DEFAULT_OUTPUT, DEFAULT_PROJECTION, DEFAULT_REPORT, SELECTION_SOURCES,
  buildManifestDraft, buildProjection, renderReport, runExperiments,
} from './lib/calibration-experiments.ts';
import { assertPublicProjection, MIN_STRATUM_ROWS } from './lib/calibration-projection.mjs';
import {
  calibrationPartitionCoverage, calibrationPartitionProblems, type CalibrationPartition,
} from './lib/calibration-partition.ts';
import { loadRepositoryState, scoringIdentity, validateTuningManifest, type ScoringComponents } from './lib/tuning-manifest.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha256 = (input: string | Buffer) => createHash('sha256').update(input).digest('hex');

const options: Record<string, string> = {};
for (const arg of process.argv.slice(2)) {
  const match = /^--(dataset|product)=(.+)$/.exec(arg);
  if (!match || match[1] in options) throw new Error('Usage: npm run calibration:run -- [--dataset=results-output/calibration/<dataset>.json] [--product=<candidate identity json>]');
  options[match[1]] = match[2];
}

const datasetPath = resolveNonPublicOutput(root, options.dataset ?? DEFAULT_DATASET);
const dataset: CandidateFeatureDataset = JSON.parse(readFileSync(datasetPath, 'utf8'));
if (dataset.datasetType !== 'candidate-features' || dataset.holdoutAccess !== 'none') throw new Error('Not a candidate-feature dataset.');

const partition: CalibrationPartition = JSON.parse(readFileSync(path.join(root, 'tuning/shadow-scoring-development-v1.json'), 'utf8'));
const partitionProblems = calibrationPartitionProblems(partition, dataset);
if (partitionProblems.length) throw new Error(`Invalid calibration partition:\n${partitionProblems.join('\n')}`);
const result = {
  ...runExperiments(dataset, { tuningCategories: partition.tuningCategories }),
  partition: { id: partition.id, coverage: calibrationPartitionCoverage(partition, dataset) },
};
const selectionSourceHash = sha256(canonicalJson(SELECTION_SOURCES.map(file => ({ file, sha256: sha256(readFileSync(path.join(root, file))) }))));

const product = options.product ? JSON.parse(readFileSync(path.resolve(root, options.product), 'utf8')) : null;
let createdAt = '1970-01-01';
try { createdAt = execFileSync('git', ['show', '-s', '--format=%cs', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(); } catch { /* keep the fixed fallback */ }
const repo = loadRepositoryState(root);
const draft = buildManifestDraft(result, dataset, { createdAt, selectionSourceHash, corpusHashes: repo.corpusHashes, product }, c => scoringIdentity(c as unknown as ScoringComponents));
// Validate every #256 rule. Until a candidate carries this scoring, product is a labelled placeholder for validation only.
const { draftNotes, ...manifest } = draft;
const placeholder = { sourceRevision: '0'.repeat(40), sourceHash: '0'.repeat(64), lockHash: '0'.repeat(64), candidateArtifactHash: '0'.repeat(64) };
const manifestProblems = validateTuningManifest({ ...manifest, product: manifest.product ?? placeholder }, repo);

const tuningShare = draftNotes.tuningGeneratedShare;
const projection = buildProjection(result, draft.scoring.identity, selectionSourceHash, { tuningShare, overrideApplied: false }, MIN_STRATUM_ROWS);
assertPublicProjection(projection);

const write = (target: string, text: string) => {
  const file = resolveNonPublicOutput(root, target);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, { mode: 0o600 });
  return path.relative(root, file);
};
const written = [
  write(DEFAULT_OUTPUT, JSON.stringify(result, null, 2) + '\n'),
  write(DEFAULT_REPORT, renderReport(result, manifestProblems)),
  write(DEFAULT_MANIFEST_DRAFT, JSON.stringify(draft, null, 2) + '\n'),
  write(DEFAULT_PROJECTION, JSON.stringify(projection, null, 2) + '\n'),
];

console.log([
  `Calibration experiments written (maintainer-local; never publish them): ${written.join(', ')}`,
  `  dataset ${dataset.datasetHash} (${dataset.extractor.version})${dataset.benchmark.dirty ? ' (benchmark tree dirty: not citable in a tuning manifest)' : ''}`,
  `  ${result.configurations.length} configurations; ${result.configurations.filter(c => c.adrConformant).length} contract-conformant; tuned on ${result.rows.development} authored development rows, evaluated on ${result.rows.developmentEvaluation} held-out development + ${result.rows.regressionEvaluation} regression rows; holdout read: none`,
  `  tuning coverage ${result.partition.coverage.length} families; each has reviewed positive and negative rows`,
  `  selection source ${selectionSourceHash}; scoring identity ${draft.scoring.identity}`,
  `  generated share of tuning rows ${(100 * tuningShare).toFixed(1)}% (cap 50%): no override`,
  `  tuning manifest draft: ${manifestProblems.length ? `${manifestProblems.length} problem(s), see the report` : 'passes every rule'}${product ? '' : ' (product binding pending)'}`,
].join('\n'));
