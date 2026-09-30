'use client';

import { useMemo, useState } from 'react';
import { RetryNote } from '../../components/feedback';
import { FixtureTable, ReportFilterBar } from '../../components/report';
import type { ReportShow } from '../../components/report/types';
import { cx } from '../../lib/cx';
import { useBuildData, warmBuildData } from '../../lib/build-data';
import { PAGE_SIZE, filterRows, isListLevel, rowsQueryString, type RowsQuery, type RowsScanners } from '../../resolvers/filters';
import { isRowsData, type RowsData, type RowsSource } from '../../resolvers/rowdata';
import { expandRows } from '../../resolvers/rows';
import { isSuiteRecordsFile } from '../../resolvers/fixtures';
import { failureText } from './dataFailure';
import styles from './Rows.module.css';
import { useRowsQuery } from './useRowsQuery';

export interface RowsViewProps {
  /** The first page of the table, and the path of the file that holds every row when there are more than a page. */
  rows: RowsSource;
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
  /** A build-emitted records file to start loading when a reader points at or focuses a row link (the suite's fixture records). */
  warm?: string;
}

/**
 * A table of fixture rows narrowed and paged from the URL. The page paints the first page of
 * the default view as HTML; every row comes from one build-emitted file, fetched once per session
 * (`lib/build-data.ts`) at an idle moment, or at once when the address asks for another view. Find,
 * show, level, scanner scope and page only choose which rows to draw, so a shared link reproduces
 * the view and a change costs no request after the file is in.
 *
 * Until the file is here the rows already drawn stay on screen and dim after a short delay, the
 * count says "Loading rows", and the controls keep the choice the reader made; nothing moves. A
 * failure says why, offers a retry and leaves the first page readable. A page change is a history
 * entry, so Back returns to the previous page. Without script the first page is all there is, and
 * a line says so.
 */
export function RowsView({ rows: source, name, title, description, facts, factsByLevel, levels, defaultScanners, showOptions, placeholder = 'fixture, suite, kind', emptyTitle, emptyText, anchor, warm }: RowsViewProps) {
  const { query, page: requested, update, goToPage } = useRowsQuery(defaultScanners);
  const [touched, setTouched] = useState(false);
  const asksForMore = requested > 1 || rowsQueryString(query, defaultScanners) !== '';
  // A file from another build than this page (the site was updated while it was open) has another row count: refuse it.
  const isThisBuild = useMemo(() => (value: unknown): value is RowsData => isRowsData(value) && value.items.length === source.total, [source.total]);
  const load = useBuildData(source.src ?? null, isThisBuild, asksForMore || touched ? 'now' : 'idle');

  // `full` is every row; until it is here, `head` (the first page of the default view) is what is drawn.
  const full = source.src ? load.data : source.head;
  const data = full ?? source.head;
  const pending = !full && asksForMore;
  const failed = pending && load.status === 'error';
  const shown: RowsQuery = full ? query : { q: '', show: 'all', level: 'all', scanners: defaultScanners };

  const filtered = full ? filterRows(full, shown) : undefined;
  const count = filtered ? filtered.items.length : source.total;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = full ? Math.min(requested, pageCount) : 1;
  const visible = expandRows(data, filtered ? filtered.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : data.items);
  const resultText = failed ? 'Rows not loaded' : pending ? 'Loading rows…' : filtered ? filtered.resultText : `${source.total.toLocaleString('en-US')} of ${source.total.toLocaleString('en-US')} rows`;

  const go = (next: number) => {
    goToPage(next);
    document.getElementById(anchor)?.scrollIntoView({ block: 'start' });
  };
  const problem = failed ? failureText(load.failure, 'the rest of the rows', 'The first page stays readable; find, filters and paging need the rest.') : undefined;

  return (
    <div id={anchor} onPointerOver={warm ? event => { if ((event.target as Element).closest('a')) warmBuildData(warm, isSuiteRecordsFile); } : undefined} onFocusCapture={warm ? event => { if ((event.target as Element).closest('a')) warmBuildData(warm, isSuiteRecordsFile); } : undefined}>
      <div onPointerEnter={() => setTouched(true)} onFocusCapture={() => setTouched(true)}>
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
      </div>
      {source.src && <noscript><p className={styles.noscript}>Find, filters and paging need JavaScript. This is the first {data.items.length.toLocaleString('en-US')} of {source.total.toLocaleString('en-US')} rows.</p></noscript>}
      <div className={cx(styles.body, pending && !failed && styles.pending)} aria-busy={pending && !failed ? true : undefined}>
        {problem && <RetryNote title={problem.title} retryLabel={problem.retryLabel} onRetry={problem.reload ? () => window.location.reload() : load.retry}>{problem.detail}</RetryNote>}
        <FixtureTable
          familyName={name}
          title={title}
          description={description}
          facts={shown.level !== 'all' ? factsByLevel?.[shown.level] ?? facts : facts}
          rows={visible}
          scanners={shown.scanners === 'all' ? data.scanners : undefined}
          emptyTitle={count === 0 && source.total > 0 ? 'No rows match' : emptyTitle}
          emptyText={count === 0 && source.total > 0 ? 'Clear the search or choose another view.' : emptyText}
          emptyBadge={source.total === 0}
          pager={count > PAGE_SIZE ? { page, pageCount, total: count, pageSize: PAGE_SIZE, onPrevious: () => go((full ? page : requested) - 1), onNext: () => go((full ? page : requested) + 1) } : undefined}
        />
      </div>
    </div>
  );
}
