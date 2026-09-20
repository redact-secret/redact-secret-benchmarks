import inventory from '../../benchmarks/detector-inventory.json';
import rawGaps from '../../benchmarks/known-gaps.json';
import { contracts } from '../../benchmarks/lib/assessment.ts';
import { validateKnownGaps, type KnownGaps } from '../../benchmarks/lib/promotion';
import { twinProbe, type TwinProbeEntry } from '../../benchmarks/lib/twin-probe.ts';
import type { FormatContract, ScoredRow } from '../../benchmarks/types.ts';
import suite from '../../qualification/suite-v1.json';
import { actionEmptyState, escapeHtml as e, evidenceCrumb, statusMark } from '../components';
import { categories, registry, type Fixture } from '../catalog';
import { filterInventory } from '../inventory.mjs';
import type { Outcome } from '../types';
import { currentReports, groupsOf, hasResults, PRODUCT, type BenchData } from './data';
import { boundCell, compactFigure, isControl, isRedact, type Floors } from './figures';
import { groupTitle, rowsTable, tierTitle } from './rows';
import { runStates } from './states';

export type CoverageView = 'all' | 'thin' | 'inventory';
export const coverageViewOf = (search: string): CoverageView => { const v = new URLSearchParams(search).get('show'); return v === 'thin' || v === 'inventory' ? v : 'all'; };
const MIN = suite.accounting.minDenominator;
const gaps = validateKnownGaps(rawGaps as unknown as KnownGaps);
const tools = { gitleaks: 'Gitleaks', trufflehog: 'TruffleHog' } as const;
type Entry = (typeof inventory.entries)[number];
const n = (value: number) => value.toLocaleString('en-US');

/** Detectors by fixture count, largest first. Assignments overlap, so the counts are never summed. */
export function detectorCounts(fixtures: Fixture[]) {
  return registry.detectors.map(d => ({ id: d.id, title: d.title, fixtures: fixtures.filter(f => f.detectors.includes(d.id)).length })).sort((a, b) => b.fixtures - a.fixtures || a.title.localeCompare(b.title));
}
const seg = (view: CoverageView) => `<div class="seg" role="group" aria-label="Coverage view">${([['all', 'All', ''], ['thin', 'Thin coverage', '?show=thin'], ['inventory', 'No dedicated fixtures', '?show=inventory']] as const).map(([id, label, query]) => `<a href="/coverage${query}"${id === view ? ' aria-current="true"' : ''}>${label}</a>`).join('')}</div>`;

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
  const link = (entry: TwinProbeEntry) => `<a href="/coverage/${e(entry.id)}">${e(title(entry.id))}</a>`;
  const of = (status: TwinProbeEntry['status']) => probe.entries.filter(entry => entry.status === status);
  const measured = [...of('not-discriminated'), ...of('discriminated'), ...of('not-measured'), ...of('unrecorded')];
  const mark = (entry: TwinProbeEntry) => entry.status === 'discriminated' ? statusMark('pass', 'Discriminated') : entry.status === 'not-discriminated' ? statusMark('fail', 'Not discriminated') : entry.status === 'not-measured' ? statusMark('not-measured') : statusMark('withheld', 'No twin, no record');
  const c = probe.counts;
  return `<section class="section" id="twin-probe"><h2 class="h2-compact">Twin probe, by detector family</h2><p class="small">${PRODUCT} on the current run: <b>${c.discriminated}</b> discriminated · <b>${c['not-discriminated']}</b> not discriminated · <b>${c['un-probeable']}</b> un-probeable${c['not-measured'] ? ` · <b>${c['not-measured']}</b> not measured` : ''}${c.unrecorded ? ` · <b>${c.unrecorded}</b> with no twin and no record` : ''}, of ${probe.entries.length} families. A family is discriminated only when every scored pair has the positive covered and the twin quiet. Un-probeable families have no twin because the provider documents nothing a twin could mutate; they are listed on their own and never counted in a twin rate.</p>
    <div class="tbl"><table><thead><tr><th scope="col">Family</th><th scope="col">Twin probe</th><th scope="col" class="num">Pairs discriminated</th></tr></thead><tbody>${measured.map(entry => `<tr><td>${link(entry)}</td><td>${mark(entry)}</td><td class="num">${entry.pairs ? `${entry.discriminated} of ${entry.pairs}` : '—'}</td></tr>`).join('')}</tbody></table></div>
    <div class="tbl" style="margin-top:var(--space-4)"><table><thead><tr><th scope="col">Un-probeable family</th><th scope="col">Why no twin exists</th><th scope="col">Checked</th></tr></thead><tbody>${of('un-probeable').map(entry => `<tr><td>${link(entry)}</td><td><small>${e(entry.reason ?? '')}</small></td><td>${e(entry.observedAt ?? '')}</td></tr>`).join('')}</tbody></table></div></section>`;
}

export function coveragePage(fixtures: Fixture[], view: CoverageView, data?: BenchData): string {
  const counts = detectorCounts(fixtures), atMinimum = counts.filter(d => d.fixtures <= MIN);
  const head = `<div class="page-head"><div><h1>Detector coverage</h1><div class="meta"><span><b>${counts.length}</b> detector families</span><span><b>${atMinimum.length}</b> at the minimum sample size</span><span>Sorted by fixtures</span></div></div>${seg(view)}</div>`;
  if (view === 'inventory') return head + inventoryView();
  const shown = view === 'thin' ? atMinimum : counts, max = Math.max(MIN, ...counts.map(d => d.fixtures));
  const line = (MIN / max * 100).toFixed(2);
  return `${head}<p class="small" style="margin-bottom:var(--space-4)">The vertical line on each bar is the minimum sample size (${MIN}): below it no rate is published for a group. A fixture may count for more than one detector, so these numbers do not add up to the corpus.</p>
    <div class="cov-list" role="table" aria-label="Detectors by fixture count"><div class="cov-row cov-head" role="row"><span role="columnheader">DETECTOR</span><span class="n" role="columnheader">FIXTURES</span><span role="columnheader">SAMPLE SIZE</span><span role="columnheader"></span></div>${shown.map(d => `<div class="cov-row" role="row"><a role="cell" href="/coverage/${e(d.id)}">${e(d.title)}</a><span class="n" role="cell">${n(d.fixtures)}</span><span class="bar" role="cell" aria-label="${n(d.fixtures)} fixtures; minimum sample size ${MIN}"><i style="width:${(d.fixtures / max * 100).toFixed(2)}%"></i><u style="left:${line}%"></u></span><span class="flag" role="cell">${d.fixtures < MIN ? 'Below minimum' : d.fixtures === MIN ? 'At minimum' : ''}</span></div>`).join('')}</div>
    ${view === 'all' ? twinProbeSection(data, fixtures) : ''}<section class="section"><h2 class="h2-compact">Case suites</h2><p class="small">The same fixtures, grouped by the question each suite was written to ask.</p><div class="tbl"><table><thead><tr><th scope="col">Suite</th><th scope="col" class="num">Fixtures</th><th scope="col">Scope</th></tr></thead><tbody>${categories.map(c => `<tr><td><a href="/suites/${e(c.id)}">${e(c.title)}</a></td><td class="num">${n(fixtures.filter(f => f.category === c.id).length)}</td><td>${e(c.description)}</td></tr>`).join('')}</tbody></table></div></section>`;
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
const inventoryRows = (entries: Entry[]) => entries.map(row => `<tr><td><a href="${e(row.sourceUrl)}" rel="noreferrer">${e(row.id)}</a><small>${e(tools[row.tool as keyof typeof tools])} ${e(inventory.sources[row.tool as keyof typeof tools].version)}</small></td><td>${row.relatedDetector ? `${statusMark('info', 'Related family')}<small><a href="/coverage/${e(row.relatedDetector)}">${e(row.relatedDetector)}</a> · parity unverified</small>` : `${statusMark('not-measured', 'No dedicated detector')}<small>Generic detection may still apply</small>`}</td><td>${row.activation === 'feature-gated' ? 'Feature-gated registration' : row.tool === 'gitleaks' ? 'Default rule' : 'Registered detector'}<small>${row.activation === 'feature-gated' ? e(row.featureFlag) : 'Source inventory · not runtime-tested here'}</small></td></tr>`).join('');

/** Upstream detector families with no dedicated equivalent, and so no dedicated fixtures. An inventory, not a measurement. */
function inventoryView(): string {
  const missing = inventory.entries.filter(row => row.status === 'no-dedicated-detector');
  const count = (tool: string) => missing.filter(row => row.tool === tool).length, all = (tool: string) => inventory.entries.filter(r => r.tool === tool).length;
  return `<p class="prose small">Named detector families in other scanners that redact-secret ${e(inventory.redactSecretVersion)} has no dedicated detector for, and this corpus therefore has no dedicated fixtures for. Missing a dedicated detector is different from missing a secret: generic detection may still find a value. Related families can support different formats; their parity is unverified. Counts are tool entries, including versions, not unique providers.</p>
    <div class="meta" style="margin:var(--space-4) 0"><span><b>${n(count('gitleaks'))}</b> of ${n(all('gitleaks'))} Gitleaks ${e(inventory.sources.gitleaks.version)} rules</span><span><b>${n(count('trufflehog'))}</b> of ${n(all('trufflehog'))} TruffleHog ${e(inventory.sources.trufflehog.version)} registrations</span><span>Snapshot ${e(inventory.reviewedAt)}</span></div>
    <form class="filters" id="inventory-filters"><label class="field">Search<input id="inventory-query" type="search" placeholder="Datadog, GCP, Notion"></label><label class="field">Scanner<select id="inventory-tool"><option value="all">Both scanners</option><option value="gitleaks">Gitleaks</option><option value="trufflehog">TruffleHog</option></select></label><label class="field">Coverage<select id="inventory-status"><option value="no-dedicated-detector">No dedicated detector</option><option value="related-family">Related family, parity unverified</option><option value="all">All entries</option></select></label></form>
    <p class="small" id="inventory-count" role="status" aria-live="polite"></p><div class="tbl wide" tabindex="0" role="region" aria-label="Upstream detector inventory"><table><thead><tr><th scope="col">Detector or rule</th><th scope="col">redact-secret status</th><th scope="col">Upstream registration</th></tr></thead><tbody id="inventory-rows">${inventoryRows(missing.slice(0, PAGE))}</tbody></table></div><p class="small" id="inventory-empty" hidden>No detector entries match these filters.</p><div class="pager"><button type="button" class="btn" id="inventory-prev">Previous</button><span id="inventory-page"></span><button type="button" class="btn" id="inventory-next">Next</button></div>
    <section class="section"><div class="section-head"><div><h2 class="h2-compact">Measured regressions tracked as product issues</h2><p class="small">Published npm ${e(gaps.measuredVersion)} · snapshot ${e(gaps.reviewedAt)}. Measured fixture failures, separate from the inventory above. Historical measurement, not live issue status.</p></div><a href="${e(gaps.milestoneUrl)}">Milestone</a></div>${gaps.issues.map(issue => `<div class="chg">${statusMark('info', issue.status)}<span><a href="${e(issue.url)}">#${issue.number} · ${e(issue.title)}</a><small>${issue.kind === 'false-positive' ? 'False positives' : 'Missed secret spans'} · ${issue.fixtures.map(slug => `<a href="/fixture/${e(slug)}">${e(slug.split('--')[1])}</a>`).join(' · ')}</small></span><span class="d">${issue.fixtures.length} fixtures</span></div>`).join('')}</section>
    <section class="section prose"><h2 class="h2-compact">Sources and method</h2><p class="small">No scanner implementations are bundled; this view stores identifiers, registration metadata, mappings and source links. Commented-out TruffleHog registrations are excluded, feature-gated registrations are labelled, and versions stay separate. These entries are candidates for future synthetic fixtures and scope review, not confirmed runtime false negatives.</p><ul class="small">${Object.entries(inventory.sources).map(([tool, source]) => `<li><a href="${e(source.url)}">${e(tools[tool as keyof typeof tools])} ${e(source.version)} registry</a> · revision <code>${e(source.revision.slice(0, 12))}</code></li>`).join('')}<li><a href="https://github.com/redact-secret/redact-secret/blob/${e(inventory.redactSecretRevision)}/crates/secret-scan-core/src/detectors/mod.rs">redact-secret ${e(inventory.redactSecretVersion)} registry</a></li></ul></section>`;
}

export function bindInventory() {
  const form = document.querySelector<HTMLFormElement>('#inventory-filters');
  if (!form) return;
  let page = 0;
  const query = document.querySelector<HTMLInputElement>('#inventory-query')!, tool = document.querySelector<HTMLSelectElement>('#inventory-tool')!, status = document.querySelector<HTMLSelectElement>('#inventory-status')!;
  const previous = document.querySelector<HTMLButtonElement>('#inventory-prev')!, next = document.querySelector<HTMLButtonElement>('#inventory-next')!;
  const render = () => {
    const selected = filterInventory(inventory.entries, { query: query.value, tool: tool.value, status: status.value }) as Entry[];
    const pages = Math.max(1, Math.ceil(selected.length / PAGE)); page = Math.min(page, pages - 1);
    document.querySelector('#inventory-rows')!.innerHTML = inventoryRows(selected.slice(page * PAGE, (page + 1) * PAGE));
    document.querySelector('#inventory-count')!.textContent = `${n(selected.length)} matching entries of ${n(inventory.entries.length)}`;
    document.querySelector<HTMLElement>('#inventory-empty')!.hidden = selected.length !== 0;
    document.querySelector('#inventory-page')!.textContent = `Page ${page + 1} of ${pages}`;
    previous.disabled = page === 0; next.disabled = page + 1 === pages;
  };
  form.addEventListener('submit', event => event.preventDefault());
  form.addEventListener('input', () => { page = 0; render(); });
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  render();
}
