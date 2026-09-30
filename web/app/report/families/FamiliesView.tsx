'use client';

import { FamilyTable, ReportFilterBar } from '../../../components/report';
import { filterFamilies } from '../../../resolvers/filters';
import type { FamilyItem } from '../../../resolvers/families';
import { useListQuery } from '../useListQuery';

/** The family list with its find and show controls, narrowed from the URL. The full list is pre-rendered. */
export function FamiliesView({ items }: { items: FamilyItem[] }) {
  const [query, update] = useListQuery();
  const { items: shown, resultText } = filterFamilies(items, query);
  return (
    <>
      <ReportFilterBar label="Filter families" query={query.q} onQueryChange={q => update({ q })} show={query.show} onShowChange={show => update({ show })} resultText={resultText} />
      <FamilyTable families={shown.map(i => i.row)} caption="Families" />
    </>
  );
}
