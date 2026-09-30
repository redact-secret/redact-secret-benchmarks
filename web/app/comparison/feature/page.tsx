import type { Metadata } from 'next';
import { RoutePage, routeEntry } from '../../RoutePage';

const HREF = '/comparison/feature/';
export const metadata: Metadata = { title: routeEntry(HREF).title };

export default function Page() {
  return <RoutePage href={HREF} pick={s => [{ label: 'redact-secret release', value: s.version }]} />;
}
