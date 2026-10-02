import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QualificationCases, QualificationUnavailable } from '../../../../../../../components/qualification';
import { resolveQualificationCaseParams, resolveQualificationCasesPage } from '../../../../../../../resolvers/qualification-pages';

/** One page per (family, page) the view holds, so a static host serves each and 404s the rest. With no usable view the one page says so. */
export const dynamicParams = false;

export async function generateStaticParams() {
  return resolveQualificationCaseParams();
}

export async function generateMetadata({ params }: { params: Promise<{ family: string; page: string }> }): Promise<Metadata> {
  const { family } = await params;
  return { title: `Cases of ${family} · Qualification` };
}

/** `/evaluation/qualification/families/<family>/cases/<page>/`: the family's cases per population, built from the pre-derived view only. */
export default async function Page({ params }: { params: Promise<{ family: string; page: string }> }) {
  const { family, page } = await params;
  const resolved = await resolveQualificationCasesPage(family, page);
  if (resolved.state === 'unknown') notFound();
  return resolved.state === 'ready' ? <QualificationCases {...resolved.props} /> : <QualificationUnavailable {...resolved.props} />;
}
