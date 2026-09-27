import { actionEmptyState, escapeHtml as e, statusMark } from '../components';
import type { EvaluationDomainDescriptor } from '../evaluation-domains';

/** Missing means credential for bookmark compatibility; any other explicit value fails closed. */
export function supportDomainOf(search: string): 'credential' | 'pii' | null {
  const values = new URLSearchParams(search).getAll('domain');
  if (values.length === 0) return 'credential';
  if (values.length !== 1) return null;
  return values[0] === 'credential' ? 'credential' : values[0] === 'pii' ? 'pii' : null;
}

const profileList = (domain: EvaluationDomainDescriptor) => domain.qualificationProfiles
  .map(item => `<code>${e(item.id)}@${e(String(item.version))}</code>`).join(' · ');

/** Keep the credential matrix unchanged while making its domain identity and alternative explicit. */
export function credentialSupportPage(content: string, domain: EvaluationDomainDescriptor): string {
  return `<div class="meta" role="group" aria-label="Support domain">
    <span>Domain <code>credential</code></span><span>Accounting <code>${e(domain.domainAccountingVersion)}</code></span><span>Qualification profiles ${profileList(domain)}</span>
    <a href="/support?domain=credential" aria-current="page">Credentials</a><a href="/support?domain=pii">PII</a>
  </div>${content}`;
}

export function piiSupportPage(domain: EvaluationDomainDescriptor): string {
  return `<div class="page-head"><div><h1>PII support</h1><div class="meta"><span>Domain <code>pii</code></span><span>Qualification profile ${profileList(domain)}</span><span>Accounting <code>${e(domain.domainAccountingVersion)}</code></span></div></div>
    <nav class="meta" aria-label="Support domain"><a href="/support?domain=credential">Credentials</a><a href="/support?domain=pii" aria-current="page">PII</a></nav></div>
    ${actionEmptyState({
      title: 'PII support is schema-only',
      body: 'The PII support projection is registered, but no family, jurisdiction, detector evidence or qualification result is published. Schema-only does not mean unsupported, provisional or stable.',
      mark: statusMark('not-measured', 'Schema only'),
    })}`;
}

export function supportDomainUnavailablePage(problem: string): string {
  return `<div class="page-head"><div><h1>Support</h1></div></div>${actionEmptyState({
    title: 'Support domain unavailable',
    body: `${e(problem)}. No credential or PII support evidence is shown for an unrecognized or invalid domain.`,
    mark: statusMark('not-measured'),
  })}`;
}
