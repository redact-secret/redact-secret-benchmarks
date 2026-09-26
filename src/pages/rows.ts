import { bindPager, escapeHtml as e, pager, statusMark, OUTCOME_NAME, type Outcome } from '../components';
import { kinds, tiers } from '../../benchmarks/lib/assessment.ts';
import type { Fixture } from '../catalog';
import type { Report, Row, Scanner } from '../types';

/** The fixture rows behind a number. Every Figure on the site can be followed down to this table, then to the bytes. */
export const kindTitle = (kind: string) => (kinds as Record<string, { title: string }>)[kind]?.title ?? kind;
export const tierTitle = (tier: string) => (tiers as Record<string, { title: string }>)[tier]?.title ?? tier;
export const groupTitle = (key: string) => (key === 'pending/T0' ? 'Pending review' : `${kindTitle(key.split('/')[0])} · ${tierTitle(key.split('/')[1])}`);

const SHORT: Record<Outcome, string> = { EXACT: 'Exact', COVERED: 'Within range', OVERBROAD: 'Too much', PARTIAL: 'Partly exposed', MISS: 'Missed' };
/**
 * One outcome as a word with a status. A policy row records a difference of
 * opinion, so it is reported as information, never as a failure.
 */
export function outcomeMark(outcome: Outcome, kind: string, long = false): string {
  const word = long ? OUTCOME_NAME[outcome] : SHORT[outcome];
  if (kind === 'policy') return statusMark('info', word);
  return statusMark(outcome === 'PARTIAL' || outcome === 'MISS' ? 'fail' : outcome === 'OVERBROAD' ? 'review' : 'pass', word);
}
export function rowMarks(row: Row | undefined, scannerStatus: string | undefined, long = false): string {
  if (!row) return scannerStatus === 'unstable' ? statusMark('unstable') : statusMark('not-measured');
  if (row.spanOutcomes) return row.spanOutcomes.map(o => outcomeMark(o, row.kind, long)).join(' ');
  if (row.flagged != null) return row.flagged ? statusMark(row.kind === 'policy' ? 'info' : 'fail', `Flagged${row.findings && row.findings > 1 ? ` ×${row.findings}` : ''}`) : statusMark('pass', 'Quiet');
  return statusMark('not-measured', `Unscored · ${row.actual.length} range${row.actual.length === 1 ? '' : 's'}`);
}
export interface ScannerColumn { id: string; name: string }
export interface FixtureCell { scanner: Scanner | undefined; row: Row | undefined }

export const rowClean = (row: Row | undefined) => !row || (row.spanOutcomes ? row.spanOutcomes.every(o => o === 'EXACT' || o === 'COVERED') : !row.flagged);
export const scannerColumns = (reports: Report[]): ScannerColumn[] =>
  [...new Map(reports.flatMap(r => r.scanners.map(s => [s.id, s.name] as const))).entries()].map(([id, name]) => ({ id, name }));
export const cellsForFixture = (fixture: Fixture, reports: Report[], scanners = scannerColumns(reports)): FixtureCell[] => {
  const report = reports.find(r => r.category === fixture.category);
  return scanners.map(({ id }) => {
    const scanner = report?.scanners.find(s => s.id === id);
    return { scanner, row: scanner?.status === 'complete' ? scanner.rows?.find(r => r.id === fixture.id) : undefined };
  });
};
export const fixtureSearch = (fixture: Fixture) =>
  `${fixture.slug} ${fixture.group} ${fixture.assessment.kind} ${fixture.assessment.tier} ${kindTitle(fixture.assessment.kind)} ${tierTitle(fixture.assessment.tier)} ${fixture.assessment.contract ?? ''} ${fixture.twinOf ? 'twin' : ''}`.toLowerCase();
export function fixtureRowCells(fixture: Fixture, cells: FixtureCell[], kindPrefix = ''): string {
  return `<td><a href="/fixture/${e(fixture.slug)}">${e(fixture.id)}</a><small>${e(fixture.category)} · ${e(fixture.group)}</small></td><td>${kindPrefix}${e(kindTitle(fixture.assessment.kind))}<small>${e(fixture.assessment.tier)} · ${e(tierTitle(fixture.assessment.tier))}${fixture.twinOf ? ' · twin' : ''}</small></td>${cells.map(c => `<td>${rowMarks(c.row, c.scanner?.status)}</td>`).join('')}`;
}

export interface RowsInput { fixtures: Fixture[]; reports: Report[]; id?: string; heading?: string; note?: string }
export function rowsTable({ fixtures, reports, id = 'rows', heading = 'Rows', note = '' }: RowsInput): string {
  const scanners = scannerColumns(reports);
  let attention = 0;
  const body = fixtures.map(f => {
    const cells = cellsForFixture(f, reports, scanners);
    const signal = cells.some(c => !rowClean(c.row));
    if (signal) attention++;
    return `<tr data-row data-search="${e(fixtureSearch(f))}" data-signal="${signal ? 1 : 0}">${fixtureRowCells(f, cells)}</tr>`;
  }).join('');
  return `<section class="section" id="${e(id)}" data-rows><div class="section-head"><div><h2 class="h2-compact">${e(heading)}</h2><p class="small">${fixtures.length.toLocaleString('en-US')} fixtures, ${attention.toLocaleString('en-US')} where some scanner left a secret readable, redacted too much or flagged a safe value.${note ? ` ${note}` : ''}</p></div><div class="filters"><label class="field">Find<input type="search" data-rows-filter placeholder="id, suite, kind, evidence level"></label><label class="field">Show<select data-rows-signal><option value="signal">Rows needing a look</option><option value="all">All rows</option></select></label></div></div>
    <div class="tbl wide" tabindex="0" role="region" aria-label="${e(heading)}"><table><thead><tr><th scope="col">Fixture</th><th scope="col">Kind and evidence</th>${scanners.map(({ name }) => `<th scope="col">${e(name)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>
    ${pager(id, '<span data-rows-count role="status" aria-live="polite"></span>')}</section>`;
}

const PAGE = 50;
const state = new Map<string, { filter: string; show: string; page: number }>();
/** Filter, the needs-a-look toggle and paging survive the 5-second refresh. */
export function bindRows() {
  document.querySelectorAll<HTMLElement>('[data-rows]').forEach(section => {
    const key = `${location.pathname}#${section.id}`;
    const rows = Array.from(section.querySelectorAll<HTMLTableRowElement>('tr[data-row]'));
    const anySignal = rows.some(r => r.dataset.signal === '1');
    const saved = state.get(key) ?? { filter: '', show: anySignal ? 'signal' : 'all', page: 0 }; state.set(key, saved);
    const filter = section.querySelector<HTMLInputElement>('[data-rows-filter]')!, show = section.querySelector<HTMLSelectElement>('[data-rows-signal]')!;
    filter.value = saved.filter; show.value = saved.show;
    const apply = () => {
      const matching = rows.filter(r => r.dataset.search!.includes(saved.filter.toLowerCase()) && (saved.show === 'all' || r.dataset.signal === '1'));
      const pages = Math.max(1, Math.ceil(matching.length / PAGE)); saved.page = Math.min(saved.page, pages - 1);
      const visible = new Set(matching.slice(saved.page * PAGE, (saved.page + 1) * PAGE));
      for (const r of rows) r.hidden = !visible.has(r);
      section.querySelector('[data-rows-count]')!.textContent = `${matching.length.toLocaleString('en-US')} of ${rows.length.toLocaleString('en-US')} rows`;
      showPage(saved.page, pages);
    };
    const showPage = bindPager(section.id, delta => { saved.page += delta; apply(); });
    filter.addEventListener('input', () => { saved.filter = filter.value; saved.page = 0; apply(); });
    show.addEventListener('change', () => { saved.show = show.value; saved.page = 0; apply(); });
    apply();
  });
}
