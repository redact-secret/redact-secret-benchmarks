import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Stack.module.css';

type Gap = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface StackProps {
  children: ReactNode;
  gap?: Gap;
  as?: 'div' | 'ul' | 'ol' | 'section';
  className?: string;
}

/** Vertical rhythm: children separated by one token gap. */
export function Stack({ children, gap = 'md', as: Tag = 'div', className }: StackProps) {
  return <Tag className={cx(styles.stack, styles[gap], className)}>{children}</Tag>;
}

export interface ClusterProps {
  children: ReactNode;
  gap?: Gap;
  align?: 'start' | 'center' | 'baseline' | 'end';
  justify?: 'start' | 'between' | 'end';
  as?: 'div' | 'ul' | 'ol' | 'span';
  className?: string;
}

/** Horizontal, wrapping row: chips, meta items, actions. */
export function Cluster({ children, gap = 'sm', align = 'center', justify = 'start', as: Tag = 'div', className }: ClusterProps) {
  return (
    <Tag className={cx(styles.cluster, styles[gap], styles[`align-${align}`], styles[`justify-${justify}`], className)}>
      {children}
    </Tag>
  );
}
