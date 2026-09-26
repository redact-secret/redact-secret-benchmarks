import { escapeHtml as e } from '../components';
import type { Fixture } from '../catalog';
import { taxonomy as defaultTaxonomy, type Taxonomy } from '../../benchmarks/support/taxonomy.ts';
import type { Report, Row, Scanner } from '../types';
import { cellsForFixture, fixtureRowCells, fixtureSearch, rowClean, scannerColumns, type FixtureCell, type ScannerColumn } from './rows';

export interface AxisCount { readable: number; overbroad: number; falseAlarm: number; notMeasured: number }
export interface ReportLeaf {
  fixture: Fixture; cells: FixtureCell[]; axes: AxisCount[]; signal: boolean; search: string;
}
export interface ReportFamilyNode { key: string; id: string | null; name: string; special: boolean; leaves: ReportLeaf[] }
export interface ReportProviderNode { key: string; id: string | null; name: string; special: boolean; families: ReportFamilyNode[] }
export interface ReportTree { scanners: ScannerColumn[]; providers: ReportProviderNode[]; leaves: ReportLeaf[] }

const SPECIAL = 'global-multi-family';
const emptyAxis = (): AxisCount => ({ readable: 0, overbroad: 0, falseAlarm: 0, notMeasured: 0 });
const axesOf = (row: Row | undefined): AxisCount => ({
  readable: row?.spanOutcomes?.some(outcome => outcome === 'PARTIAL' || outcome === 'MISS') ? 1 : 0,
  overbroad: row?.spanOutcomes?.includes('OVERBROAD') ? 1 : 0,
  falseAlarm: row?.flagged === true ? 1 : 0,
  notMeasured: row ? 0 : 1,
});
const addAxes = (rows: ReportLeaf[], scanner: number) => rows.reduce((sum, leaf) => {
  const value = leaf.axes[scanner] ?? emptyAxis();
  sum.readable += value.readable; sum.overbroad += value.overbroad;
  sum.falseAlarm += value.falseAlarm; sum.notMeasured += value.notMeasured;
  return sum;
}, emptyAxis());
const familyHref = (id: string) => `/coverage/${id}`;

/**
 * A display-only projection of the exact Report leaf set. It never re-scores a
 * row. Zero- and multi-family fixtures deliberately share one explicit bucket
 * so a fixture cannot be counted once per relationship.
 */
export function buildReportTree(fixtures: Fixture[], reports: Report[], taxonomy: Taxonomy = defaultTaxonomy): ReportTree {
  const slugs = fixtures.map(fixture => fixture.slug);
  if (new Set(slugs).size !== slugs.length) throw new Error('Report hierarchy received duplicate fixture slugs');
  const knownFamilies = new Map(taxonomy.families.map(family => [family.id, family]));
  const scanners = scannerColumns(reports);
  const leaves = fixtures.map(fixture => {
    if (!Array.isArray(fixture.familyIds) || !Array.isArray(fixture.scenarioIds)) throw new Error(`Fixture semantic index is missing: ${fixture.slug}`);
    if (!fixture.familyIds.length && !fixture.unscopedReason) throw new Error(`Fixture semantic index has no unscoped reason: ${fixture.slug}`);
    for (const id of fixture.familyIds) if (!knownFamilies.has(id)) throw new Error(`Fixture semantic index has unknown family ${id}: ${fixture.slug}`);
    const cells = cellsForFixture(fixture, reports, scanners), axes = cells.map(cell => axesOf(cell.row));
    const labels = fixture.familyIds.flatMap(id => {
      const family = knownFamilies.get(id), provider = taxonomy.providers.find(entry => entry.id === family?.provider);
      return family ? [id, family.name, family.provider ?? 'not provider specific', provider?.name ?? ''] : [];
    });
    if (fixture.familyIds.length !== 1) labels.push('global multi-family');
    return { fixture, cells, axes, signal: cells.some(cell => !rowClean(cell.row)), search: `${fixtureSearch(fixture)} ${labels.join(' ')}`.toLowerCase() };
  });

  const providerOrder = new Map(taxonomy.providers.map((provider, index) => [provider.id, index]));
  const familyOrder = new Map(taxonomy.families.map((family, index) => [family.id, index]));
  const grouped = new Map<string, { provider: ReportProviderNode; families: Map<string, ReportFamilyNode> }>();
  const add = (providerKey: string, provider: Omit<ReportProviderNode, 'families'>, familyKey: string, family: Omit<ReportFamilyNode, 'leaves'>, leaf: ReportLeaf) => {
    let held = grouped.get(providerKey);
    if (!held) { held = { provider: { ...provider, families: [] }, families: new Map() }; grouped.set(providerKey, held); }
    let node = held.families.get(familyKey);
    if (!node) { node = { ...family, leaves: [] }; held.families.set(familyKey, node); held.provider.families.push(node); }
    node.leaves.push(leaf);
  };
  for (const leaf of leaves) {
    if (leaf.fixture.familyIds.length !== 1) {
      add(SPECIAL, { key: SPECIAL, id: null, name: 'Global / multi-family', special: true }, SPECIAL,
        { key: SPECIAL, id: null, name: 'Global controls and multi-family fixtures', special: true }, leaf);
      continue;
    }
    const family = knownFamilies.get(leaf.fixture.familyIds[0])!;
    const provider = family.provider === null ? null : taxonomy.providers.find(entry => entry.id === family.provider);
    if (family.provider !== null && !provider) throw new Error(`Taxonomy family ${family.id} has an unknown provider`);
    const providerKey = provider?.id ?? 'not-provider-specific';
    add(providerKey, { key: providerKey, id: provider?.id ?? null, name: provider?.name ?? 'Not provider-specific', special: false }, family.id,
      { key: family.id, id: family.id, name: family.name, special: false }, leaf);
  }
  const providers = [...grouped.values()].map(value => value.provider).sort((a, b) => {
    if (a.special !== b.special) return a.special ? 1 : -1;
    return (providerOrder.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER) - (providerOrder.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
  });
  for (const provider of providers) provider.families.sort((a, b) => {
    if (a.special !== b.special) return a.special ? 1 : -1;
    return (familyOrder.get(a.id ?? '') ?? Number.MAX_SAFE_INTEGER) - (familyOrder.get(b.id ?? '') ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name);
  });
  const providerTotal = providers.reduce((sum, provider) => sum + provider.families.reduce((n, family) => n + family.leaves.length, 0), 0);
  if (providerTotal !== leaves.length) throw new Error(`Report hierarchy does not reconcile: ${providerTotal} display leaves for ${leaves.length} fixtures`);
  return { scanners, providers, leaves };
}

const stats = (leaves: ReportLeaf[], scanners: ScannerColumn[]) => `<span class="tree-stats">${scanners.map((scanner, index) => {
  const count = addAxes(leaves, index);
  return `<span data-tree-stat="${index}"><b>${e(scanner.name)}</b> ${count.readable} readable/missed · ${count.overbroad} too much · ${count.falseAlarm} false alarms${count.notMeasured ? ` · ${count.notMeasured} not measured` : ''}</span>`;
}).join('')}</span>`;
const count = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'fixture' : 'fixtures'}`;
const relations = (fixture: Fixture, taxonomy: Taxonomy) => fixture.familyIds.length > 1
  ? `<small class="tree-relations">Families: ${taxonomy.families.filter(family => fixture.familyIds.includes(family.id)).map(family => `<a href="${e(familyHref(family.id))}">${e(family.name)}</a>`).join(' · ')}</small>`
  : fixture.familyIds.length === 0 ? `<small class="tree-relations">Global: ${e(fixture.unscopedReason ?? '')}</small>` : '';
const leafRow = (leaf: ReportLeaf, taxonomy: Taxonomy) => {
  const result = e(JSON.stringify(leaf.axes));
  const note = relations(leaf.fixture, taxonomy);
  return `<tr data-report-leaf data-slug="${e(leaf.fixture.slug)}" data-search="${e(leaf.search)}" data-signal="${leaf.signal ? 1 : 0}" data-results="${result}">${fixtureRowCells(leaf.fixture, leaf.cells, note)}</tr>`;
};

function familyNode(family: ReportFamilyNode, scanners: ScannerColumn[], taxonomy: Taxonomy): string {
  const link = family.id ? `<a href="${e(familyHref(family.id))}">Open family evidence</a>` : '<span>Each fixture keeps all reviewed family relationships below.</span>';
  return `<details class="tree-family" data-tree-family data-key="report:family:${e(family.key)}"><summary><span><b>${e(family.name)}</b><small data-tree-count>${e(count(family.leaves.length))}</small></span>${stats(family.leaves, scanners)}</summary><div class="tree-expanded"><p class="small">${link}</p><div class="tbl wide" tabindex="0" role="region" aria-label="${e(family.name)} fixture outcomes"><table><thead><tr><th scope="col">Fixture</th><th scope="col">Kind and evidence</th>${scanners.map(scanner => `<th scope="col">${e(scanner.name)}</th>`).join('')}</tr></thead><tbody>${family.leaves.map(leaf => leafRow(leaf, taxonomy)).join('')}</tbody></table></div></div></details>`;
}
function providerNode(provider: ReportProviderNode, scanners: ScannerColumn[], taxonomy: Taxonomy): string {
  const leaves = provider.families.flatMap(family => family.leaves);
  const units = provider.special ? `${provider.families.length} display bucket` : `${provider.families.length} ${provider.families.length === 1 ? 'family' : 'families'}`;
  return `<details class="tree-provider" data-tree-provider${provider.special ? ' data-tree-special' : ''} data-key="report:provider:${e(provider.key)}"><summary><span><b>${e(provider.name)}</b><small data-tree-count>${e(count(leaves.length))} · ${units}</small></span>${stats(leaves, scanners)}</summary><div class="tree-expanded">${provider.families.map(family => familyNode(family, scanners, taxonomy)).join('')}</div></details>`;
}

export function reportHierarchy(fixtures: Fixture[], reports: Report[], heading: string, taxonomy: Taxonomy = defaultTaxonomy): string {
  let tree: ReportTree;
  try { tree = buildReportTree(fixtures, reports, taxonomy); }
  catch (error) {
    const problem = error instanceof Error ? error.message : 'Fixture semantic index is unavailable';
    return `<section class="section" id="rows"><h2 class="h2-compact">${e(heading)}</h2><div class="empty-state" role="alert"><h3 class="h3">The fixture semantic index cannot be used</h3><p class="small">${e(problem)}. No provider or family grouping is shown until the checked-in index validates.</p></div></section>`;
  }
  const attention = tree.leaves.filter(leaf => leaf.signal).length;
  return `<section class="section" id="rows" data-report-tree><div class="section-head"><div><h2 class="h2-compact">${e(heading)}</h2><p class="small">${e(count(tree.leaves.length))}, ${attention.toLocaleString('en-US')} where some scanner left a secret readable, redacted too much or flagged a safe value. Grouping is a projection of these exact rows; it does not change accounting.</p></div><div class="filters"><label class="field">Find<input type="search" data-tree-filter placeholder="fixture, provider or family"></label><label class="field">Show<select data-tree-signal><option value="signal">Rows needing a look</option><option value="all">All rows</option></select></label></div></div><p class="small" data-tree-status role="status" aria-live="polite"></p><div class="report-tree">${tree.providers.map(provider => providerNode(provider, tree.scanners, taxonomy)).join('')}</div><div class="empty-state" data-tree-empty role="status" hidden><h3 class="h3">No rows match this selection</h3><p class="small">Clear the search or show all rows. Provider and family branches with no matching fixtures stay hidden.</p></div></section>`;
}

const state = new Map<string, { filter: string; show: string }>();
const parsedAxes = (row: HTMLTableRowElement): AxisCount[] => JSON.parse(row.dataset.results ?? '[]') as AxisCount[];
function updateNode(node: HTMLElement, rows: HTMLTableRowElement[]) {
  node.hidden = rows.length === 0;
  const countNode = node.querySelector<HTMLElement>(':scope > summary [data-tree-count]');
  if (countNode) {
    const families = node.matches('[data-tree-provider]') ? Array.from(node.querySelectorAll<HTMLElement>(':scope > .tree-expanded > [data-tree-family]')).filter(family => !family.hidden).length : 0;
    const units = node.hasAttribute('data-tree-special') ? `${families} display bucket` : `${families} ${families === 1 ? 'family' : 'families'}`;
    countNode.textContent = `${count(rows.length)}${families ? ` · ${units}` : ''}`;
  }
  node.querySelectorAll<HTMLElement>(':scope > summary [data-tree-stat]').forEach((entry, index) => {
    const total = rows.reduce((sum, row) => { const value = parsedAxes(row)[index] ?? emptyAxis(); sum.readable += value.readable; sum.overbroad += value.overbroad; sum.falseAlarm += value.falseAlarm; sum.notMeasured += value.notMeasured; return sum; }, emptyAxis());
    const scanner = entry.querySelector('b')?.textContent ?? '';
    entry.innerHTML = `<b>${e(scanner)}</b> ${total.readable} readable/missed · ${total.overbroad} too much · ${total.falseAlarm} false alarms${total.notMeasured ? ` · ${total.notMeasured} not measured` : ''}`;
  });
}

/** Search and attention apply to leaves first; every ancestor summary is then
 * recounted from exactly those visible leaves. */
export function bindReportHierarchy() {
  document.querySelectorAll<HTMLElement>('[data-report-tree]').forEach(section => {
    const key = `${location.pathname}${location.search}#${section.id}`;
    const rows = Array.from(section.querySelectorAll<HTMLTableRowElement>('[data-report-leaf]'));
    const held = state.get(key) ?? { filter: '', show: rows.some(row => row.dataset.signal === '1') ? 'signal' : 'all' }; state.set(key, held);
    const filter = section.querySelector<HTMLInputElement>('[data-tree-filter]')!, show = section.querySelector<HTMLSelectElement>('[data-tree-signal]')!;
    filter.value = held.filter; show.value = held.show;
    const apply = () => {
      const needle = held.filter.trim().toLowerCase();
      const visible = new Set(rows.filter(row => (row.dataset.search ?? '').includes(needle) && (held.show === 'all' || row.dataset.signal === '1')));
      for (const row of rows) row.hidden = !visible.has(row);
      section.querySelectorAll<HTMLElement>('[data-tree-family]').forEach(node => {
        const matches = Array.from(node.querySelectorAll<HTMLTableRowElement>('[data-report-leaf]')).filter(row => visible.has(row));
        updateNode(node, matches); if (needle && matches.length) (node as HTMLDetailsElement).open = true;
      });
      section.querySelectorAll<HTMLElement>('[data-tree-provider]').forEach(node => {
        const matches = Array.from(node.querySelectorAll<HTMLTableRowElement>('[data-report-leaf]')).filter(row => visible.has(row));
        updateNode(node, matches); if (needle && matches.length) (node as HTMLDetailsElement).open = true;
      });
      section.querySelector<HTMLElement>('[data-tree-empty]')!.hidden = visible.size !== 0;
      section.querySelector<HTMLElement>('[data-tree-status]')!.textContent = `${visible.size.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} fixtures in this selection`;
    };
    filter.addEventListener('input', () => { held.filter = filter.value; apply(); });
    show.addEventListener('change', () => { held.show = show.value; apply(); });
    apply();
  });
}

/** #336-compatible annotation. Older reports have no observation field and
 * therefore render no freshness claim. */
export function peerObservation(scannerId: string, reports: Report[]): string {
  const observations = reports.flatMap(report => {
    const observation: Scanner['observation'] = report.scanners.find(scanner => scanner.id === scannerId)?.observation;
    return observation ? [{ category: report.category, ...observation }] : [];
  });
  if (!observations.length) return '';
  const snapshots = observations.filter(observation => observation.source === 'snapshot');
  if (!snapshots.length) {
    const current = observations[0];
    return `<small>Observed fresh in run ${e(current.sourceRunId.slice(0, 10))} · ${e(current.observedAt)}</small>`;
  }
  const distinct = [...new Map(snapshots.map(observation => [`${observation.sourceRunId}:${observation.snapshotDigest}:${observation.inputDigest}:${observation.category}`, observation])).values()];
  return `<details class="report-peer-observation" data-key="report:peer:${e(scannerId)}"><summary>Reused peer observations · ${distinct.length} ${distinct.length === 1 ? 'snapshot' : 'snapshots'}</summary><ul class="small">${distinct.map(observation => `<li>${e(observation.category)} · source run ${e(observation.sourceRunId)} · observed ${e(observation.observedAt)} · snapshot <code>${e(observation.snapshotDigest?.slice(0, 12) ?? '')}</code> · input <code>${e(observation.inputDigest?.slice(0, 12) ?? '')}</code></li>`).join('')}</ul></details>`;
}
