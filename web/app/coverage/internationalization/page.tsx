import type { Metadata } from 'next';
import { PageHead } from '../../../components/page';
export const metadata: Metadata = { title: 'Internationalization' };
export default function Page() {
  return <PageHead eyebrow="Planned page" title="Internationalization" lede="This page is planned. No report is published here yet." />;
}
