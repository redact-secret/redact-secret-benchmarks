import type { Metadata } from 'next';
import { ScannerOverview } from '../../../components/evaluation/scanner';
import { resolveScannerPage } from '../../../resolvers/pages';

import { ModeDialog } from './ModeDialog';

export const metadata: Metadata = { title: 'Scanners' };

/**
 * `/evaluation/scanner`: the scanners the benchmark ran with and the environment each ran in. A server
 * component: it runs during `next build` and ships HTML. It shows recorded facts and never an outcome.
 */
export default async function Page() {
  const data = await resolveScannerPage();
  return <ScannerOverview {...data} modeNoteContent={<ModeDialog note={data.modeNote} />} />;
}
