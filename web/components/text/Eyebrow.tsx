import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Eyebrow.module.css';

export interface EyebrowProps {
  children: ReactNode;
  /** Ink (default) names the page or block; muted is a quiet label above a figure. */
  tone?: 'ink' | 'muted';
  className?: string;
}

/** Small uppercase label above a heading or figure. */
export function Eyebrow({ children, tone = 'ink', className }: EyebrowProps) {
  return <p className={cx(styles.eyebrow, tone === 'muted' && styles.muted, className)}>{children}</p>;
}
