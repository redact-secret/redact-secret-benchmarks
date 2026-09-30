import type { Metadata } from 'next';
import { Stack } from '../../../components/layout';
import { Breadcrumb, PageHead } from '../../../components/page';
import { FindingsTable } from '../../../components/report';
import { resolveFindingsPage } from '../../../resolvers/pages';

export const metadata: Metadata = { title: 'Findings' };

/**
 * `/report/findings/`: every finding this benchmark handed to the product, with its recorded
 * status and the fixtures it rests on, each a link to its page. A snapshot of the ledger, not
 * live issue status; the milestone link is the way out to the live one.
 */
export default async function Page() {
  const { head, inventory } = await resolveFindingsPage();
  return (
    <Stack gap="lg">
      <PageHead
        before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Findings' }]} />}
        eyebrow={head.eyebrow}
        title={head.title}
        lede={head.lede}
        meta={head.meta}
        actions={<a href={inventory.milestone.href}>{inventory.milestone.label} on GitHub</a>}
      />
      <FindingsTable findings={inventory.rows} caption="Findings handed to the product" />
    </Stack>
  );
}
