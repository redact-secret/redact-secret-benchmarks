import { KeyValueList } from '../../data';
import { Chip, StatusBadge } from '../../feedback';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './RcBuilds.module.css';
import type { RcBuild, RcBuildsData, RcFact } from './types';

export interface RcBuildsProps extends RcBuildsData {
  className?: string;
}

function Value({ fact }: { fact: RcFact }) {
  const text = fact.mono ? <code className={styles.mono}>{fact.value}</code> : fact.value;
  return (
    <>
      {fact.href ? <a href={fact.href} rel="noreferrer">{text}</a> : text}
      {fact.note && <small className={styles.note}> {fact.note}</small>}
    </>
  );
}

function Build({ build }: { build: RcBuild }) {
  return (
    <div className={styles.build} data-build={build.mode}>
      <p className={styles.role}>
        <span className={styles.roleName}>{build.role}</span>
        <StatusBadge status={build.mode === 'candidate' ? 'info' : 'none'}>{build.mode}</StatusBadge>
        {build.tags.map(tag => <Chip key={tag} mono={false}>{tag}</Chip>)}
      </p>
      <p className={styles.heading}>
        <span className={styles.version}>{build.heading}</span>
        {build.subheading && <small className={styles.sub}> {build.subheading}</small>}
      </p>
      <KeyValueList items={build.facts.map(f => ({ term: f.term, description: <Value fact={f} /> }))} />
    </div>
  );
}

/**
 * The two builds being compared: the last release and, when one is recorded, the release candidate. Each
 * states its mode (published or candidate), commit, date and run. With no candidate only the release shows.
 */
export function RcBuilds({ title, release, candidate, className }: RcBuildsProps) {
  return (
    <Section title={title} className={cx(styles.builds, className)}>
      <div className={cx(styles.pair, !candidate && styles.single)}>
        <Build build={release} />
        {candidate && (
          <>
            <p className={styles.arrow} aria-hidden="true">→</p>
            <Build build={candidate} />
          </>
        )}
      </div>
    </Section>
  );
}
