import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './NavTile.module.css';

export interface NavTileProps {
  href: string;
  /** Names the destination: "Providers". */
  label: string;
  /** The count the destination holds, as text. Read from the ledger, not derived here. */
  figure: string;
  /** Plain words for the figure, read by screen readers after it: "providers". */
  figureUnit: string;
  description?: ReactNode;
  /** The link words: "By provider →". */
  action: string;
  className?: string;
}

/** A hub tile: a count and where it leads. The whole tile is one link. Never a result. */
export function NavTile({ href, label, figure, figureUnit, description, action, className }: NavTileProps) {
  return (
    <Link className={cx(styles.tile, className)} href={href}>
      <span className={styles.label}>{label}</span>
      <span className={styles.figure}>
        <b>{figure}</b>
        <span className={styles.unit}> {figureUnit}</span>
      </span>
      <span className={styles.description}>{description}</span>
      <span className={styles.action}>{action}</span>
    </Link>
  );
}
