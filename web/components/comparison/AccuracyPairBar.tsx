import { cx } from '../../lib/cx';
import { SegmentedNav } from '../nav';
import type { AccuracyBarRow } from './accuracyTypes';
import styles from './AccuracyPairBar.module.css';

export interface AccuracyPairBarProps {
  rows: AccuracyBarRow[];
  className?: string;
}

/**
 * The pair picker: which data, which tool, which evidence level, which test files. Every
 * option is a link (`?data=&with=&level=&scope=`), so the pair is shareable, back and forward
 * work and it runs without script. Pinned under the site header while the questions scroll.
 */
export function AccuracyPairBar({ rows, className }: AccuracyPairBarProps) {
  return (
    <div className={cx(styles.bar, className)}>
      {rows.map(row => (
        <div key={row.label} className={styles.row}>
          <span className={styles.label} title={row.hint}>
            {row.label}
            {row.sub && <small>{row.sub}</small>}
          </span>
          <SegmentedNav label={row.label} items={row.items} currentHref={row.currentHref} />
        </div>
      ))}
    </div>
  );
}
