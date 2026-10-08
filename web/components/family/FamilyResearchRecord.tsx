import { EmptyState, StatusBadge, StatusBar } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import styles from './FamilyResearchRecord.module.css';
import type { FamilyRecordLine, FamilyResearchRecordData } from './types';

export interface FamilyResearchRecordProps extends FamilyResearchRecordData {
  /** The family's name, for the accessible names of the lists. */
  name: string;
  className?: string;
}

function Lines({ title, label, lines, code }: { title: string; label: string; lines: FamilyRecordLine[]; code: boolean }) {
  if (lines.length === 0) return null;
  return (
    <div>
      <h3 className={styles.h3}>{title}</h3>
      <ul className={styles.list} aria-label={label}>
        {lines.map(line => (
          <li key={`${line.ref}|${line.text}`} className={styles.row}>
            <span className={styles.ref}>{code ? <Code>{line.ref}</Code> : <b>{line.ref}</b>}{line.at && <small> · {line.at}</small>}</span>
            <span className={styles.text}>{line.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The family's research record as the canonical credential-evidence records state it (#591): review state, format revision, research
 * state and date in one bar, then every revision when there is more than one, every blocker part, and every recorded ruling by its
 * reference. It describes the research only: no scanner, product or support status is drawn from it. A family the records do not hold
 * reads "Not recorded" with the reason, dashed.
 */
export function FamilyResearchRecord({ name, provenance, absent, facts, revisions, blockers, rulings, review, recordHref, className }: FamilyResearchRecordProps) {
  return (
    <Section
      title="Research record"
      description={`From ${provenance}. It describes the research on the format, not what any scanner or the product does, and not a support status.`}
      className={cx(styles.record, className)}
    >
      <StatusBar label={`Research record for ${name}`} items={facts} />
      {absent ? (
        <EmptyState title={absent.title}>
          <p>{absent.text}</p>
          <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
        </EmptyState>
      ) : (
        <div className={styles.groups}>
          {revisions.length > 0 && (
            <div>
              <h3 className={styles.h3}>Format revisions</h3>
              <ul className={styles.list} aria-label={`Format revisions of ${name}`}>
                {revisions.map(r => (
                  <li key={r.id} className={cx(styles.row, r.current && styles.current)}>
                    <span className={styles.ref}><b>{r.label}</b> <Code>{r.id}</Code></span>
                    <span className={styles.text}>{r.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Lines title="What blocks the research" label={`Research blockers for ${name}`} lines={blockers} code={false} />
          <Lines title="Rulings" label={`Rulings recorded for ${name}`} lines={rulings} code />
          {(review || recordHref) && (
            <p className={styles.review}>
              {review}
              {recordHref && <> <a href={recordHref} rel="noreferrer">The family record at this release</a>.</>}
            </p>
          )}
        </div>
      )}
    </Section>
  );
}
