import Link from 'next/link';
import { DataTable, ProportionBar } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './DetectorList.module.css';
import type { DetectorRowData } from './types';

export interface DetectorListProps {
  detectors: DetectorRowData[];
  /** Names the table and its scroll region. */
  caption: string;
  className?: string;
}

const columns: DataTableColumn<DetectorRowData>[] = [
  {
    key: 'detector',
    header: 'Detector',
    rowHeader: true,
    cell: r => (
      <>
        <Link href={r.href}>{r.title}</Link>
        <small className={styles.id}><Code>{r.id}</Code></small>
      </>
    ),
  },
  { key: 'fixtures', header: 'Fixtures', numeric: true, cell: r => r.fixtures },
  {
    key: 'sample',
    header: 'Sample size',
    label: 'Sample size',
    cell: r => <ProportionBar value={r.value} max={r.max} marker={r.minimum} size="thin" label={`${r.fixtures} fixtures; minimum sample size ${r.minimum}`} className={styles.bar} />,
  },
  { key: 'flag', header: 'Against the minimum', cell: r => (r.flag ? <StatusBadge status={r.flag.status}>{r.flag.label}</StatusBadge> : '') },
];

/**
 * Detectors by fixture count, largest first, with the minimum sample size marked on
 * each bar. Assignments overlap, so a fixture can count under several detectors and
 * the counts are never summed. A detector with no fixtures says so on its own page.
 */
export function DetectorList({ detectors, caption, className }: DetectorListProps) {
  return (
    <DataTable<DetectorRowData>
      className={cx(styles.table, className)}
      columns={columns}
      rows={detectors}
      getRowKey={r => r.id}
      caption={caption}
      wide
      stackOnPhone
      empty={<EmptyState title="No detector matches">Clear the search or choose All.</EmptyState>}
    />
  );
}
