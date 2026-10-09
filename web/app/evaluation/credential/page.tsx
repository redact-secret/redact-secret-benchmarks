import type { Metadata } from 'next';
import { DomainView } from '../../../components/evaluation/domain';
import { resolveDomainPage } from '../../../resolvers/pages';

import { RunNotes } from '../../report/RunNotes';

export const metadata: Metadata = { title: 'How credentials are evaluated' };

/** `/evaluation/credential`: how credentials are evaluated and what the ledger records for them. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  const data = await resolveDomainPage('credential');
  return <DomainView {...data} pipelineContent={data.pipeline && <RunNotes state={{ kind: 'measured', notes: [], pipeline: data.pipeline }} detailsInDialog />} />;
}
