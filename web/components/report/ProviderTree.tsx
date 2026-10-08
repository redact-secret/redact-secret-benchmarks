import Link from 'next/link';
import { Disclosure } from '../disclosure';
import { EmptyState } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import { FixtureCountsLine } from './FixtureCountsLine';
import styles from './ProviderTree.module.css';
import type { ProviderGroupData } from './types';

export interface ProviderTreeProps {
  providers: ProviderGroupData[];
  /** Open every provider, e.g. while a search or filter is active. */
  expanded?: boolean;
  /** Names the list for assistive tech. */
  label: string;
  /** Text under an empty result: how to get rows back. */
  emptyText?: string;
  /** A footnote about rows the tree leaves out. */
  footnote?: string;
  className?: string;
}

/**
 * Providers as rows that open onto their families. Each provider carries its
 * fixture-row counts; each family links to its rows and, when given, names its research record (review state and
 * format revision, #591), which describes the research and is never a status. Native disclosure, no state.
 */
export function ProviderTree({ providers, expanded = false, label, emptyText = 'Clear the search or choose All.', footnote, className }: ProviderTreeProps) {
  if (providers.length === 0) {
    return (
      <div className={className}>
        <EmptyState title="No provider matches">{emptyText}</EmptyState>
        {footnote && <p className={styles.footnote}>{footnote}</p>}
      </div>
    );
  }
  return (
    <div className={cx(styles.tree, className)} role="group" aria-label={label}>
      {providers.map(provider => (
        <Disclosure
          key={provider.id}
          defaultOpen={expanded}
          summary={
            <>
              <span>
                <b>{provider.name}</b>
                <small>{provider.familiesLabel} · {provider.fixturesLabel}</small>
              </span>
              <FixtureCountsLine counts={provider.counts} />
            </>
          }
        >
          <ul className={styles.families}>
            {provider.families.map(family => (
              <li key={family.id} className={styles.family}>
                <Link href={family.href} className={styles.name}>
                  <b>{family.name}</b>
                  <small><Code>{family.id}</Code></small>
                  {family.research && <small className={styles.research}>{family.research}</small>}
                </Link>
                <span className={styles.n}>{family.fixturesLabel}</span>
                <FixtureCountsLine counts={family.counts} />
              </li>
            ))}
          </ul>
        </Disclosure>
      ))}
      {footnote && <p className={styles.footnote}>{footnote}</p>}
    </div>
  );
}
