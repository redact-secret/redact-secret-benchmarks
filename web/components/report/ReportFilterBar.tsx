'use client';

import { FilterBar, SegmentedControl, TextField } from '../nav';
import { cx } from '../../lib/cx';
import styles from './ReportFilterBar.module.css';
import type { ReportShow } from './types';

export interface ReportFilterBarProps {
  /** Names the filters, e.g. "Filter providers". */
  label: string;
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  show: ReportShow;
  onShowChange: (show: ReportShow) => void;
  /** The result count as text: "12 providers · 31 families". The parent computed it. */
  resultText: string;
  className?: string;
}

const SHOW_OPTIONS: { value: ReportShow; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'signal', label: 'Needs a look' },
  { value: 'empty', label: 'No fixtures' },
];

/**
 * Find and show controls for the provider and family lists. Controlled: the
 * page owns the query and the choice, and passes back the filtered rows.
 */
export function ReportFilterBar({ label, query, onQueryChange, placeholder = 'GitHub, stripe, access key', show, onShowChange, resultText, className }: ReportFilterBarProps) {
  return (
    <FilterBar label={label} className={cx(styles.bar, className)}>
      <TextField label="Find" placeholder={placeholder} value={query} onChange={e => onQueryChange(e.target.value)} />
      <SegmentedControl label="Show" options={SHOW_OPTIONS} value={show} onChange={onShowChange} />
      <span className={styles.count} role="status">{resultText}</span>
    </FilterBar>
  );
}
