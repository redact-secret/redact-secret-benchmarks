import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QualificationFamily, QualificationUnavailable } from '../../../../../components/qualification';
import { resolveQualificationFamilyPage, resolveQualificationFamilySlugs } from '../../../../../resolvers/qualification-pages';

/** One page per family the view scores, so a static host serves each and 404s the rest. With no usable view the one page says so. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await resolveQualificationFamilySlugs()).map(family => ({ family }));
}

export async function generateMetadata({ params }: { params: Promise<{ family: string }> }): Promise<Metadata> {
  return { title: `${(await params).family} · Qualification` };
}

/** `/evaluation/qualification/families/<family>/`: the product's status and its evidence, then each scanner's counts per population. */
export default async function Page({ params }: { params: Promise<{ family: string }> }) {
  const page = await resolveQualificationFamilyPage((await params).family);
  if (page.state === 'unknown') notFound();
  return page.state === 'ready' ? <QualificationFamily {...page.props} /> : <QualificationUnavailable {...page.props} />;
}
