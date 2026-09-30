import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './ListRow.module.css';

export interface RowListProps {
  children: ReactNode;
  /** Names the list for assistive tech. */
  label: string;
  className?: string;
}

/** A ruled list of ListRows: changes, gate results, findings. */
export function RowList({ children, label, className }: RowListProps) {
  return <ul className={cx(styles.list, className)} aria-label={label}>{children}</ul>;
}

export interface ListRowProps {
  /** Left slot, usually a StatusBadge. */
  leading?: ReactNode;
  /** The main line. Put a link and a `<small>` second line here. */
  children: ReactNode;
  /** Right slot: a date or a value. */
  trailing?: ReactNode;
  className?: string;
}

/** One row: leading, main, trailing. On a phone the trailing part drops under the main line. */
export function ListRow({ leading, children, trailing, className }: ListRowProps) {
  return (
    <li className={cx(styles.row, !leading && styles.noLeading, className)}>
      {leading && <span className={styles.leading}>{leading}</span>}
      <span className={styles.main}>{children}</span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
    </li>
  );
}
