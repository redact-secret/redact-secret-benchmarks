import Image from 'next/image';
import Link from 'next/link';
import type { Section } from '../../lib/routes';
import { ThemeToggle } from './ThemeToggle';
import styles from './SiteHeader.module.css';

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
          <Image className={styles.logoLight} src={`${BASE}/logo-light.svg`} alt="" width={944} height={817} priority unoptimized />
          <Image className={styles.logoDark} src={`${BASE}/logo-dark.svg`} alt="" width={944} height={817} priority unoptimized />
          <span className={styles.sub}>Benchmarks</span>
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
      <nav className={styles.tabs} aria-label="Primary, bottom bar">
        <ul className={styles.tabList}>
          {sections.map(s => (
            <li key={s.href}>
              <Link className={styles.tab} href={s.href} aria-current={currentPath.startsWith(s.href) ? 'page' : undefined}>{s.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
