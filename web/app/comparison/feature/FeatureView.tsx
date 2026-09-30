'use client';

import { useCallback, useEffect, useState } from 'react';
import { FeatureComparison, type FeatureComparisonProps } from '../../../components/comparison';
import type { FeatureFilter } from '../../../components/comparison/types';
import { featureFilterOf, featureFilterString } from '../../../resolvers/comparison';

/**
 * The feature table with its row filter kept in the URL (`?rows=differences`).
 * Every row is already in the page; the first paint is the default (all rows),
 * which is what a reader without script gets. After hydration the URL is read
 * once, so a shared link reproduces the view, and a change rewrites the address
 * with `history.replaceState`: no navigation and no request.
 */
export function FeatureView(props: Omit<FeatureComparisonProps, 'filter' | 'onFilterChange'>) {
  const [filter, setFilter] = useState<FeatureFilter>('all');
  useEffect(() => {
    const read = () => setFilter(featureFilterOf(new URLSearchParams(window.location.search)));
    read();
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, []);
  const change = useCallback((next: FeatureFilter) => {
    setFilter(next);
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${featureFilterString(next)}${window.location.hash}`);
  }, []);
  return <FeatureComparison {...props} filter={filter} onFilterChange={change} />;
}
