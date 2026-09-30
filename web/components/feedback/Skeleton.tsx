import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** What is loading, read by assistive technology: "Loading the fixture". */
  label: string;
  /** The shapes: `SkeletonBlock`s sized like the content that will replace them. */
  children: ReactNode;
  className?: string;
}

/**
 * A stand-in for content that has not arrived: the shapes hold the space the content will take, so
 * nothing moves when it lands. The label is the only thing assistive technology reads; the shapes
 * are decoration. Motion is a slow fade and stops under `prefers-reduced-motion`.
 */
export function Skeleton({ label, children, className }: SkeletonProps) {
  return (
    <div className={cx(styles.skeleton, className)} role="status" aria-busy="true">
      <span className={styles.label}>{label}</span>
      <div className={styles.shapes} aria-hidden="true">{children}</div>
    </div>
  );
}

export interface SkeletonBlockProps {
  /** `line` is one line of text, `heading` a page title, `panel` a region of a table or figure. */
  shape?: 'line' | 'heading' | 'panel';
  /** Share of the width the content usually takes. */
  width?: 'full' | 'wide' | 'half' | 'narrow';
}

export function SkeletonBlock({ shape = 'line', width = 'full' }: SkeletonBlockProps) {
  return <span className={cx(styles.block, styles[shape], styles[width])} />;
}
