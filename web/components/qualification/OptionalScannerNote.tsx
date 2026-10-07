import Link from 'next/link';
import { Note } from '../feedback';
import { cx } from '../../lib/cx';
import styles from './OptionalScannerNote.module.css';
import type { NotMeasuredScanner } from './types';

export interface OptionalScannerNoteProps {
  /** The optional scanners the run did not measure. Empty renders nothing: a run that measured every optional scanner says nothing here. */
  scanners: NotMeasuredScanner[];
  /** `compact` is for a page that carries the note beside its numbers (a report page): the contract sentence, the reason and the pointer, without the archive and scope detail. */
  variant?: 'full' | 'compact';
  className?: string;
}

/**
 * An optional scanner the run did not measure (#763), told in the contract's own sentence ("OpenRedaction default: not measured in this run (optional)"):
 * why it was left out, and where its last measurement is, with that run's identity. It is history, labelled with its run, engine, configuration and date,
 * and is never shown as a count, a zero or a row of the current run, and never combined with another profile or another run. Every field arrives formatted.
 */
export function OptionalScannerNote({ scanners, variant = 'full', className }: OptionalScannerNoteProps) {
  if (scanners.length === 0) return null;
  return (
    <div className={cx(styles.notes, className)} data-optional-scanners="not-measured">
      {scanners.map(n => (
        <div key={n.key} className={styles.item}>
          <Note tone="info" title={n.statement}>
            <p className={styles.p} data-optional-scanner={n.key}>{n.reason}</p>
            <p className={styles.p}>{n.lastMeasurement}</p>
            {variant === 'full' && n.archive && <p className={styles.p}>{n.archive}</p>}
            {variant === 'full' && n.scope && <p className={styles.p}>{n.scope}</p>}
            {n.officialMeasurement && <p className={styles.p}>{n.officialMeasurement}</p>}
          </Note>
          {/* The link sits beside the note, not in its tinted fill: link ink on the info fill misses the contrast the pages hold. */}
          {n.link && <p className={styles.link}><Link href={n.link.href}>{n.link.label}</Link></p>}
        </div>
      ))}
    </div>
  );
}
