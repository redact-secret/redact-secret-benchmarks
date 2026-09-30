'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { pairQueryOf, panelKey, type PairOptions } from '../../../resolvers/accuracy';

/**
 * Mirrors `?data=&with=&level=&scope=&peers=` onto the root element as one key, where the
 * page's stylesheet picks which pre-rendered panel is visible. The first paint is handled by the
 * inline script in the page; this covers navigation inside the app, where that script does
 * not run again. Renders nothing.
 */
export function AccuracySync({ options }: { options: PairOptions }) {
  const params = useSearchParams();
  const key = panelKey(pairQueryOf(params, options));
  useEffect(() => {
    document.documentElement.dataset.accKey = key;
    return () => { delete document.documentElement.dataset.accKey; };
  }, [key]);
  return null;
}
