import Link from 'next/link';
import { cx } from '../../lib/cx';
import styles from './Breadcrumb.module.css';

export interface Crumb {
  label: string;
  /** Omit on the current page. */
  href?: string;
}

export interface BreadcrumbProps {
  items: Crumb[];
  className?: string;
}

/** The way back up: "Comparison / Feature". The last item is the current page. */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav className={cx(styles.crumb, className)} aria-label="Breadcrumb">
      <ol className={styles.list}>
        {items.map((item, i) => {
          const current = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`}>
              {item.href && !current ? <Link href={item.href}>{item.label}</Link> : <span aria-current={current ? 'page' : undefined}>{item.label}</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
