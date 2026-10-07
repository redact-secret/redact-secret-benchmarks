/**
 * `/evaluation/rc`: the release candidate beside the last release, resolved to block props. Pure.
 *
 * Two readings share the page (#658). Under the `new` authority the candidate is the candidate diff of a recorded replay (`rc-artifact.ts`, no import of the
 * legacy model). This file is the `legacy` rollback's reading of the saved-baseline evidence (`eval:candidate`), and the one place that picks the reading.
 *
 * Boundary rule: everything here is a value a run recorded. The classification of one fixture (regressed,
 * improved, other change, unchanged) is the existing Workbench's own (`changeRows` in benchmarks/shared/evaluation-model.ts,
 * applied to the one fixture), so this page and the old Changes page can never disagree about what moved.
 * Nothing is worded as approval, a gate or a ranking, and a missing record is stated, never a zero.
 */
import { candidatePairs, changeRows, type ChangeRow, type OutcomePair } from '../../benchmarks/shared/evaluation-model.ts';
import type { RcBuild, RcMovedRow, RcNotRecordedData, RcStamp, RcTile } from '../components/evaluation/rc/types';
import type { CandidateLoad, LastRelease, RcSources } from '../services/candidate';
import type { OwnPerformance } from '../services/performance';
import { count, int, isoDate } from './format';
import { performanceOf, PRODUCT_COMMIT_URL, releaseBuild, short, type RcNote, type RcPage } from './rc-common';
import { artifactNotRecorded, resolveArtifactRcPage } from './rc-artifact';
import { fixtureHref } from './rows';
import { LEVEL_TITLE } from './report';

export { PRODUCT_COMMIT_URL };
export type { RcNote, RcNoteTone, RcPage } from './rc-common';

/** The command the existing Workbench names for writing candidate evidence (src/pages/workbench/changes.ts). */
export const CANDIDATE_COMMAND = [
  'npm run eval:candidate -- --output-dir "$PWD/public/results" \\',
  '  --candidate-package <core.tgz> --candidate-node-package <node.tgz> \\',
  '  --candidate-wasm-package <wasm.tgz> --candidate-source-commit <40-hex> --product-state clean',
].join('\n');
/** The most rows one group of the moved-fixtures list shows. */
export const MOVED_LIMIT = 100;

type LegacyRecorded = Extract<CandidateLoad, { state: 'recorded'; source: 'legacy' }>;
type Change = 'regressed' | 'improved' | 'other' | 'unchanged';
const LEVEL_ORDER = ['T1', 'T2', 'T3', 'T0'] as const;
const WORD: Record<string, string> = { EXACT: 'Exact', COVERED: 'Covered', OVERBROAD: 'Overbroad', PARTIAL: 'Partial', MISS: 'Miss' };

/** How the recorded outcome code reads: span outcomes as words, controls as flagged or not. */
export function outcomeText(code: string | null): string {
  if (code == null) return 'Not recorded';
  if (code === 'clean') return 'Not flagged';
  const flagged = /^flagged:(\d+)$/.exec(code);
  if (flagged) return `Flagged, ${count(Number(flagged[1]), 'finding')}`;
  const observed = /^observed:(\d+)$/.exec(code);
  if (observed) return `Observed, ${count(Number(observed[1]), 'range')}`;
  const tally = new Map<string, number>();
  for (const part of code.split(',')) tally.set(part, (tally.get(part) ?? 0) + 1);
  return [...tally].map(([word, n]) => `${WORD[word] ?? word}${n > 1 ? ` ×${n}` : ''}`).join(', ');
}

/** What one fixture's move is, read by the Workbench's own rules on that one fixture. */
export function classify(pair: OutcomePair): Change {
  const statuses = changeRows([pair]).map(r => r.status);
  if (statuses.includes('regressed')) return 'regressed';
  if (statuses.includes('improved')) return 'improved';
  if (statuses.some(s => s === 'check' || s === 'policy' || s === 'unscored')) return 'other';
  return 'unchanged';
}

const levelOf = (tier: string) => (tier === 'T0' ? 'T0' : tier);
const levelTitle = (level: string) => (level === 'T0' ? 'Pending' : LEVEL_TITLE[level as 'T1' | 'T2' | 'T3'] ?? level);
const levelDetail = (level: string) => (level === 'T0' ? 'T0 · observed, never scored' : level);

// ---- builds ---------------------------------------------------------------------------

function candidateBuild(c: LegacyRecorded): RcBuild {
  const { report } = c;
  const { candidate, completeness, selection } = report;
  return {
    role: 'Release candidate',
    mode: 'candidate',
    tags: ['unreleased'],
    heading: short(candidate.sourceCommit),
    subheading: `declares ${candidate.declaredVersion}`,
    facts: [
      { term: 'Commit', value: candidate.sourceCommit, href: `${PRODUCT_COMMIT_URL}${candidate.sourceCommit}`, mono: true, note: candidate.sourceState },
      { term: 'Date', value: `Measured ${isoDate(report.finishedAt)}` },
      { term: 'Run', value: `${report.runId.slice(0, 8)} · ${report.status} · ${selection.scope === 'full-suite' ? 'full suite' : 'filtered'}`, mono: true },
      { term: 'Scanned', value: `${int(completeness.scannedFixtures)} of ${int(completeness.selectedFixtures)} fixtures` },
    ],
  };
}

// ---- recorded -------------------------------------------------------------------------

function notesFor(c: LegacyRecorded, release: LastRelease, uncompared: number): RcNote[] {
  const { report } = c;
  const notes: RcNote[] = [];
  const against = report.results[0]?.baseline.version;
  if (report.status !== 'complete') notes.push({ tone: 'warning', title: `Evidence is ${report.status}`, text: 'Counts below cover the fixtures that were scanned. A fixture that was not scanned is not compared.' });
  if (report.selection.scope !== 'full-suite') notes.push({ tone: 'warning', title: 'Filtered run', text: `This run is filtered${report.selection.filter ? ` to ${report.selection.filter}` : ''}. It is a development reading of part of the suite, not the full comparison.` });
  if (report.candidate.sourceState !== 'clean') notes.push({ tone: 'warning', title: 'Product tree was not clean', text: 'The candidate was measured from a product tree with uncommitted changes.' });
  if (report.failures.length) notes.push({ tone: 'warning', title: `${count(report.failures.length, 'failure')} recorded`, text: report.failures.map(f => `${f.phase}: ${f.code}`).join('; ') });
  if (uncompared) notes.push({ tone: 'info', title: `${count(uncompared, 'fixture')} not compared`, text: 'These have a release outcome but no candidate outcome, so they are in no count below.' });
  if (against && against !== release.version) notes.push({ tone: 'info', title: `Compared with ${against}`, text: `The candidate evidence was measured against the saved baseline ${against}. The last release the benchmark pins is ${release.version}.` });
  return notes;
}

const tileOf = (label: string, value: number, detail: string): RcTile => ({ label, value: int(value), detail });

function figureOf(row: ChangeRow | undefined, label: string, detail: string): RcTile | null {
  if (!row || row.of == null) return null;
  const before = row.before ?? row.after;
  return { label, value: int(row.after), detail, observation: `release ${int(before)} → candidate ${int(row.after)} of ${int(row.of)}` };
}

function recorded(c: LegacyRecorded, release: LastRelease, performance: OwnPerformance): RcPage {
  const { report } = c;
  const baselineVersion = report.results[0]?.baseline.version ?? release.version;
  const against = c.against ?? (baselineVersion === release.version ? release.baseline : null);
  const commit = baselineVersion === release.version ? release.commit : null;
  const pairs = candidatePairs(report);
  const fixed = pairs.filter(p => p.section === 'fixed-corpus');
  const expanded = pairs.filter(p => p.section === 'expanded-corpus');
  const comparable = fixed.filter(p => p.before != null && p.after != null);
  const classified = comparable.map(pair => ({ pair, change: classify(pair) }));
  const total = (change: Change) => classified.filter(x => x.change === change).length;

  const stamp: RcStamp = {
    scope: 'Fixed corpus: rows with a release outcome',
    from: `published ${baselineVersion}${against?.runId ? ` · run ${against.runId}` : ''}`,
    to: `candidate ${short(report.candidate.sourceCommit)} · run ${report.runId.slice(0, 8)}`,
  };

  const rows = changeRows(fixed);
  const figures = [
    figureOf(rows.find(r => r.label === 'Required secrets left readable'), 'Required secrets left readable', 'must-redact, evidence levels 1 and 2'),
    figureOf(rows.find(r => r.label === 'False alarms on controls'), 'False alarms on controls', 'must-not-flag, every level'),
  ].filter((t): t is RcTile => t !== null);

  const levels = LEVEL_ORDER.filter(level => classified.some(x => levelOf(x.pair.tier) === level));
  const tally = (level: string, change?: Change) => classified.filter(x => levelOf(x.pair.tier) === level && (!change || x.change === change)).length;

  const moveRow = ({ pair }: { pair: OutcomePair }): RcMovedRow => {
    const cut = pair.slug.indexOf('--');
    const suite = cut < 0 ? '' : pair.slug.slice(0, cut), id = cut < 0 ? pair.slug : pair.slug.slice(cut + 2);
    return { id: pair.slug, title: id, href: fixtureHref({ category: suite, id }), detail: `${suite} · ${pair.kind}`, level: levelOf(pair.tier), before: outcomeText(pair.before), after: outcomeText(pair.after) };
  };
  const listed = (change: Change) => classified.filter(x => x.change === change);
  const groupOf = (label: string, change: Change) => ({ label: `${label} · ${int(listed(change).length)}`, rows: listed(change).slice(0, MOVED_LIMIT).map(moveRow) });
  const groups = [groupOf('Regressed', 'regressed'), groupOf('Improved', 'improved')];
  const cut = (['regressed', 'improved'] as const).filter(change => listed(change).length > MOVED_LIMIT);

  const uncompared = fixed.length - comparable.length;
  return {
    state: 'recorded',
    head: {
      eyebrow: 'EVALUATION · RELEASE CANDIDATE',
      title: 'Release candidate against the last release',
      lede: 'What the benchmark recorded for the redact-secret commit in development, set beside what it recorded for the last released version. These are recorded differences. Nothing here approves or blocks a release.',
    },
    notes: notesFor(c, release, uncompared),
    builds: { title: 'Two builds, one corpus', release: releaseBuild(baselineVersion, commit, against), candidate: candidateBuild(c) },
    differences: {
      title: 'What differs',
      stamp,
      tiles: [
        tileOf('Regressed', total('regressed'), 'fixtures that now leave a required secret readable, or flag a control'),
        tileOf('Improved', total('improved'), 'fixtures that moved the other way'),
        tileOf('Other change', total('other'), 'same verdict with other ranges, policy rows and pending rows'),
        tileOf('Unchanged', total('unchanged'), 'same recorded outcome'),
      ],
      figures,
    },
    levels: {
      title: 'By evidence level',
      stamp,
      caption: 'Fixed-corpus fixtures by evidence level, published release against candidate',
      rows: levels.map(level => ({
        id: level, title: levelTitle(level), detail: levelDetail(level),
        compared: int(tally(level)), regressed: int(tally(level, 'regressed')), improved: int(tally(level, 'improved')), other: int(tally(level, 'other')), unchanged: int(tally(level, 'unchanged')),
      })),
      expanded: `Expanded corpus: ${count(expanded.length, 'row')} added since the release have no release outcome. They are listed in the run, not scored, and are never added to the counts above.`,
      footnote: 'Other change covers fixtures whose verdict held but whose ranges moved, project-policy rows that moved, and pending rows that moved. Levels with no fixed-corpus rows are not listed.',
    },
    moved: {
      title: 'Fixtures that moved',
      description: 'Each fixture opens its page. Outcomes are the recorded ones: the published release, then the candidate.',
      caption: 'Fixtures whose recorded outcome moved, with the release and candidate outcome',
      groups,
      ...(cut.length ? { truncated: `Each group lists its first ${int(MOVED_LIMIT)} fixtures; the count in its heading is the whole group.` } : {}),
    },
    notRecorded: null,
    performance: performanceOf(performance, report.candidate.sourceCommit),
  };
}

// ---- not recorded, invalid ------------------------------------------------------------

function notRecorded(load: Exclude<CandidateLoad, { state: 'recorded' }>): RcNotRecordedData {
  const invalid = load.state === 'invalid';
  return {
    title: invalid ? 'The candidate evidence did not validate' : 'No release candidate is recorded',
    heading: invalid ? 'Nothing is compared in this build' : 'Nothing is compared in this build',
    paragraphs: [
      invalid
        ? `${load.reason} Evidence that does not match the candidate contract is never read, so no difference is shown.`
        : 'A release candidate is a redact-secret main commit that passed artifact qualification and was then measured by eval:candidate. The staging publish writes that evidence. This build has none, so the page does not guess at a candidate and shows no difference.',
      'Production measures the released package only, so it is expected to look like this.',
    ],
    steps: [
      'A qualified candidate commit is staged by the publish workflow.',
      'npm run eval:candidate writes public/results/candidate-evidence-v1.json.',
      'The next build of this page reads it and compares it with the last release.',
    ],
    command: CANDIDATE_COMMAND,
  };
}

export function resolveRcPage({ authority, candidate, release, performance }: RcSources): RcPage {
  if (candidate.state === 'recorded') return candidate.source === 'artifact' ? resolveArtifactRcPage(candidate.diff, release, performance) : recorded(candidate, release, performance);
  return {
    state: candidate.state,
    head: {
      eyebrow: 'EVALUATION · RELEASE CANDIDATE',
      title: 'Release candidate against the last release',
      lede: 'What the benchmark records for the redact-secret commit in development, set beside the last released version. No candidate is recorded in this build, so the last release is shown for reference.',
    },
    notes: [],
    builds: { title: 'The last release, for reference', release: releaseBuild(release.version, release.commit, release.baseline) },
    differences: null,
    levels: null,
    moved: null,
    notRecorded: authority === 'new' ? artifactNotRecorded(candidate) : notRecorded(candidate),
    performance: performanceOf(performance, null),
  };
}
