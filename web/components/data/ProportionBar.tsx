import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import styles from './ProportionBar.module.css';

export interface ProportionBarProps {
  /** Filled part, in the same unit as `max`. */
  value: number;
  max: number;
  /** A second reference mark on the same scale, e.g. an earlier run. */
  marker?: number;
  /** Text alternative: "58 of 361 spans". Required; the bar alone says nothing. */
  label: string;
  /** `thin` is the small bar used in dense rows and queues. */
  size?: 'default' | 'thin';
  className?: string;
}

/** A single ink bar on a hairline track. Geometry passes through CSS custom properties. */
export function ProportionBar({ value, max, marker, label, size = 'default', className }: ProportionBarProps) {
  const share = (n: number) => `${max > 0 ? Math.min(1, Math.max(0, n / max)) * 100 : 0}%`;
  const style = { '--fill': share(value), '--marker': marker === undefined ? '0%' : share(marker) } as CSSProperties;
  return (
    <div className={cx(styles.bar, size === 'thin' && styles.thin, className)} role="img" aria-label={label} style={style}>
      <i className={styles.fill} />
      {marker !== undefined && <u className={styles.marker} />}
    </div>
  );
}
