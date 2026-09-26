import inventory from '../../benchmarks/detector-inventory.json';
import rawGaps from '../../benchmarks/known-gaps.json';
import { contracts } from '../../benchmarks/lib/assessment.ts';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { twinProbe, type TwinProbeEntry } from '../../benchmarks/lib/twin-probe.ts';
import type { FormatContract, ScoredRow } from '../../benchmarks/types.ts';
import suite from '../../qualification/suite-v1.json';
import scenarios from '../../benchmarks/scenarios.json';
import { taxonomy, type Family } from '../../benchmarks/support/taxonomy.ts';
import type { SupportMatrixEntry } from '../../benchmarks/support/matrix.ts';
import { actionEmptyState, bindPager, escapeHtml as e, evidenceCrumb, pager, statusMark } from '../components';
import { categories, fixtureIndex, registry, type Fixture } from '../catalog';
import { filterInventory } from '../inventory.mjs';
import { providerName, type SupportMatrixFile } from '../support-model';
import type { Outcome } from '../types';
import { currentReports, groupsOf, hasResults, PRODUCT, type BenchData } from './data';
import { boundCell, compactFigure, isControl, isRedact, type Floors } from './figures';
import { groupTitle, rowsTable, tierTitle } from './rows';
import { runStates } from './states';

export type CoverageView = 'providers' | 'detectors' | 'thin' | 'inventory' | 'all';
export const coverageViewOf = (search: string): CoverageView => {
  const v = new URLSearchParams(search).get('show');
  return v === 'detectors' || v === 'thin' || v === 'inventory' ? v : 'providers';
};
const MIN = suite.accounting.minDenominator;
const gaps = validateKnownGaps(rawGaps as unknown as KnownGaps);
const tools = { gitleaks: 'Gitleaks', trufflehog: 'TruffleHog' } as const;
type Entry = (typeof inventory.entries)[number];
const n = (value: number) => value.toLocaleString('en-US');

/** Detectors by fixture count, largest first. Assignments overlap, so the counts are never summed. */
export function detectorCounts(fixtures: Fixture[]) {
  return registry.detectors.map(d => ({ id: d.id, title: d.title, fixtures: fixtures.filter(f => f.detectors.includes(d.id)).length })).sort((a, b) => b.fixtures - a.fixtures || a.title.localeCompare(b.title));
}
const seg = (view: CoverageView) => `<div class="seg" role="group" aria-label="Coverage view">${([['providers', 'Providers', ''], ['detectors', 'Detectors', '?show=detectors'], ['inventory', 'Upstream inventory', '?show=inventory']] as const).map(([id, label, query]) => `<a href="/coverage${query}"${id === view || (id === 'detectors' && (view === 'all' || view === 'thin')) ? ' aria-current="true"' : ''}>${label}</a>`).join('')}</div>`;

/**
 * Twin probe by family (#36): discriminated, not discriminated and un-probeable
 * are separate lines. Un-probeable families never enter the pair counts, so the
 * twin rate's denominator no longer hides the families nothing is paired against.
 */
export function twinProbeSection(data: BenchData | undefined, fixtures: Fixture[]): string {
  const reports = data ? currentReports(data) : [];
  const rows = reports.flatMap(r => (r.scanners.find(s => s.id === PRODUCT && s.status === 'complete')?.rows ?? []).map(row => ({ ...row, id: `${r.category}--${row.id}`, twinOf: row.twinOf ? `${r.category}--${row.twinOf}` : undefined }))) as unknown as ScoredRow[];
  const probe = twinProbe(registry.detectors.map(d => d.id), fixtures.map(f => ({ id: f.slug, detectors: f.detectors, twinOf: f.twinOf && `${f.category}--${f.twinOf}` })), rows.length ? rows : undefined, contracts as Record<string, FormatContract>);
  const title = (id: string) => registry.detectors.find(d => d.id === id)?.title ?? id;
  const link = (entry: TwinProbeEntry) => `<a href="/coverage/detectors/${e(entry.id)}">${e(title(entry.id))}</a>`;
  const of = (status: TwinProbeEntry['status']) => probe.entries.filter(entry => entry.status === status);
  const measured = [...of('not-discriminated'), ...of('discriminated'), ...of('not-measured'), ...of('unrecorded')];
  const mark = (entry: TwinProbeEntry) => entry.status === 'discriminated' ? statusMark('pass', 'Discriminated') : entry.status === 'not-discriminated' ? statusMark('fail', 'Not discriminated') : entry.status === 'not-measured' ? statusMark('not-measured') : statusMark('withheld', 'No twin, no record');
  const c = probe.counts;
  return `<section class="section" id="twin-probe"><h2 class="h2-compact">Twin probe, by detector family</h2><p class="small">${PRODUCT} on the current run: <b>${c.discriminated}</b> discriminated · <b>${c['not-discriminated']}</b> not discriminated · <b>${c['un-probeable']}</b> un-probeable${c['not-measured'] ? ` · <b>${c['not-measured']}</b> not measured` : ''}${c.unrecorded ? ` · <b>${c.unrecorded}</b> with no twin and no record` : ''}, of ${probe.entries.length} families. A family is discriminated only when every scored pair has the positive covered and the twin quiet. Un-probeable families have no twin because the provider documents nothing a twin could mutate; they are listed on their own and never counted in a twin rate.</p>
    <div class="tbl"><table><thead><tr><th scope="col">Family</th><th scope="col">Twin probe</th><th scope="col" class="num">Pairs discriminated</th></tr></thead><tbody>${measured.map(entry => `<tr><td>${link(entry)}</td><td>${mark(entry)}</td><td class="num">${entry.pairs ? `${entry.discriminated} of ${entry.pairs}` : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="tbl" style="margin-top:var(--space-4)"><table><thead><tr><th scope="col">Un-probeable family</th><th scope="col">Why no twin exists</th><th scope="col">Checked</th></tr></thead><tbody>${of('un-probeable').map(entry => `<tr><td>${link(entry)}</td><td><small>${e(entry.reason ?? '')}</small></td><td>${e(entry.observedAt ?? '')}</td></tr>`).join('')}</tbody></table></div></section>`;
}

type CoverageStatus = SupportMatrixEntry['status'];
type Attention = 'all' | 'unmeasured' | 'no-detector' | 'debt';
type CoverageSort = 'families' | 'provider';
interface CoverageFilter { query: string; status: CoverageStatus | 'all'; attention: Attention; sort: CoverageSort }
interface ScannerObservation {
  id: string; name: string; measured: boolean; rows: number; findings: number;
  reason?: string; provenance: NonNullable<import('../types').Scanner['observation']>[];
}

const STATUS_KIND = { stable: 'pass', provisional: 'unstable', pending: 'not-measured', unsupported: 'withheld' } as const;
const scenarioName = new Map(scenarios.scenarios.map(item => [item.id, item.title]));
const filterOf = (search: string): CoverageFilter => {
  const params = new URLSearchParams(search), status = params.get('status'), attention = params.get('attention'), sort = params.get('sort');
  return {
    query: (params.get('q') ?? '').trim(),
    status: ['stable', 'provisional', 'pending', 'unsupported'].includes(status ?? '') ? status as CoverageStatus : 'all',
    attention: ['unmeasured', 'no-detector', 'debt'].includes(attention ?? '') ? attention as Attention : 'all',
    sort: sort === 'provider' ? 'provider' : 'families',
  };
};

/** A missing observation is a state with a reason; a measured numeric zero stays an ordinary zero. */
export const NotMeasured = (reason: string) => `${statusMark('not-measured', 'Not measured')}<small>${e(reason)}</small>`;

function observationsFor(selected: Fixture[], data?: BenchData): ScannerObservation[] {
  if (!selected.length) return [];
  const reports = data ? currentReports(data) : [];
  const ids = [...new Set(reports.flatMap(report => report.scanners.map(scanner => scanner.id)))];
  if (!ids.length) return [];
  return ids.map(id => {
    const scanners = reports.flatMap(report => {
      const scanner = report.scanners.find(item => item.id === id);
      if (!scanner) return [];
      const slugs = new Set(selected.filter(fixture => fixture.category === report.category).map(fixture => fixture.id));
      if (!slugs.size) return [];
      return [{ report, scanner, rows: scanner.status === 'complete' ? (scanner.rows ?? []).filter(row => slugs.has(row.id)) : [] }];
    });
    const rows = scanners.flatMap(item => item.rows);
    const scanner = scanners[0]?.scanner;
    const provenance = [...new Map(scanners.flatMap(item => item.scanner.observation ? [[JSON.stringify(item.scanner.observation), item.scanner.observation] as const] : []).values())];
    const provenanceInvalid = scanners.some(({ report, scanner: item }) => {
      const observation = item.observation;
      if (!observation || !['fresh', 'snapshot'].includes(observation.source) || !Number.isFinite(Date.parse(observation.observedAt)) || !observation.sourceRunId) return true;
      if (observation.source === 'fresh') return observation.sourceRunId !== report.runId;
      return ![observation.snapshotDigest, observation.inputDigest].every(value => /^[a-f0-9]{64}$/.test(value ?? ''));
    });
    const observed = new Set(scanners.flatMap(item => item.rows.map(row => `${item.report.category}--${row.id}`)));
    const expected = new Set(selected.map(fixture => fixture.slug));
    const measured = rows.length === selected.length && observed.size === expected.size && [...expected].every(slug => observed.has(slug)) && !provenanceInvalid;
    return {
      id, name: scanner?.name ?? id, measured, rows: rows.length,
      findings: rows.reduce((sum, row) => sum + (row.findings ?? row.actual?.length ?? 0), 0),
      ...(!measured ? { reason: provenanceInvalid ? 'Observation provenance is missing or invalid for the selected fixture reports.' : scanner?.message ?? `${n(rows.length)} of ${n(selected.length)} current-run fixture rows are validated.` } : {}),
      provenance,
    };
  });
}

export function PeerObservation(observation: ScannerObservation): string {
  if (!observation.measured) return `<div class="peer-observation"><b>${e(observation.name)}</b>${NotMeasured(observation.reason ?? 'No current observation.')}</div>`;
  const provenance = observation.provenance.map(item => item.source === 'snapshot'
    ? `<small>Reused peer snapshot · source run ${e(item.sourceRunId)} · observed ${e(item.observedAt)} · snapshot <code>${e(item.snapshotDigest?.slice(0, 12))}</code> · input <code>${e(item.inputDigest?.slice(0, 12))}</code></small>`
    : `<small>Fresh observation · source run ${e(item.sourceRunId)} · observed ${e(item.observedAt)}</small>`).join('');
  return `<div class="peer-observation"><b>${e(observation.name)}</b><span><strong>${n(observation.findings)}</strong> findings across ${n(observation.rows)} fixtures</span><small>Observed on these fixtures; this is not a general support claim.</small>${provenance}</div>`;
}

export function StatusDistribution(entries: SupportMatrixEntry[]): string {
  const counts = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  for (const entry of entries) counts[entry.status]++;
  return `<span class="status-distribution" aria-label="Support status distribution">${(Object.keys(counts) as CoverageStatus[]).filter(status => counts[status]).map(status => `<i data-support-status="${status}">${n(counts[status])} ${e(status)}</i>`).join('')}</span>`;
}

export function ProfileCells(entry: SupportMatrixEntry | undefined): string {
  const p = entry?.profileCoverage;
  if (!p) return `<section class="family-block"><h3>Fixture profile</h3>${NotMeasured(!entry ? 'No validated support matrix is published.' : entry.detectors.length ? 'The published matrix carries no validated profile evidence.' : 'No dedicated detector is registered for this family.')}</section>`;
  const labels: Record<string, string> = { totalFixtures: 'Fixtures', positiveCases: 'Positive/context', benignControls: 'Benign controls', twinPairs: 'Twin pairs', positiveContextAxes: 'Positive axes', controlAxes: 'Control axes', confusionAxes: 'Confusion axes' };
  const cells = Object.entries(p.requiredCells).map(([id, required]) => {
    const actual = p.cells[id as keyof typeof p.cells] as number;
    return `<div><span>${e(labels[id] ?? id)}</span><strong>${n(actual)}</strong><small>required ${n(required)}</small></div>`;
  }).join('');
  const axes = [p.cells.positiveContextAxisIds, p.cells.controlAxisIds, p.cells.confusionAxisIds].flat();
  return `<section class="family-block profile-cells"><h3>Fixture profile · ${e(p.target)}</h3><div class="profile-grid">${cells}</div><p class="small"><b>Tested axis IDs:</b> ${axes.length ? axes.map(e).join(' · ') : 'none'}.</p><p class="small"><b>Required but empty axis IDs:</b> ${p.requiredButEmptyAxisIds.length ? p.requiredButEmptyAxisIds.map(e).join(' · ') : 'none'}.</p><p class="small"><b>Remaining debt:</b> ${p.debt.length ? p.debt.map(debt => `${e(labels[debt.cell])} ${n(debt.actual)}/${n(debt.required)}`).join(' · ') : 'none'}.</p><p class="small">Meeting fixture-profile cells is not equivalent to passing Stable qualification.</p></section>`;
}

const statusEvidence = (entry: SupportMatrixEntry | undefined) => {
  if (!entry) return NotMeasured('No validated support matrix is published.');
  return `${statusMark(STATUS_KIND[entry.status], entry.status[0].toUpperCase() + entry.status.slice(1))}${entry.reason ? `<small>${e(entry.reason)}</small>` : '<small>No unmet floor is recorded.</small>'}`;
};

export function FamilyDetail(family: Family, fixtures: Fixture[], data?: BenchData, entry?: SupportMatrixEntry): string {
  const selected = fixtures.filter(fixture => fixture.familyIds.includes(family.id));
  const observations = observationsFor(selected, data);
  const scenarioIds = [...new Set(selected.flatMap(fixture => fixture.scenarioIds))].sort();
  const kinds = {
    positive: selected.filter(fixture => fixture.assessment.kind === 'must-redact' && !fixture.twinOf).length,
    benign: selected.filter(fixture => fixture.assessment.kind === 'must-not-flag' && !fixture.twinOf).length,
    twins: selected.filter(fixture => Boolean(fixture.twinOf)).length,
    confusion: new Set(selected.flatMap(fixture => fixture.mutationKind ? [fixture.mutationKind] : [])).size,
  };
  return `<div class="family-detail" id="family-${e(family.id)}">
    <section class="family-block"><h3>Published support evidence</h3><div class="family-status">${statusEvidence(entry)}</div><p class="small"><a href="/support#status-${e(entry?.status ?? 'criteria')}">Support criteria and qualification floors</a></p><p class="small"><b>Detectors:</b> ${family.detectors.length ? family.detectors.map(id => `<a href="/coverage/detectors/${e(id)}"><code>${e(id)}</code></a>`).join(' · ') : 'none dedicated'}.</p></section>
    <section class="family-block"><h3>Indexed fixture evidence</h3><div class="family-figures"><span><b>${n(selected.length)}</b> fixtures</span><span><b>${n(kinds.positive)}</b> positive/context</span><span><b>${n(kinds.benign)}</b> benign controls</span><span><b>${n(kinds.twins)}</b> twins</span><span><b>${n(kinds.confusion)}</b> confusion axes</span></div><p class="small"><b>Measured scenarios:</b> ${scenarioIds.length ? scenarioIds.map(id => e(scenarioName.get(id) ?? id)).join(' · ') : 'none'}.</p></section>
    ${ProfileCells(entry)}
    <section class="family-block"><h3>Scanner observations</h3>${observations.length ? `<div class="peer-observations">${observations.map(PeerObservation).join('')}</div>` : NotMeasured(selected.length ? 'No validated run results are published.' : 'This family has no indexed fixture set to observe.')}</section>
    <section class="family-block"><h3>Fixtures</h3>${selected.length ? `<ul class="fixture-links">${selected.map(fixture => `<li><a href="/fixture/${e(fixture.slug)}"><code>${e(fixture.slug)}</code></a>${fixture.familyIds.length > 1 ? ` <small>multi-family · ${fixture.familyIds.length} reviewed relations</small>` : ''}</li>`).join('')}</ul>` : NotMeasured('No reviewed fixture belongs to this family.')}</section>
  </div>`;
}

export function FamilyRow(family: Family, fixtures: Fixture[], data?: BenchData, entry?: SupportMatrixEntry, open = false): string {
  const selected = fixtures.filter(fixture => fixture.familyIds.includes(family.id));
  const measured = observationsFor(selected, data).find(item => item.id === PRODUCT)?.measured ?? false;
  return `<details class="family-row" data-key="coverage:family:${e(family.id)}"${open ? ' open' : ''}><summary><span><a href="/coverage/${e(family.id)}">${e(family.name)}</a><small class="mono">${e(family.id)}</small></span><span>${measured ? `${n(selected.length)} tested fixtures` : NotMeasured(selected.length ? 'No current product observation' : 'No indexed fixtures')}</span><span>${statusEvidence(entry)}</span></summary>${FamilyDetail(family, fixtures, data, entry)}</details>`;
}

export function ProviderRow(provider: string | null, families: Family[], fixtures: Fixture[], data?: BenchData, matrix?: SupportMatrixFile | null, open = false): string {
  const entries = families.flatMap(family => matrix?.families.find(item => item.family === family.id) ?? []);
  const distinct = new Set(fixtures.filter(fixture => fixture.familyIds.some(id => families.some(family => family.id === id))).map(fixture => fixture.slug));
  const familyObservations = families.map(family => observationsFor(fixtures.filter(fixture => fixture.familyIds.includes(family.id)), data));
  const measured = familyObservations.filter(observations => observations.find(item => item.id === PRODUCT)?.measured).length;
  const peerOnly = familyObservations.filter(observations => !observations.find(item => item.id === PRODUCT)?.measured && observations.some(item => item.id !== PRODUCT && item.measured)).length;
  const scenarios = new Set(fixtures.filter(fixture => fixture.familyIds.some(id => families.some(family => family.id === id))).flatMap(fixture => fixture.scenarioIds));
  const debt = entries.reduce((sum, entry) => sum + (entry.profileCoverage?.debt.length ?? 0), 0);
  return `<details class="provider-row" data-key="coverage:provider:${e(provider ?? 'global')}"${open ? ' open' : ''}><summary><span><b>${e(providerName(provider))}</b><small>${n(families.length)} taxonomy families · ${n(distinct.size)} distinct tested fixtures</small></span><span><b>${n(measured)}</b> measured · <b>${n(families.length - measured)}</b> unmeasured · <b>${n(peerOnly)}</b> peer-only</span>${StatusDistribution(entries)}<span><b>${n(families.filter(family => !family.detectors.length).length)}</b> no detector · <b>${n(debt)}</b> debt cells · <b>${n(scenarios.size)}</b> scenarios</span></summary><div class="provider-children">${families.map(family => FamilyRow(family, fixtures, data, matrix?.families.find(entry => entry.family === family.id), open)).join('')}</div></details>`;
}

function providerCoverage(fixtures: Fixture[], data: BenchData | undefined, matrix: SupportMatrixFile | null | undefined, problem: string | null, search: string): string {
  const filter = filterOf(search), byProvider = new Map<string | null, Family[]>();
  for (const family of taxonomy.families) byProvider.set(family.provider, [...(byProvider.get(family.provider) ?? []), family]);
  let groups = [...byProvider.entries()].map(([provider, families]) => ({ provider, families }));
  const matches = (family: Family) => {
    const entry = matrix?.families.find(item => item.family === family.id), selected = fixtures.filter(fixture => fixture.familyIds.includes(family.id));
    const measured = observationsFor(selected, data).find(item => item.id === PRODUCT)?.measured ?? false;
    const q = filter.query.toLocaleLowerCase();
    if (q && !`${providerName(family.provider)} ${family.name} ${family.id}`.toLocaleLowerCase().includes(q)) return false;
    if (filter.status !== 'all' && entry?.status !== filter.status) return false;
    if (filter.attention === 'unmeasured' && measured) return false;
    if (filter.attention === 'no-detector' && family.detectors.length) return false;
    if (filter.attention === 'debt' && !(entry?.profileCoverage?.debt.length)) return false;
    return true;
  };
  groups = groups.map(group => ({ ...group, families: group.families.filter(matches) })).filter(group => group.families.length);
  groups.sort((a, b) => filter.sort === 'provider' ? providerName(a.provider).localeCompare(providerName(b.provider)) : b.families.length - a.families.length || providerName(a.provider).localeCompare(providerName(b.provider)));
  const option = (value: string, selected: string) => value === selected ? ' selected' : '';
  const controls = `<form class="coverage-filters" method="get" action="/coverage"><label class="field">Search<input name="q" type="search" value="${e(filter.query)}" placeholder="AWS, GitHub, family ID"></label><label class="field">Status<select name="status"><option value="all">All statuses</option>${(['stable','provisional','pending','unsupported'] as const).map(value => `<option value="${value}"${option(value, filter.status)}>${value}</option>`).join('')}</select></label><label class="field">Attention<select name="attention"><option value="all">All families</option><option value="unmeasured"${option('unmeasured', filter.attention)}>Unmeasured</option><option value="no-detector"${option('no-detector', filter.attention)}>No dedicated detector</option><option value="debt"${option('debt', filter.attention)}>Profile debt</option></select></label><label class="field">Sort<select name="sort"><option value="families">Family count</option><option value="provider"${option('provider', filter.sort)}>Provider name</option></select></label><button class="btn" type="submit">Apply</button></form>`;
  const unscoped = fixtures.filter(fixture => !fixture.familyIds.length);
  return `${controls}${problem ? `<p class="coverage-warning" role="status">${NotMeasured(problem)} The taxonomy and semantic index remain available below.</p>` : ''}${groups.length ? `<div class="provider-tree" aria-label="Provider and credential family coverage">${groups.map(group => ProviderRow(group.provider, group.families, fixtures, data, matrix, Boolean(filter.query || filter.status !== 'all' || filter.attention !== 'all'))).join('')}</div>` : actionEmptyState({ title: 'No families match these filters', body: 'Clear or change the Coverage filters. The taxonomy has not been changed.' })}<section class="section"><h2 class="h2-compact">Global and unscoped controls</h2><p class="small">These ${n(unscoped.length)} fixtures have an explicit reviewed reason for carrying no provider-family relation. They remain one canonical fixture each and do not enter provider family totals.</p><ul class="fixture-links">${unscoped.slice(0, 20).map(fixture => `<li><a href="/fixture/${e(fixture.slug)}"><code>${e(fixture.slug)}</code></a><small>${e(fixture.unscopedReason ?? '')}</small></li>`).join('')}</ul></section>`;
}

function detectorCoverage(fixtures: Fixture[], view: CoverageView, data?: BenchData): string {
  const counts = detectorCounts(fixtures), atMinimum = counts.filter(d => d.fixtures <= MIN), shown = view === 'thin' ? atMinimum : counts;
  const max = Math.max(MIN, ...counts.map(d => d.fixtures)), line = (MIN / max * 100).toFixed(2);
  return `<p class="small" style="margin-bottom:var(--space-4)">The vertical line is the minimum sample size (${MIN}). Detector assignments overlap and are never summed as provider totals.</p><div class="cov-list" role="table" aria-label="Detectors by fixture count"><div class="cov-row cov-head" role="row"><span role="columnheader">DETECTOR</span><span class="n" role="columnheader">FIXTURES</span><span role="columnheader">SAMPLE SIZE</span><span role="columnheader"></span></div>${shown.map(d => `<div class="cov-row" role="row"><a role="cell" href="/coverage/detectors/${e(d.id)}">${e(d.title)}</a><span class="n" role="cell">${n(d.fixtures)}</span><span class="bar" role="cell" aria-label="${n(d.fixtures)} fixtures; minimum sample size ${MIN}"><i style="width:${(d.fixtures / max * 100).toFixed(2)}%"></i><u style="left:${line}%"></u></span><span class="flag" role="cell">${d.fixtures < MIN ? 'Below minimum' : d.fixtures === MIN ? 'At minimum' : ''}</span></div>`).join('')}</div>${view !== 'thin' ? twinProbeSection(data, fixtures) : ''}<section class="section"><h2 class="h2-compact">Development history</h2><p class="small">Suite routes remain the execution and introduction-history view for the same canonical fixtures.</p><div class="tbl"><table><thead><tr><th scope="col">Suite</th><th scope="col" class="num">Fixtures</th><th scope="col">Scope</th></tr></thead><tbody>${categories.map(category => `<tr><td><a href="/suites/${e(category.id)}">${e(category.title)}</a></td><td class="num">${n(fixtures.filter(fixture => fixture.category === category.id).length)}</td><td>${e(category.description)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export function coveragePage(fixtures: Fixture[], view: CoverageView, data?: BenchData, matrix?: SupportMatrixFile | null, problem: string | null = null, search = ''): string {
  const counts = detectorCounts(fixtures), atMinimum = counts.filter(d => d.fixtures <= MIN);
  const head = `<div class="page-head"><div><h1>Coverage evidence</h1><div class="meta"><span><b>${taxonomy.families.length}</b> credential families</span><span><b>${counts.length}</b> product detectors</span><span><b>${n(fixtures.length)}</b> canonical fixtures</span><span>These are different units and their denominators are never substituted.</span></div></div>${seg(view)}</div>`;
  if (view === 'inventory') return head + inventoryView(fixtures);
  if (view === 'detectors' || view === 'all' || view === 'thin') return head + `<p class="small">${atMinimum.length} at the minimum sample size or below.</p>` + detectorCoverage(fixtures, view, data);
  return head + providerCoverage(fixtures, data, matrix, problem, search);
}

export function familyPage(data: BenchData | undefined, fixtures: Fixture[], id: string, matrix?: SupportMatrixFile | null, problem: string | null = null): string {
  const family = taxonomy.families.find(item => item.id === id);
  if (!family) return `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: id }])}${actionEmptyState({ title: 'No such credential family', body: 'Credential families come only from the validated taxonomy. <a href="/coverage">Open the provider tree</a>.' })}`;
  const entry = matrix?.families.find(item => item.family === id);
  return `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: providerName(family.provider), href: '/coverage' }, { label: family.name }])}<div class="page-head"><div><h1>${e(family.name)}</h1><div class="meta"><span class="mono">${e(family.id)}</span><span>${e(providerName(family.provider))}</span></div></div><a class="btn" href="/coverage">All providers</a></div>${problem ? `<p class="coverage-warning">${NotMeasured(problem)}</p>` : ''}${FamilyDetail(family, fixtures, data, entry)}`;
}

const strip = (outcomes: Record<Outcome, number>) => {
  const total = Object.values(outcomes).reduce((a, b) => a + b, 0) || 1;
  const parts: [Outcome[], string, string][] = [[['EXACT', 'COVERED'], 'fill', 'redacted'], [['OVERBROAD'], 'wide', 'too much'], [['PARTIAL'], 'hatch', 'partly exposed'], [['MISS'], 'outline', 'missed']];
  const counted = parts.map(([keys, shape, word]) => ({ shape, word, count: keys.reduce((sum, k) => sum + outcomes[k], 0) })).filter(p => p.count);
  return `<div class="strip" role="img" aria-label="${counted.map(p => `${p.count} ${p.word}`).join(', ')}">${counted.map(p => `<i class="${p.shape}" style="flex:${(p.count / total).toFixed(4)}"></i>`).join('')}</div><small>${counted.map(p => `${n(p.count)} ${p.word}`).join(' · ')}</small>`;
};

export function detectorPage(data: BenchData, fixtures: Fixture[], id: string): string {
  const detector = registry.detectors.find(d => d.id === id);
  if (!detector) return `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: id }])}<div class="page-head"><div><h1>No such detector</h1></div></div>${actionEmptyState({ title: `No detector family is registered as “${e(id)}”`, body: 'Detector families come from <code>benchmarks/detectors.json</code>. <a href="/coverage">Open the coverage list</a> or search by name.' })}`;
  const selected = fixtures.filter(f => f.detectors.includes(id));
  const suites = [...new Set(selected.map(f => f.category))];
  const contract = (contracts as Record<string, { tier?: string; providerSource?: { url: string; formatVersion: string; observedAt: string; covers: string }; candidateSource?: { url: string }; corroboration?: { url: string; tool: string }[]; references?: string[]; review?: string; companion?: string; twinSource?: { url: string; formatVersion: string; observedAt: string; covers: string }; unprobeable?: { reason: string; observedAt: string } }>)[id] ?? {};
  const sources = [contract.providerSource ? `<a href="${e(contract.providerSource.url)}">Provider documentation</a> <span class="muted">${e(contract.providerSource.formatVersion)} · observed ${e(contract.providerSource.observedAt)} · ${e(contract.providerSource.covers)}</span>` : '', contract.candidateSource ? `<a href="${e(contract.candidateSource.url)}">Provider, prefix only</a>` : '', ...(contract.corroboration ?? []).map(s => `<a href="${e(s.url)}">${e(s.tool)}</a>`), ...(contract.references ?? []).map((url, i) => `<a href="${e(url)}">Reference ${i + 1}</a>`), contract.twinSource ? `<a href="${e(contract.twinSource.url)}">Twin source</a> <span class="muted">${e(contract.twinSource.formatVersion)} · observed ${e(contract.twinSource.observedAt)} · ${e(contract.twinSource.covers)}</span>` : ''].filter(Boolean);
  const head = `${evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: detector.title }])}<div class="page-head"><div><h1>${e(detector.title)}</h1><div class="meta"><span><b>${n(selected.length)}</b> fixtures${selected.length <= MIN ? ` ${statusMark('withheld', selected.length < MIN ? 'Below minimum' : 'At minimum')}` : ''}</span><span>Suites: ${suites.map(s => `<a href="/suites/${e(s)}">${e(s)}</a>`).join(', ') || 'none'}</span>${contract.tier ? `<span>Format evidence: <b>${e(contract.tier)} · ${e(tierTitle(contract.tier))}</b></span>` : ''}</div></div></div>`;
  if (!selected.length) return head + actionEmptyState({ title: 'No fixtures are assigned to this detector', body: 'It is registered upstream, but nothing in the corpus targets it, so nothing is measured and no coverage is claimed. Assign fixtures in <code>benchmarks/fixture-detectors.json</code>.', command: 'npm run fixtures:check' });
  const summary = data.summaryProblem ? undefined : data.summary, reports = currentReports(data);
  let groups = '';
  if (summary && hasResults(data)) {
    const floors = summary.accounting as unknown as Floors, mine = groupsOf(summary, PRODUCT, id), others = summary.scanners.filter(s => s.id !== PRODUCT);
    const keys = Object.keys(mine).sort((a, b) => (a === 'pending/T0' ? 1 : b === 'pending/T0' ? -1 : a.localeCompare(b)));
    groups = `<div class="tbl wide" style="margin-top:var(--space-8)"><table><thead><tr><th scope="col">Group</th><th scope="col" class="num">Fixtures</th><th scope="col">Leaked or false alarms, at most</th><th scope="col">Tells near-twins apart, at least</th><th scope="col">Outcomes</th><th scope="col">Other scanners, same cell</th></tr></thead><tbody>${keys.map(key => {
      const g = mine[key];
      if (key === 'pending/T0') return `<tr><td>${e(groupTitle(key))}</td><td class="num">${n(g.files)}</td><td>${statusMark('withheld', 'Unscored')}</td><td></td><td><small>Inspect only: never scored until evidence exists</small></td><td></td></tr>`;
      const which = isControl(g) ? 'alarm' : 'leak';
      return `<tr><td>${e(groupTitle(key))}</td><td class="num">${n(g.files)}</td><td>${compactFigure(groupTitle(key), g, which, key, floors)}</td><td>${isRedact(g) ? compactFigure(`${groupTitle(key)}, twins`, g, 'twins', key, floors) : ''}</td><td>${isRedact(g) ? strip(g.outcomes) : isControl(g) ? `<small>${n(g.files - g.flaggedFiles)} quiet · ${n(g.flaggedFiles)} flagged</small>` : ''}</td><td class="peer-cell">${others.map(s => `<small>${e(s.id)} ${boundCell(groupsOf(summary, s.id, id)[key], which, key, floors)}</small>`).join('')}</td></tr>`;
    }).join('')}</tbody></table></div><p class="small" style="margin-top:var(--space-3)">Detector views overlap, so their groups are never summed. Other scanners are reference values on the same inputs, in run order.</p>`;
  }
  const followUps = gaps.issues.filter(issue => issue.fixtures.some(slug => selected.some(f => f.slug === slug)));
  return head + (sources.length ? `<p class="small">${sources.join(' · ')}${contract.review ? ` · ${e(contract.review)}` : contract.companion ? ` · ${e(contract.companion)}` : ''}</p>` : '') + (contract.unprobeable ? `<p class="small">${statusMark('withheld', 'Un-probeable')} No negative twin is authored for this family, and it is left out of every twin rate. ${e(contract.unprobeable.reason)} <span class="muted">Checked ${e(contract.unprobeable.observedAt)}.</span></p>` : '') + groups + runStates(data)
    + (followUps.length ? `<section class="section"><h2 class="h2-compact">Tracked product issues</h2>${followUps.map(issue => `<div class="chg">${statusMark('info', issue.status)}<span><a href="${e(issue.url)}">#${issue.number} · ${e(issue.title)}</a><small>${issue.kind === 'false-positive' ? 'False positives' : 'Missed secret spans'} · measured on ${e(gaps.measuredVersion)}</small></span><span class="d">${issue.fixtures.length} fixtures</span></div>`).join('')}</section>` : '')
    + rowsTable({ fixtures: selected, reports, heading: 'Rows' });
}

const PAGE = 50;
const inventoryRows = (entries: Entry[]) => entries.map(row => `<tr><td><a href="${e(row.sourceUrl)}" rel="noreferrer">${e(row.id)}</a><small>${e(tools[row.tool as keyof typeof tools])} ${e(inventory.sources[row.tool as keyof typeof tools].version)}</small></td><td>${row.relatedDetector ? `${statusMark('info', 'Related family')}<small><a href="/coverage/detectors/${e(row.relatedDetector)}">${e(row.relatedDetector)}</a> · parity unverified</small>` : `${statusMark('not-measured', 'No dedicated detector')}<small>Generic detection may still apply</small>`}</td><td>${row.activation === 'feature-gated' ? 'Feature-gated registration' : row.tool === 'gitleaks' ? 'Default rule' : 'Registered detector'}<small>${row.activation === 'feature-gated' ? e(row.featureFlag) : 'Source inventory · not runtime-tested here'}</small></td></tr>`).join('');

/** Upstream detector families with no dedicated equivalent, and so no dedicated fixtures. An inventory, not a measurement. */
function inventoryView(fixtures: Fixture[]): string {
  const missing = inventory.entries.filter(row => row.status === 'no-dedicated-detector');
  const count = (tool: string) => missing.filter(row => row.tool === tool).length, all = (tool: string) => inventory.entries.filter(r => r.tool === tool).length;
  return `<p class="prose small">Named detector families in other scanners that redact-secret ${e(inventory.redactSecretVersion)} has no dedicated detector for, and this corpus therefore has no dedicated fixtures for. Missing a dedicated detector is different from missing a secret: generic detection may still find a value. Related families can support different formats; their parity is unverified. Counts are tool entries, including versions, not unique providers.</p>
    <div class="meta" style="margin:var(--space-4) 0"><span><b>${n(count('gitleaks'))}</b> of ${n(all('gitleaks'))} Gitleaks ${e(inventory.sources.gitleaks.version)} rules</span><span><b>${n(count('trufflehog'))}</b> of ${n(all('trufflehog'))} TruffleHog ${e(inventory.sources.trufflehog.version)} registrations</span><span>Snapshot ${e(inventory.reviewedAt)}</span></div>
    <form class="filters" id="inventory-filters"><label class="field">Search<input id="inventory-query" type="search" placeholder="Datadog, GCP, Notion"></label><label class="field">Scanner<select id="inventory-tool"><option value="all">Both scanners</option><option value="gitleaks">Gitleaks</option><option value="trufflehog">TruffleHog</option></select></label><label class="field">Coverage<select id="inventory-status"><option value="no-dedicated-detector">No dedicated detector</option><option value="related-family">Related family, parity unverified</option><option value="all">All entries</option></select></label></form>
    <p class="small" id="inventory-count" role="status" aria-live="polite"></p><div class="tbl wide" tabindex="0" role="region" aria-label="Upstream detector inventory"><table><thead><tr><th scope="col">Detector or rule</th><th scope="col">redact-secret status</th><th scope="col">Upstream registration</th></tr></thead><tbody id="inventory-rows">${inventoryRows(missing.slice(0, PAGE))}</tbody></table></div><p class="small" id="inventory-empty" hidden>No detector entries match these filters.</p>${pager('inventory')}
    <section class="section"><div class="section-head"><div><h2 class="h2-compact">Measured regressions tracked as product issues</h2><p class="small">Published npm ${e(gaps.measuredVersion)} · snapshot ${e(gaps.reviewedAt)}. Measured fixture failures, separate from the inventory above. Historical measurement, not live issue status.</p></div><a href="${e(gaps.milestoneUrl)}">Milestone</a></div>${gaps.issues.map(issue => `<div class="chg">${statusMark('info', issue.status)}<span><a href="${e(issue.url)}">#${issue.number} · ${e(issue.title)}</a><small>${issue.kind === 'false-positive' ? 'False positives' : 'Missed secret spans'} · ${issue.fixtures.map(slug => fixtures.some(f => f.slug === slug) ? `<a href="/fixture/${e(slug)}">${e(slug.split('--')[1])}</a>` : e(slug.split('--')[1])).join(' · ')}</small></span><span class="d">${issue.fixtures.length} fixtures</span></div>`).join('')}</section>
    <section class="section prose"><h2 class="h2-compact">Sources and method</h2><p class="small">No scanner implementations are bundled; this view stores identifiers, registration metadata, mappings and source links. Commented-out TruffleHog registrations are excluded, feature-gated registrations are labelled, and versions stay separate. These entries are candidates for future synthetic fixtures and scope review, not confirmed runtime false negatives.</p><ul class="small">${Object.entries(inventory.sources).map(([tool, source]) => `<li><a href="${e(source.url)}">${e(tools[tool as keyof typeof tools])} ${e(source.version)} registry</a> · revision <code>${e(source.revision.slice(0, 12))}</code></li>`).join('')}<li><a href="https://github.com/redact-secret/redact-secret/blob/${e(inventory.redactSecretRevision)}/crates/secret-scan-core/src/detectors/mod.rs">redact-secret ${e(inventory.redactSecretVersion)} registry</a></li></ul></section>`;
}

export function bindInventory() {
  const form = document.querySelector<HTMLFormElement>('#inventory-filters');
  if (!form) return;
  let page = 0;
  const query = document.querySelector<HTMLInputElement>('#inventory-query')!, tool = document.querySelector<HTMLSelectElement>('#inventory-tool')!, status = document.querySelector<HTMLSelectElement>('#inventory-status')!;
  const render = () => {
    const selected = filterInventory(inventory.entries, { query: query.value, tool: tool.value, status: status.value }) as Entry[];
    const pages = Math.max(1, Math.ceil(selected.length / PAGE)); page = Math.min(page, pages - 1);
    document.querySelector('#inventory-rows')!.innerHTML = inventoryRows(selected.slice(page * PAGE, (page + 1) * PAGE));
    document.querySelector('#inventory-count')!.textContent = `${n(selected.length)} matching entries of ${n(inventory.entries.length)}`;
    document.querySelector<HTMLElement>('#inventory-empty')!.hidden = selected.length !== 0;
    showPage(page, pages);
  };
  const showPage = bindPager('inventory', delta => { page += delta; render(); });
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { page = 0; render(); });
  render();
}
