import type { Metadata } from 'next';
import { DomainView, PiiCoverageMatrix } from '../../../../components/evaluation/domain';
import { resolvePiiEvidencePage } from '../../../../resolvers/pii-evidence-pages';

import { OutcomeComparison } from './OutcomeComparison';

export const metadata: Metadata = { title: 'Independent PII evidence population' };

export default async function Page() {
  const { outcomes, fullCoverage, ...data } = await resolvePiiEvidencePage();
  return <DomainView {...data} coverage={{ ...data.coverage, tables: data.coverage.tables.filter(table => table.id !== 'evidence-outcomes') }} afterGlance={<>{outcomes && <OutcomeComparison data={outcomes} />}<PiiCoverageMatrix {...fullCoverage} /></>} />;
}
