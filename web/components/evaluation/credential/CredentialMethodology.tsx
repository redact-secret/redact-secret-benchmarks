import { cx } from '../../../lib/cx';
import type { ReactNode } from 'react';
import { Breadcrumb, PageHead } from '../../page';
import { SegmentedNav } from '../../nav';
import { Note } from '../../feedback';
import { Section } from '../../layout';
import { DomainMethod, DomainReading } from '../domain';
import type { DomainViewData } from '../domain';
import styles from './CredentialMethodology.module.css';

export interface CredentialMethodologyData {
  head: DomainViewData['head']; method: DomainViewData['method']; reading: DomainViewData['reading'];
  limits: { label: string; text: string; href?: string }[];
}

export function CredentialMethodology({ head, method, reading, limits, className, sourceContent }: CredentialMethodologyData & { className?: string; sourceContent?: ReactNode }) {
  return <div className={cx(styles.view, className)}>
    <PageHead before={<Breadcrumb items={head.breadcrumb} />} eyebrow={head.eyebrow} title={head.title} lede={head.lede} meta={head.meta}
      actions={<SegmentedNav label={head.pairLabel} items={head.pair} currentHref={head.currentHref} />} />
    {sourceContent}
    <Note title="Looking for product coverage?" tone="info"><a href="/coverage/credential/">Open credential coverage for the exact product release, configuration and recorded limitations.</a></Note>
    <Section title="Evidence, execution and qualification">
      <p><a href="https://github.com/redact-secret/credential-evidence">credential-evidence</a> authors synthetic inputs, expected spans and controls from provider documentation, independent corroboration and project-policy decisions. Expected answers precede scanner output.</p>
      <p><a href="https://github.com/redact-secret/credential-eval">credential-eval</a> runs pinned configurations on those bytes and records span outcomes. A peer scanner is an observation, never the expected-answer authority.</p>
      <p><a href="https://github.com/redact-secret/redact-secret-benchmarks">benchmarks</a> owns the published qualification criteria and applies them to recorded evidence. The evaluator does not authorize product support. <a href="https://github.com/redact-secret/redact-secret">redact-secret</a> owns product behavior and declared scope.</p>
    </Section>
    <DomainMethod {...method} />
    <Section title="Current limits and policy interpretation">
      <p>Provider-documented, tool-corroborated and project-policy evidence remain distinct. Documented, empirical and policy-qualified benchmark classifications use their own evidence floors and criteria. Generic credential carriers can depend on context and explicit policy; they do not grant a provider-specific claim.</p>
      <p>The <a href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/benchmarks/support/policy-qualified-credentials.json">bounded credential policy contract</a> requires carrier context, value/span/action rules and independent benign/twin controls to distinguish ordinary values and look-alikes. Project-policy evidence does not become provider-documented evidence; outside-contract matches remain unknown or incidental. The <a href="https://github.com/redact-secret/redact-secret-benchmarks/blob/develop/docs/specs/policy-qualified-credentials.md">qualification rationale and exclusions</a> explains why a bounded policy classification does not establish live validity or provider-specific qualification.</p>
      {limits.map(limit => <div key={limit.label}><h3>{limit.label}</h3><p>{limit.text}{limit.href && <> <a href={limit.href}>Exact limitation record</a></>}</p></div>)}
      <p>Intervals describe the authored population. Unresolved, withheld and unavailable observations retain their stated reasons. None is a production traffic rate or a pooled cross-population score.</p>
    </Section>
    <Section title="Detailed evidence and results">
      <ul>
        <li><a href="/report/corpus/">Credential corpus and fixture inputs</a></li>
        <li><a href="/evaluation/qualification/">Official populations, qualification criteria and optional-scanner provenance</a></li>
        <li><a href="/report/families/">Complete family evidence inventory</a></li>
        <li><a href="/comparison/scanner/">Pinned scanners and configurations</a></li>
        <li><a href="/report/findings/">Findings and recorded follow-up</a></li>
        <li><a href="/comparison/accuracy/">Detailed accuracy observations</a></li>
      </ul>
      <ul aria-label="Credential method detail">{method.methods.map(row => <li key={row.term}><a href={`/evaluation/method/${row.term}/`}>{row.term} method and recorded checks</a></li>)}</ul>
    </Section>
    <DomainReading {...reading} />
  </div>;
}
