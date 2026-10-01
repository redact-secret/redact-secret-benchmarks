import { DataTable } from '../../data';
import type { DataTableColumn } from '../../data';
import { StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { Code } from '../../text';
import { cx } from '../../../lib/cx';
import type { ScannerRosterRow } from './types';
import styles from './ScannerRoster.module.css';

export interface ScannerRosterProps {
  title: string;
  description: string;
  rows: ScannerRosterRow[];
  className?: string;
}

const NotRecorded = () => <StatusBadge status="not-measured">Not recorded</StatusBadge>;

const columns: DataTableColumn<ScannerRosterRow>[] = [
  { key: 'scanner', header: 'Scanner', rowHeader: true, cell: r => <a href={`#${r.id}`}>{r.name}</a> },
  { key: 'kind', header: 'Kind', cell: r => r.kind ?? <NotRecorded /> },
  { key: 'version', header: 'Version', cell: r => <Code>{r.version}</Code> },
  { key: 'pinned', header: 'Pinned in', cell: r => <Code>{r.pinnedIn}</Code> },
  { key: 'mode', header: 'Mode line of this run', cell: r => r.mode ?? <NotRecorded /> },
];

/** Every scanner the benchmark ran with, in the run's own order: kind, version, where the version is pinned, the mode line. No outcome, no sort. */
export function ScannerRoster({ title, description, rows, className }: ScannerRosterProps) {
  return (
    <Section title={title} description={description} className={cx(styles.roster, className)}>
      <DataTable<ScannerRosterRow>
        columns={columns}
        rows={rows}
        getRowKey={r => r.id}
        caption={title}
        wide
        empty="No scanner is recorded for this benchmark."
      />
    </Section>
  );
}
