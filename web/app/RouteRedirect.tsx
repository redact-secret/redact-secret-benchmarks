'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { PageHead } from '../components/page';

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

/** Static compatibility pages keep bookmarks working before the host adopts the canonical routes. */
export function RouteRedirect({ href, label }: { href: string; label: string }) {
  useEffect(() => {
    window.location.replace(`${BASE_PATH}${href}${window.location.search}${window.location.hash}`);
  }, [href]);
  return <PageHead title={`${label} has moved`} lede="Follow the link to the page at its new address." actions={<Link href={href}>Open {label}</Link>} />;
}
