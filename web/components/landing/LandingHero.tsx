import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './LandingHero.module.css';

export interface LandingHeroProps {
  eyebrow: string;
  /** The question, split around the one emphasised word: `How exactly does it find` / `secrets` / `?`. */
  headline: { before: string; emphasis: string; after: string };
  lede: ReactNode;
  /** The caveat set beside the lede: a label and a sentence. */
  caveat: { label: string; text: string };
  /** The right-hand column; on a narrow screen it follows the text. */
  aside?: ReactNode;
  className?: string;
}

/** The landing page's opening: a question, what the site measures, and one illustrated reading beside it. Pure render. */
export function LandingHero({ eyebrow, headline, lede, caveat, aside, className }: LandingHeroProps) {
  return (
    <section className={cx(styles.hero, className)} aria-labelledby="landing-title">
      <div className={styles.text}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 id="landing-title" className={styles.title}>{headline.before} <em className={styles.emphasis}>{headline.emphasis}</em>{headline.after}</h1>
        <p className={styles.lede}>{lede}</p>
        <p className={styles.caveat}><span className={styles.caveatLabel}>{caveat.label}</span><span>{caveat.text}</span></p>
      </div>
      {aside}
    </section>
  );
}
