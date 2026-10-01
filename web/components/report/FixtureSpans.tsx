import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { StatusBadge } from '../feedback';
import { Code } from '../text';
import styles from './FixtureSpans.module.css';
import type { FixtureRange, FixtureSpanRow } from './fixtureTypes';

export interface FixtureSpansProps {
  rows: FixtureSpanRow[];
  /** Names the table: "Expected and reported spans". */
  caption?: string;
  className?: string;
}

const range = (r: FixtureRange) => (
  <span className={styles.range}>
    <Code>{r.range}</Code>
    <small className={styles.sub}>{r.size}</small>
  </span>
);

const columns: DataTableColumn<FixtureSpanRow>[] = [
  { key: 'span', header: 'Span', rowHeader: true, cell: r => <>{r.label}<small className={styles.sub}>{r.role}</small></> },
  {
    key: 'expected',
    header: 'Expected',
    cell: r => (r.expected
      ? <>{range(r.expected)}{r.expected.envelope && <small className={styles.sub}>envelope {r.expected.envelope}</small>}</>
      : <small className={styles.sub}>none expected</small>),
  },
  {
    key: 'reported',
    header: 'Reported',
    cell: r => (r.reported.length
      ? <span className={styles.ranges}>{r.reported.map(item => <span key={item.range}>{range(item)}</span>)}</span>
      : <small className={styles.sub}>{r.reportedNote}</small>),
  },
  {
    key: 'outcome',
    header: 'Outcome',
    cell: r => (r.outcome ? <><StatusBadge status={r.outcome.status}>{r.outcome.label}</StatusBadge>{r.outcomeNote && <small className={styles.sub}>{r.outcomeNote}</small>}</> : <small className={styles.sub}>{r.outcomeNote ?? 'not scored'}</small>),
  },
];

/**
 * Each expected span beside the ranges the product reported over it and the outcome the run recorded for
 * it, in UTF-8 byte offsets [start, end). A span nothing was reported over says "none reported", never a
 * blank. A fixture that expects no secret lists the ranges that were reported instead. Pure render.
 */
export function FixtureSpans({ rows, caption = 'Expected and reported spans', className }: FixtureSpansProps) {
  return <DataTable<FixtureSpanRow> className={className} columns={columns} rows={rows} getRowKey={r => r.label} caption={caption} />;
}
