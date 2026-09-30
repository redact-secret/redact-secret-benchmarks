import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './PageContainer.module.css';

export interface PageContainerProps {
  children: ReactNode;
  /** `page` is the full content width; `measure` is a reading column. */
  width?: 'page' | 'measure';
  /** Element to render. Use `main` once per page. */
  as?: 'div' | 'main' | 'article';
  className?: string;
}

/** Centers content at the page width with the gutters every page uses. Pure layout. */
export function PageContainer({ children, width = 'page', as: Tag = 'div', className }: PageContainerProps) {
  return <Tag className={cx(styles.container, width === 'measure' && styles.measure, className)}>{children}</Tag>;
}
