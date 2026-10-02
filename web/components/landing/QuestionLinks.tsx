import Link from 'next/link';
import { cx } from '../../lib/cx';
import type { Question } from './types';
import styles from './QuestionLinks.module.css';

export interface QuestionLinksProps {
  /** Names the group for assistive technology. */
  label: string;
  questions: Question[];
  className?: string;
}

/** The questions the site answers, each one link to where it is answered. The text may carry a count; the ledger says it, this shows it. */
export function QuestionLinks({ label, questions, className }: QuestionLinksProps) {
  return (
    <nav className={cx(styles.questions, className)} aria-label={label}>
      {questions.map(q => (
        <Link key={q.href} className={styles.question} href={q.href}>
          <span className={styles.kicker}>{q.kicker}</span>
          <h2 className={styles.title}>{q.title}</h2>
          <span className={styles.text}>{q.text}</span>
          <span className={styles.action}>{q.action}</span>
        </Link>
      ))}
    </nav>
  );
}
