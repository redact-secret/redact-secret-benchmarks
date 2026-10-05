/**
 * The evaluation run, read from what `npm run eval:discover` and `npm run eval:publish` write to
 * `public/results/evaluation-v1.json`. The existing site fetches the same file in the browser and
 * re-validates it with `evaluationProblem` (benchmarks/shared/evaluation-model.ts); here it is read at build time and
 * checked with that same function, against the corpus hashes of this checkout, before any page may use a
 * number. A report that fails is not shown and the reason is kept, never a partial read.
 *
 * The file is generated and never committed. When it is absent the result is `not-published` and every
 * evaluation page shows "Not measured" with the commands that produce it.
 *
 * The holdout page reads the qualification aggregate: the one embedded in the evaluation report when a
 * qualification was published with it, otherwise the frozen report committed at
 * `docs/specs/qualification/engine-v1.json`, labelled as frozen. Neither is computed here.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { evaluationProblem } from '../../benchmarks/shared/evaluation-model.ts';
import type { EvaluationReport, QualificationEvidence } from '../../benchmarks/shared/evaluation-types.ts';
import { loadCatalogSources } from './catalog';
import { once, readJsonIfPresent, REPO_ROOT } from './repo';

export type { EvaluationReport, QualificationEvidence };
export type EvaluationLoad = { state: 'measured'; report: EvaluationReport } | { state: 'not-published'; reason: string } | { state: 'unusable'; reason: string };

/** Where the qualification aggregate came from: the published run, or the frozen report in the repository. */
export type QualificationLoad =
  | { state: 'recorded'; source: 'run' | 'frozen'; report: QualificationEvidence }
  | { state: 'not-recorded'; reason: string };

export const FROZEN_QUALIFICATION = 'docs/specs/qualification/engine-v1.json';

const RESULTS_DIR = () => process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results');

export function loadEvaluation(): Promise<EvaluationLoad> {
  return once('evaluation', async () => {
    let text: string;
    try {
      text = await readFile(path.join(RESULTS_DIR(), 'evaluation-v1.json'), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'not-published', reason: 'public/results/evaluation-v1.json is absent: no evaluation was published for this checkout.' };
      throw new Error(`public/results/evaluation-v1.json is unreadable: ${(error as Error).message}`);
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      return { state: 'unusable', reason: 'public/results/evaluation-v1.json is not valid JSON.' };
    }
    const { hashes } = await loadCatalogSources();
    const problem = evaluationProblem(value, hashes);
    if (problem) return { state: 'unusable', reason: `${problem}: public/results/evaluation-v1.json does not match the evaluation contract or this checkout's fixtures.` };
    return { state: 'measured', report: value as EvaluationReport };
  });
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
