import { cx } from '../../lib/cx';
import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Note } from '../feedback';
import { Section } from '../layout';
import type { OwnRunRow } from './performance-types';
import styles from './PerformanceOwn.module.css';

export interface PerformanceOwnProps {
  title: string;
  description: string;
  /** Why these times are not set beside the pair above: another run, another machine, another protocol. */
  apart: string;
  /** redact-secret's Node surface rows, from the accepted run the Performance page reads. Empty when that run is not committed. */
  rows: OwnRunRow[];
  /** "Accepted run of da69ebf5090e, 5 repetitions, AMD EPYC 9V45, 4 CPUs". */
  source: string;
  /** Set when the run is absent or failed its check. */
  empty?: string;
  className?: string;
}

/** redact-secret on its own: the throughput the Performance page records. Its protocol stays separate from peer comparisons. */
export function PerformanceOwn({ title, description, apart, rows, source, empty, className }: PerformanceOwnProps) {
  const columns: DataTableColumn<OwnRunRow>[] = [
    { key: 'text', header: 'Text', rowHeader: true, cell: r => <><code>{r.profile}</code><small className={styles.sub}>{r.fed}</small></> },
    { key: 'median', header: 'redact-secret, usual time', label: 'redact-secret, usual time', numeric: true, cell: r => <><b>{r.median}</b><small className={styles.sub}>{r.spread}</small></> },
    { key: 'p95', header: '95th percentile', label: '95th percentile', numeric: true, cell: r => r.p95 },
    { key: 'speed', header: 'Speed', label: 'Speed', numeric: true, cell: r => <>{r.speed}<small className={styles.sub}>{r.runs}</small></> },
  ];
  return (
    <Section className={cx(styles.own, className)} title={title} headingLevel={2} rule="strong" description={description}>
      <Note>{apart}</Note>
      {empty ? (
        <Note title="Not measured yet" tone="warning">{empty}</Note>
      ) : (
        <DataTable columns={columns} rows={rows} getRowKey={r => r.id} caption={title} wide />
      )}
      <p className={styles.text}>{source}</p>
    </Section>
  );
}
