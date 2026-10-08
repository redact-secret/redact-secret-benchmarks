import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { Note, StatusBar } from '../../../../components/feedback';
import { resolveFamilyPage, resolveFamilySlugs } from '../../../../resolvers/pages';
import { RunNotes } from '../../RunNotes';
import { RowsView } from '../../RowsView';
import { ROW_SHOW } from '../../rowShowOptions';
import { FamilyView } from './FamilyView';

/** Every family in the taxonomy is a page, including those with no fixtures, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveFamilySlugs()).map(family => ({ family }));
}

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  const data = await resolveFamilyPage((await params).family);
  return { title: data ? `${data.family.name} · Families` : 'Family not found' };
}

/**
 * One family (#589): the research record and what it says about the format, the benchmark counts at every
 * evidence level and for every scanner, the peer rules that target it, then every fixture row and the sources.
 * Whatever the dossier or the run does not record is a stated "not recorded" or "not measured", never a blank
 * and never a zero. A family with no fixtures claims no coverage.
 */
export default async function Page({ params }: { params: Promise<{ family: string }> }) {
  const data = await resolveFamilyPage((await params).family);
  if (!data) notFound();
  const { family } = data;
  const providerHref = `/report/providers/?q=${encodeURIComponent(family.providerName)}`;
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Providers', href: '/report/providers/' }, { label: family.providerName, href: providerHref }, { label: family.name }]} />}
        eyebrow="redact-secret · Report"
        title={family.name}
        lede={family.about.description}
        meta={data.meta}
        actions={<Link href="/report/providers/">All providers</Link>}
      />
      <StatusBar label={`Benchmark dossier for ${family.name}`} items={data.status} />
      {family.about.note && <Note>{family.about.note}</Note>}
      <RunNotes state={data.runState} />
      <FamilyView
        name={family.name}
        providerName={family.providerName}
        research={data.research} canonicalFormat={data.canonicalFormat}
        format={data.format}
        open={data.open}
        lookAlikes={data.lookAlikes}
        benchmark={data.benchmark}
        rules={data.rules}
        sources={data.sources}
        siblings={data.siblings}
      >
        <RowsView
          anchor="family-rows"
          name={family.name}
          title="Fixtures in this family"
          description={data.description}
          rows={data.rows}
          levels={data.levels.length ? data.levels : undefined}
          defaultScanners="product"
          showOptions={ROW_SHOW}
          emptyTitle="No fixtures in this family yet"
          emptyText="Nothing in the corpus targets it, so nothing is measured and no coverage is claimed."
        />
      </FamilyView>
    </Stack>
  );
}
