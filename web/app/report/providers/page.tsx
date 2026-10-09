import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { resolveProvidersPage } from '../../../resolvers/pages';
import { RunNotes } from '../RunNotes';
import { ProvidersView } from './ProvidersView';

export const metadata: Metadata = { title: 'Providers' };

/** `/report/providers`: every provider in the taxonomy with its families and fixture-row counts. Find and show narrow the list from the URL. */
export default async function Page() {
  const data = await resolveProvidersPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Providers' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
      />
      <RunNotes state={data.runState} detailsInDialog />
      <ProvidersView levels={data.levels} />
    </Stack>
  );
}
