import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './NavRow.module.css';

export interface NavRowProps {
  href: string;
  /** Names the kind of page: "Runtime". */
  label: string;
  /** The question the page answers. */
  title: string;
  description?: ReactNode;
  /** Names of the tools the page covers, in the order the page uses. */
  tools?: string[];
  /** A count of what the page contains, as text: "6 test texts". Never a result. */
  fact?: string;
  factNote?: string;
  /** The link words: "Runtime comparison →". */
  action: string;
  className?: string;
}

/** A question row for a hub: the whole row is one link, with one visible link text. */
export function NavRow({ href, label, title, description, tools, fact, factNote, action, className }: NavRowProps) {
  return (
    <Link className={cx(styles.row, className)} href={href}>
      <span className={styles.main}>
        <span className={styles.label}>{label}</span>
        <span className={styles.title}>{title}</span>
        {description && <span className={styles.description}>{description}</span>}
        {tools && tools.length > 0 && (
          <span className={styles.tools}>
            {tools.map(t => <span key={t}>{t}</span>)}
          </span>
        )}
      </span>
      <span className={styles.side}>
        {fact && (
          <span className={styles.fact}>
            {fact}
            {factNote && <small>{factNote}</small>}
          </span>
        )}
        <span className={styles.go}>{action}</span>
      </span>
    </Link>
  );
}
