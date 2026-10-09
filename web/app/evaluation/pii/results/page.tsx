import type { Metadata } from 'next';
import { DomainView } from '../../../../components/evaluation/domain';
import { DomainGlance } from '../../../../components/evaluation/domain/DomainGlance';
import { resolveDomainPage } from '../../../../resolvers/pages';
import { PiiStatusExplorer, PiiCoverageExplorer } from '../PiiExplorer';

export const metadata: Metadata = { title: 'PII measurement results', alternates: { canonical: '/evaluation/pii/results/' } };

/** Retains population selectors, metric outcomes and execution diagnostics apart from the overview. */
export default async function Page() {
  const data = await resolveDomainPage('pii');
  const head = { ...data.head, title: 'PII measurement results', breadcrumb: [{ label: 'Evaluation', href: '/evaluation/' }, { label: 'PII methodology', href: '/evaluation/pii/' }, { label: 'Results' }] };
  return <DomainView {...data} head={head} glanceContent={<DomainGlance items={data.presentationSummary ?? data.glance} />} afterGlance={<PiiStatusExplorer data={data.status} />} statusContent={<></>} coverageContent={<PiiCoverageExplorer data={data.coverage} />} />;
}
