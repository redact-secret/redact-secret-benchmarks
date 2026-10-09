import { DomainMethod, type DomainMethodData } from '../domain';
import { Note } from '../../feedback';
import { Section } from '../../layout';
import { cx } from '../../../lib/cx';
import styles from './PiiMethodology.module.css';

export interface PiiMethodologyData {
  method: DomainMethodData;
  qualification: string;
  repositories: { label: string; href: string; responsibility: string }[];
  metricGroups: { label: string; text: string }[];
  definitionsHref: string;
  policyHref: string;
}

export function PiiMethodology({ method, qualification, repositories, metricGroups, definitionsHref, policyHref, className }: PiiMethodologyData & { className?: string }) {
  return <div className={cx(styles.methodology, className)}>
    <Note title="Looking for product capabilities?" tone="info" className={styles.coverageNote}><p><a href="/coverage/pii/">Open PII coverage</a> for the release-bound catalog, activation settings and limitations.</p></Note>
    <Section title="Evidence, evaluator and benchmark responsibilities">
      <ul className={styles.repositories}>{repositories.map(repo => <li key={repo.href}><a href={repo.href}>{repo.label}</a><p>{repo.responsibility}</p></li>)}</ul>
    </Section>
    <DomainMethod {...method} />
    <Section title="Metric groups and separate denominators">
      <p><strong>pii-v1 and b11 are different quantities.</strong> pii-v1 is neutral accounting owned by pii-eval, using authored occurrences, context trios, spans or axis assertions as each metric defines. b11 is the benchmark-owned product scorer, using scored cases, twin pairs or findings. The same ten metric IDs do not give them the same denominator or meaning.</p>
      <ul>{metricGroups.map(group => <li key={group.label}><strong>{group.label}</strong><p>{group.text}</p></li>)}</ul>
      <p>Unresolved assertions remain visible. Withheld values state why a value cannot be published; neither state is a zero or a pass. Measurable share includes all eligible authored axes, including unresolved axes.</p>
      <p><a href={definitionsHref}>Complete ten-metric definitions for both protocols</a></p>
      <p>The accepted interpretation policy keeps product thresholds and verdicts on b11 quantities. Those thresholds are not applied to pii-v1 observations, and no qualification transfers between protocols. <a href={policyHref}>Benchmark qualification profile and internal thresholds</a></p>
    </Section>
    <Section title="Population and qualification boundaries">
      <p>Each public synthetic population retains its own identity, methods, numerator, denominator and interval. Diagnostic-balanced, benign-heavy, separate public evidence and protected populations are never pooled. Synthetic rates are not production rates.</p>
      <p>Language and jurisdiction are separate dimensions. Korean or English context labels do not establish support for a national identifier. A type validator does not decide sensitivity in context.</p>
      <Note title="Current product qualification limitation" tone="info"><p>{qualification}</p></Note>
      <p>The benchmark-owned support policy requires its recorded gates and bound protected evidence. Public measurement validity alone never establishes product qualification. Ground truth authored before scanning, validator, cost and protected-path requirements remain unavailable where the recorded contract has not established them.</p>
    </Section>
    <Section title="Recorded results and diagnostic details">
      <p><a href="/evaluation/pii/results/">Population results, all metric selectors, method coverage, sources and execution details</a></p>
      <p><a href="/evaluation/pii/evidence/">Separate public evidence population and complete evidence-kind matrix</a></p>
      <p><a href="/coverage/pii/">PII product coverage</a></p>
    </Section>
  </div>;
}
