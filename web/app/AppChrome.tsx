'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SectionNav, SiteFooter, SiteHeader } from '../components/shell';
import { FOOTER_GROUPS, FOOTER_LINKS, LICENSE_HREF } from '../lib/site';
import { normalizePath, sectionFor, SECTIONS } from '../lib/routes';
import styles from './AppChrome.module.css';

/** Connects the pure shell components to the router; the only place the app reads the pathname. `build` is the run line the layout resolved, or null. */
export function AppChrome({ children, build = null }: { children: ReactNode; build?: string | null }) {
  const path = normalizePath(usePathname());
  const section = sectionFor(path);
  const quickLinks: Record<string, string[]> = {
    Report: ['/report/', '/report/providers/', '/report/detectors/'],
    Comparison: ['/comparison/scanner/', '/comparison/performance/', '/comparison/accuracy/'],
    Evaluation: ['/evaluation/method/', '/evaluation/credential/', '/evaluation/pii/'],
  };
  const quickSection = section && { ...section, entries: quickLinks[section.label].map(href => SECTIONS.flatMap(section => section.entries).find(entry => entry.href === href)!).filter(Boolean) };
  return (
    <>
      <SiteHeader sections={SECTIONS} currentPath={path} />
      <div className={styles.page}>
        {quickSection && <SectionNav section={quickSection} currentPath={path} />}
        <main id="content" className={styles.main}>{children}</main>
      </div>
      <SiteFooter
        links={FOOTER_LINKS}
        groups={FOOTER_GROUPS}
        currentPath={path}
        legal={<>© 2026 Omiologic · Benchmark code and data under the <a href={LICENSE_HREF} rel="noreferrer">MIT License</a>. This site records measurements and does not assert product output.</>}
        build={build}
      />
    </>
  );
}
