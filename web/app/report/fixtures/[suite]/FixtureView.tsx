'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { EmptyState } from '../../../../components/feedback';
import { Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { FixtureDetail } from '../../../../components/report';
import { resolveFixtureRecord, type FixtureRecord, type SuiteShared } from '../../../../resolvers/fixtures';
import styles from './Suite.module.css';

export interface FixtureViewProps {
  records: FixtureRecord[];
  shared: SuiteShared;
  suiteHref: string;
}

/**
 * One fixture of the suite, chosen by `?fixture=<id>`. The page ships a compact record per
 * fixture; the detail (bytes cut at range boundaries, one lane per scanner) is built here for
 * the one fixture a reader opens, so a suite of 1,300 fixtures never draws 1,300 of them. The
 * server HTML holds the suite's rows; this view shows in their place once the address names a
 * fixture (Suite.module.css), and says "Loading" until it has hydrated.
 */
export function FixtureView({ records, shared, suiteHref }: FixtureViewProps) {
  const id = useSearchParams().get('fixture');
  const record = useMemo(() => (id ? records.find(r => r.id === id) : undefined), [id, records]);
  const detail = useMemo(() => (record ? resolveFixtureRecord(record, shared) : undefined), [record, shared]);
  const crumbs = [{ label: 'Report', href: '/report/' }, { label: 'Suites', href: '/report/fixtures/' }, { label: shared.suite.title, href: suiteHref }];
  return (
    // `data-fixture-ready` marks a hydrated view: the layout check waits for it before measuring.
    <div className={styles.fixtureView} data-fixture-ready={id ? '' : undefined}>
      {!id ? <p className={styles.loading}>Loading the fixture…</p> : !detail || !record ? (
        <Stack gap="lg">
          <PageHead before={<Breadcrumb items={[...crumbs, { label: id }]} />} eyebrow="redact-secret · Report" title="No such fixture" />
          <EmptyState title={`No fixture “${id}” in ${shared.suite.title}`} action={<Link href={suiteHref}>All fixtures in this suite</Link>}>
            Fixture ids come from the corpus. This suite has {records.length.toLocaleString('en-US')} fixtures.
          </EmptyState>
        </Stack>
      ) : (
        <Stack gap="lg">
          <PageHead
            before={<Breadcrumb items={[...crumbs, { label: record.id }]} />}
            eyebrow={detail.suite.toUpperCase()}
            title={record.id}
            meta={[{ value: `${detail.kind} · ${detail.evidence}` }, { value: detail.size }]}
            actions={<Link href={suiteHref}>All fixtures in this suite</Link>}
          />
          <FixtureDetail fixture={detail} />
        </Stack>
      )}
    </div>
  );
}
