import type { CSSProperties } from 'react';
import { cx } from '../../lib/cx';
import type { PairSide, TrackMark, TrackTick } from './performance-types';
import styles from './TimingTrack.module.css';

const pct = (n: number) => `${Math.min(1, Math.max(0, n)) * 100}%`;

export interface TimingTrackProps {
  /** One per decade of the shared axis. Every track of a page gets the same ticks, so a position means the same thing everywhere. */
  ticks: TrackTick[];
  marks: TrackMark[];
  /** Full sentence for assistive tech: each side's time. The graphic alone says nothing. */
  ariaLabel: string;
  /** Draw the tick labels above the track (once per group; the rows below share them). */
  axis?: boolean;
  className?: string;
}

/**
 * Timed calls on one shared log axis. A filled square is side `a`, a hollow square side `b`,
 * each at its median, with a thin line behind it from the shortest to the longest timed call.
 * When both overlap, `a` draws on top and the hollow one stays visible around it. Positions are
 * fractions the caller computed from the ledger; nothing is derived here, nothing is ordered.
 */
export function TimingTrack({ ticks, marks, ariaLabel, axis = false, className }: TimingTrackProps) {
  const at = (n: number) => ({ '--at': pct(n) }) as CSSProperties;
  const ordered = [...marks.filter(m => m.side === 'b'), ...marks.filter(m => m.side === 'a')];
  return (
    <div className={cx(styles.wrap, className)}>
      {axis && (
        <div className={styles.axis} aria-hidden="true">
          {ticks.map(t => <span key={t.label} style={at(t.position)}>{t.label}</span>)}
        </div>
      )}
      <div className={styles.track} {...(ariaLabel ? { role: 'img', 'aria-label': ariaLabel } : { 'aria-hidden': true })}>
        {ticks.map(t => <i key={t.label} className={styles.tick} style={at(t.position)} />)}
        {ordered.map((m, i) => (
          <span key={`${m.side}-${i}`}>
            {m.range && <i className={styles.range} style={{ '--from': pct(m.range[0]), '--span': pct(Math.max(0, m.range[1] - m.range[0])) } as CSSProperties} />}
            <i className={cx(styles.dot, m.side === 'a' ? styles.a : styles.b)} style={at(m.position)} title={m.label} />
          </span>
        ))}
      </div>
    </div>
  );
}

export interface TimingKeyProps {
  items: { side: PairSide; label: string }[];
  /** "Thin line: shortest to longest timed call". */
  note?: string;
  className?: string;
}

/** The key to the two squares, as a list, so it reads in order without the graphic. */
export function TimingKey({ items, note, className }: TimingKeyProps) {
  return (
    <ul className={cx(styles.key, className)} aria-label="Key to the marks">
      {items.map(item => (
        <li key={item.side}>
          <i className={cx(styles.glyph, item.side === 'a' ? styles.a : styles.b)} aria-hidden="true" />
          {item.label}
        </li>
      ))}
      {note && <li>{note}</li>}
    </ul>
  );
}
