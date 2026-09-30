import Link from 'next/link';
import { cx } from '../../lib/cx';
import styles from './SegmentedNav.module.css';

export interface SegmentedNavItem {
  label: string;
  /** Shown instead of `label` on a phone. */
  shortLabel?: string;
  href: string;
}

export interface SegmentedNavProps {
  items: SegmentedNavItem[];
  /** The `href` of the current segment. */
  currentHref: string;
  /** Names the switch, e.g. "Evidence level". */
  label: string;
  className?: string;
}

/**
 * A switch made of links, so every segment is a tab stop and a bookmark, and it
 * works without script (the state is the URL). Use it for evidence level or
 * domain. For in-page state with no URL, use SegmentedControl.
 */
export function SegmentedNav({ items, currentHref, label, className }: SegmentedNavProps) {
  return (
    <nav className={cx(styles.seg, className)} aria-label={label}>
      {items.map(item => (
        <Link key={item.href} href={item.href} aria-current={item.href === currentHref ? 'page' : undefined} aria-label={item.shortLabel ? item.label : undefined}>
          {item.shortLabel ? (
            <>
              <span className={styles.wide}>{item.label}</span>
              <span className={styles.narrow} aria-hidden="true">{item.shortLabel}</span>
            </>
          ) : (
            item.label
          )}
        </Link>
      ))}
    </nav>
  );
}
