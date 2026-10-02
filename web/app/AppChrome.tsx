'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SectionNav, SiteFooter, SiteHeader } from '../components/shell';
import { FOOTER_LINKS, LICENSE_HREF } from '../lib/site';
import { normalizePath, sectionFor, SECTIONS } from '../lib/routes';
import styles from './AppChrome.module.css';

/** Connects the pure shell components to the router; the only place the app reads the pathname. `build` is the run line the layout resolved, or null. */
export function AppChrome({ children, build = null }: { children: ReactNode; build?: string | null }) {
  const path = normalizePath(usePathname());
  const section = sectionFor(path);
  return (
    <>
      <SiteHeader sections={SECTIONS} currentPath={path} />
      <div className={styles.page}>
        {section && <SectionNav section={section} currentPath={path} />}
        <main id="content" className={styles.main}>{children}</main>
      </div>
      <SiteFooter
        links={FOOTER_LINKS}
        legal={<>© 2026 Omiologic · Benchmark code and data under the <a href={LICENSE_HREF} rel="noreferrer">MIT License</a>. This site records measurements and does not assert product output.</>}
        build={build}
      />
    </>
  );
}
