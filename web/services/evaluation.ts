/**
 * The evaluation run, read from the bundle `npm run eval:publish` writes (#785, #789): the pointer
 * `public/results/evaluation-bundle-v1.json`, its manifest, one summary and bounded detail parts. The bundle is validated once, by
 * streaming one part at a time (`validateBundle`), against the corpus hashes of this checkout, before any page may use a number; the
 * summary stays in memory and the cases are read one method at a time. The full report is never rebuilt. A bundle that fails is not
 * shown and the reason is kept: `unusable`, or `stale` when its fixture corpus is not this checkout's.
 *
 * Supported legacy: when no bundle pointer exists, the old whole file `public/results/evaluation-v1.json` is read and checked as
 * before (the oracle and the rollback). `source` on a measured result says which one was read.
 *
 * The files are generated and never committed. When neither exists the result is `not-published` and every
 * evaluation page shows "Not measured" with the commands that produce it.
 *
 * The holdout page reads the qualification aggregate: the one embedded in the evaluation report when a
 * qualification was published with it, otherwise the frozen report committed at
 * `docs/specs/qualification/engine-v1.json`, labelled as frozen. Neither is computed here.
 */
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { POINTER_FILE, bundleCases, bundleReviews, resolveBundle, validateBundle, type BundleManifest, type Summary } from '../../benchmarks/evaluation/bundle/bundle.ts';
import { evaluationProblem } from '../../benchmarks/shared/evaluation-model.ts';
import type { EvaluationCase, EvaluationReport, QualificationEvidence } from '../../benchmarks/shared/evaluation-types.ts';
import { loadCatalogSources } from './catalog';
import { once, readJsonIfPresent, REPO_ROOT } from './repo';

export type { EvaluationReport, QualificationEvidence };
/** The report without its two large arrays: everything a page reads except the cases and reviews. */
export type EvaluationSummary = Summary;

/**
 * What a measured evaluation gives the pages. `report` is the summary only; the cases are read one method at a time through
 * `casesOf`, and `caseCounts` and `peerReviews` are reductions made while the bundle was validated. `source` says where it was read:
 * the validated bundle (the supported path), or the legacy whole-file `evaluation-v1.json` (the documented fallback, used only when no
 * bundle pointer exists, so the oracle and the rollback stay).
 */
export interface MeasuredEvaluation {
  state: 'measured';
  source: 'bundle' | 'legacy';
  report: EvaluationSummary;
  /** Cases per method, derived from the validated detail evidence (never from a field of the manifest). */
  caseCounts: Record<string, number>;
  /** Reviews that name a peer: the differential comparisons queued for review. */
  peerReviews: number;
  /** The cases of one method, read when asked. The most recent method is kept; no call holds the whole report. */
  casesOf(method: string): Promise<EvaluationCase[]>;
}
export type EvaluationLoad =
  | MeasuredEvaluation
  | { state: 'not-published'; reason: string }
  | { state: 'unusable'; reason: string }
  /** Valid in itself, but its fixture corpus is not this checkout's: never shown as fresh evidence. */
  | { state: 'stale'; reason: string };

/** Where the qualification aggregate came from: the published run, or the frozen report in the repository. */
export type QualificationLoad =
  | { state: 'recorded'; source: 'run' | 'frozen'; report: QualificationEvidence }
  | { state: 'not-recorded'; reason: string };

export const FROZEN_QUALIFICATION = 'docs/specs/qualification/engine-v1.json';

const RESULTS_DIR = () => process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results');
const LEGACY_FILE = 'evaluation-v1.json';
const exists = (file: string) => stat(file).then(() => true, () => false);
/** A page states why; it never prints a machine path. */
const publicPath = (message: string) => message.split(RESULTS_DIR()).join('public/results');
const refusal = (what: string, message: string): EvaluationLoad => {
  const reason = publicPath(message);
  return /^Stale evaluation/.test(message) ? { state: 'stale', reason: `${what}: ${reason}` } : { state: 'unusable', reason: `${what}: ${reason}` };
};

const peerReviewCount = async (dir: string, manifest: BundleManifest) => {
  let n = 0;
  for await (const review of bundleReviews(dir, manifest)) if (review.peer) n++;
  return n;
};

/** One method's cases, one part at a time into a single array; the last method read is kept so a page's two calls read once. */
function casesReader(read: (method: string) => Promise<EvaluationCase[]>) {
  let last: { method: string; cases: Promise<EvaluationCase[]> } | undefined;
  return (method: string) => {
    if (last?.method !== method) last = { method, cases: read(method) };
    return last.cases;
  };
}

async function loadBundle(): Promise<EvaluationLoad> {
  const what = `public/results/${POINTER_FILE}`;
  try {
    const { hashes } = await loadCatalogSources();
    const { directory, manifest } = await resolveBundle(RESULTS_DIR());
    const { summary, index } = await validateBundle(directory, { corpusHashes: hashes });
    const caseCounts: Record<string, number> = {};
    for (const c of index.cases.values()) caseCounts[c.method] = (caseCounts[c.method] ?? 0) + 1;
    const peerReviews = await peerReviewCount(directory, manifest);
    const casesOf = casesReader(async method => { const cases: EvaluationCase[] = []; for await (const c of bundleCases(directory, manifest, method)) cases.push(c); return cases; });
    return { state: 'measured', source: 'bundle', report: summary, caseCounts, peerReviews, casesOf };
  } catch (error) {
    return refusal(what, error instanceof Error ? error.message : 'The bundle could not be read.');
  }
}

async function loadLegacy(): Promise<EvaluationLoad> {
  let text: string;
  try {
    text = await readFile(path.join(RESULTS_DIR(), LEGACY_FILE), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'not-published', reason: `public/results/${POINTER_FILE} is absent, and so is the legacy whole-file public/results/${LEGACY_FILE}: no evaluation was published for this checkout.` };
    throw new Error(`public/results/${LEGACY_FILE} is unreadable: ${(error as Error).message}`);
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { state: 'unusable', reason: `public/results/${LEGACY_FILE} is not valid JSON.` };
  }
  const { hashes } = await loadCatalogSources();
  const problem = evaluationProblem(value, hashes);
  if (problem) return refusal(`public/results/${LEGACY_FILE}`, `${problem}: it does not match the evaluation contract or this checkout's fixtures.`);
  const { cases, reviews, ...summary } = value as EvaluationReport;
  const caseCounts: Record<string, number> = {};
  for (const c of cases) caseCounts[c.method] = (caseCounts[c.method] ?? 0) + 1;
  return { state: 'measured', source: 'legacy', report: summary, caseCounts, peerReviews: reviews.filter(r => r.peer).length, casesOf: casesReader(async method => cases.filter(c => c.method === method)) };
}

/**
 * The bundle wins. The legacy file is read only when no bundle pointer exists: a pointer that is present but whose bundle is missing,
 * corrupt, mixed, stale or incompatible is a stated refusal, never a fall back to older evidence and never zero.
 */
export function loadEvaluation(): Promise<EvaluationLoad> {
  return once('evaluation', async () => (await exists(path.join(RESULTS_DIR(), POINTER_FILE))) ? loadBundle() : loadLegacy());
}

const isQualification = (value: unknown): value is QualificationEvidence => {
  const q = value as QualificationEvidence | undefined;
  return Boolean(q && q.reportType === 'qualification' && q.supportClaims === false && q.holdout && Array.isArray(q.holdout.scanners));
};

export function loadQualification(): Promise<QualificationLoad> {
  return once('qualification', async () => {
    const evaluation = await loadEvaluation();
    if (evaluation.state === 'measured' && evaluation.report.qualification) return { state: 'recorded', source: 'run', report: evaluation.report.qualification };
    const frozen = await readJsonIfPresent<unknown>(FROZEN_QUALIFICATION);
    if (frozen === undefined) return { state: 'not-recorded', reason: `${FROZEN_QUALIFICATION} is absent and the evaluation was published without a qualification.` };
    if (!isQualification(frozen)) return { state: 'not-recorded', reason: `${FROZEN_QUALIFICATION} is not a qualification report this site can read.` };
    return { state: 'recorded', source: 'frozen', report: frozen };
  });
}
