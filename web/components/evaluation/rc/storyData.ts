/** Synthetic data for the release-candidate stories: made-up hashes, versions and counts, never ledger values. */
import type { RcBuild, RcBuildsData, RcDifferencesData, RcLevelsData, RcMovedData, RcMovedRow, RcNotRecordedData, RcPerformanceData, RcStamp } from './types';

export const stamp: RcStamp = {
  scope: 'Fixed corpus: rows with a release outcome',
  from: 'published 0.1.0-beta.0 · run 2026-01-01T00:00:00.000Z-aaaaaa',
  to: 'candidate 1234567 · run 00000000',
};

export const releaseBuild: RcBuild = {
  role: 'Last release',
  mode: 'published',
  tags: [],
  heading: '0.1.0-beta.0',
  facts: [
    { term: 'Commit', value: 'aaaaaaa', href: 'https://example.invalid/commit/aaaaaaa', mono: true, note: 'release pin' },
    { term: 'Date', value: 'Baseline saved 2026-01-01' },
    { term: 'Run', value: '2026-01-01T00:00:00.000Z-aaaaaa', mono: true },
    { term: 'Source', value: 'baselines/0.1.0-beta.0.json', mono: true },
  ],
};

export const candidateBuild: RcBuild = {
  role: 'Release candidate',
  mode: 'candidate',
  tags: ['unreleased'],
  heading: '1234567',
  subheading: 'declares 0.1.0-beta.1',
  facts: [
    { term: 'Commit', value: '1234567890abcdef1234567890abcdef12345678', href: 'https://example.invalid/commit/1234567', mono: true, note: 'clean' },
    { term: 'Date', value: 'Measured 2026-01-02' },
    { term: 'Run', value: '00000000 · complete · full suite', mono: true },
    { term: 'Scanned', value: '100 of 100 fixtures' },
  ],
};

export const builds: RcBuildsData = { title: 'Two builds, one corpus', release: releaseBuild, candidate: candidateBuild };
export const releaseOnly: RcBuildsData = { title: 'The last release, for reference', release: releaseBuild };
export const unknownRelease: RcBuildsData = {
  title: 'The last release, for reference',
  release: { ...releaseBuild, facts: [{ term: 'Commit', value: 'Not recorded for this version' }, { term: 'Date', value: 'Not recorded' }, { term: 'Run', value: 'Not recorded' }, { term: 'Source', value: 'No baselines/0.1.0-beta.0.json is saved' }] },
};

export const differences: RcDifferencesData = {
  title: 'What differs',
  stamp,
  tiles: [
    { label: 'Regressed', value: '2', detail: 'fixtures that now leave a required secret readable, or flag a control' },
    { label: 'Improved', value: '3', detail: 'fixtures that moved the other way' },
    { label: 'Other change', value: '1', detail: 'same verdict with other ranges, policy rows and pending rows' },
    { label: 'Unchanged', value: '40', detail: 'same recorded outcome' },
  ],
  figures: [
    { label: 'Required secrets left readable', value: '4', detail: 'must-redact, evidence levels 1 and 2', observation: 'release 3 → candidate 4 of 30' },
    { label: 'False alarms on controls', value: '1', detail: 'must-not-flag, every level', observation: 'release 1 → candidate 1 of 16' },
  ],
};

export const levels: RcLevelsData = {
  title: 'By evidence level',
  stamp,
  caption: 'Fixed-corpus fixtures by evidence level, published release against candidate',
  rows: [
    { id: 'T1', title: 'Provider-documented', detail: 'T1', compared: '20', regressed: '1', improved: '2', other: '0', unchanged: '17' },
    { id: 'T2', title: 'Tool-corroborated', detail: 'T2', compared: '25', regressed: '1', improved: '1', other: '1', unchanged: '22' },
    { id: 'T0', title: 'Pending', detail: 'T0 · observed, never scored', compared: '1', regressed: '0', improved: '0', other: '0', unchanged: '1' },
  ],
  expanded: 'Expanded corpus: 12 rows added since the release have no release outcome. They are listed in the run, not scored, and are never added to the counts above.',
  footnote: 'Other change covers fixtures whose verdict held but whose ranges moved, project-policy rows that moved, and pending rows that moved. Levels with no fixed-corpus rows are not listed.',
};

const moveRow = (n: number, before: string, after: string): RcMovedRow => ({
  id: `suite-a--fixture-${n}`, title: `fixture-${n}`, href: `/report/corpus/suite-a/?fixture=fixture-${n}`, detail: 'suite-a · must-redact', level: 'T1', before, after,
});

export const moved: RcMovedData = {
  title: 'Fixtures that moved',
  description: 'Each fixture opens its page. Outcomes are the recorded ones: the published release, then the candidate.',
  caption: 'Fixtures whose recorded outcome moved, with the release and candidate outcome',
  groups: [
    { label: 'Regressed · 2', rows: [moveRow(1, 'Exact', 'Miss'), moveRow(2, 'Exact ×2', 'Exact, Partial')] },
    { label: 'Improved · 1', rows: [moveRow(3, 'Partial', 'Exact')] },
  ],
};

export const movedNone: RcMovedData = { ...moved, groups: [{ label: 'Regressed · 0', rows: [] }, { label: 'Improved · 0', rows: [] }] };

export const movedLong: RcMovedData = {
  ...moved,
  groups: [{ label: 'Regressed · 240', rows: Array.from({ length: 12 }, (_, i) => moveRow(i + 10, 'Exact', 'Miss')) }, { label: 'Improved · 0', rows: [] }],
  truncated: 'Each group lists its first 100 fixtures; the count in its heading is the whole group.',
};

export const notRecorded: RcNotRecordedData = {
  title: 'No release candidate is recorded',
  heading: 'Nothing is compared in this build',
  paragraphs: [
    'A release candidate is a redact-secret main commit that passed artifact qualification and was then measured by eval:candidate. The staging publish writes that evidence. This build has none, so the page does not guess at a candidate and shows no difference.',
    'Production measures the released package only, so it is expected to look like this.',
  ],
  steps: [
    'A qualified candidate commit is staged by the publish workflow.',
    'npm run eval:candidate writes public/results/candidate-evidence-v1.json.',
    'The next build of this page reads it and compares it with the last release.',
  ],
  command: 'npm run eval:candidate -- --output-dir "$PWD/public/results" \\\n  --candidate-package <core.tgz> --candidate-source-commit <40-hex>',
};

export const invalid: RcNotRecordedData = {
  ...notRecorded,
  title: 'The candidate evidence did not validate',
  paragraphs: ['Invalid candidate evidence contract. Evidence that does not match the candidate contract is never read, so no difference is shown.', notRecorded.paragraphs[1]],
};

export const performance: RcPerformanceData = {
  title: 'Performance cost',
  heading: 'No performance run names this candidate',
  text: 'The accepted performance run measured commit aaaaaaa (5 repetitions). No run is recorded for the candidate commit 1234567, so no before and after is shown and nothing is estimated.',
  href: '/comparison/performance/',
  linkLabel: 'Performance comparison',
};
