import { cx } from '../../../lib/cx';
import type { ReactNode } from 'react';
import { KeyValueList } from '../../data';
import { Note } from '../../feedback';
import { Section } from '../../layout';
import { Breadcrumb, PageHead } from '../../page';
import { SegmentedNav } from '../../nav';
import type { CredentialCoverageData } from './types';
import styles from './CredentialCoverage.module.css';

export function CredentialCoverage({ release, configuration, binding, sourceRevision, counts, providers, scope, scopeSource, support, className, sourceContent }: CredentialCoverageData & { className?: string; sourceContent?: ReactNode }) {
  return <div className={cx(styles.view, className)}>
    <PageHead before={<Breadcrumb items={[{ label: 'Coverage', href: '/coverage/credential/' }, { label: 'Credential' }]} />} eyebrow="Coverage · Credential" title="Credential coverage"
      lede="Product scope and benchmark qualification are separate records. This catalog names what is recorded for the exact release and configuration; missing family declarations remain unknown."
      actions={<SegmentedNav label="Coverage domain" items={[{ label: 'Credential', href: '/coverage/credential/' }, { label: 'PII', href: '/coverage/pii/' }]} currentHref="/coverage/credential/" />} />
    {sourceContent}
    <p><a href="/evaluation/credential/">How credentials are evaluated</a> · <a href="/report/corpus/">Full credential corpus</a> · <a href="https://github.com/redact-secret/redact-secret">Product documentation</a></p>
    <Section title="Exact product and declared scope">
      <KeyValueList items={[{ term: 'Measured product', description: release }, { term: 'Configuration', description: configuration }, { term: 'Scope binding', description: binding }]} />
      <details><summary>Scope source and release identity</summary><p>{sourceRevision}</p><a href={scopeSource}>Reviewed product scope record</a></details>
      <Note title="Family declarations are not recorded" tone="info">The taxonomy and detector registry describe benchmark inventory. They do not provide a release-bound positive capability declaration for each family. Unknown is kept separate from unsupported and from qualification status.</Note>
      <KeyValueList items={counts.map(row => ({ term: row.label, description: row.value }))} />
      <p>{support}</p><a href="/evaluation/qualification/">Recorded qualification and its criteria</a>
    </Section>
    <Section title="Activation, input conditions and limitations" description="These statements describe the scope binding above. A historical scope record does not qualify another release or configuration.">
      <p>Generic labels and credential carriers require the recorded context/value contract and negative controls authored before scanner execution to distinguish ordinary values and look-alikes. Project-policy evidence stays project policy; outside-contract matches are unknown or incidental, with no provider-specific qualification. See the <a href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/support/policy-qualified-credentials.json">bounded credential policy contract</a> and its <a href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/policy-qualified-credentials.md">qualification rationale and exclusions</a>.</p>
      {scope.map(group => <div key={group.title}><h3>{group.title}</h3><ul>{group.statements.map(statement => <li key={statement}>{statement}</li>)}</ul></div>)}
      {!scope.length && <p>Activation and policy scope statements are not recorded.</p>}
    </Section>
    <Section title="Provider and family catalog" description="Open a provider for its recorded formats and qualification links. Evidence tiers, researched formats and stable/provisional/pending labels describe different records; none supplies an absent capability declaration.">
      {!providers.length && <p>No taxonomy families are recorded. Product capability remains unknown.</p>}
      {providers.map(provider => <details key={provider.id} className={styles.provider}><summary>{provider.name}</summary><a href={provider.href}>Provider evidence detail</a>
        <ul className={styles.rows}>{provider.rows.map(row => <li key={row.id} id={`coverage-${row.id.replace(':', '--')}`}>
          <h3><a href={row.href}>{row.name}</a></h3><p>{row.description}</p>
          <KeyValueList items={[{ term: 'Declared capability', description: row.declaration }, { term: 'Recorded qualification', description: row.qualification }, { term: 'Recorded format', description: row.format }, { term: 'Measured contract context', description: row.context }]} />
          <p>{row.research}</p>{row.qualificationHref && <p><a href={row.qualificationHref}>Exact qualification detail</a></p>}
          {row.sources.length > 0 && <ul>{row.sources.map((source, index) => <li key={`${source.href}-${index}`}><a href={source.href}>{source.label}</a></li>)}</ul>}
        </li>)}</ul>
      </details>)}
    </Section>
    <Note className={styles.evidenceNote} title="Full evidence remains inspectable" tone="info">Unsupported, unknown and research-pending families remain in the <a href="/report/families/">full family inventory</a>. The <a href="/report/corpus/">credential corpus</a> and <a href="/evaluation/qualification/">qualification results</a> retain their own denominators.</Note>
  </div>;
}
