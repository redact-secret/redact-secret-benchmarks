import { categories, registry, fixtures, corpusHashes } from './catalog';
import { parseRoute, isAppPath, reportProblem } from './model.mjs';
import { overview, fixturePage, fixtureList, comparison, stats, title, readingNote, runLine } from './pages/browse';
import { accuracy } from './pages/accuracy';
import { methodology } from './pages/methodology';
import { escape as e, type Report, type Run } from './types';
import { mountShell, renderPage, type NavItem, type SearchTarget } from './shell';
import './tokens.css';
import './style.css';
import type { EvaluationReport } from './evaluation-types';

const app = document.querySelector<HTMLDivElement>('#app')!;
const hashes = corpusHashes();
let request = 0, lastPayload = '', downloadUrl = '';
/** Allowlist flag for a future customer-only build: set VITE_PUBLIC_ROUTES_ONLY=1 and Workbench paths stop resolving. */
const PUBLIC_ONLY = import.meta.env.VITE_PUBLIC_ROUTES_ONLY === '1';
const suiteIds = categories.map(c => c.id);
const route = () => parseRoute(location.pathname, { suites: suiteIds, publicOnly: PUBLIC_ONLY });
// Per-route UI state survives the 5-second polling re-render.
const listState = new Map<string, { filter: string; showAll: boolean; page: number }>();
const openKeys = new Set<string>();
const splitState = new Map<string, boolean>();
const expanded = new Set<string>();

const targets = (): SearchTarget[] => [
  ...registry.detectors.map(d => ({ href: `/coverage/${d.id}`, label: d.title, hint: `detector · ${fixtures.filter(f => f.detectors.includes(d.id)).length} fixtures` })),
  ...categories.map(c => ({ href: `/suites/${c.id}`, label: c.title, hint: 'case suite' })),
  ...fixtures.map(f => ({ href: `/fixture/${f.slug}`, label: f.slug, hint: 'fixture' })),
];
const under = (...roots: string[]) => (path: string) => roots.some(root => path === root || path.startsWith(root + '/'));
const NAV: NavItem[] = [
  { href: '/report', label: 'Report', short: 'Report', current: under('/report') },
  { href: '/coverage', label: 'Coverage', short: 'Coverage', current: under('/coverage', '/suites', '/fixture') },
  { href: '/workbench', label: 'Workbench', short: 'Workbench', current: under('/workbench') },
  { href: '/how-to-read', label: 'How to read', short: 'Read', current: under('/how-to-read') },
].filter(item => !PUBLIC_ONLY || item.href !== '/workbench');
const shell = (content: string, label: string) => renderPage(content, label);

function bindList(key: string) {
  const input = document.querySelector<HTMLInputElement>('#filter');
  const rows = document.querySelector<HTMLElement>('#fixture-rows');
  if (!input || !rows) return;
  const state = listState.get(key) ?? { filter: '', showAll: false, page: 0 };
  listState.set(key, state);
  const showAll = document.querySelector<HTMLInputElement>('#show-all')!;
  input.value = state.filter; showAll.checked = state.showAll;
  const pageSize = 100;
  const apply = () => {
    state.filter = input.value; state.showAll = showAll.checked;
    const all = Array.from(rows.querySelectorAll<HTMLTableRowElement>('tr[data-row]'));
    const matching = all.filter(r => r.dataset.search!.includes(state.filter.toLowerCase()) && (state.showAll || r.dataset.signal === '1'));
    const pages = Math.max(1, Math.ceil(matching.length / pageSize));
    state.page = Math.min(state.page, pages - 1);
    const visible = new Set(matching.slice(state.page * pageSize, (state.page + 1) * pageSize));
    for (const r of all) {
      r.hidden = !visible.has(r);
      const x = document.getElementById(r.querySelector('button.expand')!.getAttribute('aria-controls')!);
      if (x) x.hidden = r.hidden || !expanded.has(r.dataset.row!);
      r.querySelector('button.expand')!.setAttribute('aria-expanded', String(expanded.has(r.dataset.row!)));
    }
    document.querySelector<HTMLElement>('#no-matches')!.hidden = matching.length > 0;
    document.querySelector('#list-count')!.textContent = `${matching.length} shown of ${all.length}${state.showAll ? '' : ' · signal only'}`;
    const pager = document.querySelector<HTMLElement>('#pager')!;
    pager.hidden = matching.length <= pageSize * 2 && pages === 1;
    document.querySelector('#page-label')!.textContent = `Page ${state.page + 1} of ${pages}`;
    document.querySelector<HTMLButtonElement>('#page-prev')!.disabled = state.page === 0;
    document.querySelector<HTMLButtonElement>('#page-next')!.disabled = state.page + 1 >= pages;
  };
  input.addEventListener('input', () => { state.page = 0; apply(); });
  showAll.addEventListener('change', () => { state.page = 0; apply(); });
  document.querySelector('#page-prev')!.addEventListener('click', () => { state.page--; apply(); });
  document.querySelector('#page-next')!.addEventListener('click', () => { state.page++; apply(); });
  rows.addEventListener('click', ev => {
    const button = (ev.target as Element).closest<HTMLButtonElement>('button.expand');
    if (!button) return;
    const slug = button.closest<HTMLTableRowElement>('tr')!.dataset.row!;
    if (expanded.has(slug)) expanded.delete(slug); else expanded.add(slug);
    apply();
  });
  apply();
}

function bindSplit() {
  for (const box of document.querySelectorAll<HTMLInputElement>('input[data-split]')) {
    const tbody = box.closest('section')!.querySelector('tbody')!;
    const render = () => {
      const split = splitState.get(box.dataset.split!) ?? false;
      box.checked = split;
      const rows = Array.from(tbody.querySelectorAll<HTMLTableRowElement>(':scope > tr'));
      const key = (r: HTMLTableRowElement) => { const tier = r.dataset.tier ?? '', scanner = r.classList.contains('tier-head') ? '' : r.dataset.scanner ?? ''; return split ? [tier, scanner] : [scanner, tier]; };
      rows.sort((a, b) => { const [x, y] = [key(a), key(b)]; return x[0].localeCompare(y[0]) || x[1].localeCompare(y[1]); });
      for (const r of rows) { if (r.classList.contains('tier-head')) r.hidden = !split; tbody.appendChild(r); }
    };
    box.addEventListener('change', () => { splitState.set(box.dataset.split!, box.checked); render(); });
    render();
  }
}

function restoreDetails() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-key]').forEach(d => {
    d.open = openKeys.has(d.dataset.key!);
    d.addEventListener('toggle', () => { if (d.open) openKeys.add(d.dataset.key!); else openKeys.delete(d.dataset.key!); });
  });
}

async function refresh(force = false) {
  const current = route();
  if (current.kind === 'redirect') { history.replaceState(null, '', current.to + location.search + location.hash); lastPayload = ''; return refresh(true); }
  const inventoryView = current.kind === 'coverage' && !current.id;
  if (inventoryView && !force) return;
  const token = ++request, path = location.pathname;
  if (current.kind === 'workbench') {
    if (current.view === 'changes') { if (force) shell('<h1>Changes</h1><p class="small">Baseline to candidate changes arrive with the Workbench stage.</p>', 'Changes'); return; }
    const legacyView = current.view === 'review' ? 'reviews' : current.view === 'qualification' ? 'method' : current.view;
    const legacyId = current.view === 'qualification' ? 'holdout' : current.view === 'review' ? '' : current.id;
    const [{ evaluationProblem }, { evaluationPage, evaluationEmpty, bindEvaluation }] = await Promise.all([import('./evaluation-model'), import('./pages/evaluation')]);
    if (token !== request || path !== location.pathname) return;
    if (force) shell('<p role="status">Loading evaluation evidence…</p>', 'Workbench');
    try {
      const response = await fetch('/results/evaluation-v1.json', { cache: 'no-store' });
      if (!response.ok) throw Error('Evaluation report not published');
      const report: EvaluationReport = await response.json();
      const problem = evaluationProblem(report, await hashes);
      if (token !== request || path !== location.pathname) return;
      const payload = JSON.stringify(report);
      if (!force && payload === lastPayload) return;
      lastPayload = payload;
      shell(problem ? evaluationEmpty(problem) : evaluationPage(report, legacyView!, legacyId), 'Workbench');
      bindEvaluation();
    } catch {
      if (token === request && path === location.pathname) { lastPayload = ''; shell(evaluationEmpty('Evaluation report missing or unreadable'), 'Workbench'); }
    }
    return;
  }
  if (inventoryView) {
    if (force) {
      shell('<p role="status">Loading detector inventory…</p>', 'Coverage gaps');
      try {
        const { coverageGaps, bindInventory } = await import('./pages/gaps');
        if (token !== request || location.pathname !== path) return;
        shell(coverageGaps(), 'Coverage gaps'); bindInventory();
      } catch { if (token === request) shell('<h1>Unable to load detector inventory.</h1><p>Reload to try again.</p>', 'Coverage gaps'); }
    }
    return;
  }
  if (current.kind === 'how-to-read') { if (force) shell(methodology(), 'How to read'); return; }
  const detector = current.kind === 'coverage' ? registry.detectors.find(d => d.id === current.id) : undefined;
  const category = current.kind === 'suite' ? categories.find(c => c.id === current.id) : undefined;
  const fixture = current.kind === 'fixture' ? fixtures.find(f => f.slug === current.id) : undefined;
  const pending = false;
  if (current.kind !== 'report' && !pending && !detector && !category && !fixture) {
    shell('<h1>Page not found</h1><p class="small">No page lives at this path. <a href="/report">Open the report</a>.</p>', 'Not found'); return;
  }
  const label = detector?.title ?? category?.title ?? fixture?.id ?? (pending ? 'Pending review' : 'Benchmark overview');
  if (force) shell('<p role="status">Loading benchmark results…</p>', label);
  try {
    const sourceHashes = await hashes;
    const relevant = fixture ? categories.filter(c => c.id === fixture.category) : category ? [category] : detector ? categories.filter(c => fixtures.some(f => f.category === c.id && f.detectors.includes(detector.id))) : pending ? categories.filter(c => fixtures.some(f => f.category === c.id && f.assessment.tier === 'T0')) : categories;
    const [run, loaded] = await Promise.all([
      fetch('/results/run.json', { cache: 'no-store' }).then(r => (r.ok ? (r.json() as Promise<Run>) : undefined)).catch(() => undefined),
      Promise.all(relevant.map(async c => {
        try {
          const response = await fetch(`/results/${c.id}.json`, { cache: 'no-store' });
          if (!response.ok) throw new Error('missing');
          const report: Report = await response.json();
          const problem = reportProblem(report, c.id, sourceHashes[c.id], fixtures);
          return { category: c, report: problem ? undefined : report, problem };
        } catch { return { category: c, report: undefined, problem: 'Missing or unreadable report' }; }
      })),
    ]);
    if (token !== request || path !== location.pathname) return;
    const payload = JSON.stringify([run, loaded]);
    if (!force && payload === lastPayload) return;
    lastPayload = payload;
    const reports = loaded.flatMap(item => item.report ? [item.report] : []);
    const problems = loaded.filter(item => item.problem);
    const notice = problems.length ? `<div class="notice"><div><strong>${problems.length} suite report(s) excluded</strong><p>${problems.map(item => `${e(item.category.title)}: ${e(item.problem)}`).join('<br>')}</p><p>Run <code>npm run bench</code> to refresh measurements. Fixture inputs remain available.</p></div></div>` : '';
    let body = '';
    if (fixture) body = fixturePage(fixture, reports);
    else if (detector) {
      const selected = fixtures.filter(f => f.detectors.includes(detector.id));
      body = `<p><a class="text-link" href="/evaluation/detector/${e(detector.id)}">Evaluation evidence: methods, failures and review →</a></p>` + title(detector.title, `Fixtures targeting ${detector.id}, across all case suites.`, 'BENCHMARK / DETECTOR') + runLine(run, reports) + stats(selected) + readingNote('Detector views overlap; do not sum them.') + (selected.length ? comparison(selected, reports, run) : '<div class="notice">This detector is registered upstream but has no assigned fixtures yet. No coverage claim is made.</div>') + fixtureList(selected, reports, run);
    } else if (pending) {
      const selected = fixtures.filter(f => f.assessment.tier === 'T0');
      body = title('Pending review', 'T0 fixtures: observations are inspectable but excluded from every comparative number until evidence exists.', 'BENCHMARK / PENDING') + fixtureList(selected, reports, run);
    } else if (category) {
      const report = reports[0];
      body = title(category.title, category.description, 'BENCHMARK / CASE') + (report ? `<p class="run-line">Run <span class="mono">${e(report.runId)}</span> · measured ${e(new Date(report.generatedAt).toLocaleString())} · <a class="text-link" href="/results/${e(category.id)}.json" download>Export JSON ↗</a></p>${accuracy(report, run)}<details class="panel provenance" data-key="provenance"><summary>Run provenance</summary><dl><dt>Corpus SHA-256</dt><dd>${e(report.corpusHash)}</dd><dt>Lockfile SHA-256</dt><dd>${e(report.lockHash)}</dd><dt>Revision</dt><dd>${e(report.revision)}${report.dirty ? ' (modified)' : ''}</dd><dt>Environment</dt><dd>${e(report.runtime.node)} / ${e(report.runtime.platform)} / ${e(report.runtime.arch)}</dd><dt>Matching rule</dt><dd>${e(report.matching)}</dd></dl></details>` : stats(fixtures.filter(f => f.category === category.id)) + fixtureList(fixtures.filter(f => f.category === category.id), reports, run));
    } else body = overview(reports, run);
    shell(notice + body, label);
    restoreDetails();
    bindSplit();
    bindList(location.pathname);
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
    const download = document.querySelector<HTMLAnchorElement>('#download-fixture');
    if (download && fixture) {
      downloadUrl = URL.createObjectURL(new Blob([new TextEncoder().encode(fixture.content)], { type: 'application/octet-stream' }));
      download.href = downloadUrl;
      download.download = fixture.path.split('/').pop()!;
    }
  } catch {
    if (token === request) shell('<h1>Unable to load benchmark catalog.</h1><p>Reload this page and check the development server.</p>', label);
  }
}

function navigate(path: string) {
  history.pushState(null, '', path);
  lastPayload = '';
  void refresh(true);
  window.scrollTo(0, 0);
}
document.addEventListener('click', event => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') || anchor.target) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
  event.preventDefault(); navigate(url.pathname + url.search);
});
mountShell(app, { nav: NAV, targets, navigate });
window.addEventListener('popstate', () => { lastPayload = ''; void refresh(true); });
// Preserve bookmarks from the original hash navigation; parseRoute forwards the old path from there.
if (location.hash.startsWith('#/')) {
  const old = location.hash.slice(2);
  history.replaceState(null, '', old === 'methodology' ? '/methodology' : `/benchmark/${old}`);
}
void refresh(true);
setInterval(() => { void refresh(); }, 5000);
