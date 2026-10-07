import Link from 'next/link';
import { EmptyState } from '../components/feedback';
import { Stack } from '../components/layout';
import { Breadcrumb, PageHead } from '../components/page';
import { Code } from '../components/text';
import { LegacyFixtureLookup } from './LegacyFixtureLookup';

/**
 * Served by a static host as 404.html for any path that is not exported, which
 * includes a family id that is not in the taxonomy (each real family is a page). An old `/fixture/<suite>--<id>` address
 * also lands here; `LegacyFixtureLookup` opens it on its suite page when the suite's records hold the fixture (#594).
 */
export default function NotFound() {
  return (
    <Stack gap="lg">
      <PageHead before={<Breadcrumb items={[{ label: 'Report', href: '/report/' }, { label: 'Not found' }]} />} title="Page not found" />
      <LegacyFixtureLookup>
        <EmptyState
          title="Nothing is recorded at this address"
          action={<><Link href="/report/families/">All families</Link> · <Link href="/report/providers/">All providers</Link> · <Link href="/report/">Report</Link></>}
        >
          A family page lives at <Code>/report/families/&lt;provider&gt;--&lt;family&gt;/</Code>, for example <Code>aws--iam-user-access-key</Code>. Pick one from the list.
        </EmptyState>
      </LegacyFixtureLookup>
    </Stack>
  );
}
