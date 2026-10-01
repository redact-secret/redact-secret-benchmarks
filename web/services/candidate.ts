/**
 * The release candidate and the last release, read the way the existing Workbench reads them
 * (`src/pages/workbench/changes.ts`, `src/main.ts`):
 *
 *  - the candidate is the evidence `npm run eval:candidate` writes to
 *    `public/results/candidate-evidence-v1.json`, validated with `candidateProblem`
 *    (src/evaluation-model.ts, the schema `schemas/candidate-report-v1.json`). Like the run files it is
 *    generated and never committed: a build that did not measure a candidate has none, and says so.
 *    Committed `evidence/<issue>/` runs are history for their issue, never "the candidate in development";
 *  - the last release is the saved comparison point `baselines/<version>.json` (run id, saved date) plus
 *    the released product commit `benchmarks/pin-manifest.json` pins for that version;
 *  - the performance reference is the accepted run (`services/performance.ts`).
 *
 * Nothing is derived here. Counts come from `changeRows`/`candidatePairs` in the resolver.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { compareBaselineNames } from '../../benchmarks/lib/baselines';
import { candidateProblem, type CandidateReport } from '../../src/evaluation-model';
import { loadOwnPerformance, type OwnPerformance } from './performance';
import { once, readJson, readJsonIfPresent, REPO_ROOT } from './repo';

export const CANDIDATE_FILE = 'candidate-evidence-v1.json';

/** What a saved release baseline records about itself (`baselines/<version>.json`). */
export interface ReleaseBaseline {
  version: string;
  runId: string | null;
  savedAt: string | null;
  /** The benchmark commit the baseline was saved at. */
  benchmarkRevision: string | null;
}

export interface LastRelease {
  /** The version the benchmark pins and measures as "published". */
  version: string;
  /** The released product commit, when the pin manifest names one for this version. */
  commit: string | null;
  /** The saved baseline for this version; null when no `baselines/<version>.json` exists. */
  baseline: ReleaseBaseline | null;
}

export type CandidateLoad =
  | { state: 'not-recorded'; reason: string }
  | { state: 'invalid'; reason: string }
  | { state: 'recorded'; report: CandidateReport; /** The baseline file the report compared against, when it is saved here. */ against: ReleaseBaseline | null };

export interface RcSources {
  candidate: CandidateLoad;
  release: LastRelease;
  performance: OwnPerformance;
}

interface PinManifest { pins: { redactSecretVersion: string; releaseSourceRevision: string } }
interface BaselineFile { version?: string; runId?: string; savedAt?: string; revision?: string }

const resultsDir = () => process.env.WEB_RESULTS_DIR ?? path.join(REPO_ROOT, 'public', 'results');

async function baselineFor(version: string): Promise<ReleaseBaseline | null> {
  const file = await readJsonIfPresent<BaselineFile>(`baselines/${version}.json`);
  if (!file) return null;
  return { version, runId: file.runId ?? null, savedAt: file.savedAt ?? null, benchmarkRevision: file.revision ?? null };
}

async function loadRelease(): Promise<LastRelease> {
  const pins = (await readJson<PinManifest>('benchmarks/pin-manifest.json')).pins;
  const names = (await readdir(path.join(REPO_ROOT, 'baselines'))).filter(n => n.endsWith('.json')).sort(compareBaselineNames);
  // The pinned release when a baseline is saved for it; otherwise the newest saved baseline, as the Workbench picks it.
  const pinned = await baselineFor(pins.redactSecretVersion);
  if (pinned) return { version: pins.redactSecretVersion, commit: pins.releaseSourceRevision, baseline: pinned };
  const newest = names.at(-1)?.replace(/\.json$/, '');
  return { version: newest ?? pins.redactSecretVersion, commit: newest ? null : pins.releaseSourceRevision, baseline: newest ? await baselineFor(newest) : null };
}

async function loadCandidate(): Promise<CandidateLoad> {
  let text: string;
  try {
    text = await readFile(path.join(resultsDir(), CANDIDATE_FILE), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'not-recorded', reason: `public/results/${CANDIDATE_FILE} is absent: no release candidate was measured for this build.` };
    throw new Error(`public/results/${CANDIDATE_FILE} is unreadable: ${(error as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: 'invalid', reason: 'Candidate evidence is unreadable (not JSON).' };
  }
  const problem = candidateProblem(parsed);
  if (problem) return { state: 'invalid', reason: problem };
  const report = parsed as CandidateReport;
  const version = report.results[0]?.baseline.version;
  return { state: 'recorded', report, against: version ? await baselineFor(version) : null };
}

export function loadRcSources(): Promise<RcSources> {
  return once('rc-sources', async () => {
    const [candidate, release, performance] = await Promise.all([loadCandidate(), loadRelease(), loadOwnPerformance()]);
    return { candidate, release, performance };
  });
}
