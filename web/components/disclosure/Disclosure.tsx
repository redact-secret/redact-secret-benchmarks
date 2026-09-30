import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Disclosure.module.css';

export interface DisclosureProps {
  /** The always-visible row. Put the name and the summary figures here. */
  summary: ReactNode;
  /** Revealed content: rows, tables, notes. */
  children: ReactNode;
  /** `plain` is a quiet inline toggle; `row` is a ruled list row; `nested` is a row inside another, marked by a left rule. */
  variant?: 'plain' | 'row' | 'nested';
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Expand and collapse with the native <details> element, so keyboard, screen
 * reader and find-in-page behaviour need no script and no state. The
 * summary is a grid: pass a Grid-like fragment for columns.
 */
export function Disclosure({ summary, children, variant = 'row', defaultOpen = false, className }: DisclosureProps) {
  return (
    <details className={cx(styles.details, styles[variant], className)} open={defaultOpen}>
      <summary className={styles.summary}>{summary}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  );
}
