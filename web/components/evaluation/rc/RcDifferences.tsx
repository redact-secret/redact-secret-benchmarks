import { StatGrid, StatTile } from '../../data';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import { RcStampLine } from './RcStampLine';
import styles from './RcDifferences.module.css';
import type { RcDifferencesData } from './types';

export interface RcDifferencesProps extends RcDifferencesData {
  className?: string;
}

/**
 * What differs, as counts of fixtures that moved each way, then the two before-and-after figures the existing
 * Workbench leads with. Every figure sits under a line naming its corpus section and the run on each side.
 */
export function RcDifferences({ title, stamp, tiles, figures, className }: RcDifferencesProps) {
  return (
    <Section title={title} className={cx(styles.differences, className)}>
      <RcStampLine stamp={stamp} />
      <StatGrid>
        {tiles.map(t => <StatTile key={t.label} size="compact" label={t.label} value={t.value} definition={t.detail} />)}
      </StatGrid>
      {figures.length > 0 && (
        <StatGrid>
          {figures.map(t => <StatTile key={t.label} size="compact" label={t.label} value={t.value} observation={t.observation} definition={t.detail} />)}
        </StatGrid>
      )}
    </Section>
  );
}
