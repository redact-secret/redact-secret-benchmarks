import { cx } from '../../lib/cx';
import { OutcomeStrip } from '../data';
import type { AccuracyResultData } from './accuracyTypes';
import styles from './AccuracyResultRow.module.css';

export interface AccuracyResultRowProps {
  result: AccuracyResultData;
  className?: string;
}

/**
 * One tool against the expected answer: its share (or count), the count under it, and a full-width
 * strip of its own outcomes with each state named. Shapes carry the states (solid, hatched, empty);
 * there is no status colour because nothing here is a verdict.
 */
export function AccuracyResultRow({ result, className }: AccuracyResultRowProps) {
  return (
    <div className={cx(styles.row, className)} role="group" aria-label={result.name}>
      <div className={styles.name}>
        {result.name}
        <small>{result.version}</small>
      </div>
      <div className={styles.value}>
        <b>{result.figure}</b>
        <span>{result.figureNote}</span>
      </div>
      <div className={styles.bar}>
        <OutcomeStrip segments={result.states.map(s => ({ kind: s.shape, weight: s.weight }))} label={result.stripLabel} />
        <ul className={styles.parts}>
          {result.states.map(s => (
            <li key={s.label}>
              <i className={cx(styles.swatch, styles[s.shape])} aria-hidden="true" />
              {s.label} <b>{s.count}</b>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
