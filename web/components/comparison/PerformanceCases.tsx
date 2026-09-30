import { cx } from '../../lib/cx';
import { StatusBadge } from '../feedback';
import { TimingTrack } from './TimingTrack';
import type { PerformanceCase, PerformanceCell, PerformanceGroup, TrackTick } from './performance-types';
import styles from './PerformanceCases.module.css';

export interface PerformanceCasesProps {
  group: PerformanceGroup;
  /** The names of side `a` and side `b`, in that order, as the column heads. */
  sides: [string, string];
  /** The shared axis: the same ticks for every group of the page. */
  ticks: TrackTick[];
  className?: string;
}

function Cell({ cell, name }: { cell: PerformanceCell; name: string }) {
  return (
    <div className={styles.cell}>
      <span className={styles.lbl}>{name}</span>
      {cell.state === 'timed' ? (
        <>
          <b className={styles.time}>{cell.time}</b>
          <span>{cell.speed}</span>
          <span>{cell.spread}</span>
          <span className={styles.did}>{cell.did}</span>
        </>
      ) : (
        <>
          <StatusBadge status="not-measured">Not measured</StatusBadge>
          <span>{cell.reason}</span>
        </>
      )}
    </div>
  );
}

const said = (cell: PerformanceCell, name: string) => `${name}: ${cell.state === 'timed' ? cell.time : 'not measured'}`;

function Row({ row, sides, ticks }: { row: PerformanceCase; sides: [string, string]; ticks: TrackTick[] }) {
  return (
    <li className={styles.row}>
      <div className={styles.text}>
        <span className={styles.label}>{row.label}</span>
        <span className={styles.note}>{row.note}</span>
        <code className={styles.detail}>{row.detail}</code>
      </div>
      <Cell cell={row.a} name={sides[0]} />
      <Cell cell={row.b} name={sides[1]} />
      <div className={styles.track}>
        <TimingTrack ticks={ticks} marks={row.marks} ariaLabel={`${row.label} ${said(row.a, sides[0])}; ${said(row.b, sides[1])}.`} />
        {row.near && <p className={styles.near}>{row.near}</p>}
      </div>
    </li>
  );
}

/**
 * One group of texts: what each side did and how long it took, then both times on one shared axis.
 * Rows keep the order the plan gives them; nothing is sorted by time and no row is dropped.
 */
export function PerformanceCases({ group, sides, ticks, className }: PerformanceCasesProps) {
  return (
    <section className={cx(styles.group, className)} aria-labelledby={`${group.id}-h`}>
      <header className={styles.head}>
        <p className={styles.position}>{group.position}</p>
        <h3 id={`${group.id}-h`} className={styles.title}>{group.title}</h3>
        <p className={styles.description}>{group.description}</p>
      </header>
      <div className={styles.cases}>
        <div className={styles.cols} aria-hidden="true">
          <span>Text</span>
          <span>{sides[0]}</span>
          <span>{sides[1]}</span>
          <TimingTrack ticks={ticks} marks={[]} ariaLabel="" axis className={styles.axisOnly} />
        </div>
        <ol className={styles.list}>
          {group.cases.map(row => <Row key={row.id} row={row} sides={sides} ticks={ticks} />)}
        </ol>
      </div>
    </section>
  );
}
