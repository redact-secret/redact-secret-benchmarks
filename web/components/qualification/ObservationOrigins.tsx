import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Note, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import styles from './ObservationOrigins.module.css';
import type { ObservationOriginsProps, OriginRow } from './types';

const columns: DataTableColumn<OriginRow>[] = [
  { key: 'scanner', header: 'Scanner', rowHeader: true, cell: r => <><Code>{r.scanner}</Code><small className={styles.sub}>{r.population} · {r.artifact}</small></> },
  { key: 'origin', header: 'Origin of the observation', cell: r => (r.state === 'not-recorded' ? <StatusBadge status="not-measured">{r.origin}</StatusBadge> : r.origin) },
  { key: 'reason', header: 'Reason the engine gave', cell: r => r.reason },
  { key: 'receipt', header: 'Receipt', cell: r => r.receipt },
];

/**
 * Where each scanner's observation came from (#724): scanned in the run, or taken from an earlier verified run. This is provenance, read from the artifact's
 * non-semantic telemetry, and it is shown apart from the scope evidence: it changes no count, outcome, denominator or status. "Not recorded" is what the
 * artifact says when the run offered no observations for reuse; it is not read as fresh. An optional scanner the run did not measure has no origin and is
 * stated as not measured, never given one.
 */
export function ObservationOrigins({ title, description, notes, rows, omitted, empty }: ObservationOriginsProps) {
  return (
    <Section title={title} description={description}>
      <Note tone="info" title="How to read the origin">{notes.map(n => <p key={n}>{n}</p>)}</Note>
      <DataTable<OriginRow> columns={columns} rows={rows} getRowKey={r => r.key} caption={title} wide empty={empty} />
      {omitted.length > 0 && (
        <ul className={styles.omitted}>
          {omitted.map(o => <li key={o.key}>{o.statement}. It has no observation in this view, so no origin.</li>)}
        </ul>
      )}
    </Section>
  );
}
