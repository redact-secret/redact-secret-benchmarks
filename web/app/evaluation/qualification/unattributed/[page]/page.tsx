import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QualificationCases, QualificationUnavailable } from '../../../../../components/qualification';
import { resolveQualificationCasesPage, resolveQualificationUnattributedParams } from '../../../../../resolvers/qualification-pages';

export const dynamicParams = false;

export async function generateStaticParams() {
  return resolveQualificationUnattributedParams();
}

export const metadata: Metadata = { title: 'Unattributed cases · Qualification' };

/** `/evaluation/qualification/unattributed/<page>/`: the cases no detector family claims, per population, from the pre-derived view only. */
export default async function Page({ params }: { params: Promise<{ page: string }> }) {
  const resolved = await resolveQualificationCasesPage(null, (await params).page);
  if (resolved.state === 'unknown') notFound();
  return resolved.state === 'ready' ? <QualificationCases {...resolved.props} /> : <QualificationUnavailable {...resolved.props} />;
}
