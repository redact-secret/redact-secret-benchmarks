import { cx } from '../../lib/cx';
import { StatusBadge } from '../feedback';
import { Section } from '../layout';
import type { MissingGroup } from './performance-types';
import styles from './PerformanceGaps.module.css';

export interface PerformanceGapsProps {
  title: string;
  description: string;
  groups: MissingGroup[];
  className?: string;
}

/** The questions this page is built to answer that no committed run has timed yet, each as a dashed "Not measured" with where it is tracked. Never an empty row, never a zero. */
export function PerformanceGaps({ title, description, groups, className }: PerformanceGapsProps) {
  return (
    <Section className={cx(styles.gaps, className)} title={title} description={description} headingLevel={2} rule="strong">
      <ol className={styles.list}>
        {groups.map(group => (
          <li key={group.id} className={styles.item}>
            <div className={styles.text}>
              <h3 className={styles.name}>{group.title}</h3>
              <p className={styles.desc}>{group.description}</p>
            </div>
            <div className={styles.state}>
              <StatusBadge status="not-measured">Not measured</StatusBadge>
              <p className={styles.reason}>{group.reason}</p>
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
