import type { Metadata } from 'next';
import { DomainView } from '../../../../components/evaluation/domain';
import { resolvePiiEvidencePage } from '../../../../resolvers/pii-evidence-pages';

export const metadata: Metadata = { title: 'Independent PII evidence population' };

export default async function Page() {
  return <DomainView {...await resolvePiiEvidencePage()} />;
}
