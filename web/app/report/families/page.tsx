import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { resolveFamiliesPage } from '../../../resolvers/pages';
import { RunNotes } from '../RunNotes';
import { FamiliesView } from './FamiliesView';

export const metadata: Metadata = { title: 'Families' };

/** `/report/families`: one row per credential family, in taxonomy order. Find and show narrow the list from the URL. */
export default async function Page() {
  const data = await resolveFamiliesPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Families' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
      />
      <RunNotes state={data.runState} />
      <FamiliesView levels={data.levels} />
    </Stack>
  );
}
