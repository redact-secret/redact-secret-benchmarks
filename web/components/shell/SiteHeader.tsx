import Image from 'next/image';
import Link from 'next/link';
import type { Section } from '../../lib/routes';
import { ThemeToggle } from './ThemeToggle';
import styles from './SiteHeader.module.css';

export interface SiteHeaderProps {
  /** The global entrances, in order. */
  sections: Section[];
  /** Path of the current page; the entrance that contains it is marked current. */
  currentPath: string;
}

/** The logo, the global entrances and the theme choice. Pure render: the caller supplies the path. */
export function SiteHeader({ sections, currentPath }: SiteHeaderProps) {
  return (
    <header className={styles.header}>
      <a className={styles.skip} href="#content">Skip to content</a>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/" aria-label="Redact Secret benchmarks, home">
          {/* The canonical lockup, unchanged: public/logo-light.svg and logo-dark.svg differ only in wordmark ink. The theme picks which one shows. */}
          <Image className={styles.logoLight} src="/logo-light.svg" alt="" width={944} height={817} priority unoptimized />
          <Image className={styles.logoDark} src="/logo-dark.svg" alt="" width={944} height={817} priority unoptimized />
        </Link>
        <nav className={styles.nav} aria-label="Primary">
          <ul className={styles.list}>
            {sections.map(s => {
              const current = currentPath.startsWith(s.href);
              return (
                <li key={s.href}>
                  <Link className={styles.link} href={s.href} aria-current={current ? 'page' : undefined}>{s.label}</Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className={styles.tools}><ThemeToggle /></div>
      </div>
    </header>
  );
}
