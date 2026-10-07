import type { ReactNode } from 'react';
import type { MetaItem } from '../../page';
import type { SegmentedNavItem } from '../../nav';

/**
 * What one scanner recorded for one check. The resolver formats every number: a block displays text and
 * never derives a count, so a cell is only ever one of these four states.
 */
export type EvidenceCell =
  /** `value` checks did not hold, of the `of` that were scored. `href` opens the checks behind `value` (#623); absent when there are none. */
  | { kind: 'count'; value: string; of: string; href?: string }
  /** Every check here waits for a person (tier T0 or a deferred expectation): counted apart, never pass or fail. `href` lists them. */
  | { kind: 'unscored'; of?: string; href?: string }
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
  /** Why this row's counts open no list of checks (#623), when they do not. */
  unlisted?: string;
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
  /** How a count leads to the checks behind it, and what it does not open (#623). */
  detail?: string;
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

/** One item of a check-list cell: a word, an identifier (`code`) or a link inside the app. */
export interface CheckItem { text: string; href?: string; code?: boolean; note?: string }

/** The checks behind one cell of a method table, one page of them (#623). Every row is one recorded check; nothing is summed. */
export interface CheckTable {
  caption: string;
  columns: { key: string; header: string }[];
  /** One list of items per column, in column order. */
  rows: { key: string; cells: CheckItem[][] }[];
}

export interface MethodCasesProps {
  crumbs: { label: string; href?: string }[];
  eyebrow: string;
  title: string;
  lede: string;
  meta: MetaItem[];
  /** The filters that chose these checks: method, check, scanner, status, and the run they come from. */
  filters: { term: string; description: string }[];
  /** What the list is and is not: run identity, review decisions, the qualification view. */
  notes: { title: string; text: string }[];
  body:
    /** The lists of a method, each with its figure and its address: what a reader without script, or without an address, sees. */
    | { state: 'index'; table: CheckTable }
    /** One page of one list. */
    | { state: 'recorded'; table: CheckTable; pager: { page: number; pageCount: number; total: number; pageSize: number; previousHref?: string; nextHref?: string } }
    /** The list's file is on its way: a skeleton the size of a page of rows. */
    | { state: 'loading'; label: string }
    /** The file did not arrive or was not this build's: why, and a way to ask again. */
    | { state: 'error'; title: string; detail: string; retryLabel: string; onRetry: () => void }
    /** The address names no list, or a page past the last. */
    | { state: 'missing'; title: string; text: string }
    | NotMeasuredData;
  back: { label: string; href: string };
  className?: string;
}
