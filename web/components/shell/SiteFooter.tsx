import type { ReactNode } from 'react';
import styles from './SiteFooter.module.css';

export interface FooterLink { label: string; href: string }

export interface SiteFooterProps {
  /** Where a reader goes beyond this site; each opens another site, so each says so with `rel`. */
  links: FooterLink[];
  /** Copyright, licence and the boundary sentence. */
  legal: ReactNode;
  /** Which run and product the pages were built from, as one line. Omitted when the build has no run to name. */
  build?: string | null;
}

/** The site footer: outside links, the legal line and, when there is one, which run the pages were built from. Pure render. */
export function SiteFooter({ links, legal, build }: SiteFooterProps) {
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <nav className={styles.links} aria-label="Footer">
          {links.map(l => <a key={l.href} href={l.href} rel="noreferrer">{l.label}</a>)}
        </nav>
        <p className={styles.legal}>{legal}</p>
        {build ? <p className={styles.build}>{build}</p> : null}
      </div>
    </footer>
  );
}
