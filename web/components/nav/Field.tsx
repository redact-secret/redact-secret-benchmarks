import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import styles from './Field.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {
  label: string;
  className?: string;
}

/** A labelled text or search input. Uncontrolled unless `value` and `onChange` are passed. */
export function TextField({ label, className, type = 'search', ...input }: TextFieldProps) {
  const id = useId();
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id}>{label}</label>
      <input id={id} type={type} className={styles.control} autoComplete="off" spellCheck={false} {...input} />
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'id' | 'children'> {
  label: string;
  options: SelectOption[];
  className?: string;
}

/** A labelled native select. Native keeps mobile pickers and keyboard behaviour for free. */
export function SelectField({ label, options, className, ...select }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={id}>{label}</label>
      <select id={id} className={styles.control} {...select}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export interface FilterBarProps {
  children: ReactNode;
  /** Names the group of filters, e.g. "Filter providers". */
  label: string;
  className?: string;
}

/** A wrapping row of filters. Add a result count or reset control as the last child. */
export function FilterBar({ children, label, className }: FilterBarProps) {
  return (
    <div className={cx(styles.bar, className)} role="group" aria-label={label}>
      {children}
    </div>
  );
}
