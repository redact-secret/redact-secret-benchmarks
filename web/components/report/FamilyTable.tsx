import Link from 'next/link';
import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FamilyTable.module.css';
import type { FamilyRowData } from './types';

export interface FamilyTableProps {
  families: FamilyRowData[];
  /** Names the table and its scroll region. */
  caption: string;
  className?: string;
}

const count = (row: FamilyRowData, pick: 'leftReadable' | 'tooMuch' | 'falseAlarms') => {
  if (!row.counts) return '—';
  const value = row.counts[pick];
  return value === '0' ? value : <b>{value}</b>;
};

const columns: DataTableColumn<FamilyRowData>[] = [
  {
    key: 'family',
    header: 'Family',
    rowHeader: true,
    cell: r => (
      <>
        <Link href={r.href}>{r.name}</Link>
        <small className={styles.id}><Code>{r.id}</Code></small>
      </>
    ),
  },
  { key: 'provider', header: 'Provider', cell: r => r.provider },
  { key: 'fixtures', header: 'Fixtures', numeric: true, cell: r => r.fixtures },
  { key: 'readable', header: 'Left readable', numeric: true, cell: r => (r.counts ? count(r, 'leftReadable') : <StatusBadge status="not-measured">No fixtures</StatusBadge>) },
  { key: 'much', header: 'Too much', numeric: true, cell: r => count(r, 'tooMuch') },
  { key: 'alarms', header: 'False alarms', numeric: true, cell: r => count(r, 'falseAlarms') },
];

/** Every family in taxonomy order, one row each. A family with no fixtures says so; it is never shown as zeros. */
export function FamilyTable({ families, caption, className }: FamilyTableProps) {
  return (
    <DataTable<FamilyRowData>
      className={cx(styles.table, className)}
      columns={columns}
      rows={families}
      getRowKey={r => r.id}
      caption={caption}
      wide
      stackOnPhone
      empty={<EmptyState title="No family matches">Clear the search or choose All.</EmptyState>}
    />
  );
}
