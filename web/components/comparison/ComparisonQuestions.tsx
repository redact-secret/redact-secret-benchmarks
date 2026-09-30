import { cx } from '../../lib/cx';
import { NavRow } from '../nav';
import type { ComparisonQuestion } from './types';
import styles from './ComparisonQuestions.module.css';

export interface ComparisonQuestionsProps {
  questions: ComparisonQuestion[];
  /** Names the list for assistive tech: "Comparisons". */
  label: string;
  className?: string;
}

/** The hub's front door: one row per question, each row one link to the page that answers it. */
export function ComparisonQuestions({ questions, label, className }: ComparisonQuestionsProps) {
  return (
    <nav className={cx(styles.list, className)} aria-label={label}>
      {questions.map(q => (
        <NavRow key={q.href} href={q.href} label={q.label} title={q.title} description={q.description} tools={q.tools} fact={q.fact} factNote={q.factNote} action={q.action} />
      ))}
    </nav>
  );
}
