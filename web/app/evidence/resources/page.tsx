import type { Metadata } from 'next';
import { PageHead } from '../../../components/page';
export const metadata: Metadata = { title: 'Evidence resources' };
export default function Page() {
  return <PageHead eyebrow="Planned page" title="Evidence resources" lede="This page is planned. No report is published here yet." />;
}
