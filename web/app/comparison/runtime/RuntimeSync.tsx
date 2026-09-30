'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { analysisOf, domainOf, viewOf } from '../../../resolvers/comparison';

/**
 * Mirrors `?analysis=`, `?domain=` and `?view=` onto the root element, where
 * Runtime.module.css picks which pre-rendered panel is visible. The first paint is
 * handled by the inline script in the page; this covers navigation inside the app,
 * where that script does not run again. Renders nothing.
 */
export function RuntimeSync() {
  const params = useSearchParams();
  const analysis = analysisOf(params.get('analysis'));
  const domain = domainOf(params.get('domain'));
  const view = viewOf(params.get('view'));
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.analysis = analysis;
    root.dataset.domain = domain;
    root.dataset.view = view;
    return () => { delete root.dataset.analysis; delete root.dataset.domain; delete root.dataset.view; };
  }, [analysis, domain, view]);
  return null;
}
