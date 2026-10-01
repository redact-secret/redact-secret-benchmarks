import { cx } from '../../../lib/cx';
import { DataTable } from '../../data';
import type { DataTableColumn, DataTableGroup } from '../../data';
import { StatusBadge } from '../../feedback';
import type { EvidenceCell, EvidenceColumn, EvidenceGroup, EvidenceRow } from './types';
import styles from './EvidenceTable.module.css';

export interface EvidenceTableProps {
  /** The scanners, in registry order. The order is never a result. */
  columns: EvidenceColumn[];
  groups: EvidenceGroup[];
  /** The header over the row labels. */
  rowHeader: string;
  /** Names the table for assistive tech. */
  caption: string;
  className?: string;
}

function Cell({ cell }: { cell: EvidenceCell }) {
  switch (cell.kind) {
    case 'count':
      return (
        <span className={styles.count}>
          <b>{cell.value}</b>
          <small>of {cell.of}</small>
        </span>
      );
    case 'unscored':
      return <span className={styles.muted}>Needs review{cell.of ? <small>{cell.of} unscored</small> : null}</span>;
    case 'not-measured':
      return <StatusBadge status="not-measured">Not measured</StatusBadge>;
    default:
      return <span className={styles.muted}>No check</span>;
  }
}

/**
 * Scanners across, checks down: every method page uses this one table, so the columns keep their place from
 * page to page. A cell is "n of N": the checks that did not hold out of the checks scored. There is no total
 * across scanners, no sort and no emphasis: the order is the registry's and a number is only ever read in its row.
 */
export function EvidenceTable({ columns, groups, rowHeader, caption, className }: EvidenceTableProps) {
  const tableColumns: DataTableColumn<EvidenceRow>[] = [
    {
      key: 'check',
      header: rowHeader,
      rowHeader: true,
      cell: row => (
        <span className={styles.label}>
          {row.label}
          {row.note && <small>{row.note}</small>}
        </span>
      ),
    },
    ...columns.map((column, i): DataTableColumn<EvidenceRow> => ({
      key: column.id,
      header: (
        <span className={styles.scanner}>
          {column.name}
          {column.version && <small>{column.version}</small>}
        </span>
      ),
      label: column.name,
      numeric: true,
      cell: row => <Cell cell={row.cells[i]} />,
    })),
  ];
  const tableGroups: DataTableGroup<EvidenceRow>[] = groups.map(g => ({ label: g.label, rows: g.rows }));
  const labelled = tableGroups.length > 1 || (tableGroups[0]?.label ?? '') !== '';
  return (
    <div className={cx(styles.table, className)}>
      {labelled ? (
        <DataTable columns={tableColumns} groups={tableGroups} getRowKey={r => r.key} caption={caption} wide />
      ) : (
        <DataTable columns={tableColumns} rows={tableGroups[0]?.rows ?? []} getRowKey={r => r.key} caption={caption} wide />
      )}
    </div>
  );
}
