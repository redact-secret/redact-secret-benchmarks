import type { Metadata } from 'next';
import { DomainView } from '../../../components/evaluation/domain';
import { resolveDomainPage } from '../../../resolvers/pages';

import { DomainGlance } from '../../../components/evaluation/domain/DomainGlance';
import { PiiStatusExplorer, PiiCoverageExplorer } from './PiiExplorer';

export const metadata: Metadata = { title: 'How PII is evaluated' };

/** `/evaluation/pii`: how PII is evaluated and what the ledger records for it. A server component: it runs during `next build` and ships HTML. */
export default async function Page() {
  const data = await resolveDomainPage('pii');
  const rows = data.status.groups.flatMap(group => group.rows);
  const measurement = rows.find(row => row.id === 'pii-eval');
  const protectedEvidence = rows.find(row => row.id === 'protected-evidence');
  const authority = rows.find(row => row.id === 'pii-authority');
  const pending = authority?.detail.includes('pending and not operational');
  const summary = [
    { label: 'Public synthetic measurement', value: measurement?.statusWord ?? 'Not recorded', detail: measurement?.value ? `${measurement.value}. The measurement artifact is validated; this is not a product support approval.` : 'No validated public measurement is recorded.' },
    { label: 'Current product support qualification', value: 'Not established', detail: protectedEvidence ? `No usable protected support record is bound. ${protectedEvidence.detail} Public measurement remains separate and usable.` : 'Historical family status and public measurements do not establish support qualification for the current candidate.' },
    { label: 'Protected execution and audit', value: pending ? 'Not operational' : 'See recorded evidence', detail: pending ? 'The protected execution and audit paths are pending. They do not gate public synthetic measurement.' : 'The exact recorded state is available in Sources and execution details. Public measurement does not imply a live protected path.' },
  ];
  return <DomainView {...data} glanceContent={<DomainGlance items={summary} />} afterGlance={<PiiStatusExplorer data={data.status} />} statusContent={<></>} coverageContent={<PiiCoverageExplorer data={data.coverage} />} />;
}
