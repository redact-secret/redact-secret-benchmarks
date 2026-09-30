import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { CodeBlock } from '../text/Code';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  children?: ReactNode;
  /** A command that produces the missing data, shown as a block. */
  command?: string;
  /** Where to go next, usually a link. */
  action?: ReactNode;
  className?: string;
}

/**
 * "Not measured yet" and "no rows match": a dashed box, so it can never be read
 * as a zero or a result. Say what is missing and how it gets here.
 */
export function EmptyState({ title, children, command, action, className }: EmptyStateProps) {
  return (
    <div className={cx(styles.empty, className)}>
      <p className={styles.title}>{title}</p>
      {children && <div className={styles.body}>{children}</div>}
      {command && <CodeBlock label={`Command: ${title}`}>{command}</CodeBlock>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
