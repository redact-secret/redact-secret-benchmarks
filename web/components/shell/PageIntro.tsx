import type { ReactNode } from 'react';
import styles from './PageIntro.module.css';

export interface Fact { label: string; value: string }
export interface PageIntroProps {
  eyebrow: string;
  title: string;
  lede: string;
  /** Recorded values to show under the title. Displayed as given, never derived here. */
  facts?: Fact[];
  /** A short plain sentence naming where the value came from (mode and source). */
  source?: string;
  /** Marks a page whose blocks have not been built yet. */
  placeholder?: ReactNode;
}

/** Page heading with optional ledger facts and a placeholder notice. Pure render. */
export function PageIntro({ eyebrow, title, lede, facts, source, placeholder }: PageIntroProps) {
  return (
    <section className={styles.intro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h1 className={styles.title}>{title}</h1>
      <p className={styles.lede}>{lede}</p>
      {facts && facts.length > 0 && (
        <dl className={styles.facts}>
          {facts.map(f => (
            <div key={f.label} className={styles.fact}>
              <dt className={styles.label}>{f.label}</dt>
              <dd className={styles.value}>{f.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {source && <p className={styles.source}>{source}</p>}
      {placeholder && <div className={styles.placeholder} role="note">{placeholder}</div>}
    </section>
  );
}
