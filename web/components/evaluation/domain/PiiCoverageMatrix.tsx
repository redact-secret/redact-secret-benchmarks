import { cx } from '../../../lib/cx';
import styles from './PiiCoverageMatrix.module.css';

export interface PiiCoverageMatrixData {
  panels: {
    id: string; title: string; snapshot: string; identity: string; note: string;
    summaries: { id: string; label: string; value: string; rowIds: string[] }[];
    slices: string[];
    rows: {
      id: string; kind: string; label: string; state: string; domain: string;
      counts: string; capability: string; mapping: string; observation: string;
      reasons: string; sources: { label: string; href: string }[];
    }[];
  }[];
  delta: { title: string; identity: string; notes: string[]; changes: { id: string; text: string }[] } | null;
}

/** All source kinds stay in the default HTML, including kinds without measurements. */
export function PiiCoverageMatrix({ panels, delta, className }: PiiCoverageMatrixData & { className?: string }) {
  return <section className={cx(styles.section, className)} aria-label="Full evidence coverage matrix">
    <h2>Every kind exposed by the evidence</h2>
    <p>Coverage describes this exact public evidence population. It does not grant product support qualification. Kind counts are not detection accuracy.</p>
    {panels.map(panel => <section key={panel.id} id={panel.id} data-coverage-panel={panel.id} data-coverage-snapshot={panel.snapshot} className={styles.panel} aria-labelledby={`${panel.id}-title`}>
      <h3 id={`${panel.id}-title`}>{panel.title}</h3>
      <p>{panel.note}</p>
      <details><summary>Exact source and measurement identities</summary><p className={styles.identity}>{panel.identity}</p></details>
      <dl className={styles.summary}>{panel.summaries.map(summary => <div key={summary.id} data-coverage-summary={summary.id} data-coverage-value={summary.value}>
        <dt>{summary.label}</dt><dd>{summary.value}</dd>
        {summary.rowIds.length > 0 && <dd className={styles.links}>{summary.rowIds.map(id => <a key={id} href={`#${id}`}>{panel.rows.find(row => row.id === id)?.label ?? id}</a>)}</dd>}
      </div>)}</dl>
      <p>Domain, jurisdiction, capability and loss memberships may overlap. Do not sum overlapping slices as unique kinds.</p>
      {panel.slices.map(text => <p key={text}>{text}</p>)}
      {!panel.rows.length && <p>No source-exposed kinds. Ratios are unavailable because the denominator is empty.</p>}
      <ul className={styles.rows}>{panel.rows.map(row => <li key={row.id} id={row.id} data-coverage-kind={row.kind} data-coverage-state={row.state}>
        <h4>{row.label} <code>{row.kind}</code></h4>
        <p><strong>{row.state}</strong> · {row.domain}</p>
        <p>{row.counts}</p>
        <p>Product capability: {row.capability}</p>
        <p>Evaluator: {row.mapping}</p>
        <p>Observation: {row.observation}</p>
        <details><summary>Reasons and source evidence for {row.label}</summary>
          <p>{row.reasons}</p>
          <ul>{row.sources.map(source => <li key={source.href}><a href={source.href}>{source.label}</a></li>)}</ul>
        </details>
      </li>)}</ul>
    </section>)}
    {delta && <section className={styles.panel} aria-label="Snapshot denominator delta" data-coverage-delta="true">
      <h3>{delta.title}</h3><p className={styles.identity}>{delta.identity}</p>
      {delta.notes.map(note => <p key={note}>{note}</p>)}
      <ul>{delta.changes.map(change => <li key={change.id}>{change.text}</li>)}</ul>
    </section>}
  </section>;
}
