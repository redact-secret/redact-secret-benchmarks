'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { checksQueryOf } from '../../../../../resolvers/evaluation-checks-view';

/**
 * Mirrors "the address names a list" onto the root element as `data-checks`, where Checks.module.css picks whether the method's index
 * of lists or one list is visible. The first paint is handled by the inline script in the page; this covers navigation inside the app,
 * where that script does not run again. Renders nothing.
 */
export function ChecksSync() {
  const named = checksQueryOf(useSearchParams()) !== null;
  useEffect(() => {
    const root = document.documentElement;
    if (named) root.dataset.checks = '1'; else delete root.dataset.checks;
    return () => { delete root.dataset.checks; };
  }, [named]);
  return null;
}
