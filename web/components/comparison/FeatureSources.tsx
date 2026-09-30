import { cx } from '../../lib/cx';
import { Section } from '../layout';
import type { FeatureSource } from './types';
import styles from './FeatureSources.module.css';

export interface FeatureSourcesProps {
  /** "Where this comes from". */
  title: string;
  sources: FeatureSource[];
  className?: string;
}

/** Where each column's claims come from: the doc, the version and the date read. A mark without a source does not ship. */
export function FeatureSources({ title, sources, className }: FeatureSourcesProps) {
  return (
    <Section className={cx(styles.sources, className)} title={title} headingLevel={3} rule="strong">
      {sources.length === 0 ? (
        <p className={styles.empty}>No sources recorded for this run.</p>
      ) : (
        <ul className={styles.list}>
          {sources.map(s => (
            <li key={s.name}>
              <b>{s.name}</b> {s.detail}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
