import type { ReactNode } from 'react';
import type { MetaItem } from '../../page';
import type { SegmentedNavItem } from '../../nav';

/**
 * What one scanner recorded for one check. The resolver formats every number: a block displays text and
 * never derives a count, so a cell is only ever one of these four states.
 */
export type EvidenceCell =
  /** `value` checks did not hold, of the `of` that were scored. */
  | { kind: 'count'; value: string; of: string }
  /** Every check here waits for a person (tier T0 or a deferred expectation): counted apart, never pass or fail. */
  | { kind: 'unscored'; of?: string }
  /** The scanner did not complete: nothing was measured, so there is no figure and no zero. */
  | { kind: 'not-measured' }
  /** No check of this kind exists for this scanner (for example no policy action was reported). */
  | { kind: 'none' };

export interface EvidenceRow {
  key: string;
  label: string;
  /** A short second line under the label: what the check asks. */
  note?: string;
  /** One cell per column, in column order. */
  cells: EvidenceCell[];
}
export interface EvidenceGroup { label: string; rows: EvidenceRow[] }
export interface EvidenceColumn { id: string; name: string; version?: string }

/** A plain table of text: suites, operators, comparison kinds. A cell may link inside the app. */
export interface TextTableCell { text: string; href?: string; note?: string }
export interface TextTable {
  caption: string;
  columns: { key: string; header: string; numeric?: boolean }[];
  rows: { key: string; cells: TextTableCell[] }[];
}

export interface MethodStep { label: string; text: string }
export interface MethodFigure { term: string; description: string }

export interface MethodRecordedData {
  state: 'recorded';
  title: string;
  description: string;
  /** The header over the row labels: "Check" or "Taxonomy". */
  rowHeader: string;
  /** What each number in the table is: "Checks that did not hold, of those scored." */
  cellMeaning: string;
  columns: EvidenceColumn[];
  groups: EvidenceGroup[];
  /** Counted apart from the table, because it is neither passed nor failed. Absent when there is nothing unscored. */
  unscored?: { title: string; text: string };
  caption: string;
}
export interface NotMeasuredData { state: 'not-measured'; title: string; body: string; command: string }

export interface MethodInputsData {
  state: 'recorded';
  title: string;
  description: string;
  /** A table with a `summary` is folded behind it: a long list of exact inputs does not push the page down. */
  tables: { title: string; description?: string; summary?: string; table: TextTable }[];
  /** Holdout: the recorded corpus and candidate, as labelled values. */
  facts?: { term: string; description: string }[];
  /** Full hashes, behind a disclosure. */
  provenance?: { summary: string; text: string };
}

export interface MethodPageProps {
  /** Names the six-way method switch. */
  switchLabel: string;
  switcher: SegmentedNavItem[];
  currentHref: string;
  crumbs: { label: string; href?: string }[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  how: { title: string; steps: MethodStep[]; figures: MethodFigure[] };
  recorded: MethodRecordedData | NotMeasuredData;
  read: { title: string; rules: ReactNode[] };
  inputs: MethodInputsData | NotMeasuredData;
  className?: string;
}
