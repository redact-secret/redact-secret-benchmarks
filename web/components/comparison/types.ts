/**
 * Data shapes for the comparison blocks (#546). Every field is plain, already
 * formatted text or a small enum: the caller shapes ledger and report outputs
 * (`evidence/429/peer-pii-runtime-throughput.json`, `benchmarks/feature-claims.json`,
 * the runtime plan) into these, and a block never derives a count, a rate or a
 * status from them. Ordering is the caller's; blocks render rows in the order given.
 */
import type { Outcome } from '../data';
import type { MetaItem } from '../page';

/* ---- /comparison (hub) ---- */

/** One question the hub routes to a page. `fact` counts what the page contains; it is never a result. */
export interface ComparisonQuestion {
  href: string;
  /** Names the kind of page: "Runtime". */
  label: string;
  /** The question the page answers. */
  title: string;
  description: string;
  /** Tool names in the order the page uses. */
  tools: string[];
  fact: string;
  factNote?: string;
  /** The link words: "Runtime comparison →". */
  action: string;
}

export interface ToolKindTool {
  name: string;
  /** Where it runs: "Node.js, browsers, Python, Rust". */
  detail?: string;
}

/** A kind of tool ("Runtime libraries") and which comparison pages cover it. */
export interface ToolKind {
  name: string;
  description: string;
  tools: ToolKindTool[];
  /** Which pages compare this kind, as one plain sentence. */
  comparedIn: string;
}

export interface Principle {
  title: string;
  description: string;
}

/** A line of the "latest runs" list: a page, its date and the versions it ran. */
export interface RunLine {
  label: string;
  detail: string;
}

/* ---- /comparison/feature ---- */

/** What the project's own docs say, or what a committed test checks. Never a score. */
export type FeatureMark = 'yes' | 'partly' | 'no';

export interface FeatureCell {
  mark: FeatureMark;
  /** Plain words: what the docs list. Empty for a bare yes or a bare "not listed". */
  note?: string;
  /** A committed test checks this claim on every run. */
  tested?: boolean;
  /** The note is a literal value (a placeholder format) and renders in monospace. */
  literal?: boolean;
}

export interface FeatureLibrary {
  id: string;
  name: string;
  /** The exact version the column describes. */
  version: string;
}

export interface FeatureRow {
  id: string;
  label: string;
  /** The ledger says all libraries carry the same mark; the "only differences" view hides these rows. */
  same: boolean;
  /** Keyed by `FeatureLibrary.id`. */
  cells: Record<string, FeatureCell>;
}

export interface FeatureGroup {
  label: string;
  rows: FeatureRow[];
}

export type FeatureFilter = 'all' | 'differences';

export interface FeatureSource {
  name: string;
  detail: string;
  /** Pages of the project's own documentation at the version read. */
  links?: { label: string; href: string }[];
}

/* ---- /comparison/runtime ---- */

export type RuntimeView = 'all' | 'speed' | 'accuracy';

/** A column: a library, or one setting of one library. */
export interface RuntimeColumn {
  id: string;
  name: string;
  /** "pii:global", "PII + US". */
  sub?: string;
}

/** What a call did to one value. `word` is the label ("Hidden"); `how` the small detail ("labelled IBAN"). */
export interface RuntimeOutcome {
  outcome: Outcome;
  word: string;
  how?: string;
}

export interface RuntimeValueRow {
  label: string;
  /** Keyed by `RuntimeColumn.id`; `null` is a cell nobody measured. */
  cells: Record<string, RuntimeOutcome | null>;
}

/** The recorded share of values that came back changed, formatted: "88%" and "7 of 8". */
export interface RuntimeHidden {
  percent: string;
  count: string;
}

/** Formatted timings: "307" ms and "0.4" MB per second. */
export interface RuntimeTiming {
  medianMs: string;
  throughput: string;
}

export interface RuntimeQuestion {
  id: string;
  /** "1 / 3". */
  position: string;
  question: string;
  description: string;
  /** The workload id, shown small: `validator-heavy`. Omitted for a question no workload exists for yet. */
  workload?: string;
  /** "116.5 KiB". Omitted with the workload. */
  size?: string;
  /** "each line repeated 512 times". Omitted with the workload. */
  repeat?: string;
  /** No credential or PII text has been timed for this question yet. */
  notMeasured?: string;
  /** An older snapshot recorded times but not outcomes: value rows read "Not recorded". */
  outcomesRecorded?: boolean;
  rows: RuntimeValueRow[];
  /** Keyed by column id. */
  hidden: Record<string, RuntimeHidden | null>;
  timing: Record<string, RuntimeTiming | null>;
}

export interface RuntimeFactCell {
  text: string;
  note?: string;
  /** "npm", "local build · unreleased". */
  chip?: string;
}

export interface RuntimeFactRow {
  label: string;
  /** Keyed by column id; `null` reads as a dash. */
  cells: Record<string, RuntimeFactCell | null>;
}

export interface RuntimeLegendItem {
  outcome: Outcome;
  label: string;
}

export type { MetaItem };
