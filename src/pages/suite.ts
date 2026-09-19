import { actionEmptyState, escapeHtml as e, evidenceCrumb, statusMark } from '../components';
import { categories, type Fixture } from '../catalog';
import type { Group } from '../types';
import { PRODUCT, runIdOf, type BenchData } from './data';
import { boundCell, compactFigure, isControl, isRedact, type Floors } from './figures';
import { groupTitle, rowsTable } from './rows';

/** One case suite, read from its own report: the groups here are the suite's published groups, untouched. */
export function suitePage(data: BenchData, fixtures: Fixture[], id: string): string {
  const category = categories.find(c => c.id === id);
  const crumb = evidenceCrumb([{ label: 'Coverage', href: '/coverage' }, { label: category?.title ?? id }]);
  if (!category) return `${crumb}<div class="page-head"><div><h1>No such suite</h1></div></div>${actionEmptyState({ title: `No case suite is registered as “${e(id)}”`, body: `Suites come from <code>benchmarks/categories.json</code>: ${categories.map(c => `<a href="/suites/${e(c.id)}">${e(c.id)}</a>`).join(', ')}.` })}`;
  const selected = fixtures.filter(f => f.category === id), loaded = data.loaded.find(l => l.category.id === id), report = loaded?.report;
  const stale = report && report.runId !== runIdOf(data);
  const head = `${crumb}<div class="page-head"><div><p class="eyebrow">CASE SUITE</p><h1>${e(category.title)}</h1><div class="meta"><span><b>${selected.length.toLocaleString('en-US')}</b> fixtures</span>${report ? `<span>Run <b>${e(report.runId.slice(0, 10))}</b>${stale ? ` ${statusMark('review', 'Older run')}` : ''}</span><a href="/results/${e(id)}.json" download>Export JSON</a>` : ''}</div></div></div><p class="prose">${e(category.description)}</p>`;
  if (!report) return head + actionEmptyState({ title: loaded?.problem && loaded.problem !== 'Missing or unreadable report' ? 'This suite report is left out' : 'No results for this suite', body: loaded?.problem && loaded.problem !== 'Missing or unreadable report' ? `${e(loaded.problem)}. A report that does not re-validate against the fixture bytes is never read.` : 'The fixtures are here, but no scanner has run against this suite. Run it, then reload.', command: `npm run bench -- --category=${id}` }) + rowsTable({ fixtures: selected, reports: [] });
  const floors = report.accounting as unknown as Floors;
  const product = report.scanners.find(s => s.id === PRODUCT), others = report.scanners.filter(s => s.id !== PRODUCT);
  const keys = Object.keys(product?.groups ?? report.scanners.find(s => s.groups)?.groups ?? {}).sort((a, b) => (a === 'pending/T0' ? 1 : b === 'pending/T0' ? -1 : a.localeCompare(b)));
  const cell = (groups: Record<string, Group> | undefined, key: string) => groups?.[key];
  const table = keys.length ? `<div class="tbl wide" style="margin-top:var(--space-8)"><table><thead><tr><th scope="col">Group</th><th scope="col" class="num">Fixtures</th><th scope="col">Leaked or false alarms, at most</th><th scope="col">Tells near-twins apart, at least</th><th scope="col">Other scanners, same cell</th></tr></thead><tbody>${keys.map(key => {
    const g = cell(product?.groups, key);
    if (key === 'pending/T0') return `<tr><td>${e(groupTitle(key))}</td><td class="num">${g?.files ?? '—'}</td><td>${statusMark('withheld', 'Unscored')}</td><td></td><td></td></tr>`;
    const which = key.startsWith('must-not-flag/') ? 'alarm' : 'leak';
    return `<tr><td>${e(groupTitle(key))}</td><td class="num">${g?.files ?? '—'}</td><td>${compactFigure(groupTitle(key), g, which, key, floors)}</td><td>${isRedact(g) ? compactFigure(`${groupTitle(key)}, twins`, g, 'twins', key, floors) : isControl(g) ? '' : ''}</td><td class="peer-cell">${others.map(s => `<small>${e(s.id)} ${s.status === 'complete' ? boundCell(cell(s.groups, key), which, key, floors) : statusMark(s.status === 'unstable' ? 'unstable' : 'not-measured')}</small>`).join('')}</td></tr>`;
  }).join('')}</tbody></table></div>` : '';
  const provenance = `<section class="section"><h2 class="h2-compact">Run provenance</h2><dl class="kv"><dt>Review status</dt><dd>${e(report.reviewStatus)}${report.scope ? ` · ${e(report.scope)}` : ''}</dd><dt>Measured</dt><dd>${e(report.generatedAt)}</dd><dt>Corpus SHA-256</dt><dd><code>${e(report.corpusHash)}</code></dd><dt>Lockfile SHA-256</dt><dd><code>${e(report.lockHash)}</code></dd><dt>Revision</dt><dd><code>${e(report.revision)}</code>${report.dirty ? ' (modified)' : ''}</dd><dt>Environment</dt><dd>${e(report.runtime.node)} · ${e(report.runtime.platform)} · ${e(report.runtime.arch)}</dd><dt>Scanners</dt><dd>${report.scanners.map(s => `${e(s.id)} ${e(s.version ?? 'version unavailable')} <span class="muted">${e(s.mode)}</span>`).join('<br>')}</dd><dt>Matching rule</dt><dd>${e(report.matching)}</dd>${report.milestoneReview ? `<dt>Release context</dt><dd>${e(report.milestoneReview.targetRelease)}. ${e(report.milestoneReview.validation)} Not evaluated: ${report.milestoneReview.unverifiedSurfaces.map(e).join(' · ')}</dd>` : ''}</dl></section>`;
  return head + (stale ? actionEmptyState({ title: 'This suite is from an older run', body: `Its run id differs from the current run, so it is left out of every cross-suite total. The numbers below are this suite's own.`, command: `npm run bench -- --category=${id}` }) : '') + table + rowsTable({ fixtures: selected, reports: [report] }) + provenance;
}
