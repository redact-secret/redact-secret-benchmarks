import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Note.module.css';

export interface NoteProps {
  children: ReactNode;
  /** Short heading in the eyebrow style, e.g. "Read this before the numbers". */
  title?: string;
  tone?: 'neutral' | 'info' | 'warning' | 'danger' | 'success';
  className?: string;
}

/** A callout: a rule on the left in the tone colour, the words carry the meaning. */
export function Note({ children, title, tone = 'neutral', className }: NoteProps) {
  return (
    <div className={cx(styles.note, styles[tone], className)} role="note">
      {title && <p className={styles.title}>{title}</p>}
      <div className={styles.body}>{children}</div>
    </div>
  );
}
