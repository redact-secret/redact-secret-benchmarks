import type { Metadata } from 'next';
import { RoutePage, routeEntry } from '../../RoutePage';

const HREF = '/report/families/';
export const metadata: Metadata = { title: routeEntry(HREF).title };

export default function Page() {
  return <RoutePage href={HREF} pick={s => [
    { label: 'Families in the taxonomy', value: String(s.families) },
    { label: 'Naming a detector', value: String(s.familiesWithDetector) },
  ]} />;
}
