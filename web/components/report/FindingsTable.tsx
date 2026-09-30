import Link from 'next/link';
import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FindingsTable.module.css';
import type { FindingRowData } from './types';

export interface FindingsTableProps {
  findings: FindingRowData[];
  /** Names the table and its scroll region. */
  caption: string;
  className?: string;
}

const columns: DataTableColumn<FindingRowData>[] = [
  {
    key: 'finding',
    header: 'Finding',
    rowHeader: true,
    cell: r => (
      <>
        <a href={r.href}>{r.number} · {r.title}</a>
        <small className={styles.sub}>{r.kind}</small>
      </>
    ),
  },
  { key: 'status', header: 'Status', cell: r => <StatusBadge status={r.status.status}>{r.status.label}</StatusBadge> },
  {
    key: 'fixtures',
    header: 'Fixtures',
    cell: r => (
      <ul className={styles.fixtures}>
        {r.fixtures.map(f => (
          <li key={f.label}>{f.href ? <Link href={f.href}><Code>{f.label}</Code></Link> : <Code>{f.label}</Code>}</li>
        ))}
      </ul>
    ),
  },
  {
    key: 'record',
    header: 'Recorded',
    cell: r => (
      <>
        {r.reviewed}
        <small className={styles.sub}>Measured on {r.measured}</small>
      </>
    ),
  },
];

/**
 * Every finding this benchmark handed to the product, with its recorded status, the
 * fixtures it rests on (each a link to its page) and when the ledger last moved. A
 * snapshot of lifecycle records, not live issue status; the page says so.
 */
export function FindingsTable({ findings, caption, className }: FindingsTableProps) {
  return (
    <DataTable<FindingRowData>
      className={cx(styles.table, className)}
      columns={columns}
      rows={findings}
      getRowKey={r => r.id}
      caption={caption}
      wide
      empty={<EmptyState title="No findings recorded">The findings ledger has no entries for this snapshot.</EmptyState>}
    />
  );
}
