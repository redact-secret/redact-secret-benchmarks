import { cx } from '../../lib/cx';
import type { Rule } from './types';
import styles from './RulesStrip.module.css';

export interface RulesStripProps {
  /** Names the list for assistive technology. */
  label: string;
  rules: Rule[];
  className?: string;
}

/** The rules of the benchmark as one closing line: a strong phrase and the words that complete it. */
export function RulesStrip({ label, rules, className }: RulesStripProps) {
  return (
    <ul className={cx(styles.rules, className)} aria-label={label}>
      {rules.map(r => (
        <li key={r.strong}><b>{r.strong}</b>{r.rest}</li>
      ))}
    </ul>
  );
}
