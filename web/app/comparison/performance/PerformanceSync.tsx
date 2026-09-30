'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { peerOf, settingOf } from '../../../resolvers/performance';

/**
 * Mirrors `?with=` and `?setting=` onto the root element, where Performance.module.css picks which
 * pre-rendered panel is visible. The first paint is handled by the inline script in the page; this covers
 * navigation inside the app, where that script does not run again. Renders nothing.
 */
export function PerformanceSync() {
  const params = useSearchParams();
  const peer = peerOf(params.get('with'));
  const setting = settingOf(params.get('setting'));
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.peer = peer;
    root.dataset.setting = setting;
    return () => { delete root.dataset.peer; delete root.dataset.setting; };
  }, [peer, setting]);
  return null;
}
