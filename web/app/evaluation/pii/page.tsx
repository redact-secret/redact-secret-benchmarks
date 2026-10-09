import type { Metadata } from 'next';
import { PiiMethodology } from '../../../components/evaluation/pii';
import { Breadcrumb, PageHead } from '../../../components/page';
import { SegmentedNav } from '../../../components/nav';
import { resolveDomainPage } from '../../../resolvers/pages';
import { resolvePiiMethodology } from '../../../resolvers/pii-overview';
import styles from './PiiOverview.module.css';
import { ResultBookmarks } from './ResultBookmarks';

export const metadata: Metadata = { title: 'How PII is evaluated', alternates: { canonical: '/evaluation/pii/' } };

export default async function Page() {
  const data = await resolveDomainPage('pii');
  return <div className={styles.page}>
    <ResultBookmarks anchors={data.status.groups.flatMap(group => group.rows.flatMap(row => row.anchor ? [row.anchor] : []))} />
    <PageHead before={<Breadcrumb items={data.head.breadcrumb} />} eyebrow={data.head.eyebrow} title={data.head.title} lede={data.head.lede}
      actions={<SegmentedNav label="Evaluation domain" items={data.head.pair} currentHref="/evaluation/pii/" />} />
    <PiiMethodology {...resolvePiiMethodology(data)} />
  </div>;
}
