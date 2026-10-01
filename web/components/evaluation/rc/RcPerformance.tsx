import Link from 'next/link';
import { EmptyState, StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './RcPerformance.module.css';
import type { RcPerformanceData } from './types';

export interface RcPerformanceProps extends RcPerformanceData {
  className?: string;
}

/** The performance cost of the candidate against the release. Today it states, in a dashed box, that none is recorded. */
export function RcPerformance({ title, heading, text, href, linkLabel, className }: RcPerformanceProps) {
  return (
    <Section title={title} className={cx(styles.performance, className)}>
      <EmptyState title={heading} action={<Link href={href}>{linkLabel}</Link>}>
        <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
        <p>{text}</p>
      </EmptyState>
    </Section>
  );
}
