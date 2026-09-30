import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Pager } from '../nav';
import type { PagerProps } from '../nav';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FixtureTable.module.css';
import type { FixtureRowData } from './types';

export interface FixtureTableProps {
  /** The family's name, used in the region label. */
  familyName: string;
  /** The rows on this page. The parent paginated them. */
  rows: FixtureRowData[];
  /** "50 rows for redact-secret only. Other scanners are on the comparison pages." */
  description: string;
  /** Headline counts: fixtures, left readable, redacted too much, false alarms. Omit when the family has no fixtures. */
  facts?: { term: string; value: string }[];
  /** Pager position; omit for a single page. */
  pager?: Pick<PagerProps, 'page' | 'pageCount' | 'total' | 'pageSize' | 'previousHref' | 'nextHref' | 'onPrevious' | 'onNext'>;
  className?: string;
}

const columns: DataTableColumn<FixtureRowData>[] = [
  {
    key: 'fixture',
    header: 'Fixture',
    rowHeader: true,
    cell: r => (
      <>
        <Code>{r.slug}</Code>
        <small className={styles.sub}>{r.group}{r.alsoIn ? ` · ${r.alsoIn}` : ''}</small>
      </>
    ),
  },
  {
    key: 'kind',
    header: 'Kind and evidence',
    cell: r => (
      <>
        {r.kind}
        {r.evidence && <small className={styles.sub}>{r.evidence}</small>}
      </>
    ),
  },
  { key: 'outcome', header: 'redact-secret', cell: r => <StatusBadge status={r.outcome.status}>{r.outcome.label}</StatusBadge> },
];

/**
 * The rows behind one family: headline counts, the fixture table and a pager.
 * A family with no fixtures shows a dashed "Not measured" box, never a table of zeros.
 */
export function FixtureTable({ familyName, rows, description, facts, pager, className }: FixtureTableProps) {
  if (rows.length === 0) {
    return (
      <EmptyState className={className} title="No fixtures in this family yet">
        <p>Nothing in the corpus targets it, so nothing is measured and no coverage is claimed.</p>
        <p><StatusBadge status="not-measured">Not measured</StatusBadge></p>
      </EmptyState>
    );
  }
  return (
    <div className={cx(styles.wrap, className)}>
      {facts && facts.length > 0 && <KeyValueList variant="facts" items={facts.map(f => ({ term: f.term, description: f.value }))} />}
      <Section title="Fixtures in this family" description={description} rule="none" headingLevel={2}>
        <DataTable<FixtureRowData> columns={columns} rows={rows} getRowKey={r => r.slug} caption={`Fixtures in ${familyName}`} wide />
        {pager && <Pager itemLabel="rows" {...pager} />}
      </Section>
    </div>
  );
}
