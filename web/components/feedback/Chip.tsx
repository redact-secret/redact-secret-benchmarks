import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Chip.module.css';

export interface ChipProps {
  children: ReactNode;
  /** `on` and `void` use success and danger tokens for a recorded presence or absence. */
  tone?: 'neutral' | 'on' | 'void';
  /** Dashed border: nothing to bind. */
  dashed?: boolean;
  /** Render the label in monospace (ids, versions, prefixes). */
  mono?: boolean;
  href?: string;
  className?: string;
}

/** A small labelled token: a detector id, a tool name, a "tested" mark. Not a status. */
export function Chip({ children, tone = 'neutral', dashed = false, mono = true, href, className }: ChipProps) {
  const classes = cx(styles.chip, tone === 'on' && styles.on, tone === 'void' && styles.void, dashed && styles.dashed, !mono && styles.sans, className);
  return href ? <Link className={cx(classes, styles.link)} href={href}>{children}</Link> : <span className={classes}>{children}</span>;
}

export interface ChipListProps {
  items: ReactNode[];
  /** Names the list for assistive tech, e.g. "Tools compared". */
  label: string;
  className?: string;
}

/** A wrapping row of chips, as a real list. */
export function ChipList({ items, label, className }: ChipListProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cx(styles.list, className)} aria-label={label}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
