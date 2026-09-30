'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { listQueryOf, listQueryString, type ListQuery } from '../../resolvers/filters';

const DEFAULT: ListQuery = { q: '', show: 'all' };

/**
 * The search text and the show choice of a list, kept in the URL (`?q=&show=`).
 *
 * The static export pre-renders the default view (the whole list), so the server
 * HTML and the first client render agree and nothing shifts. After hydration the
 * URL is read once, so a shared link reproduces the view, and back/forward is
 * followed. Every change rewrites the address with `history.replaceState`: no
 * navigation and no request, because the whole list is already in the page.
 */
export function useListQuery(): [ListQuery, (next: Partial<ListQuery>) => void] {
  const [query, setQuery] = useState<ListQuery>(DEFAULT);
  const latest = useRef(query);
  latest.current = query;
  useEffect(() => {
    const read = () => setQuery(listQueryOf(new URLSearchParams(window.location.search)));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  const update = useCallback((next: Partial<ListQuery>) => {
    const merged = { ...latest.current, ...next };
    latest.current = merged;
    setQuery(merged);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${listQueryString(merged)}${window.location.hash}`);
  }, []);
  return [query, update];
}
