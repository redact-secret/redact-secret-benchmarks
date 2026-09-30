import Link from 'next/link';
import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code, CodeBlock, Eyebrow } from '../text';
import { cx } from '../../lib/cx';
import { FixtureBytes } from './FixtureBytes';
import styles from './FixtureDetail.module.css';
import type { ExpectedSpanRow, FixtureDetailData, ReportedRangesRow } from './types';

export interface FixtureDetailProps {
  fixture: FixtureDetailData;
  className?: string;
}

const spanColumns: DataTableColumn<ExpectedSpanRow>[] = [
  { key: 'range', header: 'Span', rowHeader: true, cell: r => <Code>{r.range}</Code> },
  { key: 'role', header: 'Role', cell: r => r.role },
  { key: 'value', header: 'Value', cell: r => <Code>{r.value}</Code> },
  {
    key: 'envelope',
    header: 'Envelope',
    cell: r => (r.envelope ? (
      <>
        <Code>{r.envelope.range}</Code>
        {r.envelope.reason && <small className={styles.sub}>{r.envelope.reason}</small>}
      </>
    ) : <small>the span itself</small>),
  },
  { key: 'note', header: 'Rationale', cell: r => r.note ?? '' },
];

const reportedColumns: DataTableColumn<ReportedRangesRow>[] = [
  {
    key: 'scanner',
    header: 'Scanner',
    rowHeader: true,
    cell: r => (
      <>
        <b>{r.scanner}</b>
        <small className={styles.sub}>{r.detail}</small>
      </>
    ),
  },
  {
    key: 'outcome',
    header: 'Outcome',
    cell: r => (
      <>
        <span className={styles.badges}>{r.outcome.map((o, i) => <StatusBadge key={i} status={o.status}>{o.label}</StatusBadge>)}</span>
        {r.code && <small className={styles.sub}>{r.code}</small>}
      </>
    ),
  },
  { key: 'ranges', header: 'Reported byte ranges', cell: r => <Code>{r.ranges}</Code> },
  { key: 'bytes', header: 'Bytes', cell: r => r.bytes ?? '—' },
];

/**
 * One fixture: what had to be redacted and how far a redaction may reach, what each
 * scanner actually covered, and why the expectation holds. Every value is what the
 * ledger and the run recorded; the page asserts nothing about a scanner. The bytes
 * are synthetic test data. Pure render: the parent chose the fixture.
 */
export function FixtureDetail({ fixture, className }: FixtureDetailProps) {
  const f = fixture;
  return (
    <div className={cx(styles.detail, className)}>
      <KeyValueList
        variant="rows"
        items={[
          { term: 'Suite', description: <Link href={f.suiteHref}>{f.suite}</Link> },
          { term: 'Kind and evidence', description: `${f.kind} · ${f.evidence}` },
          { term: 'Path', description: <Code>{f.path}</Code> },
          { term: 'Size', description: f.size },
          ...(f.detectors.length ? [{ term: 'Detectors', description: f.detectors.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link href={d.href}>{d.title}</Link></span>) }] : []),
          ...(f.families.length ? [{ term: 'Families', description: f.families.map((d, i) => <span key={d.id}>{i > 0 && ', '}<Link href={d.href}>{d.name}</Link></span>) }] : []),
        ]}
      />

      <FixtureBytes lines={f.lines} scanners={f.scanners} caption={f.caption} />

      {f.runProblem && <EmptyState title="No scanner results for these bytes">{f.runProblem}</EmptyState>}

      {f.expected.length > 0 && (
        <Section title="Expected spans and envelopes" description="An envelope is the widest range a finding may reach at no cost. It is authored with a reason, hashed with the corpus and never widened in response to a scanner." rule="none" headingLevel={2}>
          <DataTable<ExpectedSpanRow> columns={spanColumns} rows={f.expected} getRowKey={r => r.range} caption="Expected spans" wide />
        </Section>
      )}

      {f.reported.length > 0 && (
        <Section title="Reported ranges" description="Ranges and outcomes are recorded from the run. Matched values and raw scanner output are never exported." rule="none" headingLevel={2}>
          <DataTable<ReportedRangesRow> columns={reportedColumns} rows={f.reported} getRowKey={r => r.scanner} caption="Reported ranges" wide />
        </Section>
      )}

      <div className={styles.side}>
        <div className={styles.col}>
          <Eyebrow>Why this expectation</Eyebrow>
          <KeyValueList
            items={[
              ...f.facts.map(fact => ({ term: fact.term, description: fact.href ? <Link href={fact.href}>{fact.value}</Link> : fact.value })),
              ...(f.sources.length ? [{ term: 'Sources', description: f.sources.map((s, i) => <span key={s.href}>{i > 0 && ' · '}<a href={s.href}>{s.label}</a></span>) }] : []),
            ]}
          />
        </div>
        <div className={styles.col}>
          <Eyebrow>Reproduce</Eyebrow>
          <CodeBlock label="Command that reproduces this suite">{f.command}</CodeBlock>
          <details className={styles.escaped}>
            <summary>Escaped representation</summary>
            <CodeBlock variant="snippet" label="The exact bytes, escaped">{f.escaped}</CodeBlock>
          </details>
        </div>
      </div>
    </div>
  );
}
