import { Suspense } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { resolveSuitePage, resolveSuiteSlugs } from '../../../../resolvers/pages';
import { RunNotes } from '../../RunNotes';
import { RowsView } from '../../RowsView';
import { LEVEL_ROW_SHOW } from '../../rowShowOptions';
import { FIXTURE_SCRIPT } from './fixture-script';
import { FixtureSync } from './FixtureSync';
import { FixtureSkeleton, FixtureView } from './FixtureView';
import styles from './Suite.module.css';

/** Every suite is a page, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveSuiteSlugs()).map(suite => ({ suite }));
}

export async function generateMetadata({ params }: { params: Promise<{ suite: string }> }): Promise<Metadata> {
  const data = await resolveSuitePage((await params).suite);
  return { title: data ? `${data.title} · Suites` : 'Suite not found' };
}

/**
 * One suite: its rows with every scanner's outcome, and, when the address names `?fixture=<id>`,
 * that fixture's page: the exact bytes, what was expected and what each scanner reported. One
 * page per suite keeps the export workable (a page per fixture would be 5,925 pages); the fixture
 * view is built in the browser from the suite's records file (fetched when a fixture is opened), and
 * the first page of rows is pre-rendered, the rest fetched as one file.
 */
export default async function Page({ params }: { params: Promise<{ suite: string }> }) {
  const data = await resolveSuitePage((await params).suite);
  if (!data) notFound();
  const suiteHref = `/report/fixtures/${data.id}/`;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: FIXTURE_SCRIPT }} />
      <Suspense fallback={null}><FixtureSync /></Suspense>
      <div className={styles.rowsView}>
        <Stack gap="lg">
          <PageHead
            before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Suites', href: '/report/fixtures/' }, { label: data.title }]} />}
            eyebrow={data.head.eyebrow}
            title={data.head.title}
            lede={data.head.lede}
            meta={data.head.meta}
            actions={<Link href="/report/fixtures/">All suites</Link>}
          />
          <RunNotes state={data.runState} />
          <RowsView
            anchor="suite-rows"
            name={data.title}
            title="Fixtures in this suite"
            description={data.description}
            facts={data.facts}
            rows={data.rows}
            warm={data.recordsSrc}
            defaultScanners="all"
            showOptions={LEVEL_ROW_SHOW}
            emptyTitle="No fixtures in this suite"
            emptyText="The suite is registered but holds no fixtures, so nothing is measured."
          />
        </Stack>
      </div>
      {/* The fallback is what a direct visit to ?fixture= shows until the page has hydrated; it is hidden when no fixture is named. */}
      <Suspense fallback={<div className={styles.fixtureView}><FixtureSkeleton suiteTitle={data.title} suiteHref={suiteHref} /></div>}>
        <FixtureView suiteTitle={data.title} suiteHref={suiteHref} src={data.recordsSrc} fixtureCount={data.fixtureCount} />
      </Suspense>
    </>
  );
}
