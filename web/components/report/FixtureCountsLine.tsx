import { StatusBadge } from '../feedback';
import { cx } from '../../lib/cx';
import styles from './FixtureCountsLine.module.css';
import type { FixtureCounts } from './types';

export interface FixtureCountsLineProps {
  /** `null` when the corpus has no fixtures: shown as "No fixtures", never as zeros. */
  counts: FixtureCounts | null;
  className?: string;
}

const strong = (value: string) => (value === '0' ? value : <b>{value}</b>);

/** One line of fixture-row counts for a provider or family, or "No fixtures" when nothing is measured. */
export function FixtureCountsLine({ counts, className }: FixtureCountsLineProps) {
  if (!counts) return <span className={cx(styles.line, className)}><StatusBadge status="not-measured">No fixtures</StatusBadge></span>;
  return (
    <span className={cx(styles.line, className)}>
      <span>{strong(counts.leftReadable)} left readable</span>
      <span>{strong(counts.tooMuch)} too much</span>
      <span>{strong(counts.falseAlarms)} false alarms</span>
      {counts.notMeasured && <span>{counts.notMeasured} not measured</span>}
    </span>
  );
}
