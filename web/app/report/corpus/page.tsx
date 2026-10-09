import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { SuiteTable } from '../../../components/report';
import { resolveSuitesPage } from '../../../resolvers/pages';
import { RunNotes } from '../RunNotes';

export const metadata: Metadata = { title: 'Credential Corpus' };

/** `/report/corpus/`: every suite of the corpus with redact-secret's counts. Each opens its rows, and each row its fixture. */
export default async function Page() {
  const data = await resolveSuitesPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Credential Corpus' }]} />}
        eyebrow={data.head.eyebrow}
        title={data.head.title}
        lede={data.head.lede}
        meta={data.head.meta}
      />
      <RunNotes state={data.runState} detailsInDialog />
      <SuiteTable suites={data.suites} caption="Suites of the corpus" />
    </Stack>
  );
}
