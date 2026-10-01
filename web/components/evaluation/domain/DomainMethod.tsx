import { cx } from '../../../lib/cx';
import { DataTable, KeyValueList } from '../../data';
import { Disclosure } from '../../disclosure';
import { Note } from '../../feedback';
import { Section } from '../../layout';
import { Code, Eyebrow } from '../../text';
import styles from './DomainMethod.module.css';
import type { DomainMethodData, MetricRow, VocabularyRow } from './types';

export interface DomainMethodProps extends DomainMethodData {
  className?: string;
}

const columns = [
  { key: 'word', header: 'Word', cell: (row: VocabularyRow) => <Code>{row.word}</Code> },
  { key: 'meaning', header: 'Means', cell: (row: VocabularyRow) => row.meaning },
];

const metricColumns = [
  { key: 'id', header: 'Metric', rowHeader: true, cell: (row: MetricRow) => <Code>{row.id}</Code> },
  { key: 'population', header: 'Population', cell: (row: MetricRow) => row.population },
  { key: 'counts', header: 'Counts', cell: (row: MetricRow) => row.counts },
  { key: 'better', header: 'Better', cell: (row: MetricRow) => row.better },
];

/**
 * How a case is judged: four steps, the words an outcome or a level can take, who decides the expected answer,
 * the methods that build cases, and what "recorded, not graded" means for this domain. The same blocks in the same
 * order for both domains.
 */
export function DomainMethod({ title, steps, vocabularies, oracle, methods, metrics, recorded, className }: DomainMethodProps) {
  return (
    <Section title={title} className={cx(styles.method, className)}>
      <ol className={styles.steps}>
        {steps.map(step => (
          <li key={step.title} className={styles.step}>
            <b className={styles.stepTitle}>{step.title}</b>
            <span className={styles.stepText}>{step.text}</span>
          </li>
        ))}
      </ol>
      <div className={styles.pair}>
        {vocabularies.map(vocabulary => (
          <DataTable
            key={vocabulary.title}
            caption={vocabulary.title}
            showCaption
            columns={columns}
            rows={vocabulary.rows}
            getRowKey={row => row.word}
          />
        ))}
      </div>
      <div className={styles.pair}>
        <div className={styles.group}>
          <Eyebrow tone="muted">Who decides the expected answer</Eyebrow>
          <KeyValueList items={oracle.map(row => ({ term: row.term, description: row.text }))} />
        </div>
        <div className={styles.group}>
          <Eyebrow tone="muted">Methods that build cases</Eyebrow>
          <KeyValueList items={methods.map(row => ({ term: row.term, description: row.text }))} />
        </div>
      </div>
      <Disclosure variant="plain" summary={metrics.summary}>
        <div className={styles.metrics}>
          <p className={styles.metricsText}>{metrics.text}</p>
          <DataTable caption="Metric definitions" columns={metricColumns} rows={metrics.rows} getRowKey={row => row.id} wide />
        </div>
      </Disclosure>
      <Note title={recorded.title} tone="info">
        <p>{recorded.text}</p>
      </Note>
    </Section>
  );
}
