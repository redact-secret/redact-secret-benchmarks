'use client';

import { FilterBar, SegmentedControl, SelectField, TextField } from '../nav';
import type { SegmentedOption, SelectOption } from '../nav';
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
  /**
   * The choices of the "Show" control. Omit for the provider and family lists (all, needs a
   * look, no fixtures); a list of fixture rows passes its own.
   */
  showOptions?: SegmentedOption<ReportShow>[];
  /** The result count as text: "12 providers · 31 families". The parent computed it. */
  resultText: string;
  /**
   * Narrow the counts to one evidence level. Omit for a list with no level
   * control. The parent owns the value and worked out each option's label.
   */
  levels?: { label: string; options: SelectOption[]; value: string; onChange: (value: string) => void };
  /**
   * A further select, e.g. which scanners' outcomes a table shows. Same shape as `levels`;
   * the parent owns the value.
   */
  scope?: { label: string; options: SelectOption[]; value: string; onChange: (value: string) => void };
  className?: string;
}

const SHOW_OPTIONS: SegmentedOption<ReportShow>[] = [
  { value: 'all', label: 'All' },
  { value: 'signal', label: 'Needs a look' },
  { value: 'empty', label: 'No fixtures' },
];

/**
 * Find and show controls for the provider, family and fixture-row lists. Controlled:
 * the page owns the query and the choices, and passes back the filtered rows.
 */
export function ReportFilterBar({ label, query, onQueryChange, placeholder = 'GitHub, stripe, access key', show, onShowChange, showOptions = SHOW_OPTIONS, resultText, levels, scope, className }: ReportFilterBarProps) {
  return (
    <FilterBar label={label} className={cx(styles.bar, className)}>
      <TextField label="Find" placeholder={placeholder} value={query} onChange={e => onQueryChange(e.target.value)} />
      {levels && <SelectField label={levels.label} options={levels.options} value={levels.value} onChange={e => levels.onChange(e.target.value)} />}
      {scope && <SelectField label={scope.label} options={scope.options} value={scope.value} onChange={e => scope.onChange(e.target.value)} />}
      <SegmentedControl label="Show" options={showOptions} value={show} onChange={onShowChange} />
      <span className={styles.count} role="status">{resultText}</span>
    </FilterBar>
  );
}
