import type { Metadata } from 'next';
import { CredentialMethodology } from '../../../components/evaluation/credential';
import { resolveDomainPage } from '../../../resolvers/pages';
import { resolveCredentialMethodology } from '../../../resolvers/credential-methodology';

import { RunNotes } from '../../report/RunNotes';

export const metadata: Metadata = { title: 'How credentials are evaluated', alternates: { canonical: '/evaluation/credential/' } };

/** `/evaluation/credential`: how credentials are evaluated and what the ledger records for them. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  const data = await resolveDomainPage('credential');
  return <CredentialMethodology {...resolveCredentialMethodology(data)} sourceContent={data.pipeline && <RunNotes state={{ kind: 'measured', notes: [], pipeline: data.pipeline }} detailsInDialog />} />;
}
