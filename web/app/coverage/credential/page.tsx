import type { Metadata } from 'next';
import { CredentialCoverage } from '../../../components/coverage/credential';
import { resolveCredentialCoveragePage } from '../../../resolvers/pages';
import { RunNotes } from '../../report/RunNotes';

export const metadata: Metadata = { title: 'Credential coverage', alternates: { canonical: '/coverage/credential/' } };

export default async function Page() {
  const data = await resolveCredentialCoveragePage();
  return <CredentialCoverage {...data} sourceContent={data.pipeline && <RunNotes state={{ kind: 'measured', notes: [], pipeline: data.pipeline }} detailsInDialog />} />;
}
