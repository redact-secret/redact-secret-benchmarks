'use client';

import { FixtureTable, ReportFilterBar } from '../../components/report';
import type { ReportShow } from '../../components/report/types';
import { PAGE_SIZE, filterRows, isListLevel, type RowsScanners } from '../../resolvers/filters';
import { expandRows, type RowsData } from '../../resolvers/rows';
import { useRowsQuery } from './useRowsQuery';

export interface RowsViewProps {
  data: RowsData;
  /** The name of what the rows belong to, for the table's region label. */
  name: string;
  title: string;
  description: string;
  facts?: { term: string; value: string }[];
  /** Headline counts per evidence level (`T1`...), for a table with a level control: the choice picks the counts that match its rows. */
  factsByLevel?: Record<string, { term: string; value: string }[]>;
  /** Named evidence levels to offer, each with the row count it holds. Omit for a table with no level control. */
  levels?: { value: string; label: string }[];
  /** Whether the table opens on redact-secret's column alone or on every scanner. */
  defaultScanners: RowsScanners;
  /** "Show" choices; the first is the default ("all"). */
  showOptions: { value: ReportShow; label: string }[];
  placeholder?: string;
  emptyTitle?: string;
  emptyText?: string;
  /** An id for the table's region, so a page change can scroll back to it. */
  anchor: string;
}

/**
 * A table of fixture rows narrowed and paged from the URL. Every row is pre-rendered into
 * the page as data and the first page as HTML; find, show, level, scanner scope and page
 * only choose which of them to draw, so none needs a request and a shared link reproduces
 * the view. A page change is a history entry, so Back returns to the previous page.
 */
export function RowsView({ data, name, title, description, facts, factsByLevel, levels, defaultScanners, showOptions, placeholder = 'fixture, suite, kind', emptyTitle, emptyText, anchor }: RowsViewProps) {
  const { query, page: requested, update, goToPage } = useRowsQuery(defaultScanners);
  const { items, resultText } = filterRows(data, query);
  const pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const page = Math.min(requested, pageCount);
  const visible = expandRows(data, items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE));
  const go = (next: number) => {
    goToPage(next);
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  };
  return (
    <div id={anchor}>
      <ReportFilterBar
        label={`Filter ${name}`}
        placeholder={placeholder}
        query={query.q}
        onQueryChange={q => update({ q })}
        show={query.show}
        onShowChange={show => update({ show })}
        showOptions={showOptions}
        resultText={resultText}
        levels={levels ? { label: 'Evidence level', options: levels, value: query.level, onChange: level => isListLevel(level) && update({ level }) } : undefined}
        scope={data.scanners.length > 1 ? {
          label: 'Scanners',
          options: [{ value: 'product', label: 'redact-secret only' }, { value: 'all', label: `Every scanner (${data.scanners.length})` }],
          value: query.scanners,
          onChange: value => (value === 'all' || value === 'product') && update({ scanners: value }),
        } : undefined}
      />
      <FixtureTable
        familyName={name}
        title={title}
        description={description}
        facts={query.level !== 'all' ? factsByLevel?.[query.level] ?? facts : facts}
        rows={visible}
        scanners={query.scanners === 'all' ? data.scanners : undefined}
        emptyTitle={items.length === 0 && data.items.length > 0 ? 'No rows match' : emptyTitle}
        emptyText={items.length === 0 && data.items.length > 0 ? 'Clear the search or choose another view.' : emptyText}
        emptyBadge={data.items.length === 0}
        pager={items.length > PAGE_SIZE ? { page, pageCount, total: items.length, pageSize: PAGE_SIZE, onPrevious: () => go(page - 1), onNext: () => go(page + 1) } : undefined}
      />
    </div>
  );
}
