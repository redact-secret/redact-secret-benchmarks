import Link from 'next/link';
import { Disclosure } from '../disclosure';
import type { AccuracyDifferenceColumn, AccuracyDifferencesData } from './accuracyTypes';
import styles from './AccuracyDifferences.module.css';

export interface AccuracyDifferencesProps extends AccuracyDifferencesData {
  /** Called when "Show all n providers" is pressed on the column at this index. Controlled: the parent owns what is shown. */
  onShowAll?: (column: number) => void;
  className?: string;
}

function Column({ column, onShowAll }: { column: AccuracyDifferenceColumn; onShowAll?: () => void }) {
  return (
    <section className={styles.column}>
      <h4 className={styles.title}>
        {column.title}
        <span>{column.total}</span>
      </h4>
      {column.groups.length === 0 ? (
        <p className={styles.none}>{column.none}</p>
      ) : column.groups[0].name === '' ? (
        <ul className={styles.flat}>
          {column.groups[0].files.map(f => <li key={f.slug}>{f.href ? <Link href={f.href}>{f.slug}</Link> : f.slug}</li>)}
        </ul>
      ) : (
        column.groups.map(group => (
          <Disclosure
            key={group.name}
            variant="plain"
            className={styles.group}
            summary={<><span className={styles.provider}>{group.name}</span><span className={styles.count}>{group.count}</span></>}
          >
            <ul className={styles.files}>
              {group.files.map(f => <li key={f.slug}>{f.href ? <Link href={f.href}>{f.slug}</Link> : f.slug}</li>)}
            </ul>
          </Disclosure>
        ))
      )}
      {column.more && onShowAll && <button type="button" className={styles.more} onClick={onShowAll}>{column.more}</button>}
    </section>
  );
}

/**
 * The files where the two tools differ, in both directions and always both, even when one is empty.
 * Grouped by provider, providers alphabetical, files by slug: never ordered by how many there are.
 * Files are slugs that link to the existing fixture page; no file content is shown here.
 */
export function AccuracyDifferences({ columns, note, onShowAll, className }: AccuracyDifferencesProps) {
  return (
    <div className={className}>
      <p className={styles.note}>{note}</p>
      <div className={styles.lists}>
        {columns.map((column, i) => <Column key={column.title} column={column} onShowAll={onShowAll ? () => onShowAll(i) : undefined} />)}
      </div>
    </div>
  );
}
