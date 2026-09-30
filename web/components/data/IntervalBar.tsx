import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import styles from './IntervalBar.module.css';

export interface IntervalBarProps {
  /** Full sentence for assistive tech: the observed value, the bound and the axis. Required; the graphic alone says nothing. */
  ariaLabel: string;
  /** Observed value as a fraction of the axis, 0 to 1. Marked with a triangle. */
  observed: number;
  /** Published bound as a fraction of the axis, 0 to 1. Marked with a tick. */
  bound: number;
  /** The interval drawn between two fractions of the axis. */
  range?: [number, number];
  axisMin: string;
  axisMax: string;
  className?: string;
}

const pct = (n: number) => `${Math.min(1, Math.max(0, n)) * 100}%`;

/**
 * An observed value inside its published bound. No circles: a triangle marks the
 * observation and a tick marks the bound. Geometry passes through CSS custom
 * properties, never raw lengths. Positions are fractions the caller computed from
 * the ledger; nothing is derived here.
 */
export function IntervalBar({ ariaLabel, observed, bound, range, axisMin, axisMax, className }: IntervalBarProps) {
  const [from, to] = range ?? [Math.min(observed, bound), Math.max(observed, bound)];
  const style = { '--observed': pct(observed), '--bound': pct(bound), '--from': pct(from), '--span': pct(Math.max(0, to - from)) } as CSSProperties;
  return (
    <div className={cx(styles.wrap, className)}>
      <div className={styles.iv} role="img" aria-label={ariaLabel} style={style}>
        <div className={styles.axis} />
        <div className={styles.range} />
        <div className={styles.tick} />
        <div className={styles.tri} />
      </div>
      <div className={styles.scale} aria-hidden="true">
        <span>{axisMin}</span>
        <span>{axisMax}</span>
      </div>
    </div>
  );
}
