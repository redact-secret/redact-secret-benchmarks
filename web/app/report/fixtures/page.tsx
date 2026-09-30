import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { SuiteTable } from '../../../components/report';
import { resolveSuitesPage } from '../../../resolvers/pages';
import { RunNotes } from '../RunNotes';

export const metadata: Metadata = { title: 'Suites' };

/** `/report/fixtures/`: every suite of the corpus with redact-secret's counts. Each opens its rows, and each row its fixture. */
export default async function Page() {
  const data = await resolveSuitesPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Suites' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
      />
      <RunNotes state={data.runState} />
      <SuiteTable suites={data.suites} caption="Suites of the corpus" />
    </Stack>
  );
}
