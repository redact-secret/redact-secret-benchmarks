import Link from 'next/link';
import { KeyValueList } from '../../data';
import { Disclosure } from '../../disclosure';
import { StatusBadge } from '../../feedback';
import { Grid, Section } from '../../layout';
import { Code, CodeBlock } from '../../text';
import { cx } from '../../../lib/cx';
import type { ScannerFact, ScannerProfileData } from './types';
import styles from './ScannerProfile.module.css';

export interface ScannerProfileProps extends ScannerProfileData {
  className?: string;
}

function value(fact: ScannerFact) {
  if (fact.value === null) {
    return (
      <>
        <StatusBadge status="not-measured">{fact.missing ?? 'Not recorded'}</StatusBadge>
        {fact.note && <small className={styles.note}>{fact.note}</small>}
      </>
    );
  }
  return (
    <>
      {fact.code ? <Code>{fact.value}</Code> : fact.value}
      {fact.note && <small className={styles.note}>{fact.note}</small>}
    </>
  );
}

/**
 * One scanner: what it is, then the same four groups for every scanner (install and pin, how it ran, where it ran,
 * rules), what is out of scope, and the comparison pages it is in. A fact the repository does not hold is a dashed
 * "Not recorded". Nothing here says how well the scanner did.
 */
export function ScannerProfile({ id, name, version, kind, description, groups, command, outOfScope, scope, compared, className }: ScannerProfileProps) {
  return (
    <div id={id} className={cx(styles.profile, className)}>
      <Section title={`${name} ${version}`} eyebrow={kind ?? undefined} description={description ?? undefined}>
        <Grid columns={2} gap="lg">
          {groups.map(group => (
            <div key={group.title} className={styles.group}>
              <h3 className={styles.h3}>{group.title}</h3>
              <KeyValueList items={group.facts.map(f => ({ term: f.term, description: value(f) }))} />
            </div>
          ))}
        </Grid>
        {command && (
          <Disclosure variant="plain" summary={command.summary}>
            <CodeBlock variant="snippet" label={command.label}>{command.text}</CodeBlock>
          </Disclosure>
        )}
        <div className={styles.group}>
          <h3 className={styles.h3}>Out of scope</h3>
          {scope ? (
            <>
              <KeyValueList items={scope.facts.map(f => ({ term: f.term, description: value(f) }))} />
              {scope.groups.map(g => (
                <div key={g.title} className={styles.scopeGroup}>
                  <h4 className={styles.h4}>{g.title}</h4>
                  <p className={styles.note}>{g.note}</p>
                  <ul className={styles.list}>{g.items.map(text => <li key={text}>{text}</li>)}</ul>
                </div>
              ))}
            </>
          ) : outOfScope ? (
            <ul className={styles.list}>{outOfScope.map(text => <li key={text}>{text}</li>)}</ul>
          ) : (
            <p><StatusBadge status="not-measured">Not recorded</StatusBadge></p>
          )}
        </div>
        {compared.length > 0 && (
          <nav className={styles.group} aria-label={`${name} on the comparison pages`}>
            <h3 className={styles.h3}>Compared on</h3>
            <ul className={styles.links}>
              {compared.map(link => <li key={link.href}><Link href={link.href}>{link.label}</Link></li>)}
            </ul>
          </nav>
        )}
      </Section>
    </div>
  );
}
