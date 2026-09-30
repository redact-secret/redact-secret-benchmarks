import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './StatusBadge.module.css';

/**
 * A recorded state, never a verdict this site makes. Colour is never the only
 * cue: the word is always shown, and each status has its own border or fill shape
 * (`unstable` is hatched, `not-measured` is dashed, `none` is a plain rule).
 */
export type Status = 'pass' | 'fail' | 'unstable' | 'review' | 'withheld' | 'info' | 'not-measured' | 'none';

export interface StatusBadgeProps {
  status: Status;
  /** The word shown. Say what the ledger says ("Verified", "Few samples"). */
  children: ReactNode;
  className?: string;
}

/** Status word with a token colour and a shape cue. */
export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  return (
    <span className={cx(styles.badge, styles[status], className)} data-status={status}>
      {children}
    </span>
  );
}
