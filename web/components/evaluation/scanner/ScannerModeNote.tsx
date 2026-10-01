import { Note, StatusBadge } from '../../feedback';
import { cx } from '../../../lib/cx';
import styles from './ScannerModeNote.module.css';
import type { ScannerModeNoteData } from './types';

export interface ScannerModeNoteProps extends ScannerModeNoteData {
  className?: string;
}

/** Published and candidate, in two sentences, with the mode of the run the page describes. A stable count always names one of the two. */
export function ScannerModeNote({ title, mode, modeLabel, paragraphs, className }: ScannerModeNoteProps) {
  return (
    <Note title={title} tone="info" className={cx(styles.note, className)}>
      <p>
        {mode ? <StatusBadge status="info">{mode === 'published' ? 'Published' : 'Candidate'}</StatusBadge> : <StatusBadge status="not-measured">No run</StatusBadge>}
        {' '}{modeLabel}
      </p>
      {paragraphs.map(text => <p key={text}>{text}</p>)}
    </Note>
  );
}
