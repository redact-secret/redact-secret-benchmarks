import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './StatusBar.module.css';

export interface StatusBarItem {
  label: string;
  /** The recorded value. Displayed as given. */
  value: ReactNode;
  /** `danger` puts a danger rule over the cell; `not-measured` draws it dashed. */
  tone?: 'neutral' | 'danger' | 'warning' | 'success' | 'not-measured';
  href?: string;
}

export interface StatusBarProps {
  items: StatusBarItem[];
  /** Names the bar, e.g. "Ledger health". */
  label: string;
  className?: string;
}

/** A single row of labelled health cells (ledger health, gate results). Each cell can link to its detail. */
export function StatusBar({ items, label, className }: StatusBarProps) {
  return (
    <ul className={cx(styles.bar, className)} aria-label={label}>
      {items.map(item => {
        const tone = item.tone ?? 'neutral';
        const body = (
          <>
            <b className={styles.label}>{item.label}</b>
            <span className={styles.value}>{item.value}</span>
          </>
        );
        return (
          <li key={item.label} className={cx(styles.cell, styles[tone])}>
            {item.href ? <Link className={styles.inner} href={item.href}>{body}</Link> : <div className={styles.inner}>{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}
