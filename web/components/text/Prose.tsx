import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Prose.module.css';

export interface ProseProps {
  children: ReactNode;
  /** `small` is the muted 14px explanatory copy under a heading. */
  size?: 'body' | 'small';
  className?: string;
}

/** A reading column for paragraphs and lists, capped at the measure. */
export function Prose({ children, size = 'body', className }: ProseProps) {
  return <div className={cx(styles.prose, size === 'small' && styles.small, className)}>{children}</div>;
}
