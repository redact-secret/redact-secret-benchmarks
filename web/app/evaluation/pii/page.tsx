import type { Metadata } from 'next';
import { DomainView } from '../../../components/evaluation/domain';
import { resolveDomainPage } from '../../../resolvers/pages';

import { DomainGlance } from '../../../components/evaluation/domain/DomainGlance';
import { PiiStatusExplorer, PiiCoverageExplorer } from './PiiExplorer';

export const metadata: Metadata = { title: 'How PII is evaluated' };

/** `/evaluation/pii`: how PII is evaluated and what the ledger records for it. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  const data = await resolveDomainPage('pii');
  return <DomainView {...data} glanceContent={<DomainGlance items={data.presentationSummary ?? data.glance} />} afterGlance={<PiiStatusExplorer data={data.status} />} statusContent={<></>} coverageContent={<PiiCoverageExplorer data={data.coverage} />} />;
}
