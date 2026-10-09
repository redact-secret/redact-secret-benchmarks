import type { Metadata } from 'next';
import { PiiCatalog } from '../../../components/coverage/pii';
import { Breadcrumb, PageHead } from '../../../components/page';
import { SegmentedNav } from '../../../components/nav';
import { resolvePiiCoveragePage } from '../../../resolvers/pages';
import styles from '../../evaluation/pii/PiiOverview.module.css';

export const metadata: Metadata = { title: 'PII coverage', alternates: { canonical: '/coverage/pii/' } };

export default async function Page() {
  const data = await resolvePiiCoveragePage();
  return <div className={styles.page}>
    <PageHead before={<Breadcrumb items={[{ label: 'Coverage' }, { label: 'PII' }]} />} eyebrow="Coverage · PII" title="PII coverage"
      lede="Release-bound personal-data declarations, activation and evidence limitations. Public synthetic measurements and product qualification remain separate."
      actions={<SegmentedNav label="Coverage domain" items={[{ label: 'Credential', href: '/coverage/credential/' }, { label: 'PII', href: '/coverage/pii/' }]} currentHref="/coverage/pii/" />} />
    <PiiCatalog {...data} />
    <p><a href="https://github.com/redact-secret/redact-secret/blob/main/README.md">Product documentation</a></p>
  </div>;
}
