import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import styles from './OutcomeStrip.module.css';

export interface OutcomeSegment {
  /** `fill` solid ink, `wide` muted ink, `hatch` diagonal, `outline` dashed box. Shape is the cue, never colour. */
  kind: 'fill' | 'wide' | 'hatch' | 'outline';
  /** Relative size of the segment. Any positive numbers; they are normalised across the strip. */
  weight: number;
}

export interface OutcomeStripProps {
  segments: OutcomeSegment[];
  /** Text alternative giving the counts in words. Required. */
  label: string;
  className?: string;
}

/** A proportional strip of outcome kinds. Zero-weight segments are dropped. */
export function OutcomeStrip({ segments, label, className }: OutcomeStripProps) {
  const shown = segments.filter(s => s.weight > 0);
  return (
    <div className={cx(styles.strip, className)} role="img" aria-label={label}>
      {shown.map((s, i) => (
        <i key={i} className={cx(styles.seg, styles[s.kind])} style={{ '--weight': s.weight } as CSSProperties} />
      ))}
    </div>
  );
}
