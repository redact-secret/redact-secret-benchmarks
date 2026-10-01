import Link from 'next/link';
import { StatusBadge } from '../feedback';
import { cx } from '../../lib/cx';
import { FixtureFileView } from './FixtureFileView';
import { FixtureKey } from './FixtureKey';
import styles from './FixtureTwins.module.css';
import type { FixtureTwinData } from './fixtureTypes';

export interface FixtureTwinsProps {
  items: FixtureTwinData[];
  className?: string;
}

/**
 * The related file or files that differ from this one by authored mutation: the twin's changed lines with
 * the changed bytes boxed, what the corpus says was changed, what the product recorded on the twin, and
 * the way to open it. A fixture with several twins lists each; a twin lists the original it came from.
 */
export function FixtureTwins({ items, className }: FixtureTwinsProps) {
  return (
    <div className={cx(styles.twins, className)}>
      {items.map(item => (
        <article key={item.id} className={styles.twin}>
          <FixtureFileView file={item.file} />
          <FixtureKey items={[{ mark: 'changed', label: 'The changed bytes' }]} />
          <div className={styles.row}>
            <div className={styles.text}>
              <h3 className={styles.title}>{item.title}</h3>
              <p className={styles.description}>{item.description}</p>
            </div>
            <div className={styles.side}>
              <span className={styles.badges}>{item.outcome.map((o, i) => <StatusBadge key={i} status={o.status}>{o.label}</StatusBadge>)}</span>
              <span>{item.outcomeNote}</span>
              <Link href={item.href}>{item.linkLabel}</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
