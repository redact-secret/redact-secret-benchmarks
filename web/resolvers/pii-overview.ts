import type { PiiCoveragePublication } from '../../scripts/pii-coverage-publication.mjs';
import type { PiiEvaluation } from '../services/domains';
import type { DomainViewData } from '../components/evaluation/domain';
import type { PiiCatalogData } from '../components/coverage/pii';
import type { PiiMethodologyData } from '../components/evaluation/pii';
import { int } from './format';

const repo = 'https://github.com/redact-secret/redact-secret-benchmarks';
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown) => typeof value === 'string' && value ? value : 'Not recorded';
const selectors = (value: unknown) => Array.isArray(value) && value.every(item => typeof item === 'string') ? value.join(', ') || 'No selector recorded' : 'Not recorded';
const detailHref = (kind: string) => `/evaluation/pii/evidence/#coverage-active-baseline-${encodeURIComponent(kind).replace(/%/g, '-')}`;

export function resolvePiiCatalog(publication: PiiCoveragePublication | null, pii: PiiEvaluation, unavailableReason = 'No validated source-bound PII coverage publication is available.'): PiiCatalogData {
  const joined = publication?.coverage.matrices.active.baseline;
  const inventory = publication?.coverage.inventories.active;
  const binding = object(joined?.binding), product = object(binding.product), scanner = object(binding.scanner), engine = object(binding.engine);
  const current = pii.currentQualification;
  const qualification = current
    ? `Current target ${current.sourceCommit}: qualification not established. Public synthetic measurement ${current.publicMeasurement.state}; public qualification ${current.gates.publicQualification}; protected path ${current.gates.protectedPath}; protected partition ${current.gates.protectedPartition}. Public evidence does not qualify product support.`
    : 'Current product qualification is not recorded. Historical reviewed bindings and public synthetic measurements do not establish current support; protected execution and audit remain unavailable unless bound to their own validated evidence.';
  const comparison = pii.candidateComparison;
  const activation = comparison?.state === 'recorded'
    ? (['baseline', 'candidate'] as const).map(side => ({ title: `${side === 'baseline' ? 'Published comparison baseline' : 'Candidate build, not a release'} activation`,
      text: `Version ${comparison[side].version}; source ${comparison[side].sourceCommit}; package tree ${comparison[side].packageTreeSha256}. ${comparison.activation[side].surfaces.map(surface => `${surface.surface}: ${surface.checks.map(check => `${check.artifact} selectors [${check.requestedSelectors.join(', ')}], activation ${check.activationIdentity}`).join('; ')}`).join(' | ')}. Installed-product configuration checks only, not a capability or support verdict. This separate comparison never supplies measurements to the catalog.` }))
    : [{ title: 'Current-target activation checks unavailable', text: comparison?.reason ?? 'No validated current-target comparison is recorded. No historical activation setting is substituted.' }];
  const rows = joined?.matrix.rows ?? [];
  const states = new Map<string, number>();
  for (const row of rows) states.set(row.state, (states.get(row.state) ?? 0) + 1);
  const summary = joined ? `${int(rows.length)} source-exposed kinds in the active published-baseline inventory. ${[...states].map(([state, count]) => `${state}: ${int(count)}`).join('; ')}. Kind counts describe inventory, not detection accuracy or qualified coverage.` : unavailableReason;
  return {
    facts: [
      { term: 'Catalog evidence', description: inventory ? `Active snapshot ${inventory.source.snapshot.id}; source ${inventory.source.release.repository}@${inventory.source.release.commit}` : 'Not recorded' },
      { term: 'Published catalog product', description: `Version ${text(product.version)}; source ${text(product.sourceCommit)}; product commitment ${text(joined?.matrix.identity.productCommitment)}` },
      { term: 'Catalog configuration', description: `Selectors ${selectors(scanner.activation)}; configuration ${text(scanner.configurationDigest)}; activation ${text(scanner.activationDigest)}` },
      { term: 'Catalog evaluator and population', description: `Engine ${text(engine.commit)}; binary ${text(engine.binarySha256)}; protocol ${text(joined?.matrix.identity.protocol)}; population ${text(joined?.matrix.identity.population)}` },
      { term: 'Language and context scope', description: 'Not recorded per kind by this coverage contract. Evidence jurisdiction labels are not language support. Historical language observations remain in the result details.' },
    ], activation, qualification, summary,
    limitations: [
      ...(inventory?.limitations ?? []),
      joined?.capabilityDeclarations.reason ?? 'Declared capability is bound to the exact catalog product, not to a proposed snapshot or candidate build.',
      joined?.familyMetrics.reason ?? 'Family metrics are unavailable where the protocol has no compatible projection.',
      'Unknown capability, explicitly absent implementation, unmeasured declarations, evaluator losses and withheld observations remain distinct. No supported-only rate represents the evidence-wide inventory.',
      'Generic findings, taxonomy membership and context labels do not establish PHI or national-identifier support.',
    ],
    rows: rows.map(row => ({ id: row.kindKey, label: row.label, state: row.state,
      domains: row.domains.join(', ') || 'Not recorded', jurisdictions: row.jurisdictions.join(', ') || 'Not recorded',
      language: 'Not recorded per kind; language and jurisdiction are separate. Context fidelity may be unavailable.',
      capability: `${row.capability.state}; product commitment ${row.capability.productCommitment ?? 'unavailable'}. This declaration is not product qualification.`,
      measurement: `${row.observation.status}; ${row.observation.axes.length ? row.observation.axes.map(axis => `${axis.axis}: ${int(axis.measured)} measured of ${int(axis.eligible)} eligible; ${int(axis.unresolved)} unresolved; ${int(axis.withheld)} withheld`).join('; ') : 'No compatible per-kind measured axes recorded; unavailable is not zero.'}`,
      limitations: `${row.mapping.state}; ${[...row.mapping.losses, ...row.reasons].join('; ') || 'No additional per-kind limitation recorded.'}`,
      href: detailHref(row.kindKey), ...(row.capability.source ? { declarationHref: row.capability.source } : {}),
    })), emptyReason: joined ? 'The validated inventory exposes no kinds. No coverage ratio can be established.' : unavailableReason,
  };
}

export function resolvePiiMethodology(view: DomainViewData): PiiMethodologyData {
  const qualification = (view.presentationSummary ?? []).filter(item => item.label !== 'Public synthetic measurement').map(item => `${item.label}: ${item.value ?? 'Not recorded'}. ${item.detail}`).join(' ')
    || 'Current product qualification is not recorded. Public synthetic measurement does not establish protected qualification.';
  return { method: { ...view.method, metrics: { ...view.method.metrics, summary: 'pii-v1 metric definitions and separate denominators',
    rows: view.method.metrics.rows.map(row => ({ ...row, id: `pii-v1:${row.id}` })) } }, qualification,
    repositories: [
      { label: 'pii-evidence on GitHub', href: 'https://github.com/redact-secret/pii-evidence', responsibility: 'Authors source cases, taxonomy, evidence provenance and expected-answer contracts before a scanner runs.' },
      { label: 'pii-eval on GitHub', href: 'https://github.com/redact-secret/pii-eval', responsibility: 'Runs source-bound measurement and records authored type, range and sensitivity/context assertions with separate metric denominators.' },
      { label: 'redact-secret core on GitHub', href: 'https://github.com/redact-secret/redact-secret', responsibility: 'Implements the scanner and its explicit activation configuration; scanner findings do not author the expected answer.' },
      { label: 'Benchmarks on GitHub', href: repo, responsibility: 'Consumes validated artifacts, keeps populations separate and owns interpretation and qualification policy. It does not adopt evidence or infer a support verdict from this overview.' },
    ],
    metricGroups: [
      { label: 'Type identity', text: 'Type miss, wrong family and wrong jurisdiction use resolved authored type assertions; jurisdictional assertions have their own eligible population.' },
      { label: 'Sensitivity and benign context', text: 'Sensitive miss and non-sensitive flag use their respective resolved authored sensitivity assertions. Context discrimination uses complete trios; benign suppression uses distinct authored benign cases.' },
      { label: 'Collision and range', text: 'Jurisdiction collision uses resolved collision assertions. Range collateral uses reported exact, overbroad and partial spans; it is not a rate over every evidence case.' },
      { label: 'Measurable share', text: 'Resolved pass or fail assertions over all eligible authored axes, including unresolved axes. It reports measurement availability, not product support.' },
    ], definitionsHref: `${repo}/blob/develop/benchmarks/evaluation/domains/pii/metric-basis.mjs`,
    policyHref: `${repo}/blob/develop/qualification/pii-v1.json`,
  };
}
