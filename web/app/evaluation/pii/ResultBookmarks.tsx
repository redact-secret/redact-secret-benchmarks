'use client';

import { useEffect } from 'react';
import Link from 'next/link';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Recorded result anchors keep their selections when followed from the old overview. */
export function ResultBookmarks({ anchors }: { anchors: string[] }) {
  useEffect(() => {
    const follow = () => {
      let anchor: string;
      try { anchor = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
      if (anchor && anchors.includes(anchor)) {
        window.location.replace(`${BASE_PATH}/evaluation/pii/results/${window.location.search}${window.location.hash}`);
      }
    };
    follow();
    window.addEventListener('hashchange', follow);
    return () => window.removeEventListener('hashchange', follow);
  }, [anchors]);
  return <noscript><p>Recorded result bookmarks now open on <Link href="/evaluation/pii/results/">Personal-data measurement results</Link>.</p></noscript>;
}
