/**
 * The data the family-page blocks take (#589). Every value is already formatted text:
 * a block never derives a count, rate or status from another prop. The resolver
 * (`web/resolvers/family-detail.ts`) reads the ledger, the provider dossier and the
 * peer rule map and hands the result over.
 */
/**
 * A line of dossier prose, split so a block renders it with no markup of its own:
 * plain text, a code span (a prefix, a pattern) or a link to a source.
 */
export type InlinePart = string | { code: string } | { href: string; text: string };

/** One labelled note from the provider dossier, as written. */
export interface FamilyNoteItem {
  term: string;
  parts: InlinePart[];
}

/** A row of the counts: one evidence level, or one scanner. */
export interface FamilyCountsRow {
  id: string;
  label: string;
  /** A second line: the level's name, or the scanner's mode. */
  detail?: string;
  /** "25". A level with no fixtures is not a row. */
  fixtures: string;
  /** "—" where nothing is measured: never zero. */
  leftReadable: string;
  tooMuch: string;
  falseAlarms: string;
  /** Present only when some rows have no recorded outcome. */
  notMeasured?: string;
}

/** One scanner of the run, with what its own rules say about the family. */
export interface FamilyScannerRow extends FamilyCountsRow {
  kind: string;
  /** "3 rules target it" or "No rule maps to it": the reviewed rule map, not a result. */
  rules: string;
}

export interface FamilyBenchmarkData {
  /** "published · redact-secret 0.1.0-beta.11": the mode the counts came from. `null` when no run is published. */
  mode: string | null;
  /** Headline counts over every level, `Fixtures` first. */
  facts: { term: string; value: string }[];
  /** "11 must redact, 14 must not flag." The kinds the fixtures have, from the corpus. */
  kinds: string;
  /** One row per evidence level the family has fixtures at, then nothing for the other levels. */
  levels: FamilyCountsRow[];
  /** One row per scanner of the run, in run order; empty when no run is published. */
  scanners: FamilyScannerRow[];
  /** A sentence about the run when it is partial or absent, otherwise nothing. */
  runNote?: string;
  /** Where the table of every row is on the page, if the family has fixtures. */
  rowsHref?: string;
}

/** A rule of a scanner that targets the family. */
export interface FamilyRuleRow {
  scanner: string;
  rule: string;
  /** The reviewed pattern evidence, as the map states it ("github_pat_ + 82 characters"). */
  basis: string;
}

export interface FamilyRulesData {
  rules: FamilyRuleRow[];
  /** Scanners with no rule that maps to the family. */
  withoutRules: string[];
  /** "Reviewed 2026-09-30 against each scanner's pinned rule file." */
  reviewed: string;
}

export interface FamilySourceLink {
  href: string;
  /** "docs.github.com", or the reference text of a research issue. */
  label: string;
  /** "docs.github.com/en/authentication/…": the rest of the address, for a reader who wants to see where it goes. */
  detail?: string;
}

/** One cell of the research record: "Review state" and "Draft, not reviewed". `not-measured` draws it dashed ("Not recorded"). */
export interface FamilyRecordFact {
  label: string;
  value: string;
  tone?: 'neutral' | 'not-measured';
}

/** One format contract revision of the family, as the canonical record lists it. */
export interface FamilyRevisionItem {
  /** "github:fine-grained-personal-access-token@1". */
  id: string;
  /** "Revision 1". */
  label: string;
  /** "current · draft · supersedes @1": the record's period, review state and chain, in words. */
  detail: string;
  current: boolean;
}

/** A line with a stable reference: a ruling (`review-…#2`), a blocker kind or an open question id. */
export interface FamilyRecordLine {
  /** The reference or kind, drawn as code or a label. */
  ref: string;
  /** "2026-10-04", when the record dates it. */
  at?: string;
  text: string;
}

/**
 * The research record of a family from the canonical credential-evidence records (#591, #582): review state, format revision,
 * research state and blockers, the revisions and the rulings. It describes the research, never a scanner, the product or support status.
 */
export interface FamilyResearchRecordData {
  /** "credential-evidence snapshot-2026.10.06.4 · records at 77ce761 · schema 1.8.0": where the record comes from. */
  provenance: string;
  /** Set when no record is shown, with the reason: the family has no record, or the projection is not the pinned release's. */
  absent?: { title: string; text: string };
  facts: FamilyRecordFact[];
  /** Every format contract revision, shown when there is more than one (a superseded or proposed revision stays visible). */
  revisions: FamilyRevisionItem[];
  /** One line per blocker part, kind first. */
  blockers: FamilyRecordLine[];
  /** Policy rulings recorded as `decided` review events, by stable reference. */
  rulings: FamilyRecordLine[];
  /** "5 events: 2 observed, 3 reviewed. Latest: reviewed on 2026-09-29 by automation, project maintainer." */
  review?: string;
  /** The family record at the release's commit. */
  recordHref?: string;
}

export interface FamilySourcesData {
  /** Documentation and code the dossier and the taxonomy cite for the format. */
  sources: FamilySourceLink[];
  /** Research issues, and the evidence permalink, as the dossier records them. */
  log: FamilySourceLink[];
  /** "Researched 2026-09-29", when the dossier has a date. */
  researched?: string;
}

/** Provider format facts copied from one credential-evidence contract, without interpreting claim text. */
export interface FamilyFormatData {
  provenance: string;
  absent?: string;
  shape: { label: string; value: string }[];
  claims: { id: string; text: string; evidenceClass: 'provider-documented' | 'tool-corroborated' | 'project-policy' | 'unresolved'; evidenceLabel: string; date: string; temporality: string; sources: { id: string; label: string; href: string; detail: string }[] }[];
  questions: FamilyRecordLine[];
}
