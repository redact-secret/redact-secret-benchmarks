import type { Metadata } from 'next';
import { DomainView } from '../../../components/evaluation/domain';
import { resolveDomainPage } from '../../../resolvers/pages';

export const metadata: Metadata = { title: 'How PII is evaluated' };

/** `/evaluation/pii`: how PII is evaluated and what the ledger records for it. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  return <DomainView {...await resolveDomainPage('pii')} />;
}
