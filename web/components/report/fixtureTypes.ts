/**
 * Props of the fixture page blocks (#588). Plain, serialisable data the resolver shaped from the
 * corpus and the run: text arrives formatted, a block never derives a count or a word.
 */
import type { Crumb } from '../page';
import type { ByteLineData, FixtureScannerData, StatusLabel } from './types';

/**
 * How a stretch of a file is drawn. `expected` is a secret span the corpus authored; `companion` a span
 * that is context, not a secret. In an output view, `redacted` is a reported range over secret bytes
 * (solid bar, text hidden), `partial` a reported range that touches a partly exposed secret (hatched
 * bar, text hidden), `exposed` secret bytes no reported range covers (dashed frame, text shown) and
 * `extra` a reported range outside every expected span (solid bar, text hidden). `changed` is a byte a
 * twin differs by.
 */
export type FileMarkKind = 'expected' | 'companion' | 'redacted' | 'partial' | 'exposed' | 'extra' | 'changed';

export interface FileSegment {
  text: string;
  mark?: FileMarkKind;
  /** The envelope of an expected span: the widest range a finding may reach at no cost. */
  envelope?: boolean;
  /** Names a masked range for assistive technology ("redacted, 93 bytes"); the hidden text is never read. */
  label?: string;
  /** Tooltip for a pointer ("Expected secret, bytes 48 to 141"). */
  title?: string;
}

export interface FileLineData { number: number; segments: FileSegment[] }
/** Lines nothing touches are left out of a long file and replaced by a gap row that says how many. */
export interface FileGapData { gap: number }
export type FileRowData = FileLineData | FileGapData;

/** One file as the page draws it: the header, the numbered lines, the way it is read by assistive technology. */
export interface FixtureFileData {
  /** Names the scrollable region: "Input file". */
  label: string;
  /** The file's path, or a short phrase for a drawn output ("1 range reported"). */
  title: string;
  /** "145 bytes · LF · UTF-8". */
  facts: string;
  /** Right of the facts: "bytes 48–141", "byte 111 changed". */
  note?: string;
  rows: FileRowData[];
  /** Said under the file when it holds characters that are not normally visible and are drawn as symbols. */
  notice?: string;
}

export interface FixtureKeyItem { mark: FileMarkKind | 'envelope'; label: string }

export interface FixtureVerdictData {
  /** "redact-secret 0.1.0-beta.11". */
  who: string;
  /** "published run 2026-09-30". */
  run: string;
  /** The recorded outcome in one phrase: "Redacted exactly", "Quiet", "Not measured". */
  headline: StatusLabel;
  explanation: string;
  /** Up to three recorded figures; none when nothing was measured. */
  figures: { label: string; value: string; of?: string }[];
}

export interface FixtureRange { range: string; size: string }

export interface FixtureSpanRow {
  /** "Secret 1", "Companion 1", "Reported range 1". */
  label: string;
  /** "role: secret". */
  role: string;
  /** Absent for a reported range no span expects. */
  expected?: FixtureRange & { envelope?: string };
  reported: FixtureRange[];
  /** Said where `reported` is empty: "none reported", "not measured". */
  reportedNote: string;
  outcome?: StatusLabel;
  /** What the outcome word means, in the ledger's terms. */
  outcomeNote?: string;
}

export interface FixtureTwinData {
  id: string;
  href: string;
  /** "Alphabet twin", or the twin's own id when the corpus names no kind. */
  title: string;
  /** The corpus's own words for what differs. */
  description: string;
  /** "byte 111 changed". */
  changed: string;
  file: FixtureFileData;
  outcome: StatusLabel[];
  /** "redact-secret flagged nothing". */
  outcomeNote: string;
  /** "Open the twin" or "Open the original". */
  linkLabel: string;
}

export interface FixtureTwinsData {
  heading: string;
  lede: string;
  items: FixtureTwinData[];
}

export interface FixtureFactData {
  term: string;
  value?: string;
  /** Makes `value` a link. */
  href?: string;
  /** Several linked values. */
  links?: { label: string; href: string; external?: boolean }[];
  /** A second line under the value. */
  note?: string;
  /** The corpus holds no value: drawn dashed and muted, never as a blank. */
  notRecorded?: boolean;
  /** `value` is an id or a path: monospace. */
  mono?: boolean;
}

export interface FixturePeerRow {
  id: string;
  name: string;
  /** "Results from 2026-09-29 · Directory scan · default rules". */
  detail: string;
  fixture: StatusLabel[];
  ranges: string;
  /** This scanner's outcome on each related fixture (the twins, or the original), when the fixture has any. */
  related?: { label: string; outcome: StatusLabel[] }[];
}

export interface FixturePeersData {
  /** "Same input, 3 other scanners". */
  summary: string;
  /** Header of the related column: "Its twin", "Its twins", "Its original". Absent when the fixture has none. */
  relatedHeading?: string;
  rows: FixturePeerRow[];
  /** Every scanner's reported ranges drawn on the bytes, as lanes. */
  lanes?: { lines: ByteLineData[]; scanners: FixtureScannerData[]; caption: string };
}

export interface FixtureActionsData {
  /** A data URL holding the exact bytes, and the file name to save it as. Absent when the bytes cannot be encoded. */
  download?: { href: string; filename: string };
  /** The suite page, where the fixture is one row of the corpus. */
  corpusHref: string;
}

/** Everything the fixture page shows about one fixture. */
export interface FixtureDetailData {
  id: string;
  head: {
    /** "Fixture · must redact". */
    eyebrow: string;
    title: string;
    /** "beta8-211--github-fine-grained-pat-terraform-provider". */
    slug: string;
    tags: { label: string; dashed?: boolean; mono?: boolean }[];
  };
  crumbs: Crumb[];
  suiteHref: string;
  verdict: FixtureVerdictData;
  input: FixtureFileData;
  /** The product's reported ranges drawn over the input. Absent when the product holds no row for these bytes. */
  output?: FixtureFileData;
  /** Said where `output` is absent. */
  outputNote?: string;
  key: FixtureKeyItem[];
  spans: FixtureSpanRow[];
  spansLede: string;
  twins?: FixtureTwinsData;
  whyHeading: string;
  facts: FixtureFactData[];
  sources: { href: string; label: string }[];
  /** The exact bytes as an escaped string, for the disclosure. */
  escaped: string;
  command: string;
  actions: FixtureActionsData;
  peers?: FixturePeersData;
  /** Not measured: the run left this suite's report out, or holds none. */
  runProblem?: string;
}
