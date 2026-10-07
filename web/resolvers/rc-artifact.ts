/**
 * `/evaluation/rc` under the `new` authority (#658): the release candidate as the candidate diff of a recorded replay (`qualification:candidate-diff`,
 * `services/candidate.ts`). Pure, and it imports nothing of the legacy evidence model.
 *
 * What the page may say is what the internal projection carries and the publication decision allows: counts per population, the candidate's registered identity
 * and the control it was compared with. It lists no case (the projection is internal; its rows stay in `results-output/`), links to no fixture and adds no count
 * across populations. Nothing is worded as approval, a gate or a ranking, and a missing record is stated, never a zero. Decision:
 * `docs/decisions/2026-10-07-read-the-release-candidate-page-from-the-candidate-diff-under-the-new-authority.md`.
 */
import type { CandidateDiff, PopulationDiff } from '../../benchmarks/qualification/candidate-diff';
import type { RcBuild, RcLevelRow, RcNotRecordedData } from '../components/evaluation/rc/types';
import type { CandidateLoad, LastRelease } from '../services/candidate';
import type { OwnPerformance } from '../services/performance';
import { int } from './format';
import { performanceOf, PRODUCT_COMMIT_URL, releaseBuild, short, type RcNote, type RcPage } from './rc-common';

/** The command that builds the projection this page reads. */
export const CANDIDATE_DIFF_COMMAND = [
  'npm run qualification:candidate-diff -- --candidate <registered id> \\',
  '  --candidate-dir <downloaded candidate-run artifacts> --verify-tarballs \\',
  '  --out results-output/candidate-diff-from-artifacts.json',
].join('\n');

const POPULATION_TITLE: Record<string, string> = {
  'public-evidence-snapshot': 'Public evidence snapshot',
  'regression-corpus': 'Regression corpus',
  'policy-corpus': 'Policy corpus',
};

const digestOf = (sha256: string) => sha256.replace(/^sha256:/, '');

function candidateBuild(diff: CandidateDiff): RcBuild {
  const { candidate } = diff;
  return {
    role: 'Release candidate',
    mode: 'candidate',
    tags: ['unreleased', 'exploratory'],
    heading: short(candidate.commit),
    subheading: `declares ${candidate.version}`,
    facts: [
      { term: 'Commit', value: candidate.commit, href: `${PRODUCT_COMMIT_URL}${candidate.commit}`, mono: true },
      { term: 'Registered as', value: candidate.id, mono: true },
      ...candidate.tarballs.map(t => ({ term: 'Package', value: `${t.name} · sha256 ${digestOf(t.sha256).slice(0, 16)}`, mono: true })),
      { term: 'Kind', value: 'Exploratory replay, internal; never a recorded run' },
    ],
  };
}

function populationRow(p: PopulationDiff): RcLevelRow {
  return {
    id: p.population,
    title: POPULATION_TITLE[p.population] ?? p.population,
    detail: `${int(p.stillFailing)} still failing in the candidate`,
    compared: int(p.cases),
    regressed: int(p.regressed),
    improved: int(p.fixed),
    other: int(p.changed),
    unchanged: int(p.unchanged),
  };
}

/** The pinned release's commit is the release's only when the diff's control is that version; otherwise it is not recorded for it. */
const commitFor = (version: string, release: LastRelease) => (version === release.version ? release.commit : null);

export function resolveArtifactRcPage(diff: CandidateDiff, release: LastRelease, performance: OwnPerformance): RcPage {
  const version = diff.baseline.productVersion;
  const notes: RcNote[] = [
    { tone: 'info', title: 'Exploratory replay', text: 'This is a product candidate replay: the official evidence, engine and configuration of the last release, with the candidate\'s own build as the only difference. It is exploratory and internal, and it is not a recorded run.' },
  ];
  if (diff.worsened) notes.push({ tone: 'warning', title: 'Some cases are worse', text: 'At least one population below records a case whose outcome is worse in the candidate than in the last release.' });
  const stamp = {
    scope: 'Each population on its own; cases are never added across populations',
    from: `published ${version} · archive ${diff.baseline.archive.release}`,
    to: `candidate ${short(diff.candidate.commit)} · ${diff.candidate.id}`,
  };
  return {
    state: 'recorded',
    head: {
      eyebrow: 'EVALUATION · RELEASE CANDIDATE',
      title: 'Release candidate against the last release',
      lede: 'What the benchmark recorded for the redact-secret commit in development, set beside what it recorded for the last released version on the same evidence. These are recorded differences. Nothing here approves or blocks a release.',
    },
    notes,
    builds: { title: 'Two builds, one set of evidence', release: releaseBuild(version, commitFor(version, release), null, diff.baseline.archive), candidate: candidateBuild(diff) },
    differences: null,
    levels: {
      title: 'By population',
      heading: 'Population',
      stamp,
      caption: 'Cases per population, published release against candidate',
      rows: diff.populations.map(populationRow),
      expanded: 'The methods run is bound by its run record and byte digest only; its assertions and review occurrences are compared in the candidate effect report, not here, and no count of it is shown.',
      footnote: 'Improved is a case that did not pass in the release and passes in the candidate. Regressed is a case whose outcome is worse. Other change is a differing outcome that is neither. Only counts are shown: the projection is internal, so no case is listed and no fixture page is linked.',
    },
    moved: null,
    notRecorded: null,
    performance: performanceOf(performance, diff.candidate.commit),
  };
}

/** The dashed state of a build with no usable candidate diff: absent (the normal state), not valid, or measured for an earlier release. */
export function artifactNotRecorded(load: Exclude<CandidateLoad, { state: 'recorded' }>): RcNotRecordedData {
  const invalid = load.state === 'invalid', stale = load.state === 'stale';
  const title = invalid ? 'The candidate diff did not validate' : stale ? 'The recorded candidate replay is not for the current release' : 'No release candidate is recorded';
  const first = invalid
    ? `${load.reason} A diff that does not match its contract is never read, so no difference is shown.`
    : stale
      ? `${load.reason} A replay measured against an earlier release or engine is history, not a statement about the current release, so no difference is shown.`
      : 'A release candidate is a redact-secret main commit that passed artifact qualification and was then replayed as a product candidate: the same official evidence, engine and configuration as the release, with the candidate\'s own build. The publication reads that recorded replay; it never measures a candidate itself and never reuses a released observation as one. No replay is recorded for this build\'s candidate, so the page does not guess and shows no difference.';
  return {
    title,
    heading: 'Nothing is compared in this build',
    paragraphs: [first, 'Production measures the released package only, so it is expected to look like this.'],
    steps: [
      'A maintainer registers the candidate\'s tarballs in benchmarks/product-candidates.json and dispatches the candidate replay (official-runs.yml, input candidate).',
      'qualification:candidate-diff compares the replay with the control at the same pins; the staging publication runs it with --verify-tarballs.',
      'The next build of this page reads the projection and shows its counts.',
    ],
    command: CANDIDATE_DIFF_COMMAND,
  };
}
