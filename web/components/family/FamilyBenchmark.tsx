import Link from 'next/link';
import { DataTable, KeyValueList } from '../data';
import type { DataTableColumn } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { cx } from '../../lib/cx';
import styles from './FamilyBenchmark.module.css';
import type { FamilyBenchmarkData, FamilyCountsRow, FamilyScannerRow } from './types';

export interface FamilyBenchmarkProps extends FamilyBenchmarkData {
  className?: string;
}

const countColumns = <Row extends FamilyCountsRow>(rows: Row[]): DataTableColumn<Row>[] => [
  { key: 'fixtures', header: 'Fixtures', numeric: true, cell: r => r.fixtures },
  { key: 'left', header: 'Left readable', numeric: true, cell: r => r.leftReadable },
  { key: 'much', header: 'Too much', numeric: true, cell: r => r.tooMuch },
  { key: 'alarms', header: 'False alarms', numeric: true, cell: r => r.falseAlarms },
  ...(rows.some(r => r.notMeasured) ? [{ key: 'unmeasured', header: 'Not measured', numeric: true, cell: (r: Row) => r.notMeasured ?? '0' }] : []),
];

const levelColumns = (rows: FamilyCountsRow[]): DataTableColumn<FamilyCountsRow>[] => [
  { key: 'level', header: 'Evidence level', rowHeader: true, cell: r => <>{r.label}{r.detail && <small>{r.detail}</small>}</> },
  ...countColumns(rows),
];

const scannerColumns = (rows: FamilyScannerRow[]): DataTableColumn<FamilyScannerRow>[] => [
  {
    key: 'scanner',
    header: 'Scanner',
    rowHeader: true,
    cell: r => (
      <span className={styles.scanner}>
        {r.label}
        <small>{r.kind}{r.detail ? ` · ${r.detail}` : ''}</small>
        <small>{r.rules}</small>
      </span>
    ),
  },
  ...countColumns(rows),
];

/**
 * What the ledger recorded on a family's fixtures: the counts for redact-secret at each evidence level
 * and each scanner's counts on the same fixtures, in run order. The mode (published or candidate) is
 * stated. A scanner's own rules are named under its name, because a scanner with no rule for a family
 * has nothing to report on it; the table never orders, highlights or sums scanners. A family with no
 * fixtures is a dashed "Not measured" box, never a row of zeros.
 */
export function FamilyBenchmark({ mode, facts, kinds, levels, scanners, runNote, rowsHref, className }: FamilyBenchmarkProps) {
  const description = mode
    ? <>Fixture rows on the current run. Counts are for redact-secret in <b>{mode}</b> mode.</>
    : 'No benchmark run is published for this checkout, so no count here is measured.';
  return (
    <Section title="In this benchmark" description={description} className={cx(styles.bench, className)}>
      {facts.length === 0 ? (
        <EmptyState title="No fixtures in this family yet">
          <p>Nothing in the corpus targets it, so nothing is measured and no coverage is claimed.</p>
          <p><StatusBadge status="not-measured">Not measured</StatusBadge></p>
        </EmptyState>
      ) : (
        <div className={styles.body}>
          <KeyValueList variant="facts" items={facts.map(f => ({ term: f.term, description: f.value }))} />
          <p className={styles.small}>
            {kinds}
            {rowsHref && <> <Link href={rowsHref}>See every row</Link></>}
          </p>
          {runNote && <p className={styles.small}>{runNote}</p>}
          {levels.length > 1 && (
            <DataTable<FamilyCountsRow> columns={levelColumns(levels)} rows={levels} getRowKey={r => r.id} caption="redact-secret fixture counts by evidence level" stackOnPhone={false} />
          )}
          {scanners.length > 0 && (
            <div className={styles.scanners}>
              <h3 className={styles.h3}>Every scanner on the same fixtures</h3>
              <p className={styles.small}>In run order. Counts are what each scanner recorded on this family&apos;s fixtures, whichever rules it has; a scanner with no rule for the family has nothing to report on it.</p>
              <DataTable<FamilyScannerRow> columns={scannerColumns(scanners)} rows={scanners} getRowKey={r => r.id} caption="Counts per scanner on this family's fixtures" wide stackOnPhone={false} />
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
