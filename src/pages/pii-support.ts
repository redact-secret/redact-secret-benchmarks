import { actionEmptyState, escapeHtml as e, statusMark } from '../components';
import type { EvaluationDomainDescriptor } from '../evaluation-domains';
import type { EvaluationDomainDescriptorV2 } from '../evaluation-domains-v2';
import type { PiiSupportMatrixFile } from '../pii-support-model';
import { SUPPORT_STATUSES } from '../support-model';
import type { SupportStatus } from '../../benchmarks/support/status.ts';
import { isPiiJurisdiction } from '../../benchmarks/evaluation/domains/pii/jurisdictions.ts';

export type SupportQuery = { domain: 'credential'; status: SupportStatus | 'all' } |
  { domain: 'pii'; family: string | null; jurisdiction: string | null };
const encoded = (search: string) => {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  if (!raw) return true;
  try { return raw.split('&').every(part => part.length > 0 && part.split('=').every(value => (decodeURIComponent(value.replace(/\+/g, ' ')), true))); }
  catch { return false; }
};
/** One fail-closed parser owns both legacy credential filters and PII identities. */
export function supportQueryOf(search: string): SupportQuery | null {
  if (!encoded(search)) return null;
  const query = new URLSearchParams(search), keys = [...query.keys()];
  if (new Set(keys).size !== keys.length || [...query.values()].some(value => value === '')) return null;
  const domain = query.get('domain') ?? 'credential';
  if (domain === 'credential') {
    if (keys.some(key => !['domain', 'status'].includes(key))) return null;
    const status = query.get('status') ?? 'all';
    return status === 'all' || SUPPORT_STATUSES.includes(status as SupportStatus) ? { domain, status: status as SupportStatus | 'all' } : null;
  }
  if (domain !== 'pii' || keys.some(key => !['domain', 'family', 'jurisdiction'].includes(key))) return null;
  const family = query.get('family'), jurisdiction = query.get('jurisdiction');
  if (family && jurisdiction) return null;
  if (family && !/^pii:(?:global|[a-z]{2}):[a-z0-9]+(?:-[a-z0-9]+)*$/.test(family)) return null;
  if (jurisdiction && !isPiiJurisdiction(jurisdiction)) return null;
  if (family) {
    const familyScope = family.split(':')[1];
    if (familyScope !== 'global' && !isPiiJurisdiction(familyScope.toUpperCase())) return null;
  }
  return { domain, family, jurisdiction };
}
export const supportDomainOf = (search: string): 'credential' | 'pii' | null => supportQueryOf(search)?.domain ?? null;

const profileList = (domain: Pick<EvaluationDomainDescriptor, 'qualificationProfiles'>) => domain.qualificationProfiles
  .map(item => `<code>${e(item.id)}@${e(String(item.version))}</code>`).join(' · ');

/** Keep the credential matrix unchanged while making its domain identity and alternative explicit. */
export function credentialSupportPage(content: string, domain: EvaluationDomainDescriptor): string {
  return `<div class="meta" role="group" aria-label="Support domain">
    <span>Domain <code>credential</code></span><span>Accounting <code>${e(domain.domainAccountingVersion)}</code></span><span>Qualification profiles ${profileList(domain)}</span>
    <a href="/support?domain=credential" aria-current="page">Credentials</a><a href="/support?domain=pii">PII</a>
  </div>${content}`;
}

export type PiiSupportQuery = Extract<SupportQuery, { domain: 'pii' }>;
export const piiSupportQueryOf = (search: string): PiiSupportQuery | null => {
  const query = supportQueryOf(search); return query?.domain === 'pii' ? query : null;
};
export function piiSupportQueryProblem(query: PiiSupportQuery, matrix: PiiSupportMatrixFile): string | null {
  if (query.family && !matrix.families.some(row => row.family === query.family)) return 'Unknown PII family identity';
  if (query.jurisdiction && !matrix.families.some(row => row.jurisdiction === query.jurisdiction)) return 'Unknown PII jurisdiction identity';
  return null;
}

export function piiSupportPage(domain: EvaluationDomainDescriptorV2, matrix: PiiSupportMatrixFile, query: PiiSupportQuery): string {
  const selected = matrix.families.filter(row => !query.family && !query.jurisdiction || Boolean(query.family && row.family === query.family) || Boolean(query.jurisdiction && row.jurisdiction === query.jurisdiction));
  const rows = selected.map(row => `<article data-support-status="${e(row.status.state)}" data-family="${e(row.family)}"><div><b>${e(row.displayName)}</b><small><code>${e(row.family)}</code> · ${e(row.identityDomain)} · ${e(row.scope)}</small></div><div>${statusMark(row.status.state === 'stable' ? 'pass' : row.status.state === 'unsupported' ? 'withheld' : 'not-measured', row.status.state)}<small>Profile <code>${e(row.status.profile.id)}@${e(String(row.status.profile.version))}</code> · ${row.status.reasonCodes.map(e).join(' · ')}</small></div></article>`).join('');
  const comparisons = matrix.populationComparisons.map(comparison => {
    const regressions = comparison.benignFalseAlarmDeltas.filter(row => row.regressed).map(row =>
      `<li><code>${e(row.family)}</code> · ${e(row.scope)} · ${e(row.contextClass)} · ${e(row.evidenceClass)} · delta ${e(String(row.delta))}</li>`).join('');
    const diagnostics = comparison.diagnosticDeltas.filter(row => row.regressed).map(row =>
      `<li>${e(row.axis)} · delta ${e(String(row.delta))} · failed delta ${e(String(row.failedDelta))}</li>`).join('');
    return `<article data-population="${e(comparison.id)}" data-population-verdict="${e(comparison.verdict)}"><div><b>${e(comparison.id)}</b><small>${comparison.status === 'compared' ? 'Baseline/candidate comparison' : 'No bound baseline/candidate comparison published'}</small></div><div>${statusMark(comparison.verdict === 'no-regression' ? 'pass' : comparison.verdict === 'regression' ? 'fail' : 'not-measured', comparison.verdict)}${regressions || diagnostics ? `<ul>${regressions}${diagnostics}</ul>` : ''}</div></article>`;
  }).join('');
  return `<div class="page-head"><div><h1>PII support</h1><div class="meta"><span>Domain <code>pii</code></span><span>Qualification profile ${profileList(domain)}</span><span>Accounting <code>${e(domain.domainAccountingVersion)}</code></span></div></div>
    <nav class="meta" aria-label="Support domain"><a href="/support?domain=credential">Credentials</a><a href="/support?domain=pii" aria-current="page">PII</a></nav></div>
    <p class="prose small">This benchmark measures and records family-level PII evidence; <code>supportClaims=false</code>. It does not infer one jurisdiction or identity family from a neighbor.</p>
    <section><h2>Population regression views</h2><p class="small">Diagnostic-balanced and benign-heavy stress remain separate; a local regression is never hidden by an aggregate improvement.</p>${comparisons}</section>
    ${rows || actionEmptyState({ title: query.family || query.jurisdiction ? 'No matching PII family' : 'PII support is pending', body: query.family || query.jurisdiction ? 'The requested identity is not present in the validated arrival registry.' : 'No PII family has arrived in the canonical registry. Absence is not an unsupported, provisional or stable claim.', mark: statusMark('not-measured') })}`;
}

export function supportDomainUnavailablePage(problem: string): string {
  return `<div class="page-head"><div><h1>Support</h1></div></div>${actionEmptyState({
    title: 'Support domain unavailable',
    body: `${e(problem)}. No credential or PII support evidence is shown for an unrecognized or invalid domain.`,
    mark: statusMark('not-measured'),
  })}`;
}
