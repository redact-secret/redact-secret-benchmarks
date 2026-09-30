'use client';

import { useCallback, useEffect, useState } from 'react';
import { FixtureTable } from '../../../../components/report';
import type { FixtureRowData } from '../../../../components/report/types';
import { PAGE_SIZE, pageOf } from '../../../../resolvers/filters';

export interface FamilyRowsProps {
  familyName: string;
  rows: FixtureRowData[];
  facts?: { term: string; value: string }[];
  description: string;
}

const readPage = (pageCount: number) => pageOf(new URLSearchParams(window.location.search).get('page'), pageCount);

/**
 * The fixture rows of one family, paged from the URL (`?page=2`). Every row is
 * pre-rendered into the page as data and the first page as HTML; paging slices
 * the rows already there, so it needs no request. A page change is a history
 * entry, so Back returns to the previous page of rows.
 */
export function FamilyRows({ familyName, rows, facts, description }: FamilyRowsProps) {
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const [page, setPage] = useState(1);
  useEffect(() => {
    const read = () => setPage(readPage(pageCount));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [pageCount]);
  const go = useCallback((next: number) => {
    const url = next === 1 ? window.location.pathname : `${window.location.pathname}?page=${next}`;
    window.history.pushState(window.history.state, '', url);
    setPage(next);
    document.getElementById('family-rows')?.scrollIntoView({ block: 'start' });
  }, []);
  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  return (
    <div id="family-rows">
      <FixtureTable
        familyName={familyName}
        rows={visible}
        description={description}
        facts={facts}
        pager={rows.length > PAGE_SIZE ? { page, pageCount, total: rows.length, pageSize: PAGE_SIZE, onPrevious: () => go(page - 1), onNext: () => go(page + 1) } : undefined}
      />
    </div>
  );
}
