import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { MetaList } from './MetaList';
import type { MetaItem } from './MetaList';
import styles from './PageHead.module.css';

export interface PageHeadProps {
  title: string;
  eyebrow?: string;
  /** One or two plain sentences under the title. */
  lede?: ReactNode;
  /** Run facts under the lede, displayed as given. */
  meta?: MetaItem[];
  /** Right-aligned controls, such as an evidence-level switch. */
  actions?: ReactNode;
  /** Renders above the eyebrow, usually a Breadcrumb. */
  before?: ReactNode;
  className?: string;
}

/** The page heading: the one h1, with eyebrow, lede, meta and page-level actions. */
export function PageHead({ title, eyebrow, lede, meta, actions, before, className }: PageHeadProps) {
  return (
    <header className={cx(styles.head, className)}>
      {before}
      <div className={styles.row}>
        <div className={styles.text}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <h1 className={styles.title}>{title}</h1>
          {lede && <p className={styles.lede}>{lede}</p>}
          {meta && meta.length > 0 && <MetaList items={meta} />}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </header>
  );
}
