import Link from 'next/link';
import { cx } from '../../lib/cx';
import styles from './Pager.module.css';

export interface PagerProps {
  /** 1-based current page. */
  page: number;
  pageCount: number;
  /** Total items across all pages, when known. */
  total?: number;
  pageSize?: number;
  /** Plural noun for the count text. */
  itemLabel?: string;
  /** Link mode (works without script, state in the URL): hrefs for the neighbours. */
  previousHref?: string;
  nextHref?: string;
  /** Button mode: callbacks. Ignored when the matching href is given. */
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

const fmt = (n: number) => n.toLocaleString('en-US');

/** Previous / next with a plain position line. Stateless: the parent decides what a page is. */
export function Pager({ page, pageCount, total, pageSize, itemLabel = 'rows', previousHref, nextHref, onPrevious, onNext, className }: PagerProps) {
  const hasPrevious = page > 1;
  const hasNext = page < pageCount;
  const range = total !== undefined && pageSize !== undefined && total > 0
    ? ` · ${fmt((page - 1) * pageSize + 1)}–${fmt(Math.min(total, page * pageSize))} of ${fmt(total)} ${itemLabel}`
    : total !== undefined ? ` · ${fmt(total)} ${itemLabel}` : '';

  const turn = (dir: 'Previous' | 'Next', enabled: boolean, href: string | undefined, onClick: (() => void) | undefined) => {
    if (!enabled) return <span className={cx(styles.button, styles.disabled)} aria-disabled="true">{dir}</span>;
    if (href) return <Link className={styles.button} href={href} rel={dir === 'Previous' ? 'prev' : 'next'}>{dir}</Link>;
    return <button type="button" className={styles.button} onClick={onClick}>{dir}</button>;
  };

  return (
    <nav className={cx(styles.pager, className)} aria-label="Pagination">
      <span className={styles.turn}>
        {turn('Previous', hasPrevious, previousHref, onPrevious)}
        {turn('Next', hasNext, nextHref, onNext)}
      </span>
      <span aria-live="polite">Page {fmt(page)} of {fmt(Math.max(1, pageCount))}{range}</span>
    </nav>
  );
}
