/**
 * The shape of a rows table's data as a page ships it, and the few pure helpers the
 * client-side filters need. No imports of anything but types, so both the resolvers that
 * build the data (`rows.ts`) and the filters a client island runs (`filters.ts`) can use it
 * without a cycle.
 */
import type { ScannerColumnData, StatusLabel } from '../components/report/types';

/** Flags the filters read, one bit each, so a filter never re-derives an outcome. */
export const FLAG = {
  /** Some scanner left a secret readable, redacted too much or flagged a control. */
  look: 1,
  /** redact-secret left a span readable. */
  leaked: 2,
  /** redact-secret flagged a control. */
  flagged: 4,
  /** The fixture is a near-twin negative, or the positive it was mutated from. */
  twin: 8,
} as const;

/** One row as shipped. `g`, `k` and `e` index `RowsData.dictionary`; each `o` indexes `RowsData.statuses`. */
export interface CompactRow {
  /** The fixture id within its suite. */
  i: string;
  /** The suite (category) id. */
  c: string;
  /** Suite and group text. */
  g: number;
  /** Kind text. */
  k: number;
  /** Evidence text. */
  e: number;
  /** "also in 2 other families". */
  a?: string;
  /** One status index per scanner column. */
  o: number[];
  /** The fixture's evidence level: `T1`, `T2`, `T3` or `T0`. */
  l: string;
  f: number;
}

/** Everything a rows table needs: the scanner columns, the shared text and the rows. */
export interface RowsData {
  scanners: ScannerColumnData[];
  statuses: StatusLabel[];
  dictionary: string[];
  items: CompactRow[];
}

/** The text a row's search matches: what the table shows for the fixture. */
export const rowSearchText = (data: Pick<RowsData, 'dictionary'>, item: CompactRow): string =>
  `${item.i} ${data.dictionary[item.g]} ${data.dictionary[item.k]} ${data.dictionary[item.e]}`.toLowerCase();

/**
 * A rows table as a page ships it: the first page of its default view, which paints with the
 * page, and the path of the build-emitted file that holds every row when there are more than
 * fit that page. `head` is a complete `RowsData` (its own dictionary and statuses), so the
 * same code draws it and the loaded file. No `src` means `head` holds every row.
 */
export interface RowsSource {
  head: RowsData;
  /** Rows in the whole table, for the count and the pager before the rest has loaded. */
  total: number;
  /** A path for `lib/data-paths.ts`; present only when `head` is not every row. */
  src?: string;
}

/** Shape guard for a loaded rows file: the parts `expandRows` and the filters read exist. */
export const isRowsData = (value: unknown): value is RowsData => {
  const v = value as Partial<RowsData> | null;
  return !!v && Array.isArray(v.scanners) && Array.isArray(v.statuses) && Array.isArray(v.dictionary) && Array.isArray(v.items);
};
