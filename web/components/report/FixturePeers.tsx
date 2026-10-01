import { DataTable } from '../data';
import type { DataTableColumn } from '../data';
import { Disclosure } from '../disclosure';
import { StatusBadge } from '../feedback';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import { FixtureBytes } from './FixtureBytes';
import styles from './FixturePeers.module.css';
import type { FixturePeerRow, FixturePeersData } from './fixtureTypes';
import type { StatusLabel } from './types';

export interface FixturePeersProps {
  peers: FixturePeersData;
  /** Open on first render; a reader who follows a link to the scanners lands on the table. */
  defaultOpen?: boolean;
  className?: string;
}

const badges = (labels: StatusLabel[]) => <span className={styles.badges}>{labels.map((o, i) => <StatusBadge key={i} status={o.status}>{o.label}</StatusBadge>)}</span>;

/**
 * The other scanners on the same input, behind a disclosure and in run order. Reference only: what each
 * recorded for this file and, where the file has a twin or an original, for that file too, with the
 * ranges it reported. Nothing is sorted or marked as better; scanners differ in scope and defaults, and
 * the comparison pages hold the full comparison. Open, it also draws every scanner's ranges on the bytes.
 */
export function FixturePeers({ peers, defaultOpen = false, className }: FixturePeersProps) {
  const columns: DataTableColumn<FixturePeerRow>[] = [
    { key: 'scanner', header: 'Scanner', rowHeader: true, cell: r => <>{r.name}<small className={styles.sub}>{r.detail}</small></> },
    { key: 'fixture', header: 'This fixture', cell: r => badges(r.fixture) },
    { key: 'ranges', header: 'Reported ranges', cell: r => <Code>{r.ranges}</Code> },
    ...(peers.relatedHeading ? [{ key: 'related', header: peers.relatedHeading, cell: (r: FixturePeerRow) => (r.related?.length ? <span className={styles.related}>{r.related.map(item => <span key={item.label}>{badges(item.outcome)}{peers.rows.some(x => (x.related?.length ?? 0) > 1) && <small className={styles.sub}>{item.label}</small>}</span>)}</span> : <small className={styles.sub}>not measured</small>) }] : []),
  ];
  return (
    <div className={cx(styles.peers, className)}>
      <Disclosure variant="plain" defaultOpen={defaultOpen} summary={<>{peers.summary}<small className={styles.order}>listed in run order</small></>}>
        <div className={styles.body}>
          <DataTable<FixturePeerRow> columns={columns} rows={peers.rows} getRowKey={r => r.id} caption="Other scanners on this input" wide />
          {peers.lanes && <FixtureBytes lines={peers.lanes.lines} scanners={peers.lanes.scanners} caption={peers.lanes.caption} label="Every scanner's ranges on the bytes" />}
        </div>
      </Disclosure>
    </div>
  );
}
