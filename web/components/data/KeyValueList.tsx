import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './KeyValueList.module.css';

export interface KeyValueItem {
  term: string;
  /** The recorded value, displayed as given. */
  description: ReactNode;
}

export interface KeyValueListProps {
  items: KeyValueItem[];
  /** `rows` is a label column beside values; `facts` is a ruled row of large figures. */
  variant?: 'rows' | 'facts';
  className?: string;
}

/** A definition list for labelled values. Use `facts` for the headline row of a detail page. */
export function KeyValueList({ items, variant = 'rows', className }: KeyValueListProps) {
  if (items.length === 0) return null;
  return (
    <dl className={cx(styles.list, variant === 'facts' ? styles.facts : styles.rows, className)}>
      {items.map(item => (
        <div key={item.term} className={styles.item}>
          <dt>{item.term}</dt>
          <dd>{item.description}</dd>
        </div>
      ))}
    </dl>
  );
}
