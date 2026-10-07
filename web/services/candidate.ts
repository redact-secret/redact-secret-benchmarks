/**
 * The release candidate and the last release behind `/evaluation/rc`, from whichever pipeline the committed authority names (#658).
 *
 *  - `new`: the candidate is the candidate diff of a recorded candidate replay, `qualification:candidate-diff`'s internal, allowlisted projection
 *    (`results-output/candidate-diff-from-artifacts.json`, schema `redact-secret/candidate-diff-from-artifacts/v1`). The publication writes it only for a candidate
 *    that was replayed at the exact tarball digest (`scripts/credential-publication.ts candidate`, #657); the page reads it back, validates it with the
 *    artifact validator (`candidateDiffArtifactProblems`) and binds it to the pins of this checkout with the same function the publication uses
 *    (`candidateDiffFreshnessProblems`), so a replay measured against an earlier release or engine is "stale", never a statement about the current one.
 *    The file lives outside `public/`: it is not shipped, only its counts reach the page. Absent means no candidate is recorded, which is the normal state
 *    (no replay exists for most commits), and is said as such; it is never filled from the legacy evidence or from a released observation.
 *  - `legacy`: the rollback reads the evidence `eval:candidate` writes to `public/results/candidate-evidence-v1.json` and `baselines/<version>.json`
 *    (`services/candidate-legacy.ts`), exactly as before.
 *
 * The last release is the release the benchmark pins (`benchmarks/pin-manifest.json`); under `new` its identity on the page is also what the diff's control names.
 * The performance reference is the accepted run (`services/performance.ts`). Nothing is derived here; counts come from the diff or the legacy resolver.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { candidateDiffArtifactProblems, CANDIDATE_DIFF_SCHEMA, type CandidateDiff } from '../../benchmarks/qualification/candidate-diff';
import { candidateDiffFreshnessProblems, type RegistryForFreshness } from '../../benchmarks/qualification/candidate-freshness';
import { loadAuthority, type Authority } from './authority';
import { loadLegacyCandidate, loadLegacyRelease, type LegacyCandidateLoad, type LegacyRelease, type ReleaseBaseline } from './candidate-legacy';
import { loadOwnPerformance, type OwnPerformance } from './performance';
import { once, readJson, REPO_ROOT } from './repo';

export type { ReleaseBaseline };
export type LastRelease = LegacyRelease;

/** Where `qualification:candidate-diff` and the publication seam write the projection; internal, never under `public/` or `web/`. */
export const CANDIDATE_DIFF_FILE = 'results-output/candidate-diff-from-artifacts.json';

export type CandidateLoad =
  | LegacyCandidateLoad
  /** A diff exists but is not bound to the current pins (an earlier release, engine or evidence): history, shown as not recorded with the reason. */
  | { state: 'stale'; reason: string }
  | { state: 'recorded'; source: 'artifact'; diff: CandidateDiff };

export interface RcSources {
  authority: Authority;
  candidate: CandidateLoad;
  release: LastRelease;
  performance: OwnPerformance;
}

interface PinManifest { pins: { redactSecretVersion: string; releaseSourceRevision: string } }

const diffFile = () => process.env.WEB_CANDIDATE_DIFF_FILE ?? path.join(REPO_ROOT, CANDIDATE_DIFF_FILE);
const DIGEST = /^sha256:[0-9a-f]{64}$/;

/** What the page needs of a diff, checked before anything is read from it; the artifact validator then checks the counts. */
function shapeProblems(diff: any): string[] {
  const problems: string[] = [];
  const text = (v: unknown) => typeof v === 'string' && v.length > 0;
  if (!diff || typeof diff !== 'object') return ['not an object'];
  if (diff.schema !== CANDIDATE_DIFF_SCHEMA) return [`not a ${CANDIDATE_DIFF_SCHEMA} artifact`];
  if (!text(diff.candidate?.id) || !/^[0-9a-f]{40}$/.test(diff.candidate?.commit ?? '') || !text(diff.candidate?.version) || !Array.isArray(diff.candidate?.tarballs)) problems.push('the candidate identity is incomplete');
  else if (diff.candidate.tarballs.some((t: any) => !text(t?.name) || !(DIGEST.test(t?.sha256 ?? '') || /^[0-9a-f]{64}$/.test(t?.sha256 ?? '')))) problems.push('a candidate tarball has no name or digest');
  if (!text(diff.baseline?.productVersion) || !text(diff.baseline?.archive?.release) || !text(diff.baseline?.archive?.sha256)) problems.push('the baseline identity is incomplete');
  if (!Array.isArray(diff.populations) || !diff.populations.length) problems.push('no population is compared');
  else for (const p of diff.populations) {
    if (!text(p?.population) || !Array.isArray(p?.families) || !Array.isArray(p?.differing)) problems.push('a population is incomplete');
    for (const k of ['cases', 'fixed', 'regressed', 'changed', 'unchanged', 'stillFailing']) if (!Number.isInteger(p?.[k]) || p[k] < 0) problems.push(`${String(p?.population)}: ${k} is not a count`);
  }
  return problems;
}

async function loadArtifactCandidate(): Promise<CandidateLoad> {
  let text: string;
  try {
    text = await readFile(diffFile(), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { state: 'not-recorded', reason: `${CANDIDATE_DIFF_FILE} is absent: no candidate replay is registered for the qualified candidate of this build, so no candidate diff was read.` };
    }
    throw new Error(`${CANDIDATE_DIFF_FILE} is unreadable: ${(error as Error).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { state: 'invalid', reason: 'The candidate diff is unreadable (not JSON).' };
  }
  const shape = shapeProblems(parsed);
  if (shape.length) return { state: 'invalid', reason: `The candidate diff does not match its contract: ${shape.join('; ')}.` };
  const diff = parsed as CandidateDiff;
  const artifact = candidateDiffArtifactProblems(diff);
  if (artifact.length) return { state: 'invalid', reason: `The candidate diff is not what it says: ${artifact.join('; ')}.` };
  const stale = candidateDiffFreshnessProblems(diff, await readJson<RegistryForFreshness>('benchmarks/official-runs.json'));
  if (stale.length) return { state: 'stale', reason: `The candidate diff is not bound to the current pins: ${stale.join('; ')}.` };
  return { state: 'recorded', source: 'artifact', diff };
}

async function loadPinnedRelease(): Promise<LastRelease> {
  const pins = (await readJson<PinManifest>('benchmarks/pin-manifest.json')).pins;
  return { version: pins.redactSecretVersion, commit: pins.releaseSourceRevision, baseline: null };
}

export function loadRcSources(): Promise<RcSources> {
  return once('rc-sources', async () => {
    const { authority } = await loadAuthority();
    const official = authority === 'new';
    const [candidate, release, performance] = await Promise.all([
      official ? loadArtifactCandidate() : loadLegacyCandidate(),
      official ? loadPinnedRelease() : loadLegacyRelease(),
      loadOwnPerformance(),
    ]);
    return { authority, candidate, release, performance };
  });
}
