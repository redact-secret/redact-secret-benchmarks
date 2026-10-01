import type { Metadata } from 'next';
import { DomainView } from '../../../components/evaluation/domain';
import { resolveDomainPage } from '../../../resolvers/pages';

export const metadata: Metadata = { title: 'How credentials are evaluated' };

/** `/evaluation/credential`: how credentials are evaluated and what the ledger records for them. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  return <DomainView {...await resolveDomainPage('credential')} />;
}
