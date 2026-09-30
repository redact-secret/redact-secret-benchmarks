import Link from 'next/link';
import { ListRow, RowList } from '../disclosure';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { cx } from '../../lib/cx';
import styles from './FindingsFeed.module.css';
import type { FindingData } from './types';

export interface FindingsFeedProps {
  title: string;
  /** Says when the snapshot was taken and that it is not live issue status. */
  description: string;
  findings: FindingData[];
  /** The link to every finding, e.g. "All 57 findings". */
  allHref?: string;
  allLabel?: string;
  id?: string;
  className?: string;
}

/** "What changed": findings this benchmark handed to the product, newest first, each with its recorded state. */
export function FindingsFeed({ title, description, findings, allHref, allLabel, id, className }: FindingsFeedProps) {
  return (
    <div id={id} className={cx(styles.feed, className)}>
      <Section title={title} description={description} actions={allHref && allLabel ? <Link href={allHref}>{allLabel}</Link> : undefined}>
        {findings.length === 0 ? (
          <EmptyState title="No findings recorded">The findings ledger has no entries for this snapshot.</EmptyState>
        ) : (
          <RowList label={title}>
            {findings.map(f => (
              <ListRow key={f.id} leading={<StatusBadge status={f.status.status}>{f.status.label}</StatusBadge>} trailing={f.date}>
                <Link href={f.href}>{f.title}</Link>
                <small className={styles.detail}>{f.detail}</small>
              </ListRow>
            ))}
          </RowList>
        )}
      </Section>
    </div>
  );
}
