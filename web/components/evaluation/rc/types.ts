/** Props of the release-candidate blocks. Every value is text the resolver already formatted; a block displays it. */

/** One labelled fact of a build: "Commit", "Date", "Run". `href` makes the value a link. */
export interface RcFact {
  term: string;
  value: string;
  href?: string;
  /** Show the value in monospace (hashes, run ids, file paths). */
  mono?: boolean;
  /** A short plain word after the value ("release pin", "clean"). */
  note?: string;
}

/** One side of the comparison: the last release or the candidate. */
export interface RcBuild {
  /** "Last release" or "Release candidate". */
  role: string;
  /** Where the numbers came from: `published` or `candidate`. */
  mode: 'published' | 'candidate';
  /** Extra plain tags beside the mode ("unreleased"). */
  tags: string[];
  /** The version or short commit the side is known by. */
  heading: string;
  /** A short line under the heading ("declares 0.1.0-beta.13"). */
  subheading?: string;
  facts: RcFact[];
}

export interface RcBuildsData {
  title: string;
  release: RcBuild;
  /** Absent when no candidate is recorded. */
  candidate?: RcBuild;
}

/** The line that names what a block compares: the corpus section, the mode and the run on each side. */
export interface RcStamp {
  scope: string;
  from: string;
  to: string;
}

export interface RcTile {
  label: string;
  value: string;
  detail: string;
  /** "release 3 → candidate 5 of 1,118". */
  observation?: string;
}

export interface RcDifferencesData {
  title: string;
  stamp: RcStamp;
  tiles: RcTile[];
  figures: RcTile[];
}

export interface RcLevelRow {
  id: string;
  /** "Provider-documented". */
  title: string;
  /** "T1", or "T0 · observed, never scored". */
  detail: string;
  compared: string;
  regressed: string;
  improved: string;
  other: string;
  unchanged: string;
}

export interface RcLevelsData {
  title: string;
  stamp: RcStamp;
  caption: string;
  rows: RcLevelRow[];
  /** What the expanded corpus holds and why it is not in the counts. */
  expanded: string;
  /** What a column called "Other change" covers. */
  footnote: string;
}

export interface RcMovedRow {
  id: string;
  /** The fixture id without its suite prefix. */
  title: string;
  href: string;
  detail: string;
  level: string;
  before: string;
  after: string;
}

export interface RcMovedGroup {
  label: string;
  rows: RcMovedRow[];
}

export interface RcMovedData {
  title: string;
  description: string;
  caption: string;
  groups: RcMovedGroup[];
  /** Said when a group is longer than the list. */
  truncated?: string;
}

export interface RcNotRecordedData {
  title: string;
  heading: string;
  paragraphs: string[];
  steps: string[];
  command: string;
}

export interface RcPerformanceData {
  title: string;
  heading: string;
  text: string;
  href: string;
  linkLabel: string;
}
