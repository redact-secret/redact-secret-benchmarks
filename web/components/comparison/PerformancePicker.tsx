import { cx } from '../../lib/cx';
import { SegmentedNav } from '../nav';
import { TimingKey } from './TimingTrack';
import type { PairSide, PickerControl } from './performance-types';
import styles from './PerformancePicker.module.css';

export interface PerformancePickerProps {
  /** One row per thing the reader chooses ("Compare with", "redact-secret setting"). Links: the choice lives in the URL. */
  controls: PickerControl[];
  /** What each square on the tracks stands for. */
  legend: { side: PairSide; label: string }[];
  legendNote?: string;
  className?: string;
}

/** The bar pinned under the site header while the tracks are on screen: pick the pair, read the key. Links, so a pair is shareable and works without script. */
export function PerformancePicker({ controls, legend, legendNote, className }: PerformancePickerProps) {
  return (
    <div className={cx(styles.bar, className)}>
      {controls.map(control => (
        <div key={control.label} className={styles.row}>
          <span className={styles.label}>{control.label}</span>
          <SegmentedNav items={control.items} currentHref={control.currentHref} label={control.label} className={styles.seg} />
        </div>
      ))}
      <TimingKey items={legend} note={legendNote} />
    </div>
  );
}
