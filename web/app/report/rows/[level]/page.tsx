import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Stack } from '../../../../components/layout';
import { SegmentedNav } from '../../../../components/nav';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { isLevel } from '../../../../resolvers/report';
import { resolveLevelRowsPage, resolveLevelSlugs } from '../../../../resolvers/pages';
import { RunNotes } from '../../RunNotes';
import { RowsView } from '../../RowsView';
import { LEVEL_ROW_SHOW } from '../../rowShowOptions';

/** The three evidence levels are three pages, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export function generateStaticParams() {
  return resolveLevelSlugs().map(level => ({ level }));
}

export async function generateMetadata({ params }: { params: Promise<{ level: string }> }): Promise<Metadata> {
  const { level } = await params;
  return { title: isLevel(level) ? `Rows at ${level}` : 'Rows' };
}

/**
 * `/report/rows/<level>/`: every fixture at one evidence level with the outcome each scanner
 * recorded, the rows the three answers on `/report/` are counted from. Each headline figure links
 * here with the `?show=` that isolates its own rows.
 */
export default async function Page({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  if (!isLevel(level)) notFound();
  const data = await resolveLevelRowsPage(level);
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Rows' }, { label: level }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
        actions={<><SegmentedNav label="Evidence level" items={data.levels} currentHref={data.currentHref} /><Link href={data.answersHref}>The three answers</Link></>}
      />
      <RunNotes state={data.runState} />
      <RowsView
        anchor="level-rows"
        name={`the ${level} level`}
        title="Rows at this evidence level"
        description={data.description}
        facts={data.facts}
        rows={data.rows}
        defaultScanners="all"
        showOptions={LEVEL_ROW_SHOW}
        emptyTitle="No rows at this level"
        emptyText="No fixture is recorded at this evidence level, so nothing is measured."
      />
    </Stack>
  );
}
