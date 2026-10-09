import Link from 'next/link';
import type { ReactNode } from 'react';
import { KeyValueList } from '../data';
import { Code, CodeBlock } from '../text';
import { cx } from '../../lib/cx';
import styles from './FixtureWhy.module.css';
import type { FixtureActionsData, FixtureFactData } from './fixtureTypes';

export interface FixtureWhyProps {
  facts: FixtureFactData[];
  sources: { href: string; label: string }[];
  /** The command that reproduces the suite. */
  command: string;
  /** The exact bytes as an escaped string; absent when the bytes are not recorded. */
  escaped?: string;
  actions: FixtureActionsData;
  className?: string;
}

function valueOf(fact: FixtureFactData): ReactNode {
  if (fact.notRecorded) return <span className={styles.missing}>Not recorded</span>;
  if (fact.links) {
    return fact.links.map((l, i) => (
      <span key={l.href}>
        {i > 0 && ' · '}
        {l.external ? <a href={l.href} rel="noreferrer">{l.label}</a> : <Link href={l.href}>{l.label}</Link>}
      </span>
    ));
  }
  const text = fact.mono ? <Code>{fact.value}</Code> : fact.value;
  return fact.href ? <Link href={fact.href}>{text}</Link> : text;
}

/**
 * Why the fixture exists, in the corpus's own recorded words: what it expects and why, its evidence level,
 * family, detectors, scenarios, where it was added and its sources, then the file itself with the way to
 * take the exact bytes and to reproduce the suite. A fact the corpus does not hold reads "Not recorded",
 * drawn dashed; nothing is filled in. Pure render.
 */
export function FixtureWhy({ facts, sources, command, escaped, actions, className }: FixtureWhyProps) {
  return (
    <div className={cx(styles.why, className)}>
      <KeyValueList
        items={[
          ...facts.map(fact => ({
            term: fact.term,
            description: <>{valueOf(fact)}{fact.note && <small className={styles.note}>{fact.note}</small>}</>,
          })),
          ...(sources.length ? [{ term: 'Sources', description: <span className={styles.sources}>{sources.map(s => <a key={s.href} href={s.href} rel="noreferrer">{s.label}</a>)}</span> }] : []),
        ]}
      />
      <div className={styles.actions}>
        {actions.download
          ? <a className={styles.action} href={actions.download.href} download={actions.download.filename}>Download exact bytes</a>
          : <span className={cx(styles.action, styles.off)}>{actions.bytesNotRecorded ? 'Exact bytes unavailable in this view' : 'Exact bytes cannot be saved as UTF-8'}</span>}
        <Link className={styles.action} href={actions.corpusHref}>View in corpus</Link>
      </div>
      <details className={styles.more}>
        <summary>{escaped === undefined ? 'Reproduce' : 'Reproduce and escaped bytes'}</summary>
        <div className={styles.body}>
          <CodeBlock label="Command that reproduces this suite">{command}</CodeBlock>
          {escaped !== undefined && <CodeBlock variant="snippet" label="The exact bytes, escaped">{escaped}</CodeBlock>}
        </div>
      </details>
    </div>
  );
}
