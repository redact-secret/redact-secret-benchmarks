import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Note } from './Note';
import styles from './RetryNote.module.css';

export interface RetryNoteProps {
  /** What failed, in a few words: "Could not load the rows". */
  title: string;
  /** Why, and what still works: "You are offline. The first page is shown; search needs the rest." */
  children: ReactNode;
  /** Asks again. The parent owns the request; this only calls it. */
  onRetry: () => void;
  retryLabel?: string;
  className?: string;
}

/**
 * A failed load that can be tried again. Announced to assistive technology when it appears
 * (`role="alert"`), says what still works, and puts one button at the end of the sentence.
 */
export function RetryNote({ title, children, onRetry, retryLabel = 'Try again', className }: RetryNoteProps) {
  return (
    <div role="alert" className={cx(styles.retry, className)}>
      <Note tone="danger" title={title}>
        <p>{children}</p>
        <p><button type="button" className={styles.button} onClick={onRetry}>{retryLabel}</button></p>
      </Note>
    </div>
  );
}
