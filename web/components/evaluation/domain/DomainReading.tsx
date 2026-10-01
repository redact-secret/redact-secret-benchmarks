import { cx } from '../../../lib/cx';
import { KeyValueList } from '../../data';
import { Section } from '../../layout';
import { Code } from '../../text';
import styles from './DomainReading.module.css';
import type { DomainReadingData } from './types';

export interface DomainReadingProps extends DomainReadingData {
  className?: string;
}

/**
 * How to read the numbers (six short definitions, not a repeat of the method) and the sources: the specs and records
 * the page rests on, shown as the paths they are at. Every source leaves the site and says so by its address.
 */
export function DomainReading({ title, items, sources, className }: DomainReadingProps) {
  return (
    <div className={cx(styles.reading, className)}>
      <Section title={title}>
        <KeyValueList items={items.map(row => ({ term: row.term, description: row.text }))} />
      </Section>
      <Section title="Sources" headingLevel={3} rule="hairline">
        <ul className={styles.sources} aria-label="Sources">
          {sources.map(source => (
            <li key={source.path} className={styles.source}>
              <a href={source.href} rel="noreferrer">{source.label}</a>
              <Code>{source.path}</Code>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
