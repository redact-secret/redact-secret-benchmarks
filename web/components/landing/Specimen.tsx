import { cx } from '../../lib/cx';
import { SegmentedControl } from '../nav/SegmentedControl';
import type { SpecimenExample } from './types';
import styles from './Specimen.module.css';

export interface SpecimenProps {
  /** The small heading above the card. */
  eyebrow: string;
  /** Names the choice between examples. */
  choiceLabel: string;
  examples: SpecimenExample[];
  /** Controlled: the id of the example shown. */
  active: string;
  onChange: (id: string) => void;
  /** Changing it restarts the reading (the bar closing over the dashed box). */
  runKey: number;
  onReplay: () => void;
  replayLabel: string;
  className?: string;
}

const PENDING = '…';

/**
 * One synthetic input read the way the report reads it: the expected secret as a dashed box, a redaction as a solid bar that
 * closes over it, then the three words of the verdict. The motion is CSS only and the settled state is always in the DOM, so
 * `prefers-reduced-motion` shows it at once and a reader without script sees the same page. Controlled and stateless: the
 * parent owns the choice and the replay counter. It illustrates how a result is read; it is never a recorded row.
 */
export function Specimen({ eyebrow, choiceLabel, examples, active, onChange, runKey, onReplay, replayLabel, className }: SpecimenProps) {
  const example = examples.find(e => e.id === active) ?? examples[0];
  if (!example) return null;
  const run = `${example.id}-${runKey}`;
  return (
    <figure className={cx(styles.specimen, className)} aria-labelledby="specimen-caption">
      <div className={styles.head}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <SegmentedControl label={choiceLabel} value={example.id} options={examples.map(e => ({ value: e.id, label: e.label }))} onChange={onChange} />
      </div>
      <div className={styles.file}>
        <div className={styles.fileHead}>
          <span className={styles.fileName}>{example.name}</span>
          <span className={styles.fileTag}>synthetic · never issued</span>
        </div>
        <pre className={styles.code} aria-live="polite">
          {example.lines.map((line, i) => (
            <span key={`${run}-${i}`} className={styles.line}>
              <span className={styles.number} aria-hidden="true">{i + 1}</span>
              {typeof line === 'string' ? line : <>{line.before}<span className={styles.secret} title="Expected secret">{line.secret}</span>{line.after}</>}
              {'\n'}
            </span>
          ))}
        </pre>
        <dl className={styles.verdict} key={run}>
          <div><dt>Expected</dt><dd>{example.expected}</dd></div>
          <div>
            <dt>Redacted</dt>
            <dd className={styles.stack}>
              <span className={styles.pending} aria-hidden="true">{PENDING}</span>
              <span className={styles.settled}>{example.expected}</span>
            </dd>
          </div>
          <div>
            <dt>Result</dt>
            <dd className={styles.stack}>
              <span className={styles.pending} aria-hidden="true">{PENDING}</span>
              <span className={cx(styles.settled, styles.status)}>{example.result}</span>
            </dd>
          </div>
        </dl>
      </div>
      <figcaption id="specimen-caption" className={styles.caption}>
        {example.caption}{' '}
        <button type="button" className={styles.replay} onClick={onReplay}>{replayLabel}</button>
      </figcaption>
    </figure>
  );
}
