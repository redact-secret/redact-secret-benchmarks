import Link from 'next/link';
import { DataTable } from '../../data';
import type { DataTableColumn } from '../../data';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './RcMoved.module.css';
import type { RcMovedData, RcMovedRow } from './types';

export interface RcMovedProps extends RcMovedData {
  className?: string;
}

const columns: DataTableColumn<RcMovedRow>[] = [
  { key: 'fixture', header: 'Fixture', rowHeader: true, cell: r => <><Link href={r.href}>{r.title}</Link><small className={styles.detail}>{r.detail}</small></> },
  { key: 'level', header: 'Level', cell: r => r.level },
  { key: 'before', header: 'Release outcome', cell: r => <span className={styles.outcome}>{r.before}</span> },
  { key: 'after', header: 'Candidate outcome', cell: r => <span className={styles.outcome}>{r.after}</span> },
];

/** The fixtures whose recorded outcome moved, grouped by direction, each linking to its fixture page. */
export function RcMoved({ title, description, caption, groups, truncated, className }: RcMovedProps) {
  return (
    <Section title={title} description={description} className={cx(styles.moved, className)}>
      <DataTable<RcMovedRow>
        columns={columns}
        groups={groups}
        getRowKey={r => r.id}
        caption={caption}
        wide
        empty="No fixture moved."
      />
      {truncated && <p className={styles.foot}>{truncated}</p>}
    </Section>
  );
}
