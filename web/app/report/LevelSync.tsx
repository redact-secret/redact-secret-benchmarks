'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Mirrors `?level=` and `?peers=` onto the root element, where Report.module.css
 * picks which pre-rendered level panel is visible. The first paint is handled by
 * the inline script in the page (no flash of another level); this covers
 * navigation inside the app, where that script does not run again. Renders nothing.
 */
export function LevelSync() {
  const params = useSearchParams();
  const level = params.get('level');
  const peers = params.get('peers');
  useEffect(() => {
    const root = document.documentElement;
    if (level === 'T2' || level === 'T3') root.dataset.level = level; else delete root.dataset.level;
    if (peers === '1') root.dataset.peers = '1'; else delete root.dataset.peers;
    return () => { delete root.dataset.level; delete root.dataset.peers; };
  }, [level, peers]);
  return null;
}
