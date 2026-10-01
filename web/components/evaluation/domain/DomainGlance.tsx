import { cx } from '../../../lib/cx';
import { StatGrid, StatTile } from '../../data';
import { StatusBadge } from '../../feedback';
import styles from './DomainGlance.module.css';
import type { GlanceItem } from './types';

export interface DomainGlanceProps {
  items: GlanceItem[];
  className?: string;
}

/**
 * Three recorded facts under the head: what is covered, what the ledger records as its status (with its mode), and
 * what is held apart. Never a total: the views these facts come from overlap, so a sum would count a case twice.
 * A fact the ledger does not hold is the dashed "Not recorded", never a zero.
 */
export function DomainGlance({ items, className }: DomainGlanceProps) {
  return (
    <StatGrid className={cx(styles.glance, className)}>
      {items.map(item => (
        <StatTile
          key={item.label}
          size="compact"
          label={item.label}
          value={item.value ?? '—'}
          status={item.value === null ? <StatusBadge status="not-measured">Not recorded</StatusBadge> : undefined}
          observation={item.detail}
        />
      ))}
    </StatGrid>
  );
}
