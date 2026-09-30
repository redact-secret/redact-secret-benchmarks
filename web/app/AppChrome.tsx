'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SectionNav, SiteHeader } from '../components/shell';
import { normalizePath, sectionFor, SECTIONS } from '../lib/routes';
import styles from './AppChrome.module.css';

/** Connects the pure shell components to the router; the only place the app reads the pathname. */
export function AppChrome({ children }: { children: ReactNode }) {
  const path = normalizePath(usePathname());
  const section = sectionFor(path);
  return (
    <>
      <SiteHeader sections={SECTIONS} currentPath={path} />
      <div className={styles.page}>
        {section && <SectionNav section={section} currentPath={path} />}
        <main id="content" className={styles.main}>{children}</main>
      </div>
      <footer className={styles.footer}>
        <p className={styles.note}>
          This site records measurements and does not assert product output. The redesign is built beside the existing site, which stays the published one until cutover.
        </p>
      </footer>
    </>
  );
}
