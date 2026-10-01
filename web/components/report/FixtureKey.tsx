import { cx } from '../../lib/cx';
import styles from './FixtureKey.module.css';
import type { FixtureKeyItem } from './fixtureTypes';

export interface FixtureKeyProps {
  items: FixtureKeyItem[];
  /** Names the list: "Key". */
  label?: string;
  className?: string;
}

/** What each mark on a file view means. Each swatch repeats the mark's shape, so the key reads without colour. */
export function FixtureKey({ items, label = 'Key', className }: FixtureKeyProps) {
  if (items.length === 0) return null;
  return (
    <ul className={cx(styles.key, className)} aria-label={label}>
      {items.map(item => (
        <li key={item.mark}><i className={cx(styles.swatch, styles[item.mark])} aria-hidden="true" />{item.label}</li>
      ))}
    </ul>
  );
}
