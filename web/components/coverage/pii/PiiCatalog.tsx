import { KeyValueList } from '../../data';
import { EmptyState, Note } from '../../feedback';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './PiiCatalog.module.css';

export interface PiiCatalogData {
  facts: { term: string; description: string }[];
  activation: { title: string; text: string }[];
  qualification: string;
  summary: string;
  limitations: string[];
  rows: { id: string; label: string; state: string; domains: string; jurisdictions: string; language: string; capability: string; measurement: string; limitations: string; href: string; declarationHref?: string }[];
  emptyReason: string;
}

/** A compact catalog of bound declarations, with the complete evidence inventory one link away. */
export function PiiCatalog({ facts, activation, qualification, summary, limitations, rows, emptyReason, className }: PiiCatalogData & { className?: string }) {
  return <div className={cx(styles.catalog, className)}>
    <Section title="Release and configuration"><KeyValueList items={facts} />
      {activation.map(item => <details key={item.title} className={styles.activation}>
        <summary>{item.title}</summary><Note title="Exact activation checks" tone="info"><p>{item.text}</p></Note>
      </details>)}
    </Section>
    <Note title="Product qualification has not been established" tone="info"><p>{qualification}</p><a href="/evaluation/pii/results/">Qualification, binding and protected execution details</a></Note>
    <Section title="Personal-data types in the bound catalog">
      <p data-pii-catalog-summary="true">{summary}</p>
      <p>Declared implementation, public synthetic measurement and product qualification describe separate records. Evidence taxonomy membership does not establish country or PHI support.</p>
      {!rows.length && <EmptyState title="Catalog unavailable">{emptyReason}</EmptyState>}
      <ul className={styles.rows}>{rows.map(row => <li key={row.id} className={styles.row} data-pii-catalog-kind={row.id}>
        <details><summary><span>{row.label}</span> <code>{row.id}</code> <strong>{row.state}</strong></summary>
        <KeyValueList items={[
          { term: 'Evidence domains', description: row.domains },
          { term: 'Evidence jurisdictions', description: row.jurisdictions },
          { term: 'Language and context requirements', description: row.language },
          { term: 'Declared implementation', description: row.capability },
          { term: 'Public synthetic measurement', description: row.measurement },
          { term: 'Limitations', description: row.limitations },
        ]} />
        <p><a href={row.href}>Exact kind evidence and reasons</a></p>
        {row.declarationHref && <p><a href={row.declarationHref}>Bound product declaration</a></p>}
        </details>
      </li>)}</ul>
    </Section>
    <Section title="Known limitations and unknown scope">
      <ul>{limitations.map(item => <li key={item}>{item}</li>)}</ul>
      <p><a href="/evaluation/pii/evidence/">Full evidence-kind inventory, including unsupported, deferred and unrepresentable kinds</a></p>
      <p><a href="/evaluation/pii/evidence/#coverage-proposed-baseline">Proposed snapshots and candidate builds, separately labelled</a></p>
      <p><a href="/evaluation/pii/">How PII is evaluated</a></p>
    </Section>
  </div>;
}
