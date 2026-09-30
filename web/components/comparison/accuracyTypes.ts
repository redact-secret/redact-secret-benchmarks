/**
 * Data shapes for the accuracy pair blocks (`/comparison/accuracy`, #570). Plain, already
 * formatted text and small enums, as in `types.ts`: the resolver shapes the run and the
 * recorded runtime comparison into these and a block never derives a count, a share or a
 * status from them. The two sides carry the same fields in the same order.
 */
import type { SegmentedNavItem } from '../nav';

/** One side of the pair. */
export interface AccuracySide {
  /** "Runtime library", "Repository scanner". */
  kind: string;
  name: string;
  version: string;
  /** One plain sentence about what the tool is built for. Present on both sides or neither. */
  job?: string;
  /** How it ran here: the mode line the ledger recorded. */
  ran: string;
  /** When its output was recorded. */
  recorded?: string;
}

/** One switch row of the pair bar. Every item is a link: the state lives in the URL. */
export interface AccuracyBarRow {
  label: string;
  /** Small mono text under the label ("runtime libraries only"). */
  sub?: string;
  items: SegmentedNavItem[];
  currentHref: string;
  /** Said on hover and to assistive tech, where an option needs a caveat. */
  hint?: string;
}

/** A state of the expected answer for one tool. `shape` is the cue, never a colour. */
export interface AccuracyState {
  label: string;
  count: string;
  shape: 'fill' | 'hatch' | 'outline';
  /** The raw count, used only to size the strip. */
  weight: number;
}

/** One tool against the expected answer for a question: its share, the count under it and its own strip. */
export interface AccuracyResultData {
  name: string;
  version: string;
  /** "97%", or "5 of 8" where there are too few files for a percentage. */
  figure: string;
  /** "940 of 965 hidden", or "hidden". */
  figureNote: string;
  states: AccuracyState[];
  stripLabel: string;
}

export interface AccuracyFileLink {
  /** The file's slug, or its label where it has no page. */
  slug: string;
  /** Omitted where the file has no page of its own. */
  href?: string;
}

export interface AccuracyDifferenceGroup {
  /** The provider; empty for a flat list. */
  name: string;
  count: string;
  files: AccuracyFileLink[];
}

/** One direction of the differences: the files where only this side gave the expected answer. */
export interface AccuracyDifferenceColumn {
  title: string;
  total: string;
  groups: AccuracyDifferenceGroup[];
  /** The "Show all n providers" words, when the list is cut. */
  more?: string;
}

export interface AccuracyDifferencesData {
  /** Both directions, always, even when one is empty. */
  columns: AccuracyDifferenceColumn[];
  /** Said under a direction that has no files. */
  none: string;
}

export interface AccuracyQuestionData {
  id: string;
  /** "1 / 2". */
  position: string;
  title: string;
  /** The count and what the files are. */
  description: string;
  /** "Expected: hidden". */
  expect: string;
  /** One row per tool, in the order of the sides. Empty when there is nothing to read. */
  results: AccuracyResultData[];
  /** Said instead of the rows: no files, or nothing measured for both. */
  empty?: string;
  /** "Fewer than 20 files, so counts only." */
  readout?: string;
  /** Files left out because one side recorded nothing, and similar. */
  notes?: string[];
  /** Differences that need no script (a short flat list). */
  differences?: AccuracyDifferencesData;
}

export interface AccuracySource {
  text: string;
  link?: { href: string; label: string };
}
