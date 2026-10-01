import { cx } from '../../../lib/cx';
import styles from './RcStampLine.module.css';
import type { RcStamp } from './types';

export interface RcStampLineProps {
  stamp: RcStamp;
  className?: string;
}

/** The line above a figure that names its corpus section, the published side and the candidate side, each with its run. */
export function RcStampLine({ stamp, className }: RcStampLineProps) {
  return (
    <p className={cx(styles.stamp, className)}>
      <b>{stamp.scope}</b> · <span className={styles.side}>{stamp.from}</span> → <span className={styles.side}>{stamp.to}</span>
    </p>
  );
}
