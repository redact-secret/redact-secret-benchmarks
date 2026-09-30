'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { pageOf, rowsQueryOf, rowsQueryString, type RowsQuery, type RowsScanners } from '../../resolvers/filters';

const DEFAULT = (scanners: RowsScanners): RowsQuery => ({ q: '', show: 'all', level: 'all', scanners });

const withPage = (search: string, page: number): string => (page <= 1 ? search : `${search}${search ? '&' : '?'}page=${page}`);

/**
 * The search text, show choice, evidence level, scanner scope and page of a rows table,
 * kept in the URL (`?q=&show=&level=&scanners=&page=`).
 *
 * The static export pre-renders the default view (the first page of every row), so the
 * server HTML and the first client render agree and nothing shifts. After hydration the
 * URL is read once, so a shared link reproduces the view, and back/forward is followed.
 * A filter change rewrites the address with `history.replaceState` and returns to page 1;
 * a page change is a history entry (`pushState`), so Back returns to the previous page.
 * No change makes a request: every row is already in the page.
 */
export function useRowsQuery(defaultScanners: RowsScanners): {
  query: RowsQuery;
  page: number;
  update: (next: Partial<RowsQuery>) => void;
  goToPage: (page: number) => void;
} {
  const [state, setState] = useState<{ query: RowsQuery; page: number }>({ query: DEFAULT(defaultScanners), page: 1 });
  const latest = useRef(state);
  latest.current = state;
  useEffect(() => {
    const read = () => {
      const params = new URLSearchParams(window.location.search);
      setState({ query: rowsQueryOf(params, defaultScanners), page: pageOf(params.get('page'), Number.MAX_SAFE_INTEGER) });
    };
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [defaultScanners]);
  const update = useCallback((next: Partial<RowsQuery>) => {
    const query = { ...latest.current.query, ...next };
    latest.current = { query, page: 1 };
    setState(latest.current);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${rowsQueryString(query, defaultScanners)}${window.location.hash}`);
  }, [defaultScanners]);
  const goToPage = useCallback((page: number) => {
    latest.current = { ...latest.current, page };
    setState(latest.current);
    window.history.pushState(window.history.state, '', `${window.location.pathname}${withPage(rowsQueryString(latest.current.query, defaultScanners), page)}${window.location.hash}`);
  }, [defaultScanners]);
  return { query: state.query, page: state.page, update, goToPage };
}
