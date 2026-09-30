import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './StatTile.module.css';

export interface StatTileProps {
  /** The question or name the figure answers. */
  label: string;
  /** The recorded figure, as text ("3.6%", "1,065"). Formatted by the caller, never derived here. */
  value: string;
  /** Small word before the value: "at most", "at least". */
  qualifier?: string;
  /** Makes the value a link to the rows behind it. */
  href?: string;
  /** A visual under the value, usually an IntervalBar. */
  children?: ReactNode;
  /** The observation behind the figure: "26 of 1,065 secret spans leaked". */
  observation?: ReactNode;
  /** A status badge beside the observation. */
  status?: ReactNode;
  /** What the figure means and which direction is better. Explanatory, not a claim. */
  definition?: ReactNode;
  /** `compact` is the smaller figure used inside hub tiles and dense rows. */
  size?: 'default' | 'compact';
  className?: string;
}

/** One figure with its question, visual, observation and definition. Pure render. */
export function StatTile({ label, value, qualifier, href, children, observation, status, definition, size = 'default', className }: StatTileProps) {
  const figure = (
    <>
      {qualifier && <small className={styles.qualifier}>{qualifier} </small>}
      {value}
    </>
  );
  return (
    <div className={cx(styles.tile, size === 'compact' && styles.compact, className)}>
      <p className={styles.label}>{label}</p>
      <p className={styles.value}>{href ? <Link href={href}>{figure}</Link> : figure}</p>
      {children}
      {(observation || status) && (
        <p className={styles.observation}>
          {observation} {status}
        </p>
      )}
      {definition && <p className={styles.definition}>{definition}</p>}
    </div>
  );
}

export interface StatGridProps {
  children: ReactNode;
  className?: string;
}

/** A ruled row of StatTiles with hairline dividers; one column on a phone. */
export function StatGrid({ children, className }: StatGridProps) {
  return <div className={cx(styles.grid, className)}>{children}</div>;
}
