import { EmptyState, StatusBadge } from '../feedback';
import { Section } from '../layout';
import { Code } from '../text';
import { cx } from '../../lib/cx';
import type { FamilyFormatData } from './types';
import styles from './FamilyFormat.module.css';

export interface FamilyFormatProps extends FamilyFormatData { name: string; className?: string }

export function FamilyFormat({ name, provenance, absent, shape, claims, questions, className }: FamilyFormatProps) {
  return <Section title="Format" description={`Provider format research from ${provenance}.`} className={cx(styles.format, className)}>
    {absent ? <EmptyState title="Format not recorded"><p>{absent}</p><StatusBadge status="not-measured">Not recorded</StatusBadge></EmptyState> : <div className={styles.groups}>
      <div><h3 className={styles.h3}>What it looks like</h3>
        {shape.length ? <><dl className={styles.shape}>{shape.map((part, i) => <div key={`${part.label}-${i}`} className={styles.part}><dt>{part.label}</dt><dd><Code>{part.value}</Code></dd></div>)}</dl><p className={styles.note}>Parts are shown as recorded. Evidence classes belong to the facts below; no class is assigned to a part.</p></> : <p>Shape not recorded.</p>}
      </div>
      <div><h3 className={styles.h3}>Format facts</h3>
        {claims.length ? <ul className={styles.list} aria-label={`Format facts for ${name}`}>{claims.map(claim => <li key={claim.id} className={cx(styles.fact, styles[claim.evidenceClass])}>
          <p><b>{claim.evidenceLabel}</b> · <Code>{claim.id}</Code> · {claim.temporality} · observed {claim.date}</p><p>{claim.text}</p>
          {claim.sources.length ? <ul className={styles.sources}>{claim.sources.map(source => <li key={source.id}><a href={source.href} rel="noreferrer">{source.label}</a><small>{source.detail}</small></li>)}</ul> : <p className={styles.note}>Source not recorded.</p>}
        </li>)}</ul> : <p>Format facts not recorded.</p>}
      </div>
      <div><h3 className={styles.h3}>Open questions</h3>
        {questions.length ? <ul className={styles.list} aria-label={`Format questions for ${name}`}>{questions.map(question => <li className={styles.fact} key={question.ref}><p><Code>{question.ref}</Code>{question.at && <> · raised {question.at}</>}</p><p>{question.text}</p></li>)}</ul> : <p>No open question is recorded for this revision.</p>}
      </div>
    </div>}
  </Section>;
}
