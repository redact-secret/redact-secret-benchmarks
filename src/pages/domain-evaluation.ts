import { actionEmptyState, domainBar, escapeHtml as e, statusMark, type StatusKind } from '../components';
import type { EvaluationDomainDescriptor } from '../evaluation-domains';
import { PII_METRIC_IDS, PII_METRIC_LABELS, piiV1Profile } from '../../benchmarks/evaluation/domains/pii/profile.ts';
import {
  PII_SENSITIVITY_STATES, PII_TYPE_STATES, piiReachableSensitivityStates, piiReachableTypeStates, piiSensitivityStatus, piiTypeStatus, type PiiAxisStatus,
} from '../../benchmarks/evaluation/domains/pii/outcome-validation.ts';
import { PII_BENIGN_COLLISION_EVIDENCE_CLASSES, PII_EVIDENCE_ACCOUNTING_CLASSES, PII_EVIDENCE_CLASS_ROLES } from '../../benchmarks/evaluation/domains/pii/benign-collision-classes.ts';
import { PII_CONTEXT_CLASSES, PII_CONTEXT_LANGUAGES } from '../../benchmarks/evaluation/domains/pii/context-languages.ts';

const profiles = (domain: EvaluationDomainDescriptor) => domain.qualificationProfiles
  .map(profile => `<code>${e(profile.id)}@${e(String(profile.version))}</code>`).join(' · ');

const evaluationDomainBar = (selected: EvaluationDomainDescriptor['domain'], identities: { label: string; value: string }[]) => domainBar({
  label: 'Evaluation domain',
  links: [{ href: '/evaluation/credentials', label: 'Credentials', current: selected === 'credential' }, { href: '/evaluation/pii', label: 'PII', current: selected === 'pii' }],
  identities,
});

const head = (domain: EvaluationDomainDescriptor, title: string) => `${evaluationDomainBar(domain.domain, [
  { label: 'Domain', value: `<code>${e(domain.domain)}</code>` },
  { label: 'Report profile', value: `<code>${e(domain.reportProfile.id)}@${e(String(domain.reportProfile.version))}</code>` },
  { label: 'Accounting', value: `<code>${e(domain.domainAccountingVersion)}</code>` },
])}<div class="page-head"><div><h1>${e(title)}</h1></div></div>`;

const AXIS_STATUS: Record<PiiAxisStatus, { kind: StatusKind; word: string }> = {
  pass: { kind: 'pass', word: 'counts as pass' }, fail: { kind: 'fail', word: 'counts as fail' },
  'review-required': { kind: 'review', word: 'review required' }, 'not-measured': { kind: 'not-measured', word: 'not measured' },
};
const derived = (status: PiiAxisStatus) => `<small class="derives" data-derived-status="${status}">${e(AXIS_STATUS[status].word)}</small>`;

/** MetricRow: each metric with its own population, numerator and denominator, verbatim. There is no total row: no two share a denominator. */
function metricRows(): string {
  const applicability = { required: 'Every family', jurisdictional: 'Jurisdictional families only', 'reported-spans': 'Reported spans only' } as const;
  return `<section class="section" aria-labelledby="pii-metrics"><h2 class="h2-compact" id="pii-metrics">Metrics</h2>
    <p class="small">${PII_METRIC_IDS.length} metrics, each read against its own population. None is combined with another or with a credential metric, and none has a value until PII accounting is published.</p>
    <div class="tbl wide"><table><thead><tr><th scope="col">Metric</th><th scope="col">Population</th><th scope="col">Counts</th><th scope="col">Better</th><th scope="col">Value</th></tr></thead><tbody>${PII_METRIC_IDS.map(id => {
      const [population, numerator, denominator] = PII_METRIC_LABELS[id], metric = piiV1Profile.metrics[id];
      return `<tr data-metric="${e(id)}"><td><code>${e(id)}</code><small>${e(applicability[metric.applicability])}</small></td><td>${e(population)}</td><td>${e(numerator)}<small>of ${e(denominator)}</small></td><td class="nowrap">${metric.direction === 'upper' ? 'Lower' : 'Higher'}</td><td>${statusMark('not-measured')}</td></tr>`;
    }).join('')}</tbody></table></div></section>`;
}

/** OutcomeMatrix: the authored expectation decides which states can occur; the rest are hatched, which never looks like zero. */
function outcomeStates(): string {
  const grid = <S extends string>(axis: string, states: readonly S[], rows: { expectation: string; reachable: readonly S[] }[], status: (state: S) => PiiAxisStatus) =>
    `<div class="outcome-grid" role="table" aria-label="${e(axis)} states reachable from each authored expectation" style="--cols:${states.length}">
      <div role="row"><span role="columnheader" class="hd">Expectation</span>${states.map(state => `<span role="columnheader" class="hd"><code>${e(state)}</code></span>`).join('')}</div>
      ${rows.map(row => `<div role="row"><span role="rowheader" class="rh"><code>${e(row.expectation)}</code></span>${states.map(state => row.reachable.includes(state)
        ? `<span role="cell" data-reachable="true">${statusMark('not-measured')}${derived(status(state))}</span>`
        : `<span role="cell" class="gated" data-reachable="false">Cannot occur</span>`).join('')}</div>`).join('')}
    </div>`;
  return `<section class="section" aria-labelledby="pii-outcomes"><h2 class="h2-compact" id="pii-outcomes">Two outcome axes</h2>
    <p class="small">Each observation is judged twice: type identity and sensitivity in context. The two are never folded into one rate, and one observation is never counted as a success on both. The authored expectation decides which states are reachable; a hatched cell cannot occur, which is different from zero.</p>
    <h3 class="h3 outcome-axis">Type identity</h3>
    ${grid('Type identity', PII_TYPE_STATES, [{ expectation: 'type: valid', reachable: piiReachableTypeStates('valid') }, { expectation: 'type: invalid', reachable: piiReachableTypeStates('invalid') }], piiTypeStatus)}
    <h3 class="h3 outcome-axis">Sensitivity in context</h3>
    ${grid('Sensitivity', PII_SENSITIVITY_STATES, (['sensitive', 'non-sensitive', 'not-established'] as const).map(value => ({ expectation: `sensitivity: ${value}`, reachable: piiReachableSensitivityStates(value) })), piiSensitivityStatus)}
    <p class="small"><code>invalid-correct</code> and <code>invalid-accepted</code> count checksum twins: a deliberately invalid value rejected, or accepted. <code>unresolved</code> needs review; it stays in the denominator and never becomes a pass.</p></section>`;
}

/** EvidenceClassMap: the deliberately lossy mapping, with the classes that map to nothing named rather than left blank. */
function evidenceClasses(): string {
  const why = { 'mechanical-control': 'Proves type and validator behaviour only; not semantic evidence', collision: 'Counted by the jurisdiction-collision method instead', benign: '' } as const;
  return `<section class="section" aria-labelledby="pii-evidence-classes"><h2 class="h2-compact" id="pii-evidence-classes">Evidence classes</h2>
    <p class="small">${PII_BENIGN_COLLISION_EVIDENCE_CLASSES.length} authored evidence classes map, deliberately lossily, onto the benign accounting classes of <code>pii-v1</code>. Classes that fold into one accounting class are still counted apart on the evidence side.</p>
    <div class="tbl"><table><thead><tr><th scope="col">Evidence class</th><th scope="col">Accounting class</th><th scope="col">Counted by</th></tr></thead><tbody>${PII_BENIGN_COLLISION_EVIDENCE_CLASSES.map(id => {
      const accounting = PII_EVIDENCE_ACCOUNTING_CLASSES[id], role = PII_EVIDENCE_CLASS_ROLES[id];
      return `<tr data-evidence-class="${e(id)}"><td><code>${e(id)}</code></td><td>${accounting.length ? `<span class="chips">${accounting.map(value => `<span class="chip">${e(value)}</span>`).join('')}</span>`
        : `<span class="chip void">No accounting class</span><small>${e(why[role.kind])}</small>`}</td><td><code>${e(role.method)}</code><small>qualifies ${role.qualifies.map(e).join(' · ')}</small></td></tr>`;
    }).join('')}</tbody></table></div></section>`;
}

/** ContextLanguageStrata: language × context polarity; the neutral middle is never folded away. Language is not jurisdiction. */
function contextStrata(): string {
  return `<section class="section" aria-labelledby="pii-context"><h2 class="h2-compact" id="pii-context">Context by language</h2>
    <p class="small">The primary context languages are ${PII_CONTEXT_LANGUAGES.map(language => `<code>${e(language)}</code>`).join(' and ')}. Adding a language adds a row, not a new evaluator.</p>
    <div class="strata" role="table" aria-label="Context evidence by language and polarity" style="--cols:${PII_CONTEXT_CLASSES.length}">
      <div role="row"><span role="columnheader" class="hd">Language</span>${PII_CONTEXT_CLASSES.map(value => `<span role="columnheader" class="hd">${e(value)}</span>`).join('')}</div>
      ${PII_CONTEXT_LANGUAGES.map(language => `<div role="row"><span role="rowheader" class="rh"><code>${e(language)}</code></span>${PII_CONTEXT_CLASSES.map(() => `<span role="cell">${statusMark('not-measured')}</span>`).join('')}</div>`).join('')}
    </div>
    <p class="small strata-note"><b>Language support is not jurisdiction support.</b> Reading Korean context labels says nothing about a Korean national-identifier family; jurisdictions are listed on <a href="/support?domain=pii">PII support</a>.</p></section>`;
}

/** Public domain landing pages name their own accounting and qualification identities; they never combine metric spaces. */
export function domainEvaluationPage(domain: EvaluationDomainDescriptor, workbenchAvailable = true): string {
  if (domain.domain === 'credential') {
    return `${head(domain, 'Credential evaluation')}
      <div class="prose"><p class="small">Credential evidence keeps its existing case, variant, assertion and qualification views. It is measured only under the <code>${e(domain.evaluationProfile)}</code> evaluation profile and is not combined with PII results.</p></div>
      <section class="section"><h2 class="h2-compact">Qualification profiles</h2><p class="small">${profiles(domain)}</p>
        ${workbenchAvailable ? '<p><a href="/workbench">Open credential evaluation evidence in Workbench</a></p>' : '<p class="small">The public domain route preserves the published credential identity; maintainer-only evidence views are not included in this build.</p>'}</section>`;
  }
  return `${head(domain, 'PII evaluation')}
    ${actionEmptyState({
      title: 'PII evaluation is schema-only',
      body: `The <code>${e(domain.evaluationProfile)}</code> evaluation profile and ${profiles(domain)} qualification profile are registered, but no public PII evaluation artifact or detector evidence is published. No status, rate or cross-domain score can be inferred from this state.
        What is readable now is the contract below: ${PII_METRIC_IDS.length} metric definitions, the two outcome axes, ${PII_BENIGN_COLLISION_EVIDENCE_CLASSES.length} evidence classes and the context strata. Registered families, their authority and the population views are on <a href="/support?domain=pii">PII support</a>.`,
      mark: statusMark('not-measured', 'Schema only'),
    })}
    ${metricRows()}${outcomeStates()}${evidenceClasses()}${contextStrata()}`;
}

export function domainEvaluationUnavailablePage(domain: 'credential' | 'pii', problem: string): string {
  const title = domain === 'credential' ? 'Credential evaluation' : 'PII evaluation';
  return `${evaluationDomainBar(domain, [{ label: 'Domain', value: `<code>${domain}</code>` }, { label: 'Accounting', value: 'Unavailable' }])}<div class="page-head"><div><h1>${title}</h1></div></div>${actionEmptyState({
    title: 'Evaluation domain metadata unavailable',
    body: `${e(problem)}. Domain evidence is withheld until the published domain index validates.`,
    mark: statusMark('not-measured'),
  })}`;
}
