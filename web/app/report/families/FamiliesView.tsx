'use client';

import { FamilyTable, ReportFilterBar } from '../../../components/report';
import { filterFamilies, isListLevel } from '../../../resolvers/filters';
import type { LevelList } from '../../../resolvers/families';
import { useListQuery } from '../useListQuery';

/**
 * The family list with its find, level and show controls, narrowed from the URL.
 * Every level's list is pre-rendered into the page; the level control picks one, so a
 * level costs no request and a shared `?level=T2` link reproduces the view.
 */
export function FamiliesView({ levels }: { levels: LevelList[] }) {
  const [query, update] = useListQuery();
  const current = levels.find(l => l.level === query.level) ?? levels[0];
  const { items: shown, resultText } = filterFamilies(current.list.families, query);
  return (
    <>
      <ReportFilterBar
        label="Filter families"
        query={query.q}
        onQueryChange={q => update({ q })}
        show={query.show}
        onShowChange={show => update({ show })}
        levels={{ label: 'Evidence level', options: levels.map(l => ({ value: l.level, label: l.optionLabel })), value: current.level, onChange: level => isListLevel(level) && update({ level }) }}
        resultText={resultText}
      />
      <FamilyTable families={shown.map(i => i.row)} caption={current.level === 'all' ? 'Families' : `Families at one evidence level`} />
    </>
  );
}
