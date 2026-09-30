import { cx } from '../../lib/cx';
import { Chip } from '../feedback';
import { SegmentedControl } from '../nav';
import type { FeatureFilter } from './types';
import styles from './FeatureToolbar.module.css';

export interface FeatureToolbarProps {
  /** Controlled: the parent owns the filter. */
  filter: FeatureFilter;
  onFilterChange: (filter: FeatureFilter) => void;
  className?: string;
}

/** The bar pinned above the feature table: the row filter and what a dash and a `tested` chip mean. */
export function FeatureToolbar({ filter, onFilterChange, className }: FeatureToolbarProps) {
  return (
    <div className={cx(styles.bar, className)}>
      <SegmentedControl
        label="Rows"
        value={filter}
        onChange={onFilterChange}
        options={[
          { value: 'all', label: 'All' },
          { value: 'differences', label: 'Only differences' },
        ]}
      />
      <p className={styles.note}>
        — means not listed. <Chip className={styles.tested}>tested</Chip> means we ran it ourselves.
      </p>
    </div>
  );
}
