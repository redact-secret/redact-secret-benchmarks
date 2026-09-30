import { cx } from '../../lib/cx';
import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Chip } from '../feedback';
import { Section } from '../layout';
import { MetaList } from '../page';
import type { MetaItem } from '../page';
import type { RuntimeColumn, RuntimeFactRow } from './types';
import styles from './RuntimeFacts.module.css';

export interface RuntimeFactsProps {
  /** "About the libraries" or "About the settings". */
  title: string;
  columns: RuntimeColumn[];
  rows: RuntimeFactRow[];
  /** The run behind the times: date, platform, how a time was taken. */
  run?: MetaItem[];
  /** What "Hidden" and "Switch off" mean, and where sizes come from. Plain sentences. */
  notes?: string[];
  className?: string;
}

/** What each library or setting is and where it runs, from packages and docs. States facts; grades nothing. */
export function RuntimeFacts({ title, columns, rows, run, notes, className }: RuntimeFactsProps) {
  const tableColumns: DataTableColumn<RuntimeFactRow>[] = [
    { key: 'fact', header: '', label: 'Fact', rowHeader: true, cell: row => row.label },
    ...columns.map(col => ({
      key: col.id,
      label: col.name,
      header: col.name,
      cell: (row: RuntimeFactRow) => {
        const cell = row.cells[col.id];
        if (!cell) return <span className={styles.none}>—</span>;
        return (
          <>
            {cell.text}
            {cell.chip && <> <Chip>{cell.chip}</Chip></>}
            {cell.note && <small className={styles.note}>{cell.note}</small>}
          </>
        );
      },
    })),
  ];
  return (
    <Section className={cx(styles.facts, className)} title={title} headingLevel={3} rule="strong">
      <DataTable columns={tableColumns} rows={rows} getRowKey={row => row.label} caption={title} stackOnPhone wide empty="No facts recorded for this run." />
      {run && run.length > 0 && <MetaList items={run} />}
      {notes?.map(note => (
        <p key={note} className={styles.text}>{note}</p>
      ))}
    </Section>
  );
}
