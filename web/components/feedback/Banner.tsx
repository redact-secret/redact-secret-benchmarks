import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Banner.module.css';

export interface BannerProps {
  children: ReactNode;
  tone?: 'warning' | 'info';
  /** Names the banner for assistive tech, e.g. "Site environment". */
  label: string;
  className?: string;
}

/** A full-width strip above the header, for staging and local builds. Production renders none. */
export function Banner({ children, tone = 'warning', label, className }: BannerProps) {
  return (
    <div className={cx(styles.banner, tone === 'info' && styles.info, className)} role="note" aria-label={label}>
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
