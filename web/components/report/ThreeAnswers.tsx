import { IntervalBar, StatGrid, StatTile } from '../data';
import { StatusBadge } from '../feedback';
import { Section } from '../layout';
import { SegmentedNav } from '../nav';
import { MetaList } from '../page';
import type { MetaItem } from '../page';
import { cx } from '../../lib/cx';
import styles from './ThreeAnswers.module.css';
import type { AnswerData, EvidenceLevelLink } from './types';

export interface ThreeAnswersProps {
  title: string;
  /** Names the evidence level being shown: "PROVIDER-DOCUMENTED". */
  eyebrow: string;
  /** Run facts: run date, input count, accounting version, and the mode the figures came from. */
  meta: MetaItem[];
  levels: EvidenceLevelLink[];
  currentLevelHref: string;
  answers: AnswerData[];
  className?: string;
}

/**
 * The three headline figures at one evidence level. The level switch is a set
 * of links (state in the URL), so each level is a page a reader can bookmark.
 */
export function ThreeAnswers({ title, eyebrow, meta, levels, currentLevelHref, answers, className }: ThreeAnswersProps) {
  return (
    <Section
      className={cx(styles.answers, className)}
      title={title}
      eyebrow={eyebrow}
      description={<MetaList items={meta} />}
      actions={<SegmentedNav label="Evidence level" items={levels} currentHref={currentLevelHref} />}
    >
      {answers.length === 0 ? (
        <p className={styles.none}>No figures are recorded at this evidence level.</p>
      ) : (
        <StatGrid>
          {answers.map(a => (
            <StatTile
              key={a.id}
              label={a.question}
              qualifier={a.qualifier}
              value={a.value}
              href={a.href}
              observation={<><b>{a.observation.strong}</b> {a.observation.rest}</>}
              status={a.status && <StatusBadge status={a.status.status}>{a.status.label}</StatusBadge>}
              definition={a.definition}
            >
              <IntervalBar {...a.interval} />
            </StatTile>
          ))}
        </StatGrid>
      )}
    </Section>
  );
}
