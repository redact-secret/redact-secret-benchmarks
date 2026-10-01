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
  /** One plain sentence about what the scanner is built for. Omit when the ledger holds none. */
  blurb?: string;
  targeted: Ratio | null;
  leftReadable: Ratio | null;
  elsewhere: Ratio | null;
  /**
   * Spans it left readable across every input at this level, no matter which its
   * rules target. Present when the run records it; the three targeted columns
   * are hidden while no row has them.
   */
  allInputs?: Ratio | null;
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

/** One fixture row on a family, level, suite or detector page. */
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
  /** redact-secret's outcome: the one column a table without `scanners` shows. */
  outcome: StatusLabel;
  /** The fixture page: bytes, expected spans and what each scanner reported. Omit for a row with no page. */
  href?: string;
  /** One outcome per scanner column, in the order of the table's `scanners`. */
  outcomes?: StatusLabel[];
}

/** A scanner column of a fixture table. */
export interface ScannerColumnData {
  id: string;
  name: string;
}

/**
 * Which rows a list shows; the page owns the value. `all`, `signal` (needs a look) and `empty`
 * (no fixtures) serve the provider and family lists; a list of fixture rows adds `leaked`
 * (redact-secret left a span readable), `flagged` (redact-secret flagged a control) and `twins`.
 */
export type ReportShow = 'all' | 'signal' | 'empty' | 'leaked' | 'flagged' | 'twins';

/** One piece of a fixture's text between range boundaries. The text is verbatim; the block draws whitespace as symbols. */
export interface ByteSegment {
  text: string;
  /** The piece is inside a secret span that must be redacted, or a companion span. */
  role?: 'secret' | 'companion';
  /** The piece is inside an envelope: a finding may reach this far at no cost. */
  envelope?: boolean;
}

/** One piece of a scanner's lane under a line: text mirrors the bytes so a bar sits under exactly the glyphs it covers. */
export interface LanePiece {
  text: string;
  /** `fill` a finding covers it, `hatch` it is partly exposed, `outline` a secret was missed here. Never colour alone. */
  shape?: 'fill' | 'hatch' | 'outline';
}

export interface ByteLineData {
  /** 1-based line number. */
  number: number;
  segments: ByteSegment[];
  /** One lane per scanner, in the order of the block's `scanners`. Empty on a line nothing touches. */
  lanes: { label: string; pieces: LanePiece[] }[];
}

/** A scanner as the fixture page shows it: its name, and one outcome word per secret span (or "Quiet"/"Flagged" for a control). */
export interface FixtureScannerData {
  id: string;
  name: string;
  verdict: StatusLabel[];
}

/** A detector as the detector list shows it. */
export interface DetectorRowData {
  id: string;
  title: string;
  href: string;
  fixtures: string;
  /** The count and the minimum sample size on one scale, for the bar. */
  value: number;
  max: number;
  minimum: number;
  /** "Below minimum", "At minimum", or empty. */
  flag?: StatusLabel;
}

/** One group (kind and evidence level) of a detector's fixtures, with what the run recorded for it. */
export interface DetectorGroupRowData {
  group: string;
  fixtures: string;
  /** The headline figure of the group, formatted: "at most 3.6%", or the reason it is withheld. */
  headline: { label: string; value: string; note?: string };
  /** A second figure where the group has one (near-twins). */
  secondary?: { label: string; value: string; note?: string };
  outcomes?: { segments: { kind: 'fill' | 'wide' | 'hatch' | 'outline'; weight: number }[]; label: string; text: string };
  /** Other scanners' figure for the same cell, in run order. */
  others: { scanner: string; value: string }[];
}

/** A finding as the inventory page shows it. */
export interface FindingRowData {
  id: string;
  number: string;
  title: string;
  href: string;
  status: StatusLabel;
  kind: string;
  fixtures: { label: string; href?: string }[];
  measured: string;
  reviewed: string;
}

/** A suite as the suite list shows it. */
export interface SuiteRowData {
  id: string;
  title: string;
  href: string;
  fixtures: string;
  description: string;
  counts: FixtureCounts | null;
}
