/**
 * What both readings of `/evaluation/rc` share (#658): the page type, the last release's build card and the performance block. Pure. The legacy reading
 * (`rc.ts`, the saved-baseline evidence) and the artifact reading (`rc-artifact.ts`, the candidate diff of a recorded replay) both build a `RcPage`
 * from these; neither imports the other's source model.
 */
import type { RcBuild, RcBuildsData, RcDifferencesData, RcLevelsData, RcMovedData, RcNotRecordedData, RcPerformanceData } from '../components/evaluation/rc/types';
import type { ReleaseBaseline } from '../services/candidate';
import type { OwnPerformance } from '../services/performance';
import { count, isoDate } from './format';

export const PRODUCT_COMMIT_URL = 'https://github.com/redact-secret/redact-secret/commit/';

export type RcNoteTone = 'warning' | 'info';
export interface RcNote { tone: RcNoteTone; title: string; text: string }

export interface RcPage {
  state: 'recorded' | 'not-recorded' | 'invalid' | 'stale';
  head: { eyebrow: string; title: string; lede: string };
  notes: RcNote[];
  builds: RcBuildsData;
  differences: RcDifferencesData | null;
  levels: RcLevelsData | null;
  moved: RcMovedData | null;
  notRecorded: RcNotRecordedData | null;
  performance: RcPerformanceData;
}

export const short = (sha: string) => sha.slice(0, 7);

/** The last release's card. `baseline` is the legacy saved comparison point; `archive` is the control a candidate diff names (the evidence archive of the release). */
export function releaseBuild(version: string, commit: string | null, baseline: ReleaseBaseline | null, archive?: { release: string; sha256: string }): RcBuild {
  const commitFact = commit ? { term: 'Commit', value: short(commit), href: `${PRODUCT_COMMIT_URL}${commit}`, mono: true, note: 'release pin' } : { term: 'Commit', value: 'Not recorded for this version' };
  if (archive) {
    return {
      role: 'Last release',
      mode: 'published',
      tags: [],
      heading: version,
      facts: [commitFact, { term: 'Source', value: `Evidence archive ${archive.release}`, mono: true }, { term: 'Archive digest', value: archive.sha256.replace(/^sha256:/, '').slice(0, 16), mono: true }],
    };
  }
  return {
    role: 'Last release',
    mode: 'published',
    tags: [],
    heading: version,
    facts: [
      commitFact,
      baseline?.savedAt ? { term: 'Date', value: `Baseline saved ${isoDate(baseline.savedAt)}` } : { term: 'Date', value: 'Not recorded' },
      baseline?.runId ? { term: 'Run', value: baseline.runId, mono: true } : { term: 'Run', value: 'Not recorded' },
      baseline ? { term: 'Source', value: `baselines/${baseline.version}.json`, mono: true } : { term: 'Source', value: `No baselines/${version}.json is saved` },
    ],
  };
}

export function performanceOf(performance: OwnPerformance, candidateCommit: string | null): RcPerformanceData {
  const base = { title: 'Performance cost', heading: 'No performance run names this candidate', href: '/comparison/performance/', linkLabel: 'Performance comparison' };
  if (performance.state !== 'measured') return { ...base, heading: 'No performance run is recorded', text: `${performance.reason} Nothing is estimated.` };
  const accepted = `The accepted performance run measured commit ${short(performance.sourceCommit)} (${count(performance.repetitions, 'repetition')}).`;
  if (candidateCommit && performance.sourceCommit === candidateCommit) {
    return { ...base, heading: 'Not recorded as a before and after', text: `${accepted} That is this candidate's commit, and no run of the last release's commit is recorded beside it, so no cost is compared and nothing is estimated.` };
  }
  if (!candidateCommit) return { ...base, heading: 'No candidate to compare', text: `${accepted} No candidate is recorded, so no cost is compared and nothing is estimated.` };
  return { ...base, text: `${accepted} No run is recorded for the candidate commit ${short(candidateCommit)}, so no before and after is shown and nothing is estimated.` };
}
