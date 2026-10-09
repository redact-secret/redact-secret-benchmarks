import { cx } from '../../lib/cx';
import { SegmentedNav } from '../nav';
import { TimingKey } from './TimingTrack';
import type { PairSide, PickerControl } from './performance-types';
import styles from './PerformancePicker.module.css';

export interface PerformancePickerProps {
  /** One dropdown per choice. The consumer records the selected href in the URL. */
  controls: PickerControl[];
  onSelect?: (href: string) => void;
  /** What each square on the tracks stands for. */
  legend: { side: PairSide; label: string }[];
  legendNote?: string;
  className?: string;
}

/** Pick the pair and read the track key. Links remain available without script. */
export function PerformancePicker({ controls, legend, legendNote, className, onSelect }: PerformancePickerProps) {
  return (
    <div className={cx(styles.bar, className)}>
      {controls.map(control => (
        <label key={control.label} className={styles.row}>
          <span className={styles.label}>{control.label}</span>
          <select className={styles.select} {...(onSelect ? { value: control.currentHref } : { defaultValue: control.currentHref })} onChange={event => onSelect?.(event.target.value)}>
            {control.items.map(item => <option key={item.href} value={item.href}>{item.label}</option>)}
          </select>
        </label>
      ))}
      <noscript>{controls.map(control => <SegmentedNav key={control.label} items={control.items} currentHref={control.currentHref} label={control.label} />)}</noscript>
      <TimingKey items={legend} note={legendNote} />
    </div>
  );
}
'use client';

