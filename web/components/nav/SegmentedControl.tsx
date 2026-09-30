'use client';

import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { cx } from '../../lib/cx';
import styles from './SegmentedControl.module.css';

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
}

export interface SegmentedControlProps<V extends string> {
  options: SegmentedOption<V>[];
  /** Controlled: the parent owns the value. */
  value: V;
  onChange: (value: V) => void;
  /** Names the group, e.g. "Rows". Required. */
  label: string;
  className?: string;
}

/**
 * An exclusive toggle group for in-page state that has no URL (an "Only
 * differences" filter, a view). MUI supplies the group semantics, roving focus
 * and `aria-pressed`; every visual is a class from the module. Controlled and
 * stateless. When the state should be shareable, use SegmentedNav instead.
 */
export function SegmentedControl<V extends string>({ options, value, onChange, label, className }: SegmentedControlProps<V>) {
  return (
    <ToggleButtonGroup
      className={cx(styles.group, className)}
      size="small"
      exclusive
      value={value}
      aria-label={label}
      onChange={(_, next: V | null) => { if (next !== null) onChange(next); }}
    >
      {options.map(o => (
        <ToggleButton key={o.value} className={styles.option} value={o.value}>{o.label}</ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
