'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Mirrors `?fixture=` onto the root element as `data-fixture`, where Suite.module.css picks
 * whether the suite's rows or one fixture's page is visible. The first paint is handled by the
 * inline script in the page (no flash of the rows); this covers navigation inside the app,
 * where that script does not run again. Renders nothing.
 */
export function FixtureSync() {
  const fixture = useSearchParams().get('fixture');
  useEffect(() => {
    const root = document.documentElement;
    if (fixture) root.dataset.fixture = '1'; else delete root.dataset.fixture;
    return () => { delete root.dataset.fixture; };
  }, [fixture]);
  return null;
}
