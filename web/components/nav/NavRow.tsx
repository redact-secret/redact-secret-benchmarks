import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './NavRow.module.css';

export interface NavRowProps {
  /** The page the row opens. Omit it for a page that is not in this build yet: the row is then plain text, dashed, with `action` as its state. */
  href?: string;
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
  /** The link words: "Runtime comparison →", or the state ("Not in this build yet") when there is no `href`. */
  action: string;
  className?: string;
}

/** A question row for a hub: the whole row is one link, with one visible link text. */
export function NavRow({ href, label, title, description, tools, fact, factNote, action, className }: NavRowProps) {
  const content = (
    <>
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
        <span className={href ? styles.go : styles.state}>{action}</span>
      </span>
    </>
  );
  return href ? (
    <Link className={cx(styles.row, className)} href={href}>{content}</Link>
  ) : (
    <div className={cx(styles.row, styles.pending, className)}>{content}</div>
  );
}
