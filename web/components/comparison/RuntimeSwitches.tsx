import { cx } from '../../lib/cx';
import { Cluster } from '../layout';
import { SegmentedNav } from '../nav';
import type { SegmentedNavProps } from '../nav';
import styles from './RuntimeSwitches.module.css';

type Switch = Omit<SegmentedNavProps, 'className'>;

export interface RuntimeSwitchesProps {
  /** Internal (redact-secret's own settings) or External (next to other libraries). */
  analysis: Switch;
  /** Credentials or PII. */
  domain: Switch;
  className?: string;
}

/** The two page-level switches at the top right of the runtime page. Both are links: the state lives in the URL. */
export function RuntimeSwitches({ analysis, domain, className }: RuntimeSwitchesProps) {
  return (
    <Cluster gap="sm" className={cx(styles.switches, className)}>
      <SegmentedNav {...analysis} />
      <SegmentedNav {...domain} />
    </Cluster>
  );
}
