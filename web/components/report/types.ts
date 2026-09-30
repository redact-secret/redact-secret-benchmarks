/**
 * The data shapes the report blocks take. Every value is already formatted text
 * ("1,065", "3.6%") that an adapter reads from the ledger and the report output
 * (`benchmarks/support/taxonomy.json`, the family/fixture rows, the findings
 * ledger, the peer-scanner matrix). A block never derives a count, rate or
 * status from another prop: the ledger says it, the UI displays it. The
 * adapter that maps ledger records to these shapes belongs to the route work
 * (#547), not to a block.
 *
 * Counts are fixture rows for redact-secret in one mode. The mode (`published`
 * or `candidate`) travels with the run facts a page shows in its head.
 */
import type { Status } from '../feedback';

export type Mode = 'published' | 'candidate';

/** A status word with the token it is drawn with. */
export interface StatusLabel {
  status: Status;
  label: string;
}

/** A hub tile on `/report`: a count and where it leads. */
export interface HubTileData {
  href: string;
  label: string;
  figure: string;
  figureUnit: string;
  /** Bold lead of the description, e.g. "81". */
  emphasis?: string;
  /** Rest of the description, e.g. "with fixtures in this corpus." */
  text: string;
  action: string;
}

/** One figure of "Three answers": question, bound, observation, definition. */
export interface AnswerData {
  id: string;
  question: string;
  /** "at most" or "at least". */
  qualifier: string;
  value: string;
  /** The rows behind the figure. */
  href?: string;
  interval: {
    ariaLabel: string;
    /** Fractions of the axis, 0 to 1. */
    observed: number;
    bound: number;
    range?: [number, number];
    axisMin: string;
    axisMax: string;
  };
  /** "26 of 1,065" and the words after it. */
  observation: { strong: string; rest: string };
  status?: StatusLabel;
  definition: string;
}

/** An evidence level link: `/report`, `?level=T2`, `?level=T3`. */
export interface EvidenceLevelLink {
  label: string;
  shortLabel: string;
  href: string;
}

/** A "what changed" row: one finding handed to the product. */
export interface FindingData {
  id: string;
  href: string;
  title: string;
  /** "Flagged a safe value · 3 fixtures". */
  detail: string;
  date: string;
  status: StatusLabel;
}

/** "26 of 1,065 spans" and a line beneath. */
export interface Ratio {
  count: string;
  of: string;
  unit?: string;
  note?: string;
}

/** One scanner in "Other scanners on the same inputs". A `null` ratio is not measured. */
export interface PeerScannerRow {
  name: string;
  version: string;
  /** "Repository scanner · Directory scan". */
  role: string;
  blurb: string;
  targeted: Ratio | null;
  leftReadable: Ratio | null;
  elsewhere: Ratio | null;
  safeFlagged: Ratio | null;
}

/** The "read this before the numbers" caveats and the quoting guidance. */
export interface PeerScannerNotes {
  caveatsTitle: string;
  caveats: { lead: string; text: string }[];
  source: string;
  quoteTitle: string;
  quoteDont: string;
  quoteDo: string;
  quoteNote: string;
}

/** Fixture-row counts for a provider or family. `null` where used means the corpus has no fixtures for it. */
export interface FixtureCounts {
  leftReadable: string;
  tooMuch: string;
  falseAlarms: string;
  /** Present only when some rows are not measured. */
  notMeasured?: string;
}

export interface FamilyEntry {
  id: string;
  name: string;
  href: string;
  fixturesLabel: string;
  counts: FixtureCounts | null;
}

export interface ProviderGroupData {
  id: string;
  name: string;
  familiesLabel: string;
  fixturesLabel: string;
  counts: FixtureCounts | null;
  families: FamilyEntry[];
}

/** A row of the flat family list. */
export interface FamilyRowData {
  id: string;
  name: string;
  href: string;
  provider: string;
  fixtures: string;
  counts: FixtureCounts | null;
}

export interface FamilyAboutData {
  description: string;
  note?: string;
  sources?: { href: string; host: string }[];
}

/** One fixture row on a family page. */
export interface FixtureRowData {
  slug: string;
  /** The suite or folder the fixture sits in. */
  group: string;
  /** "also in 2 other families". */
  alsoIn?: string;
  /** "Must redact", "Project policy". */
  kind: string;
  /** Evidence level, e.g. "T1". */
  evidence?: string;
  outcome: StatusLabel;
}

/** Which rows a list shows; the page owns the value. */
export type ReportShow = 'all' | 'signal' | 'empty';
