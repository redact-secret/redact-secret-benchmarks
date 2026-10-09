import type { Metadata } from 'next';
import { RouteRedirect } from '../../RouteRedirect';

export const metadata: Metadata = { title: 'Scanner comparison has moved' };

export default function Page() {
  return <RouteRedirect label="Scanner comparison" href="/comparison/scanner/" />;
}
