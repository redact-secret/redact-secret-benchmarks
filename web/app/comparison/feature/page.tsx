import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState } from '../../../components/feedback';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { resolveFeatureComparisonPage } from '../../../resolvers/pages';
import { FeatureView } from './FeatureView';

export const metadata: Metadata = { title: 'Feature comparison' };

/**
 * `/comparison/feature`: what each library's own documentation says it can do.
 * Until `benchmarks/feature-claims.json` exists the page says nothing is recorded
 * and shows no table. The row filter is a client island (`FeatureView`).
 */
export default async function Page() {
  const page = await resolveFeatureComparisonPage();
  if (page.state === 'recorded') return <FeatureView {...page.view} />;
  return (
    <Stack gap="lg">
      <PageHead before={<Breadcrumb items={page.breadcrumb} />} eyebrow={page.eyebrow} title={page.title} lede={page.lede} />
      <EmptyState title={page.notice.title} action={<Link href={page.runtime.href}>{page.runtime.label}</Link>}>
        {page.notice.text}
      </EmptyState>
    </Stack>
  );
}
