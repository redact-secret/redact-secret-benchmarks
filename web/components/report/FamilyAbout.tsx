import { cx } from '../../lib/cx';
import styles from './FamilyAbout.module.css';
import type { FamilyAboutData } from './types';

export interface FamilyAboutProps extends FamilyAboutData {
  className?: string;
}

/** What a family is, why the ledger treats it as it does, and where the shape is documented. */
export function FamilyAbout({ description, note, sources, className }: FamilyAboutProps) {
  return (
    <div className={cx(styles.about, className)}>
      <p>{description}</p>
      {note && <p className={styles.small}>{note}</p>}
      {sources && sources.length > 0 && (
        <p className={styles.small}>
          Sources:{' '}
          {sources.map((s, i) => (
            <span key={s.href}>
              {i > 0 && ' · '}
              <a href={s.href} rel="noreferrer">{s.host}</a>
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
