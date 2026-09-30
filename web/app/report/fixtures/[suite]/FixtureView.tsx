'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { EmptyState, RetryNote, Skeleton, SkeletonBlock } from '../../../../components/feedback';
import { Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { FixtureDetail } from '../../../../components/report';
import { useBuildData } from '../../../../lib/build-data';
import { isSuiteRecordsFile, resolveFixtureRecord, type SuiteRecordsFile } from '../../../../resolvers/fixtures';
import { failureText } from '../../dataFailure';
import styles from './Suite.module.css';

export interface FixtureViewProps {
  suiteTitle: string;
  suiteHref: string;
  /** The build-emitted records file of this suite (`lib/data-paths.ts`). */
  src: string;
  /** How many fixtures the suite has, for the "no such fixture" message. */
  fixtureCount: number;
}

const crumbsOf = (suiteTitle: string, suiteHref: string) => [{ label: 'Report', href: '/report/' }, { label: 'Suites', href: '/report/fixtures/' }, { label: suiteTitle, href: suiteHref }];

/**
 * The placeholder a direct visit to `?fixture=` shows until the page has hydrated, and the shape of
 * the loading state: a title and two regions, so the fixture's page lands where they were. The
 * server HTML holds it; `Suite.module.css` shows it only when the address names a fixture.
 */
export function FixtureSkeleton({ suiteTitle, suiteHref, id }: { suiteTitle: string; suiteHref: string; id?: string }) {
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={id ? [...crumbsOf(suiteTitle, suiteHref), { label: id }] : crumbsOf(suiteTitle, suiteHref)} />}
        eyebrow={suiteTitle.toUpperCase()}
        title={id ?? ' '}
        meta={[{ value: ' ' }]}
      />
      <Skeleton label={id ? `Loading fixture ${id}` : 'Loading the fixture'}>
        <SkeletonBlock shape="panel" />
        <SkeletonBlock shape="panel" />
        <SkeletonBlock shape="line" width="half" />
      </Skeleton>
    </Stack>
  );
}

/**
 * One fixture of the suite, chosen by `?fixture=<id>`. The suite's records come from one
 * build-emitted file, fetched the first time a fixture is opened and kept for the session, so
 * moving between fixtures of a suite costs nothing after the first. The detail (bytes cut at range
 * boundaries, one lane per scanner) is built here for the one fixture a reader opens. While the
 * file loads the page shows the fixture's title and a skeleton the size of the regions to come;
 * a failure says why and offers a retry. The server HTML holds the suite's rows and the
 * skeleton; this view shows in their place once the address names a fixture (Suite.module.css).
 */
export function FixtureView({ suiteTitle, suiteHref, src, fixtureCount }: FixtureViewProps) {
  const id = useSearchParams().get('fixture');
  // A file from another build than this page has another number of fixtures: refuse it.
  const isThisBuild = useMemo(() => (value: unknown): value is SuiteRecordsFile => isSuiteRecordsFile(value) && value.records.length === fixtureCount, [fixtureCount]);
  const load = useBuildData(id ? src : null, isThisBuild, 'now');
  const file = load.data;
  const record = useMemo(() => (id && file ? file.records.find(r => r.id === id) : undefined), [id, file]);
  const detail = useMemo(() => (record && file ? resolveFixtureRecord(record, file.shared) : undefined), [record, file]);
  const crumbs = crumbsOf(suiteTitle, suiteHref);
  const state = !id ? 'idle' : file ? (record ? 'ready' : 'missing') : load.status === 'error' ? 'error' : 'loading';
  const problem = state === 'error' ? failureText(load.failure, 'this fixture', 'The rest of the suite is unaffected.') : undefined;
  return (
    // `data-fixture-state` names what is drawn; `data-fixture-ready` marks a loaded view, which the layout check waits for.
    <div className={styles.fixtureView} data-fixture-state={state} data-fixture-ready={state === 'ready' || state === 'missing' ? '' : undefined}>
      {state === 'idle' || state === 'loading' ? <FixtureSkeleton suiteTitle={suiteTitle} suiteHref={suiteHref} id={id ?? undefined} /> : state === 'error' && id ? (
        <Stack gap="lg">
          <PageHead before={<Breadcrumb items={[...crumbs, { label: id }]} />} eyebrow={suiteTitle.toUpperCase()} title={id} meta={[{ value: ' ' }]} />
          {problem && <RetryNote title={problem.title} retryLabel={problem.retryLabel} onRetry={problem.reload ? () => window.location.reload() : load.retry}>{problem.detail}</RetryNote>}
          <Link href={suiteHref}>All fixtures in this suite</Link>
        </Stack>
      ) : state === 'missing' && id ? (
        <Stack gap="lg">
          <PageHead before={<Breadcrumb items={[...crumbs, { label: id }]} />} eyebrow="redact-secret · Report" title="No such fixture" />
          <EmptyState title={`No fixture “${id}” in ${suiteTitle}`} action={<Link href={suiteHref}>All fixtures in this suite</Link>}>
            Fixture ids come from the corpus. This suite has {fixtureCount.toLocaleString('en-US')} fixtures.
          </EmptyState>
        </Stack>
      ) : detail && record ? (
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
      ) : null}
    </div>
  );
}
