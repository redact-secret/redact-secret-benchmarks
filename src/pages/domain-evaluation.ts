import { actionEmptyState, escapeHtml as e, statusMark } from '../components';
import type { EvaluationDomainDescriptor } from '../evaluation-domains';

const domainLinks = (selected: EvaluationDomainDescriptor['domain']) => `<nav class="meta" aria-label="Evaluation domain">
  <a href="/evaluation/credentials"${selected === 'credential' ? ' aria-current="page"' : ''}>Credentials</a>
  <a href="/evaluation/pii"${selected === 'pii' ? ' aria-current="page"' : ''}>PII</a>
</nav>`;

const profiles = (domain: EvaluationDomainDescriptor) => domain.qualificationProfiles
  .map(profile => `<code>${e(profile.id)}@${e(String(profile.version))}</code>`).join(' · ');

const head = (domain: EvaluationDomainDescriptor, title: string) => `<div class="page-head"><div><h1>${e(title)}</h1><div class="meta">
  <span>Domain <code>${e(domain.domain)}</code></span>
  <span>Report profile <code>${e(domain.reportProfile.id)}@${e(String(domain.reportProfile.version))}</code></span>
  <span>Accounting <code>${e(domain.domainAccountingVersion)}</code></span>
</div></div>${domainLinks(domain.domain)}</div>`;

/** Public domain landing pages name their own accounting and qualification identities; they never combine metric spaces. */
export function domainEvaluationPage(domain: EvaluationDomainDescriptor, workbenchAvailable = true): string {
  if (domain.domain === 'credential') {
    return `${head(domain, 'Credential evaluation')}
      <p class="prose small">Credential evidence keeps its existing case, variant, assertion and qualification views. It is measured only under the <code>${e(domain.evaluationProfile)}</code> evaluation profile and is not combined with PII results.</p>
      <section class="section"><h2 class="h2-compact">Qualification profiles</h2><p class="small">${profiles(domain)}</p>
        ${workbenchAvailable ? '<p><a href="/workbench">Open credential evaluation evidence in Workbench</a></p>' : '<p class="small">The public domain route preserves the published credential identity; maintainer-only evidence views are not included in this build.</p>'}</section>`;
  }
  return `${head(domain, 'PII evaluation')}
    ${actionEmptyState({
      title: 'PII evaluation is schema-only',
      body: `The <code>${e(domain.evaluationProfile)}</code> evaluation profile and ${profiles(domain)} qualification profile are registered, but no public PII evaluation artifact or detector evidence is published. No status, rate or cross-domain score can be inferred from this state.`,
      mark: statusMark('not-measured', 'Schema only'),
    })}`;
}

export function domainEvaluationUnavailablePage(domain: 'credential' | 'pii', problem: string): string {
  const title = domain === 'credential' ? 'Credential evaluation' : 'PII evaluation';
  return `<div class="page-head"><div><h1>${title}</h1></div>${domainLinks(domain)}</div>${actionEmptyState({
    title: 'Evaluation domain metadata unavailable',
    body: `${e(problem)}. Domain evidence is withheld until the published domain index validates.`,
    mark: statusMark('not-measured'),
  })}`;
}
