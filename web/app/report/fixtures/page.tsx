import type { Metadata } from 'next';
import { RouteRedirect } from '../../RouteRedirect';

export const metadata: Metadata = { title: 'Credential Corpus has moved' };

export default function Page() {
  return <RouteRedirect label="Credential Corpus" href="/report/corpus/" />;
}
