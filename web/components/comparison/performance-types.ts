/**
 * Props shared by the performance pair blocks (`/comparison/performance`). Every value is
 * already formatted and every position already computed: a block draws what it is given.
 * Two sides, `a` and `b`, are laid out identically; which library each is belongs to the page.
 */
import type { SegmentedNavItem } from '../nav';

/** The two sides of the pair. `a` is drawn as a filled square, `b` as a hollow one: a shape, never a colour. */
export type PairSide = 'a' | 'b';

/** One decade of the shared log axis: where it sits (0 to 1) and its label ("10 ms"). */
export interface TrackTick {
  position: number;
  label: string;
}

/** One timed call on the shared axis, at its median, with the span of its timed calls behind it. */
export interface TrackMark {
  side: PairSide;
  /** 0 to 1 along the axis. */
  position: number;
  /** "3.8 ms", for the tooltip and assistive tech. */
  label: string;
  /** Shortest and longest timed call, as positions. */
  range?: [number, number];
}

export interface PairSideInfo {
  name: string;
  /** "0.1.0-beta.11". */
  version: string;
  /** "local build · unreleased", "npm". */
  chip?: string;
  /** "Setting: PII + US". */
  setting: string;
  /** What this side is and which call was timed. */
  lines: string[];
}

/** A time the ledger recorded, or a stated "Not measured". */
export type PerformanceCell =
  | {
      state: 'timed';
      /** "3.8 ms". */
      time: string;
      /** "17.1 MB/s · 12 runs". */
      speed: string;
      /** "3.6 to 4.3 ms". */
      spread: string;
      /** What the call did: "Hid 8 of 8 values". */
      did: string;
    }
  | { state: 'not-measured'; reason: string };

export interface PerformanceCase {
  id: string;
  /** "Does it catch real sensitive values?" */
  label: string;
  /** What the text is, by kind. */
  note: string;
  /** `real-looking-values · 128.0 KiB · each line repeated 512 times`. */
  detail: string;
  a: PerformanceCell;
  b: PerformanceCell;
  marks: TrackMark[];
  /** Set when the two times are not read as different; says why. */
  near?: string;
}

export interface PerformanceGroup {
  id: string;
  /** "1 / 2". */
  position: string;
  title: string;
  description: string;
  cases: PerformanceCase[];
}

export interface PerformanceOverviewRow {
  side: PairSide;
  name: string;
  /** "3.9 ms to 1,775 ms across 6 texts". */
  span: string;
  marks: TrackMark[];
}

/** One control of the picker: a label and links, the current one marked by href. */
export interface PickerControl {
  label: string;
  items: SegmentedNavItem[];
  currentHref: string;
}

export interface OwnRunRow {
  id: string;
  /** The text's profile: "scale-logs-small-whole". */
  profile: string;
  /** How the text reached the call. */
  fed: string;
  median: string;
  /** "2.1 to 2.3 ms". */
  spread: string;
  p95: string;
  speed: string;
  runs: string;
}

export interface MissingGroup {
  id: string;
  title: string;
  description: string;
  /** Why it has no time, and where it is tracked. */
  reason: string;
}
