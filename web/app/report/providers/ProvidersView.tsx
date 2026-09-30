'use client';

import { ProviderTree, ReportFilterBar } from '../../../components/report';
import { filterProviders } from '../../../resolvers/filters';
import type { ProviderItem } from '../../../resolvers/families';
import { useListQuery } from '../useListQuery';

/**
 * The provider list with its find and show controls. The whole list is
 * pre-rendered in the page; this island only narrows it, from the URL.
 * Search or a narrowing choice opens every provider so the matches are visible.
 */
export function ProvidersView({ items, footnote }: { items: ProviderItem[]; footnote: string }) {
  const [query, update] = useListQuery();
  const { items: shown, resultText } = filterProviders(items, query);
  return (
    <>
      <ReportFilterBar label="Filter providers" query={query.q} onQueryChange={q => update({ q })} show={query.show} onShowChange={show => update({ show })} resultText={resultText} />
      {/* Keyed by the query so a changed filter re-opens the disclosures it should. */}
      <ProviderTree key={`${query.q}|${query.show}`} providers={shown.map(i => i.group)} expanded={!!query.q.trim() || query.show !== 'all'} label="Providers and their families" footnote={footnote} />
    </>
  );
}
