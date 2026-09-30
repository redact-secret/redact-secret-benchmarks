import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Grid.module.css';

export interface GridProps {
  children: ReactNode;
  /** Columns at full width. Every grid collapses to one column on a phone. */
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
  /** Hairline rules between cells, for facts and figure rows. */
  divided?: boolean;
  as?: 'div' | 'ul' | 'ol';
  className?: string;
}

/** Responsive equal-width columns. Cells set `min-width: 0` so long content wraps instead of overflowing. */
export function Grid({ children, columns = 2, gap = 'md', divided = false, as: Tag = 'div', className }: GridProps) {
  return (
    <Tag className={cx(styles.grid, styles[`cols${columns}`], styles[gap], divided && styles.divided, className)}>
      {children}
    </Tag>
  );
}
