import { cx } from '../../lib/cx';
import type { AccuracySide } from './accuracyTypes';
import styles from './AccuracyToolPair.module.css';

export interface AccuracyToolPairProps {
  /** redact-secret. */
  ours: AccuracySide;
  /** The tool it is read next to. Same fields, same order, same weight. */
  theirs: AccuracySide;
  className?: string;
}

function Side({ side }: { side: AccuracySide }) {
  return (
    <div className={styles.side}>
      <p className={styles.kind}>{side.kind}</p>
      <p className={styles.name}>
        {side.name}
        <small>{side.version}</small>
      </p>
      {side.job && <p className={styles.line}>{side.job}</p>}
      <p className={styles.line}>Ran as: {side.ran}</p>
      {side.recorded && <p className={styles.line}>{side.recorded}</p>}
    </div>
  );
}

/** The two tools side by side: what each is, how it ran here and when. Symmetrical; neither side is emphasised. */
export function AccuracyToolPair({ ours, theirs, className }: AccuracyToolPairProps) {
  return (
    <div className={cx(styles.pair, className)} role="group" aria-label={`${ours.name} and ${theirs.name}`}>
      <Side side={ours} />
      <Side side={theirs} />
    </div>
  );
}
