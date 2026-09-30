import type { Metadata } from 'next';
import { RoutePage, routeEntry } from '../../RoutePage';

const HREF = '/report/providers/';
export const metadata: Metadata = { title: routeEntry(HREF).title };

export default function Page() {
  return <RoutePage href={HREF} pick={s => [{ label: 'Providers in the taxonomy', value: String(s.providers) }]} />;
}
