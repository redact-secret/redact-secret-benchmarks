/** Props for the scanner page blocks. Every value is already formatted: a block never derives or reads a ledger. */

export interface ScannerRosterRow {
  id: string;
  name: string;
  /** "Repository scanner", "Runtime library"; `null` when the registry does not say. */
  kind: string | null;
  version: string;
  /** The file that pins the version. */
  pinnedIn: string;
  /** The run's mode line; `null` when there is no run. */
  mode: string | null;
}

/** One labelled fact. `value: null` is "Not recorded": the repository does not hold it. */
export interface ScannerFact {
  term: string;
  value: string | null;
  /** A second, quieter line: where the value is recorded, or what it was recorded for. */
  note?: string;
  /** Set the value in monospace (ids, digests, versions, commands). */
  code?: boolean;
  /** The word shown for a `null` value, when it is not "Not recorded" (for example "Unavailable": the record predates the fact). */
  missing?: string;
}

export interface ScannerFactGroup { title: string; facts: ScannerFact[] }

/** One kind of product scope statement: its heading, what the kind means, and the statements. */
export interface ScannerScopeGroup { title: string; note: string; items: string[] }

export interface ScannerLink { label: string; href: string }

export interface ScannerProfileData {
  id: string;
  name: string;
  version: string;
  kind: string | null;
  description: string | null;
  groups: ScannerFactGroup[];
  /** The exact arguments the scanner is run with, shown in a disclosure. */
  command: { summary: string; text: string; label: string } | null;
  /** What is not run or measured; `null` is "Not recorded". */
  outOfScope: string[] | null;
  /**
   * The product's own scope (#622), in place of `outOfScope`: how the reviewed statements bind to what was measured (release, mode line, current, history or
   * unknown), then the statements by kind. Absent for a peer.
   */
  scope?: { facts: ScannerFact[]; groups: ScannerScopeGroup[] };
  /** The comparison pages that include this scanner. */
  compared: ScannerLink[];
}

export interface ScannerModeNoteData {
  title: string;
  /** The mode of the run this page describes. */
  mode: 'published' | 'candidate' | null;
  modeLabel: string;
  paragraphs: string[];
}
