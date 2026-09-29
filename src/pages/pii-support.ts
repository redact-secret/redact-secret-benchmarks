import { actionEmptyState, commitmentChip, domainBar, escapeHtml as e, statusMark, type StatusKind } from '../components';
import type { EvaluationDomainDescriptor } from '../evaluation-domains';
import type { EvaluationDomainDescriptorV2 } from '../evaluation-domains-v2';
import type { PiiAuthority, PiiAuthoritySupport, PiiSupportMatrixFile } from '../pii-support-model';
import { SUPPORT_STATUSES } from '../support-model';
import type { SupportStatus } from '../../benchmarks/support/status.ts';
import { isPiiJurisdiction, PII_JURISDICTION_STANDARD } from '../../benchmarks/evaluation/domains/pii/jurisdictions.ts';
import { SUPPORT_STATUS_COPY } from './support';

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

/** One DomainBar for both support domains: the switch is a control, the identity beside it is read. */
const supportDomainBar = (selected: 'credential' | 'pii', domain: Pick<EvaluationDomainDescriptor, 'domainAccountingVersion' | 'qualificationProfiles'>) => domainBar({
  label: 'Support domain',
  links: [{ href: '/support?domain=credential', label: 'Credentials', current: selected === 'credential' }, { href: '/support?domain=pii', label: 'PII', current: selected === 'pii' }],
  identities: [{ label: 'Domain', value: `<code>${selected}</code>` }, { label: 'Accounting', value: `<code>${e(domain.domainAccountingVersion)}</code>` },
    { label: 'Qualification', value: profileList(domain) }],
});

/** Keep the credential matrix unchanged while making its domain identity and alternative explicit. */
export function credentialSupportPage(content: string, domain: EvaluationDomainDescriptor): string {
  return `${supportDomainBar('credential', domain)}${content}`;
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

type PiiFamily = PiiSupportMatrixFile['families'][number];
type PiiComparison = PiiSupportMatrixFile['populationComparisons'][number];

const SUPPORTS_ORDER: PiiAuthoritySupport[] = ['lexical', 'validation', 'allocation', 'reserved-control', 'sensitivity'];
const SOURCE_KIND: Record<PiiAuthority['sourceKind'], string> = { standard: 'Standard', 'public-authority': 'Public authority' };
const CONTEXT_OBLIGATION: Record<string, string> = {
  none: 'No context obligation', reinforcing: 'Context reinforces', 'required-for-sensitive-classification': 'Context required for a sensitive classification',
};
/** Activation is a separate axis from support: a family can be switchable in the product and still pending here. */
const ACTIVATION: Record<string, () => string> = {
  'not-measured': () => statusMark('not-measured', 'Activation not measured'), unavailable: () => '<span class="st st-none">Not in the recorded activation</span>',
  available: () => statusMark('pass', 'Available'), 'explicitly-unsupported': () => statusMark('fail', 'Explicitly unsupported'),
};
const POPULATION_ROLE: Record<string, string> = {
  'diagnostic-balanced': 'Development-only tuning view for type, validator and context behaviour. It does not decide a release.',
  'benign-heavy-stress': 'Evaluation-only view dominated by non-sensitive occurrences. A false-alarm regression has to show here.',
};
const VERDICT: Record<PiiComparison['verdict'], { kind: StatusKind; tone: string }> = {
  'no-regression': { kind: 'pass', tone: 'ok' }, regression: { kind: 'fail', tone: 'bad' }, 'not-measured': { kind: 'not-measured', tone: 'nm' },
};
const signed = (value: number | null) => value === null ? 'not measured' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}`;
const label = (text: string) => `<span class="visually-hidden">${e(text)}: </span>`;
const chip = (text: string, tone = '') => `<span class="chip${tone ? ` ${tone}` : ''}">${e(text)}</span>`;

const supportsOf = (row: PiiFamily) => SUPPORTS_ORDER.filter(kind => row.authority.some(source => source.supports.includes(kind)));
const sourceName = (source: PiiAuthority) => /^https:\/\//.test(source.locator)
  ? `<a href="${e(source.locator)}" rel="noopener noreferrer">${e(source.sourceId)}</a>` : `<code>${e(source.sourceId)}</code>`;

/** AuthorityList: what each source backs. Sensitivity is backed by its own source; it is never derived from the format. */
const authorityList = (row: PiiFamily) => `<div class="tbl"><table><caption>Authority for <code>${e(row.family)}</code></caption>
  <thead><tr><th scope="col">Source</th><th scope="col">Kind</th><th scope="col">Revision</th><th scope="col">Supports</th></tr></thead><tbody>${row.authority.map(source =>
    `<tr><td>${sourceName(source)}</td><td>${e(SOURCE_KIND[source.sourceKind])}</td><td><code>${e(source.revision)}</code></td><td><span class="chips">${SUPPORTS_ORDER.filter(kind => source.supports.includes(kind)).map(kind => chip(kind)).join('')}</span></td></tr>`).join('')}</tbody></table></div>`;

/** Validator evidence is a structural fact of the family here; bits and pass rates arrive with measurements, not before. */
const validatorLine = (row: PiiFamily) => row.validatorApplicable
  ? `${statusMark('not-measured', 'Validator not measured')} <small>A checksum or allocation validator applies to this family. A validator failure proves the validator ran; on its own it is not semantic evidence.</small>`
  : `<span class="st st-none">No validator</span> <small>No checksum or allocation check applies; the type axis rests on syntax and authority alone.</small>`;

const populationEvidence = (row: PiiFamily) => `<ul class="plain">${row.populationEvidence.map(item =>
  `<li><code>${e(item.id)}</code> · ${item.status === 'not-measured' ? statusMark('not-measured') : e(item.status)} · strata ${e(String(item.strata))}</li>`).join('')}</ul>`;

type PiiRoute = NonNullable<PiiSupportMatrixFile['protectedRoute']>;
/** The protected-disposition evidence behind a routed status: its reason, coverage and the committed custody identities. */
const protectedBlock = (routed: PiiRoute['families'][number]) => `<div class="family-block" data-protected-reason="${e(routed.reason)}"><h3 class="h3">Protected disposition</h3>
  <p class="small">${routed.status === 'provisional' ? 'Every public gate and the sealed protected run are met under an accepted custody.' : `Held at pending: <code>${e(routed.reason)}</code>.`}
  Coverage: ${e(routed.coverage.note)}${routed.coverage.jurisdiction ? ` (jurisdiction <code>${e(routed.coverage.jurisdiction)}</code>)` : ''}${routed.coverage.contract ? `, per <code>${e(routed.coverage.contract)}</code> as frozen` : ''}.</p>
  <p class="commitments">${commitmentChip({ label: 'Epoch', commitment: routed.epochCommitment, note: 'Reviewed binding' })}${commitmentChip({ label: 'Custody', commitment: routed.trustCommitment, note: 'Reviewed binding' })}</p></div>`;

/** PiiFamilyRow: scope instead of provider, authority instead of detectors, and no link down to fixture bytes; the artifact cannot carry them. */
function familyRow(row: PiiFamily, open: boolean, route: PiiRoute | null): string {
  const copy = SUPPORT_STATUS_COPY[row.status.state], activation = ACTIVATION[row.activation.state];
  const supports = supportsOf(row), routed = route?.families.find(entry => entry.family === row.family) ?? null;
  return `<details class="pii-family" data-support-status="${e(row.status.state)}" data-family="${e(row.family)}"${open ? ' open' : ''}><summary>
    <span class="nm">${label('Family')}${e(row.displayName)}<small><code>${e(row.family)}</code> · ${e(row.identityDomain)} · ${e(row.scope)}</small>${routed ? `<small class="coverage">${e(routed.coverage.note)}</small>` : ''}</span>
    <span>${label('Status')}${statusMark(copy.kind, copy.word)}<small>Profile <code>${e(row.status.profile.id)}@${e(String(row.status.profile.version))}</code></small><small class="reasons">${row.status.reasonCodes.map(e).join(' · ')}</small></span>
    <span>${label('Authority')}${row.authority.length} ${row.authority.length === 1 ? 'source' : 'sources'}<small>${supports.map(e).join(' · ')}</small></span>
    <span class="small">${label('Context')}${e(CONTEXT_OBLIGATION[row.contextObligation] ?? row.contextObligation)}</span>
    <span>${label('Activation')}${activation()}<small><code>${e(row.activation.selector)}</code></small></span>
  </summary><div class="pii-family-detail">
    ${routed ? protectedBlock(routed) : ''}<div class="family-block"><h3 class="h3">Authority</h3>${authorityList(row)}</div>
    <div class="cols2"><div class="family-block"><h3 class="h3">Validator</h3><p class="small">${validatorLine(row)}</p></div>
      <div class="family-block"><h3 class="h3">Population evidence</h3>${populationEvidence(row)}</div></div>
    <p class="small">Selector <code>${e(row.activation.selector)}</code> enables this family only; it does not enable a neighbouring family or jurisdiction.${row.jurisdiction ? ` Jurisdiction is read from the <code>scope</code> field (<code>${e(row.scope)}</code>), not from the identifier.` : ''}</p>
  </div></details>`;
}

/** JurisdictionScope: a list, never a map. The pinned standard is not the denominator of our coverage. */
function jurisdictionScope(matrix: PiiSupportMatrixFile): string {
  const withEvidence = matrix.families.filter(row => row.jurisdiction !== null);
  const codes = [...new Set(withEvidence.map(row => row.jurisdiction as string))].sort();
  return `<section class="section" aria-labelledby="pii-jurisdictions"><h2 class="h2-compact" id="pii-jurisdictions">Jurisdictions</h2>
    <p class="small">A jurisdiction is listed only when a family in the registry carries it. Enabling one does not enable a neighbour.</p>
    <div class="pii-jurisdictions"><div><p class="eyebrow muted">With a registered family · ${codes.length}</p>
      ${codes.length ? `<p class="chips">${codes.map(code => withEvidence.filter(row => row.jurisdiction === code).map(row =>
        `<a class="chip on" href="/support?domain=pii&amp;jurisdiction=${e(code)}">${e(code)} · <code>${e(row.family)}</code></a>`).join('')).join('')}</p>`
        : '<p class="small">No jurisdictional family has arrived. Global families carry no jurisdiction.</p>'}</div>
      <div><p class="eyebrow muted">Identifier standard</p><p class="small"><code>${e(PII_JURISDICTION_STANDARD.id)}</code> · <code>${e(PII_JURISDICTION_STANDARD.revision)}</code> · ${e(String(PII_JURISDICTION_STANDARD.codeCount))} codes. A valid code is an identity check, <b>not evidence</b>; the size of the standard is not a coverage denominator.</p></div>
    </div></section>`;
}

/** PopulationComparison: a regression verdict per population, in its own card, listing only the regressed strata on all four axes. */
function populationComparison(comparison: PiiComparison): string {
  const verdict = VERDICT[comparison.verdict];
  const regressions = comparison.benignFalseAlarmDeltas.filter(row => row.regressed).map(row =>
    `<li><code>${e(row.family)}</code> · ${e(row.scope)} · ${e(row.contextClass)} · <code>${e(row.evidenceClass)}</code> · delta ${e(signed(row.delta))}</li>`).join('');
  const diagnostics = comparison.diagnosticDeltas.filter(row => row.regressed).map(row =>
    `<li><code>${e(row.axis)}</code> · delta ${e(signed(row.delta))} · failed delta ${e(signed(row.failedDelta))}</li>`).join('');
  return `<article class="popcmp ${verdict.tone}" data-population="${e(comparison.id)}" data-population-verdict="${e(comparison.verdict)}">
    <div class="popcmp-head"><b>${e(comparison.id)}</b>${statusMark(verdict.kind, comparison.verdict)}<small>${comparison.status === 'compared' ? 'Baseline/candidate comparison' : 'No bound baseline/candidate comparison published'}</small></div>
    ${POPULATION_ROLE[comparison.id] ? `<p class="small">${e(POPULATION_ROLE[comparison.id])}</p>` : ''}
    ${regressions ? `<p class="small"><b>Benign false-alarm regressions</b></p><ul>${regressions}</ul>` : ''}
    ${diagnostics ? `<p class="small"><b>Diagnostic regressions</b></p><ul>${diagnostics}</ul>` : ''}
  </article>`;
}

export function piiSupportPage(domain: EvaluationDomainDescriptorV2, matrix: PiiSupportMatrixFile, query: PiiSupportQuery): string {
  const selected = matrix.families.filter(row => !query.family && !query.jurisdiction || Boolean(query.family && row.family === query.family) || Boolean(query.jurisdiction && row.jurisdiction === query.jurisdiction));
  const narrowed = Boolean(query.family || query.jurisdiction);
  const route = matrix.protectedRoute ?? null;
  const rows = selected.map(row => familyRow(row, Boolean(query.family), route)).join('');
  const contract = matrix.activationContract, product = contract.productArtifact === 'trusted' ? contract.productArtifactCommitment : null;
  const activationIdentity = matrix.families.find(row => row.activation.activationIdentity)?.activation.activationIdentity ?? null;
  const selectors = activationIdentity ? /;selectors=([^;]+);/.exec(activationIdentity)?.[1].split(',') ?? [] : [];
  const activationNote = product && contract.productSourceCommit ? `<p class="small">Activation was recorded on product <code>${e(contract.productSourceCommit.slice(0, 12))}</code> with ${selectors.length === 1 ? 'selector' : 'selectors'} ${selectors.map(value => `<code>${e(value)}</code>`).join(', ')}. A family outside ${selectors.length === 1 ? 'that selector' : 'those selectors'} reads as not in the recorded activation, which is not a statement that the product lacks it.</p>`
    : '<p class="small">No product activation record matches the product this publication measured, so activation is not measured.</p>';
  const families = rows ? `<div class="pii-families"><div class="pii-family-head" aria-hidden="true"><span>PII family</span><span>Status</span><span>Authority</span><span>Context</span><span>Activation</span></div>${rows}</div>`
    : actionEmptyState({ title: narrowed ? 'No matching PII family' : 'PII support is pending', body: narrowed ? 'The requested identity is not present in the validated arrival registry.' : 'No PII family has arrived in the canonical registry. Absence is not an unsupported, provisional or stable claim.', mark: statusMark('not-measured') });
  return `${supportDomainBar('pii', domain)}<div class="page-head"><div><h1>PII support</h1></div></div>
    <div class="prose"><p class="small">This benchmark measures and records family-level PII evidence; <code>supportClaims=false</code>. It does not infer one jurisdiction or identity family from a neighbor.</p></div>
    <p class="commitments" role="group" aria-label="Commitments recomputed before rendering">${commitmentChip({ label: 'Artifact', commitment: matrix.artifactCommitment })}${commitmentChip({ label: 'Registry', commitment: matrix.registryCommitment })}${commitmentChip({ label: 'Product artifact', commitment: product, note: product ? 'Sanctioned binding' : 'Not measured' })}</p>
    ${activationNote}${route ? `<p class="small" data-protected-route="${e(route.id)}">Family status comes from the reviewed Beta.11 protected disposition for core <code>${e(route.coreCommit.slice(0, 12))}</code> (route <code>${e(route.route)}</code>; recorded in <code>${e(route.record)}</code>). This route reaches <b>provisional</b> at most and never stable; the population views below stay separate evidence.</p>` : ''}
    <section class="section" aria-labelledby="pii-families"><div class="section-head"><div><h2 class="h2-compact" id="pii-families">PII families</h2>
      <p class="small">${narrowed ? `Showing ${selected.length} of ${matrix.families.length}. <a href="/support?domain=pii">Show every family</a>.` : `${matrix.families.length} ${matrix.families.length === 1 ? 'family' : 'families'} in the validated registry.`} Status and activation are separate axes. Rows stop at identity and authority: this artifact cannot carry fixture content, so there is no link down to bytes.</p></div></div>
      ${families}</section>
    ${narrowed ? '' : jurisdictionScope(matrix)}
    <section class="section" aria-labelledby="pii-populations"><h2 class="h2-compact" id="pii-populations">Population regression views</h2><p class="small">Diagnostic-balanced and benign-heavy stress remain separate; a local regression is never hidden by an aggregate improvement.</p>
      <div class="popcmps">${matrix.populationComparisons.map(populationComparison).join('')}</div></section>`;
}

export function supportDomainUnavailablePage(problem: string): string {
  return `<div class="page-head"><div><h1>Support</h1></div></div>${actionEmptyState({
    title: 'Support domain unavailable',
    body: `${e(problem)}. No credential or PII support evidence is shown for an unrecognized or invalid domain.`,
    mark: statusMark('not-measured'),
  })}`;
}
