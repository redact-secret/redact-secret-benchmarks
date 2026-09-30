import { useId } from 'react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import styles from './Section.module.css';

export interface SectionProps {
  title: string;
  eyebrow?: string;
  /** A short plain sentence under the title. */
  description?: ReactNode;
  /** Right-aligned controls, such as a segmented control or a link. */
  actions?: ReactNode;
  /** Heading level; the page head owns h1. */
  headingLevel?: 2 | 3;
  /** `strong` is the ink rule that opens a major section; `hairline` is a quiet sub-section. */
  rule?: 'strong' | 'hairline' | 'none';
  children?: ReactNode;
  className?: string;
}

/** A ruled section with its own heading, so blocks stack without ad-hoc spacing. */
export function Section({ title, eyebrow, description, actions, headingLevel = 2, rule = 'strong', children, className }: SectionProps) {
  const headingId = useId();
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <section
      className={cx(styles.section, rule === 'strong' && styles.strong, rule === 'hairline' && styles.hairline, className)}
      aria-labelledby={headingId}
    >
      <header className={styles.head}>
        <div className={styles.titles}>
          {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
          <Heading id={headingId} className={headingLevel === 2 ? styles.h2 : styles.h3}>{title}</Heading>
          {description && <div className={styles.description}>{description}</div>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </header>
      {children}
    </section>
  );
}
