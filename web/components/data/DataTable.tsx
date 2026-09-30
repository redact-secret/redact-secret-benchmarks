import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './DataTable.module.css';

export interface DataTableColumn<Row> {
  /** Stable key, also used as the phone label fallback. */
  key: string;
  header: ReactNode;
  /** Text for a cell's phone label when `header` is not plain text. */
  label?: string;
  /** Right-align and use tabular figures. */
  numeric?: boolean;
  /** Render this column's cell as the row's `th scope="row"`. One per table. */
  rowHeader?: boolean;
  cell: (row: Row, index: number) => ReactNode;
}

export interface DataTableGroup<Row> {
  label: string;
  rows: Row[];
}

interface Base<Row> {
  columns: DataTableColumn<Row>[];
  getRowKey: (row: Row) => string;
  /** Names the table for assistive tech and its scroll region. Required. */
  caption: string;
  /** Show the caption as visible text above the table. */
  showCaption?: boolean;
  /** Shown when there are no rows. Defaults to a plain sentence. */
  empty?: ReactNode;
  /** `wide` gives the table a minimum width so it scrolls inside its own box instead of squashing. */
  wide?: boolean;
  /**
   * On a phone each row becomes a labelled block, so no cell is squeezed to a
   * word per line and nothing scrolls sideways. On by default; pass `false` for a
   * table whose columns only read side by side, which then scrolls inside its own
   * region at its natural width.
   */
  stackOnPhone?: boolean;
  className?: string;
}

export type DataTableProps<Row> = Base<Row> & ({ rows: Row[]; groups?: never } | { groups: DataTableGroup<Row>[]; rows?: never });

/**
 * A table of recorded values. Rows are plain data the caller shaped from the
 * ledger; the table only lays them out. A word is never broken to make a column
 * narrower: a table that does not fit scrolls horizontally inside its own
 * focusable region, never the page, and on a phone it stacks (`stackOnPhone`). Sorting and filtering are the caller's, so
 * order is always the order given.
 */
export function DataTable<Row>({ columns, getRowKey, caption, showCaption = false, empty, wide = false, stackOnPhone = true, className, ...data }: DataTableProps<Row>) {
  const groups: DataTableGroup<Row>[] | null = data.groups ?? null;
  const flat = data.rows ?? [];
  const isEmpty = groups ? groups.every(g => g.rows.length === 0) : flat.length === 0;

  const renderRow = (row: Row, index: number) => (
    <tr key={getRowKey(row)}>
      {columns.map(col => {
        const label = col.label ?? (typeof col.header === 'string' ? col.header : col.key);
        const content = col.cell(row, index);
        return col.rowHeader ? (
          <th key={col.key} scope="row" className={cx(styles.cell, col.numeric && styles.num)}>{content}</th>
        ) : (
          <td key={col.key} className={cx(styles.cell, col.numeric && styles.num)} data-label={stackOnPhone ? label : undefined}>
            {/* One box for the value, so a stacked row is label + value however many inline parts the cell has. */}
            <span className={styles.value}>{content}</span>
          </td>
        );
      })}
    </tr>
  );

  return (
    <div className={cx(styles.region, className)} role="region" aria-label={caption} tabIndex={0}>
      <table className={cx(styles.table, wide && styles.wide, stackOnPhone && styles.stack)}>
        <caption className={showCaption ? styles.caption : styles.hidden}>{caption}</caption>
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key} scope="col" className={cx(styles.head, col.numeric && styles.num)}>{col.header}</th>
            ))}
          </tr>
        </thead>
        {isEmpty ? (
          <tbody>
            <tr>
              <td className={styles.empty} colSpan={columns.length}>{empty ?? 'No rows.'}</td>
            </tr>
          </tbody>
        ) : groups ? (
          groups.map(group => (
            <tbody key={group.label}>
              <tr className={styles.group}>
                <th scope="colgroup" colSpan={columns.length}>{group.label}</th>
              </tr>
              {group.rows.map(renderRow)}
            </tbody>
          ))
        ) : (
          <tbody>{flat.map(renderRow)}</tbody>
        )}
      </table>
    </div>
  );
}
