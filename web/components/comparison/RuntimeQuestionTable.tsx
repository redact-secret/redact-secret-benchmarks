import { cx } from '../../lib/cx';
import { OutcomeMark } from '../data';
import { EmptyState, StatusBadge } from '../feedback';
import type { RuntimeColumn, RuntimeQuestion, RuntimeView } from './types';
import styles from './RuntimeQuestionTable.module.css';

export interface RuntimeQuestionTableProps {
  question: RuntimeQuestion;
  columns: RuntimeColumn[];
  /** `speed` hides the value rows; `accuracy` hides the time band. From the URL, so it works without script. */
  view?: RuntimeView;
  /** What a column is, for the caption: "redact-secret setting" or "library". */
  columnKind: string;
  className?: string;
}

/**
 * One question of the runtime page: the values in the text (rows) against the
 * libraries or settings (columns), then how much came back changed, then the
 * time. Outcomes are drawn by shape with the word in the legend; nothing is
 * coloured, ranked or graded. A cell nobody measured is a dashed "Not measured".
 */
export function RuntimeQuestionTable({ question, columns, view = 'all', columnKind, className }: RuntimeQuestionTableProps) {
  const { outcomesRecorded = true } = question;
  const showValues = view !== 'speed';
  const showTime = view !== 'accuracy';
  const cols = columns.length;

  return (
    <section className={cx(styles.block, className)} aria-labelledby={`${question.id}-h`}>
      <header className={styles.head}>
        <p className={styles.position}>{question.position}</p>
        <h3 id={`${question.id}-h`} className={styles.question}>{question.question}</h3>
        <p className={styles.description}>{question.description}</p>
      </header>

      {question.notMeasured ? (
        <EmptyState title="Not measured yet">{question.notMeasured}</EmptyState>
      ) : (
        <div className={styles.region} role="region" aria-label={`${question.question} What each ${columnKind} hid, and how long it took. Not a ranking.`} tabIndex={0}>
          <table className={cx(styles.table, cols > 4 && styles.many)}>
            <caption className={styles.hidden}>{question.question} What each {columnKind} hid, and how long it took. Not a ranking.</caption>
            <thead>
              <tr>
                <td />
                {columns.map(col => (
                  <th key={col.id} scope="col" className={styles.col}>
                    {col.name}
                    {col.sub && <small>{col.sub}</small>}
                  </th>
                ))}
              </tr>
            </thead>
            {showValues && (
              <tbody>
                {outcomesRecorded ? (
                  question.rows.map(row => (
                    <tr key={row.label}>
                      <th scope="row" className={styles.rowHead}>{row.label}</th>
                      {columns.map(col => {
                        const cell = row.cells[col.id];
                        return (
                          <td key={col.id} className={styles.center}>
                            {cell ? <OutcomeMark outcome={cell.outcome} label={cell.word} detail={cell.how} display="icon" /> : <StatusBadge status="not-measured">Not measured</StatusBadge>}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <th scope="row" className={styles.rowHead}>Values in the text</th>
                    <td colSpan={cols} className={styles.center}>
                      <StatusBadge status="not-measured">Not recorded</StatusBadge>
                    </td>
                  </tr>
                )}
                {outcomesRecorded && (
                  <tr className={styles.sum}>
                    <th scope="row" className={styles.rowHead}>Hidden</th>
                    {columns.map(col => {
                      const hidden = question.hidden[col.id];
                      return (
                        <td key={col.id} className={cx(styles.center, styles.percent)}>
                          {hidden ? (
                            <>
                              <b>{hidden.percent}</b>
                              <small>{hidden.count}</small>
                            </>
                          ) : (
                            <StatusBadge status="not-measured">Not measured</StatusBadge>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                )}
              </tbody>
            )}
            {showTime && (
              <tbody>
                <tr className={cx(showValues && styles.band)}>
                  <th scope="row" className={styles.rowHead}>
                    Usual time<small>ms</small>
                  </th>
                  {columns.map(col => (
                    <td key={col.id} className={cx(styles.center, styles.figure)}>
                      {question.timing[col.id]?.medianMs ?? <StatusBadge status="not-measured">Not measured</StatusBadge>}
                    </td>
                  ))}
                </tr>
                <tr>
                  <th scope="row" className={styles.rowHead}>
                    Speed<small>MB per second</small>
                  </th>
                  {columns.map(col => (
                    <td key={col.id} className={cx(styles.center, styles.figure)}>
                      {question.timing[col.id]?.throughput ?? <StatusBadge status="not-measured">Not measured</StatusBadge>}
                    </td>
                  ))}
                </tr>
              </tbody>
            )}
          </table>
        </div>
      )}
      <p className={styles.id}>
        <code>{question.workload}</code> · {question.size} · {question.repeat}
      </p>
    </section>
  );
}
