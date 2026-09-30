/**
 * Fixture rows with one outcome per scanner, for the level, family, suite and
 * detector pages (#559). Pure: fixtures and each scanner's recorded rows in, block
 * props and the flags the row filters read out.
 *
 * A row is a fixture. Its outcome for a scanner is a word and a status from what
 * that scanner recorded (`outcomeOf`); a scanner with no row for the fixture is
 * "Not measured", never a pass. Nothing is re-scored. Rows come ordered so the ones
 * that need a look are first: rows where redact-secret left a secret readable,
 * redacted too much or flagged a control, then rows where any other scanner did,
 * then the rest in corpus order.
 *
 * A page ships every row of its table as data (the first page as HTML), and the
 * static export repeats a page's data several times, so rows are shipped compact:
 * strings shared between rows (a suite and group, a kind, an evidence level) are held
 * once in `dictionary`, each outcome is an index into `statuses`, and the four flags
 * are one number. `expandRows` turns the visible rows back into block props.
 */
import type { CatalogFixture } from '../services/catalog';
import type { RowResult } from '../services/run';
import type { FixtureCounts, FixtureRowData, ScannerColumnData, StatusLabel } from '../components/report/types';
import { KIND_TITLE, TIER_TITLE, countsOf, isLeft, isTooMuch, outcomeOf, rowClean, tally } from './families';
import { count, int } from './format';
import { FLAG, type CompactRow, type RowsData } from './rowdata';

export const PRODUCT = 'redact-secret';

/** The page of a fixture: its suite page, opened on that fixture. */
export const suiteHref = (category: string): string => `/report/fixtures/${category}/`;
export const fixtureHref = (fixture: { category: string; id: string }): string => `${suiteHref(fixture.category)}?fixture=${encodeURIComponent(fixture.id)}`;
/** The rows behind the figures at one evidence level (`T1`, `T2`, `T3`). */
export const rowsHref = (level: string): string => `/report/rows/${level}/`;

/** One scanner's recorded rows, in the column order of the table. */
export interface RowScanner { id: string; name: string; rows: Map<string, RowResult> | undefined }

export { FLAG, rowSearchText } from './rowdata';
export type { CompactRow, RowsData } from './rowdata';

const problem = (row: RowResult | undefined): boolean => !rowClean(row) || (!!row && isTooMuch(row));

export function resolveRowsData(fixtures: CatalogFixture[], scanners: RowScanner[]): RowsData {
  const twinPositives = new Set(fixtures.flatMap(f => (f.twinOf ? [f.twinOf] : [])));
  const product = scanners.find(s => s.id === PRODUCT);
  const statuses: StatusLabel[] = [];
  const statusIndex = new Map<string, number>();
  const dictionary: string[] = [];
  const dictionaryIndex = new Map<string, number>();
  const status = (s: StatusLabel): number => {
    const key = `${s.status}|${s.label}`;
    let index = statusIndex.get(key);
    if (index === undefined) { index = statuses.length; statuses.push(s); statusIndex.set(key, index); }
    return index;
  };
  const word = (text: string): number => {
    let index = dictionaryIndex.get(text);
    if (index === undefined) { index = dictionary.length; dictionary.push(text); dictionaryIndex.set(text, index); }
    return index;
  };

  const ranked = fixtures.map((f, index) => {
    const mine = product?.rows?.get(f.slug);
    const leaked = !!mine && isLeft(mine);
    const flagged = mine?.flagged === true;
    const look = scanners.some(s => problem(s.rows?.get(f.slug)));
    const item: CompactRow = {
      i: f.id,
      c: f.category,
      g: word(`${f.category} · ${f.group}`),
      k: word(f.tier === 'T0' ? 'Pending review' : KIND_TITLE[f.kind] ?? f.kind),
      e: word(`${f.tier} · ${TIER_TITLE[f.tier] ?? f.tier}${f.twinOf ? ' · twin' : ''}`),
      ...(f.familyIds.length > 1 ? { a: `also in ${count(f.familyIds.length - 1, 'other family', 'other families')}` } : {}),
      o: scanners.map(s => status(outcomeOf(f, s.rows?.get(f.slug)))),
      l: f.tier,
      f: (look ? FLAG.look : 0) | (leaked ? FLAG.leaked : 0) | (flagged ? FLAG.flagged : 0) | (f.twinOf || twinPositives.has(f.slug) ? FLAG.twin : 0),
    };
    return { item, index, rank: leaked || flagged || (!!mine && isTooMuch(mine)) ? 0 : look ? 1 : 2 };
  });
  ranked.sort((a, b) => a.rank - b.rank || a.index - b.index);
  return { scanners: scanners.map(s => ({ id: s.id, name: s.name })), statuses, dictionary, items: ranked.map(r => r.item) };
}

/** Turn compact rows into the block's rows. Only the rows drawn need expanding. */
export function expandRows(data: Pick<RowsData, 'scanners' | 'statuses' | 'dictionary'>, items: CompactRow[]): FixtureRowData[] {
  const productAt = Math.max(0, data.scanners.findIndex(s => s.id === PRODUCT));
  return items.map(item => {
    const outcomes = item.o.map(i => data.statuses[i]);
    return {
      slug: item.i,
      group: data.dictionary[item.g],
      ...(item.a ? { alsoIn: item.a } : {}),
      kind: data.dictionary[item.k],
      evidence: data.dictionary[item.e],
      outcome: outcomes[productAt],
      href: fixtureHref({ category: item.c, id: item.i }),
      outcomes,
    };
  });
}

/** The headline counts of a set of rows for redact-secret, as the fact list the table shows. */
export function rowFacts(fixtures: CatalogFixture[], rows: Map<string, RowResult> | undefined, label = 'Rows'): { term: string; value: string }[] {
  const t = tally(fixtures, rows);
  const measured = rows !== undefined;
  return [
    { term: label, value: int(t.fixtures) },
    { term: 'Left readable', value: measured ? int(t.leftReadable) : '—' },
    { term: 'Redacted too much', value: measured ? int(t.tooMuch) : '—' },
    { term: 'False alarms', value: measured ? int(t.falseAlarms) : '—' },
    ...(t.notMeasured > 0 ? [{ term: 'Not measured', value: int(t.notMeasured) }] : []),
  ];
}

/** Counts of a set of fixtures for a suite or detector row, or `null` when it has none. */
export const countsFor = (fixtures: CatalogFixture[], rows: Map<string, RowResult> | undefined): FixtureCounts | null => countsOf(tally(fixtures, rows), rows !== undefined);

/** The scanner columns of a run: every scanner the run lists, in run order, product first. */
export const scannerColumns = (scanners: { id: string; name: string }[]): ScannerColumnData[] => scanners.map(s => ({ id: s.id, name: s.name }));
