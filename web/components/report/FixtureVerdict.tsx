import { KeyValueList } from '../data';
import { cx } from '../../lib/cx';
import styles from './FixtureVerdict.module.css';
import type { FixtureVerdictData } from './fixtureTypes';

export interface FixtureVerdictProps {
  verdict: FixtureVerdictData;
  className?: string;
}

/**
 * What the product recorded on this file, before the bytes that earned it: whose run, the outcome in one
 * phrase with a shape beside it (never colour alone), a sentence that says what the phrase means in the
 * ledger's terms, and up to three recorded figures. A fixture the run holds no row for says "Not measured"
 * and why, with no figures. Pure render: the words and numbers arrive formatted.
 */
export function FixtureVerdict({ verdict, className }: FixtureVerdictProps) {
  const { headline } = verdict;
  return (
    <div className={cx(styles.verdict, className)}>
      <div className={styles.lead}>
        <p className={styles.who}>{verdict.who} · {verdict.run}</p>
        <p className={styles.big}><i className={styles.mark} data-status={headline.status} aria-hidden="true" />{headline.label}</p>
        <p className={styles.expl}>{verdict.explanation}</p>
      </div>
      {verdict.figures.length > 0 && (
        <KeyValueList
          variant="facts"
          className={styles.figures}
          items={verdict.figures.map(f => ({ term: f.label, description: <>{f.value}{f.of && <small className={styles.of}>{f.of}</small>}</> }))}
        />
      )}
    </div>
  );
}
