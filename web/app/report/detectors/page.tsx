import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { resolveDetectorsPage } from '../../../resolvers/pages';
import { RunNotes } from '../RunNotes';
import { DetectorsView } from './DetectorsView';

export const metadata: Metadata = { title: 'Detectors' };

/** `/report/detectors/`: every detector family by the fixtures that exercise it, against the minimum sample size. */
export default async function Page() {
  const data = await resolveDetectorsPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Detectors' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
      />
      <RunNotes state={data.runState} detailsInDialog />
      <DetectorsView detectors={data.detectors} />
      <p>{data.note}</p>
    </Stack>
  );
}
