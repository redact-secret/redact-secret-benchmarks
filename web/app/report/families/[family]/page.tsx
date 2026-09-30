import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Stack } from '../../../../components/layout';
import { Breadcrumb, PageHead } from '../../../../components/page';
import { FamilyAbout } from '../../../../components/report';
import { resolveFamilyPage, resolveFamilySlugs } from '../../../../resolvers/pages';
import { RunNotes } from '../../RunNotes';
import { FamilyRows } from './FamilyRows';

/** Every family in the taxonomy is a page, including those with no fixtures, so a static host serves each and 404s the rest. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveFamilySlugs()).map(family => ({ family }));
}

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  const data = await resolveFamilyPage((await params).family);
  return { title: data ? `${data.family.name} · Families` : 'Family not found' };
}

/** One family: what it is, then the rows behind its counts. A family with no fixtures says "Not measured" and claims no coverage. */
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
        meta={data.meta}
        actions={<Link href="/report/providers/">All providers</Link>}
      />
      <RunNotes state={data.runState} />
      <FamilyAbout {...family.about} />
      <FamilyRows familyName={family.name} rows={family.rows} facts={family.facts} description={data.description} />
    </Stack>
  );
}
