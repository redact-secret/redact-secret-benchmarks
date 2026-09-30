import { cx } from '../../lib/cx';
import { Chip } from '../feedback';
import type { PairSide, PairSideInfo } from './performance-types';
import styles from './PerformancePairHead.module.css';

export interface PerformancePairHeadProps {
  /** Exactly two, drawn alike: same order of facts, same weight, same width. */
  sides: [PairSideInfo, PairSideInfo];
  className?: string;
}

const SIDES: PairSide[] = ['a', 'b'];

/** Which library and which version sits on each side, with the setting and the call that was timed. States facts; grades nothing. */
export function PerformancePairHead({ sides, className }: PerformancePairHeadProps) {
  return (
    <div className={cx(styles.pair, className)}>
      {sides.map((info, i) => (
        <section key={SIDES[i]} className={styles.side} aria-label={info.name}>
          <h2 className={styles.name}>
            <i className={cx(styles.glyph, SIDES[i] === 'a' ? styles.a : styles.b)} aria-hidden="true" />
            {info.name}
            <small>{info.version}</small>
            {info.chip && <Chip>{info.chip}</Chip>}
          </h2>
          <p className={styles.setting}>{info.setting}</p>
          {info.lines.map(line => <p key={line} className={styles.line}>{line}</p>)}
        </section>
      ))}
    </div>
  );
}
