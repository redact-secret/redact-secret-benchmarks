'use client';

import { ProviderTree, ReportFilterBar } from '../../../components/report';
import { filterProviders, isListLevel } from '../../../resolvers/filters';
import type { LevelList } from '../../../resolvers/families';
import { useListQuery } from '../useListQuery';

/**
 * The provider list with its find, level and show controls. Every level's list is
 * pre-rendered in the page; this island only picks and narrows it, from the URL.
 * Search or a narrowing choice opens every provider so the matches are visible.
 */
export function ProvidersView({ levels }: { levels: LevelList[] }) {
  const [query, update] = useListQuery();
  const current = levels.find(l => l.level === query.level) ?? levels[0];
  const { items: shown, resultText } = filterProviders(current.list.providers, query);
  return (
    <>
      <ReportFilterBar
        label="Filter providers"
        query={query.q}
        onQueryChange={q => update({ q })}
        show={query.show}
        onShowChange={show => update({ show })}
        levels={{ label: 'Evidence level', options: levels.map(l => ({ value: l.level, label: l.optionLabel })), value: current.level, onChange: level => isListLevel(level) && update({ level }) }}
        resultText={resultText}
      />
      {/* Keyed by the query so a changed filter re-opens the disclosures it should. */}
      <ProviderTree key={`${query.q}|${query.show}|${current.level}`} providers={shown.map(i => i.group)} expanded={!!query.q.trim() || query.show !== 'all'} label="Providers and their families" footnote={current.footnote} />
    </>
  );
}
