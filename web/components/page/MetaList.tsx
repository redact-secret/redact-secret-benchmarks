import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './MetaList.module.css';

export interface MetaItem {
  /** Plain word before the value, such as "Run" or "Accounting". */
  label?: string;
  /** The recorded value, or a link. Displayed as given. */
  value: ReactNode;
}

export interface MetaListProps {
  items: MetaItem[];
  className?: string;
}

/** One line of run facts: "Run 2026-09-30 · Accounting v1.1". Wraps on a phone. */
export function MetaList({ items, className }: MetaListProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cx(styles.meta, className)}>
      {items.map((item, i) => (
        <li key={i}>
          {item.label && <>{item.label} </>}
          <b>{item.value}</b>
        </li>
      ))}
    </ul>
  );
}
