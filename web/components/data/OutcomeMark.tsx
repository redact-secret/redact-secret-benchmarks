import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './OutcomeMark.module.css';

/**
 * What a call did to a value, drawn by shape so no status colour is used:
 * `replaced` a solid ink bar, `partial` a half bar, `unchanged` a hairline,
 * `not-applicable` a dashed box (switched off or out of scope; distinct from unchanged).
 */
export type Outcome = 'replaced' | 'partial' | 'unchanged' | 'not-applicable';

export interface OutcomeMarkProps {
  outcome: Outcome;
  /** The word ("Hidden", "Left as is"). Always rendered; the icon is only a second cue. */
  label: string;
  /** How it happened, in small mono text ("labelled IBAN"). */
  detail?: string;
  className?: string;
}

/** An outcome icon with its word and optional detail. */
export function OutcomeMark({ outcome, label, detail, className }: OutcomeMarkProps) {
  return (
    <span className={cx(styles.mark, styles[outcome], className)} data-outcome={outcome}>
      <i className={styles.icon} aria-hidden="true" />
      <b className={styles.label}>{label}</b>
      {detail && <small className={styles.detail}>{detail}</small>}
    </span>
  );
}

export interface LegendProps {
  items: ReactNode[];
  /** Names the legend for assistive tech. */
  label: string;
  className?: string;
}

/** A wrapping key for icons and marks used in a table or chart. */
export function Legend({ items, label, className }: LegendProps) {
  return (
    <ul className={cx(styles.legend, className)} aria-label={label}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
}
