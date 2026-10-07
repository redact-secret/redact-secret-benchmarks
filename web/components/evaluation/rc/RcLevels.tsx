import { DataTable } from '../../data';
import type { DataTableColumn } from '../../data';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import { RcStampLine } from './RcStampLine';
import styles from './RcLevels.module.css';
import type { RcLevelRow, RcLevelsData } from './types';

export interface RcLevelsProps extends RcLevelsData {
  className?: string;
}

const columnsFor = (heading: string): DataTableColumn<RcLevelRow>[] => [
  { key: 'level', header: heading, rowHeader: true, cell: r => <>{r.title}<small className={styles.detail}>{r.detail}</small></> },
  { key: 'compared', header: 'Compared', numeric: true, cell: r => r.compared },
  { key: 'regressed', header: 'Regressed', numeric: true, cell: r => r.regressed },
  { key: 'improved', header: 'Improved', numeric: true, cell: r => r.improved },
  { key: 'other', header: 'Other change', numeric: true, cell: r => r.other },
  { key: 'unchanged', header: 'Unchanged', numeric: true, cell: r => r.unchanged },
];

/** Fixed-corpus counts per evidence level. The expanded corpus has no release outcome and is only described, never summed in. */
export function RcLevels({ title, heading = 'Evidence level', stamp, caption, rows, expanded, footnote, className }: RcLevelsProps) {
  return (
    <Section title={title} className={cx(styles.levels, className)}>
      <RcStampLine stamp={stamp} />
      <DataTable<RcLevelRow> columns={columnsFor(heading)} rows={rows} getRowKey={r => r.id} caption={caption} empty="No fixed-corpus fixtures were compared." />
      <p className={styles.foot}>{footnote}</p>
      <p className={styles.foot}>{expanded}</p>
    </Section>
  );
}
