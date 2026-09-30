import Link from 'next/link';
import { cx } from '../../lib/cx';
import { Section } from '../layout';
import type { AccuracySource } from './accuracyTypes';
import styles from './AccuracySources.module.css';

export interface AccuracySourcesProps {
  /** "Where this comes from". */
  title: string;
  sources: AccuracySource[];
  className?: string;
}

/** Which run, versions and dates the page reads, and how a file is counted. Links stay inside the app. */
export function AccuracySources({ title, sources, className }: AccuracySourcesProps) {
  return (
    <Section title={title} headingLevel={3} rule="hairline" className={className}>
      <ul className={cx(styles.list)}>
        {sources.map(s => (
          <li key={s.text}>
            {s.text}
            {s.link && <> <Link className={styles.link} href={s.link.href}>{s.link.label}</Link>.</>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
