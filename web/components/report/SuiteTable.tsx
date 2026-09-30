import Link from 'next/link';
import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './SuiteTable.module.css';
import type { SuiteRowData } from './types';

export interface SuiteTableProps {
  suites: SuiteRowData[];
  /** Names the table and its scroll region. */
  caption: string;
  className?: string;
}

const count = (row: SuiteRowData, pick: 'leftReadable' | 'tooMuch' | 'falseAlarms') => {
  if (!row.counts) return '—';
  const value = row.counts[pick];
  return value === '0' ? value : <b>{value}</b>;
};

const columns: DataTableColumn<SuiteRowData>[] = [
  {
    key: 'suite',
    header: 'Suite',
    rowHeader: true,
    cell: r => (
      <>
        <Link href={r.href}>{r.title}</Link>
        <small className={styles.sub}><Code>{r.id}</Code></small>
        <small className={styles.sub}>{r.description}</small>
      </>
    ),
  },
  { key: 'fixtures', header: 'Fixtures', numeric: true, cell: r => r.fixtures },
  { key: 'readable', header: 'Left readable', numeric: true, cell: r => (r.counts ? count(r, 'leftReadable') : <StatusBadge status="not-measured">No fixtures</StatusBadge>) },
  { key: 'much', header: 'Too much', numeric: true, cell: r => count(r, 'tooMuch') },
  { key: 'alarms', header: 'False alarms', numeric: true, cell: r => count(r, 'falseAlarms') },
];

/** Every suite of the corpus with redact-secret's fixture-row counts. A suite with no fixtures says so; it is never shown as zeros. */
export function SuiteTable({ suites, caption, className }: SuiteTableProps) {
  return (
    <DataTable<SuiteRowData>
      className={cx(styles.table, className)}
      columns={columns}
      rows={suites}
      getRowKey={r => r.id}
      caption={caption}
      wide
      stackOnPhone
      empty={<EmptyState title="No suite matches">Clear the search.</EmptyState>}
    />
  );
}
