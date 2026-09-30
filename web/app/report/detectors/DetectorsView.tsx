'use client';

import { DetectorList, ReportFilterBar } from '../../../components/report';
import type { DetectorRowData } from '../../../components/report/types';
import { count } from '../../../resolvers/format';
import { useListQuery } from '../useListQuery';

const SHOW = [
  { value: 'all' as const, label: 'All' },
  { value: 'signal' as const, label: 'At or below the minimum' },
];

/** The detector list with its find and show controls, narrowed from the URL. The whole list is pre-rendered. */
export function DetectorsView({ detectors }: { detectors: DetectorRowData[] }) {
  const [query, update] = useListQuery();
  const q = query.q.trim().toLowerCase();
  const shown = detectors.filter(d => (!q || `${d.title} ${d.id}`.toLowerCase().includes(q)) && (query.show !== 'signal' || !!d.flag));
  return (
    <>
      <ReportFilterBar
        label="Filter detectors"
        placeholder="GitHub, stripe, private key"
        query={query.q}
        onQueryChange={value => update({ q: value })}
        show={query.show === 'signal' ? 'signal' : 'all'}
        onShowChange={show => update({ show })}
        showOptions={SHOW}
        resultText={count(shown.length, 'detector')}
      />
      <DetectorList detectors={shown} caption="Detectors by fixture count" />
    </>
  );
}
