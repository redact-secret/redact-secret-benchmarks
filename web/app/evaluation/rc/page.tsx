import type { Metadata } from 'next';
import { Note } from '../../../components/feedback';
import { RcBuilds, RcDifferences, RcLevels, RcMoved, RcNotRecorded, RcPerformance } from '../../../components/evaluation/rc';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { resolveReleaseCandidatePage } from '../../../resolvers/pages';

export const metadata: Metadata = { title: 'Release candidate' };

/**
 * `/evaluation/rc`: the commit in development beside the last release, as recorded differences. A server
 * component: it runs during `next build` and ships HTML. A build with no candidate evidence shows the
 * "no candidate recorded" state, never an empty comparison.
 */
export default async function Page() {
  const data = await resolveReleaseCandidatePage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Evaluation' }, { label: 'Release candidate' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
      />
      {data.notes.map(n => <Note key={n.title} tone={n.tone} title={n.title}>{n.text}</Note>)}
      {data.notRecorded && <RcNotRecorded {...data.notRecorded} />}
      <RcBuilds {...data.builds} />
      {data.differences && <RcDifferences {...data.differences} />}
      {data.levels && <RcLevels {...data.levels} />}
      {data.moved && <RcMoved {...data.moved} />}
      <RcPerformance {...data.performance} />
    </Stack>
  );
}
