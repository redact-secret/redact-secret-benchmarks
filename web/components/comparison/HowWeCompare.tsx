import { cx } from '../../lib/cx';
import { Grid, Section } from '../layout';
import type { Principle, RunLine } from './types';
import styles from './HowWeCompare.module.css';

export interface HowWeCompareProps {
  /** "How we compare". */
  title: string;
  principles: Principle[];
  /** "Latest runs". */
  runsLabel: string;
  /** The latest run of each page: its date and the versions it ran, read from the same files the pages use. */
  runs: RunLine[];
  className?: string;
}

/** The method in short rules, then the date and versions of each page's latest run. A stale page is visible from here. */
export function HowWeCompare({ title, principles, runsLabel, runs, className }: HowWeCompareProps) {
  return (
    <Section className={cx(styles.section, className)} title={title} rule="none">
      <Grid columns={4} divided>
        {principles.map(p => (
          <div key={p.title} className={styles.principle}>
            <b className={styles.title}>{p.title}</b>
            <span className={styles.text}>{p.description}</span>
          </div>
        ))}
      </Grid>
      {runs.length > 0 && (
        <div className={styles.runs}>
          <b>{runsLabel}</b>
          {runs.map(r => (
            <span key={r.label}>{r.label} · {r.detail}</span>
          ))}
        </div>
      )}
    </Section>
  );
}
