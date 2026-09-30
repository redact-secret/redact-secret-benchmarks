import { cx } from '../../lib/cx';
import { StatusBadge } from '../feedback';
import { TimingTrack } from './TimingTrack';
import type { PerformanceOverviewRow, TrackTick } from './performance-types';
import styles from './PerformanceOverview.module.css';

export interface PerformanceOverviewProps {
  title: string;
  /** "Each mark is one text. The more a row spreads, the more that library's time depends on the text." */
  note: string;
  ticks: TrackTick[];
  /** Exactly two rows, one per side, drawn alike. */
  rows: [PerformanceOverviewRow, PerformanceOverviewRow];
  className?: string;
}

/** Every text on one shared axis, one row per side. The spread is what it shows; there is no headline time, average or total. */
export function PerformanceOverview({ title, note, ticks, rows, className }: PerformanceOverviewProps) {
  return (
    <section className={cx(styles.overview, className)} aria-labelledby="perf-overview-h">
      <h2 id="perf-overview-h" className={styles.title}>{title}</h2>
      <p className={styles.note}>{note}</p>
      <div className={styles.rows}>
        <div className={styles.row}>
          <span />
          <TimingTrack ticks={ticks} marks={[]} ariaLabel="" axis />
        </div>
        {rows.map(row => (
          <div key={row.side} className={styles.row}>
            <div className={styles.name}>
              <span>{row.name}</span>
              {row.span ? <small>{row.span}</small> : <StatusBadge status="not-measured">Not measured</StatusBadge>}
            </div>
            <TimingTrack ticks={ticks} marks={row.marks} ariaLabel={`${row.name}: ${row.span || 'not measured'}.`} />
          </div>
        ))}
      </div>
    </section>
  );
}
