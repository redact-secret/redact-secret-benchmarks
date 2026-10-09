import type { Metadata } from 'next';
import { DomainView, PiiCoverageMatrix } from '../../../../components/evaluation/domain';
import { resolvePiiEvidencePage } from '../../../../resolvers/pii-evidence-pages';

import { OutcomeComparison } from './OutcomeComparison';

export const metadata: Metadata = { title: 'Independent PII evidence population', alternates: { canonical: '/evaluation/pii/evidence/' } };

export default async function Page() {
  const { outcomes, fullCoverage, ...data } = await resolvePiiEvidencePage();
  return <DomainView {...data} coverage={{ ...data.coverage, tables: data.coverage.tables.filter(table => !outcomes || table.id !== 'evidence-outcomes') }} afterGlance={<>
    <nav aria-label="PII evidence destinations"><a href="/coverage/pii/">PII product coverage</a> · <a href="/evaluation/pii/">PII methodology</a> · <a href="/evaluation/pii/results/">PII measurement results</a></nav>
    {outcomes && <OutcomeComparison data={outcomes} />}<PiiCoverageMatrix {...fullCoverage} /></>} />;
}
