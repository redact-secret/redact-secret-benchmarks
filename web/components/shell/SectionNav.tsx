import Link from 'next/link';
import type { Section } from '../../lib/routes';
import styles from './SectionNav.module.css';

export interface SectionNavProps {
  section: Section;
  /** Path of the current page. */
  currentPath: string;
}

/** The pages inside one entrance, with the section name as the way back to its overview. */
export function SectionNav({ section, currentPath }: SectionNavProps) {
  return (
    <nav className={styles.nav} aria-label={`${section.label} pages`}>
      <ul className={styles.list}>
        {section.entries.map(entry => (
          <li key={entry.href}>
            <Link className={styles.link} href={entry.href} aria-current={currentPath === entry.href ? 'page' : undefined}>
              {entry.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
