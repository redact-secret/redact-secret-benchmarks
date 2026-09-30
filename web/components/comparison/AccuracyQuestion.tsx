import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { EmptyState } from '../feedback';
import { AccuracyResultRow } from './AccuracyResultRow';
import type { AccuracyQuestionData } from './accuracyTypes';
import styles from './AccuracyQuestion.module.css';

export interface AccuracyQuestionProps {
  question: AccuracyQuestionData;
  /** What goes under the rows: the differences. A slot, so the caller decides when it loads. */
  differences?: ReactNode;
  className?: string;
}

/**
 * One question of the pair page: what the files are, what they expect, then one row per tool
 * against that answer. The differences go under the rows, second. Never a total across questions.
 */
export function AccuracyQuestion({ question, differences, className }: AccuracyQuestionProps) {
  return (
    <section className={cx(styles.block, className)} aria-labelledby={`${question.id}-h`}>
      <header className={styles.head}>
        <p className={styles.position}>{question.position}</p>
        <h3 id={`${question.id}-h`} className={styles.title}>{question.title}</h3>
        <p className={styles.description}>
          {question.description} <b>{question.expect}.</b>
        </p>
      </header>
      {question.empty ? (
        <EmptyState title="Nothing to compare here">{question.empty}</EmptyState>
      ) : (
        <div className={styles.rows}>{question.results.map(result => <AccuracyResultRow key={result.name} result={result} />)}</div>
      )}
      {question.readout && <p className={styles.readout}>{question.readout}</p>}
      {question.notes?.map(note => <p key={note} className={styles.readout}>{note}</p>)}
      {differences}
    </section>
  );
}
