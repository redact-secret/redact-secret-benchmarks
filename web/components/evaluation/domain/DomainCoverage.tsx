import { cx } from '../../../lib/cx';
import { DataTable, KeyValueList } from '../../data';
import type { DataTableColumn } from '../../data';
import { EmptyState, StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { Eyebrow } from '../../text';
import styles from './DomainCoverage.module.css';
import type { CoverageCell, CoverageNotRecorded, CoverageRow, CoverageTable, DomainCoverageData } from './types';

export interface DomainCoverageProps extends DomainCoverageData {
  className?: string;
}

const isNotRecorded = (table: CoverageTable | CoverageNotRecorded): table is CoverageNotRecorded => 'text' in table;

function Cell({ cell }: { cell: CoverageCell }) {
  if (cell.figure === null) return <StatusBadge status="not-measured">Not recorded</StatusBadge>;
  return (
    <>
      <b className={styles.figure}>{cell.figure}</b>
      {cell.detail && <small className={styles.detail}>{cell.detail}</small>}
    </>
  );
}

function Table({ table }: { table: CoverageTable }) {
  const columns: DataTableColumn<CoverageRow>[] = [
    {
      key: 'label',
      header: table.rowHeader,
      rowHeader: true,
      cell: row => (
        <>
          <b className={styles.rowLabel}>{row.label}</b>
          {row.detail && <small className={styles.detail}>{row.detail}</small>}
        </>
      ),
    },
    ...table.columns.map((header, i) => ({ key: `c${i}`, header, numeric: true, cell: (row: CoverageRow) => <Cell cell={row.cells[i]} /> })),
  ];
  return (
    <div className={styles.table}>
      <DataTable caption={table.caption} showCaption columns={columns} rows={table.rows} getRowKey={row => row.id} />
      {table.note && <p className={styles.note}>{table.note}</p>}
    </div>
  );
}

/**
 * What is covered: counts per kind and level (credential) or per family and view (PII), each with the record and the
 * mode they come from. A table the ledger has no record for says so in a dashed box and names the issue that owns it.
 * Counts are never summed across views, families or domains.
 */
export function DomainCoverage({ title, mode, tables, columnKey, scope, className }: DomainCoverageProps) {
  return (
    <Section title={title} description={mode} className={cx(styles.coverage, className)}>
      {tables.map(table =>
        isNotRecorded(table) ? (
          <EmptyState key={table.id} title={table.caption}>
            <p>
              <StatusBadge status="not-measured">Not recorded</StatusBadge> {table.text}
              {table.issue && <> Follow-up <a href={table.issue.href} rel="noreferrer">#{table.issue.number}</a>.</>}
            </p>
          </EmptyState>
        ) : (
          <Table key={table.id} table={table} />
        ),
      )}
      <div className={styles.pair}>
        <div className={styles.group}>
          <Eyebrow tone="muted">Reading the columns</Eyebrow>
          <KeyValueList items={columnKey.map(row => ({ term: row.term, description: row.text }))} />
        </div>
        <div className={styles.group}>
          <Eyebrow tone="muted">Scope</Eyebrow>
          <KeyValueList items={scope.map(row => ({ term: row.term, description: row.text }))} />
        </div>
      </div>
    </Section>
  );
}
