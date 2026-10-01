import { EmptyState, StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './RcNotRecorded.module.css';
import type { RcNotRecordedData } from './types';

export interface RcNotRecordedProps extends RcNotRecordedData {
  className?: string;
}

/**
 * The state of a build with no release candidate (or with evidence that did not validate): a dashed box that
 * says nothing is compared, why, and how a candidate gets recorded. It cannot be read as a result.
 */
export function RcNotRecorded({ title, heading, paragraphs, steps, command, className }: RcNotRecordedProps) {
  return (
    <Section title={title} className={cx(styles.notRecorded, className)}>
      <EmptyState title={heading} command={command}>
        {paragraphs.map(p => <p key={p}>{p}</p>)}
        <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
        <ol className={styles.steps}>
          {steps.map(s => <li key={s}>{s}</li>)}
        </ol>
      </EmptyState>
    </Section>
  );
}
