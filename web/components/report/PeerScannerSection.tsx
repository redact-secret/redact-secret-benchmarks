import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Note, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Eyebrow } from '../text';
import { cx } from '../../lib/cx';
import styles from './PeerScannerSection.module.css';
import type { PeerScannerNotes, PeerScannerRow, Ratio } from './types';

export interface PeerScannerSectionProps {
  title: string;
  description: string;
  rows: PeerScannerRow[];
  notes: PeerScannerNotes;
  className?: string;
}

function RatioCell({ ratio }: { ratio: Ratio | null }) {
  if (!ratio) return <StatusBadge status="not-measured">Not measured</StatusBadge>;
  return (
    <>
      <b>{ratio.count}</b> of {ratio.of}{ratio.unit ? ` ${ratio.unit}` : ''}
      {ratio.note && <small>{ratio.note}</small>}
    </>
  );
}

const columns: DataTableColumn<PeerScannerRow>[] = [
  {
    key: 'scanner',
    header: 'Scanner',
    rowHeader: true,
    cell: r => (
      <>
        <b>{r.name} {r.version}</b>
        <small>{r.role}</small>
        <small>{r.blurb}</small>
      </>
    ),
  },
  { key: 'targeted', header: 'Inputs its rules target', numeric: true, cell: r => <RatioCell ratio={r.targeted} /> },
  { key: 'readable', header: 'Left readable on those inputs', numeric: true, cell: r => <RatioCell ratio={r.leftReadable} /> },
  { key: 'elsewhere', header: 'Left readable everywhere else', numeric: true, cell: r => <RatioCell ratio={r.elsewhere} /> },
  { key: 'safe', header: 'Safe values flagged', numeric: true, cell: r => <RatioCell ratio={r.safeFlagged} /> },
];

/**
 * What other scanners left readable on the same inputs, framed by the caveats a
 * reader needs first. Shows what each recorded; it never ranks scanners.
 */
export function PeerScannerSection({ title, description, rows, notes, className }: PeerScannerSectionProps) {
  return (
    <Section className={cx(styles.peers, className)} title={title} description={description} rule="hairline">
      <Note tone="warning" title={notes.caveatsTitle}>
        <ol className={styles.caveats}>
          {notes.caveats.map(c => (
            <li key={c.lead}><b>{c.lead}</b> {c.text}</li>
          ))}
        </ol>
      </Note>
      <DataTable<PeerScannerRow>
        className={styles.table}
        columns={columns}
        rows={rows}
        getRowKey={r => `${r.name} ${r.version}`}
        caption={title}
        wide
        empty="No other scanner has been run on these inputs."
      />
      <p className={styles.source}>{notes.source}</p>
      <div className={styles.quote}>
        <Eyebrow>{notes.quoteTitle}</Eyebrow>
        <p><StatusBadge status="fail">Don&apos;t</StatusBadge> {notes.quoteDont}</p>
        <p><StatusBadge status="pass">Do</StatusBadge> {notes.quoteDo}</p>
        <p className={styles.note}>{notes.quoteNote}</p>
      </div>
    </Section>
  );
}
