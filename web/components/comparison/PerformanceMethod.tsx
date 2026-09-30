import { cx } from '../../lib/cx';
import { Section } from '../layout';
import styles from './PerformanceMethod.module.css';

export interface PerformanceMethodProps {
  title: string;
  /** Plain sentences: the run (machine, Node, runs per time), what was timed, what a time is, what the noise is. */
  items: string[];
  className?: string;
}

/** How the times were taken, at the foot of the page. */
export function PerformanceMethod({ title, items, className }: PerformanceMethodProps) {
  return (
    <Section className={cx(styles.method, className)} title={title} headingLevel={2} rule="hairline">
      <ul className={styles.list}>
        {items.map(item => <li key={item}>{item}</li>)}
      </ul>
    </Section>
  );
}
