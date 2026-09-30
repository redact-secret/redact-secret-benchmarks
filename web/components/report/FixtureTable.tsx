import Link from 'next/link';
import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Pager } from '../nav';
import type { PagerProps } from '../nav';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FixtureTable.module.css';
import type { FixtureRowData, ScannerColumnData } from './types';

export interface FixtureTableProps {
  /** The name of what the rows belong to (a family, a level, a suite, a detector), used in the region label. */
  familyName: string;
  /** The rows on this page. The parent paginated them. */
  rows: FixtureRowData[];
  /** "50 rows for redact-secret only. Other scanners are on the comparison pages." */
  description: string;
  /** Headline counts: fixtures, left readable, redacted too much, false alarms. Omit when there are none. */
  facts?: { term: string; value: string }[];
  /** Pager position; omit for a single page. */
  pager?: Pick<PagerProps, 'page' | 'pageCount' | 'total' | 'pageSize' | 'previousHref' | 'nextHref' | 'onPrevious' | 'onNext'>;
  /**
   * One outcome column per scanner, from each row's `outcomes` (same order). Omit for the
   * single redact-secret column, which is what a family page shows by default.
   */
  scanners?: ScannerColumnData[];
  /** The section heading. Defaults to "Fixtures in this family". */
  title?: string;
  /** What an empty table says. Defaults to the family wording. */
  emptyTitle?: string;
  emptyText?: string;
  className?: string;
}

const baseColumns = (linked: boolean): DataTableColumn<FixtureRowData>[] => [
  {
    key: 'fixture',
    header: 'Fixture',
    rowHeader: true,
    cell: r => (
      <>
        {linked && r.href ? <Link href={r.href}><Code>{r.slug}</Code></Link> : <Code>{r.slug}</Code>}
        <small className={styles.sub}>{r.group}{r.alsoIn ? ` · ${r.alsoIn}` : ''}</small>
      </>
    ),
  },
  {
    key: 'kind',
    header: 'Kind and evidence',
    cell: r => (
      <>
        {r.kind}
        {r.evidence && <small className={styles.sub}>{r.evidence}</small>}
      </>
    ),
  },
];

const productColumn: DataTableColumn<FixtureRowData> = { key: 'outcome', header: 'redact-secret', cell: r => <StatusBadge status={r.outcome.status}>{r.outcome.label}</StatusBadge> };

const scannerColumns = (scanners: ScannerColumnData[]): DataTableColumn<FixtureRowData>[] => scanners.map((s, i) => ({
  key: `scanner-${s.id}`,
  header: s.name,
  label: s.name,
  cell: r => {
    const outcome = r.outcomes?.[i];
    return outcome ? <StatusBadge status={outcome.status}>{outcome.label}</StatusBadge> : <StatusBadge status="not-measured">Not measured</StatusBadge>;
  },
}));

/**
 * The rows behind a family, level, suite or detector: headline counts, the fixture
 * table and a pager. Each row links to its fixture page when it has one. The table
 * shows redact-secret's outcome, or one column per scanner when `scanners` is given.
 * A list with no fixtures shows a dashed "Not measured" box, never a table of zeros.
 */
export function FixtureTable({ familyName, rows, description, facts, pager, scanners, title = 'Fixtures in this family', emptyTitle = 'No fixtures in this family yet', emptyText = 'Nothing in the corpus targets it, so nothing is measured and no coverage is claimed.', className }: FixtureTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState className={className} title={emptyTitle}>
        <p>{emptyText}</p>
        <p><StatusBadge status="not-measured">Not measured</StatusBadge></p>
      </EmptyState>
    );
  }
  const columns = [...baseColumns(rows.some(r => r.href)), ...(scanners && scanners.length > 0 ? scannerColumns(scanners) : [productColumn])];
  return (
    <div className={cx(styles.wrap, className)}>
      {facts && facts.length > 0 && <KeyValueList variant="facts" items={facts.map(f => ({ term: f.term, description: f.value }))} />}
      <Section title={title} description={description} rule="none" headingLevel={2}>
        <DataTable<FixtureRowData> columns={columns} rows={rows} getRowKey={r => r.href ?? r.slug} caption={`Fixtures in ${familyName}`} wide />
        {pager && <Pager itemLabel="rows" {...pager} />}
      </Section>
    </div>
  );
}
