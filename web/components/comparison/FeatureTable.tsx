import { cx } from '../../lib/cx';
import { DataTable } from '../data';
import type { DataTableColumn, DataTableGroup } from '../data';
import { Chip } from '../feedback';
import type { FeatureCell, FeatureFilter, FeatureGroup, FeatureLibrary, FeatureMark, FeatureRow } from './types';
import styles from './FeatureTable.module.css';

export interface FeatureTableProps {
  libraries: FeatureLibrary[];
  groups: FeatureGroup[];
  /** `differences` hides rows the ledger marks `same`. Controlled by the parent. */
  filter?: FeatureFilter;
  /** Names the table for assistive tech. */
  caption: string;
  className?: string;
}

/** Said to screen readers ahead of the note; the page never draws a tick or a cross. */
const MARK_WORD: Record<FeatureMark, string> = { yes: 'Yes', partly: 'Opt-in or partly', no: 'Not listed' };

function Cell({ cell }: { cell: FeatureCell | undefined }) {
  if (!cell) return <span className={styles.no}>—</span>;
  const text = cell.note || (cell.mark === 'yes' ? 'Yes' : '—');
  return (
    <span className={cx(styles.cell, cell.mark === 'no' && styles.no)}>
      <span className={styles.hidden}>{MARK_WORD[cell.mark]}. </span>
      {cell.literal ? <code className={styles.literal}>{text}</code> : text}
      {cell.tested && <> <Chip className={styles.tested}>tested</Chip></>}
    </span>
  );
}

/**
 * What each library says it can do, from its own docs, one grouped table. Cells
 * are plain words with a dash for "not listed": no ticks, no totals, no score.
 * A `tested` chip marks the few claims a committed test checks. On a phone each
 * feature becomes a block with one labelled line per library.
 */
export function FeatureTable({ libraries, groups, filter = 'all', caption, className }: FeatureTableProps) {
  const columns: DataTableColumn<FeatureRow>[] = [
    { key: 'feature', header: 'Feature', rowHeader: true, cell: row => row.label },
    ...libraries.map(lib => ({
      key: lib.id,
      label: lib.name,
      header: (
        <>
          {lib.name}
          <small className={styles.version}>{lib.version}</small>
        </>
      ),
      cell: (row: FeatureRow) => <Cell cell={row.cells[lib.id]} />,
    })),
  ];
  const shown: DataTableGroup<FeatureRow>[] = groups
    .map(g => ({ label: g.label, rows: filter === 'differences' ? g.rows.filter(r => !r.same) : g.rows }))
    .filter(g => g.rows.length > 0);
  return (
    <DataTable
      className={cx(styles.table, className)}
      columns={columns}
      groups={shown}
      getRowKey={row => row.id}
      caption={caption}
      stackOnPhone
      wide
      empty={filter === 'differences' ? 'Every listed feature reads the same across these libraries.' : 'No features recorded for this run.'}
    />
  );
}
