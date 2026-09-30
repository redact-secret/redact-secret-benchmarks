import type { Metadata } from 'next';
import { RoutePage, routeEntry } from '../RoutePage';

const HREF = '/report/';
export const metadata: Metadata = { title: routeEntry(HREF).title };

export default function Page() {
  return <RoutePage href={HREF} pick={s => [
    { label: 'Release', value: s.version },
    { label: 'Providers', value: String(s.providers) },
    { label: 'Families', value: String(s.families) },
  ]} />;
}
