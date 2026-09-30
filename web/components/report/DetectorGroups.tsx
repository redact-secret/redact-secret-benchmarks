import { DataTable, OutcomeStrip } from '../data';
import type { DataTableColumn } from '../data';
import { StatusBadge } from '../feedback';
import { cx } from '../../lib/cx';
import styles from './DetectorGroups.module.css';
import type { DetectorGroupRowData } from './types';

export interface DetectorGroupsProps {
  groups: DetectorGroupRowData[];
  /** Names the table and its scroll region. */
  caption: string;
  className?: string;
}

const columns: DataTableColumn<DetectorGroupRowData>[] = [
  { key: 'group', header: 'Group', rowHeader: true, cell: r => r.group },
  { key: 'fixtures', header: 'Fixtures', numeric: true, cell: r => r.fixtures },
  {
    key: 'headline',
    header: 'Leaked or false alarms',
    cell: r => (
      <>
        <small className={styles.label}>{r.headline.label}</small>
        <b>{r.headline.value}</b>
        {r.headline.note && <small className={styles.note}>{r.headline.note}</small>}
      </>
    ),
  },
  {
    key: 'secondary',
    header: 'Near-twins',
    cell: r => (r.secondary ? (
      <>
        <small className={styles.label}>{r.secondary.label}</small>
        <b>{r.secondary.value}</b>
        {r.secondary.note && <small className={styles.note}>{r.secondary.note}</small>}
      </>
    ) : ''),
  },
  {
    key: 'outcomes',
    header: 'Outcomes',
    cell: r => (r.outcomes ? (
      <>
        <OutcomeStrip segments={r.outcomes.segments} label={r.outcomes.label} />
        <small className={styles.note}>{r.outcomes.text}</small>
      </>
    ) : <StatusBadge status="not-measured">Not scored</StatusBadge>),
  },
  {
    key: 'others',
    header: 'Other scanners, same cell',
    cell: r => (r.others.length ? (
      <ul className={styles.others}>
        {r.others.map(o => <li key={o.scanner}><small>{o.scanner} {o.value}</small></li>)}
      </ul>
    ) : ''),
  },
];

/**
 * One row per group (kind and evidence level) of a detector's fixtures, with the
 * figure the run recorded for redact-secret and, in run order, for each other scanner
 * on the same cell. A withheld figure shows its reason verbatim. Detector views
 * overlap, so their groups are never summed across detectors.
 */
export function DetectorGroups({ groups, caption, className }: DetectorGroupsProps) {
  return <DataTable<DetectorGroupRowData> className={cx(styles.table, className)} columns={columns} rows={groups} getRowKey={r => r.group} caption={caption} wide />;
}
