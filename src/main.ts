import { categories, registry, fixtures, corpusHashes, baseline } from './catalog';
import { parseRoute, isAppPath, reportProblem } from './model.mjs';
import { overview, fixturePage, fixtureList, comparison, stats, title, readingNote, runLine } from './pages/browse';
import { accuracy } from './pages/accuracy';
import { methodology } from './pages/methodology';
import { escape as e, type Report, type Run } from './types';
import { mountShell, renderPage, type NavItem, type SearchTarget } from './shell';
import './tokens.css';
import './style.css';
import type { EvaluationReport } from './evaluation-types';
import type { CandidateReport, ReviewLedgerFile } from './evaluation-model';
import { summaryProblem, type BenchData, type RunSummary } from './pages/data';

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

/** Run manifest, run summary and every suite report, each re-validated before a page may read it. */
async function loadBench(): Promise<BenchData & { signature: string }> {
  const sourceHashes = await hashes;
  const json = <T>(url: string) => fetch(url, { cache: 'no-store' }).then(r => (r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<T>) : undefined)).catch(() => undefined);
  const [run, summary, loaded] = await Promise.all([
    json<Run>('/results/run.json'), json<RunSummary>('/results/summary.json'),
    Promise.all(categories.map(async category => {
      const report = await json<Report>(`/results/${category.id}.json`);
      if (!report) return { category, problem: 'Missing or unreadable report' };
      const problem = reportProblem(report, category.id, sourceHashes[category.id], fixtures);
      return problem ? { category, problem } : { category, report };
    })),
  ]);
  const data: BenchData = { run, loaded, hashes: sourceHashes, summary };
  data.summaryProblem = summaryProblem(summary, data) ?? undefined;
  return { ...data, signature: JSON.stringify([run?.runId, summary?.runId, summary?.generatedAt, loaded.map(l => [l.category.id, l.report?.runId, l.report?.generatedAt, l.problem])]) };
}

async function refresh(force = false) {
  const current = route();
  if (current.kind === 'redirect') { history.replaceState(null, '', current.to + location.search + location.hash); lastPayload = ''; return refresh(true); }
  const inventoryView = current.kind === 'coverage' && !current.id;
  if (inventoryView && !force) return;
  const token = ++request, path = location.pathname;
  if (current.kind === 'workbench') {
    if (force) shell('<p role="status" class="small">Loading Workbench evidence…</p>', 'Workbench');
    const [{ workbenchPage }, { reviewPage, bindCopy }, { changesPage }, { qualificationPage }, { methodPage, bindExplorer }, { reviewClasses, evaluationProblem, candidateProblem }, { default: ledger }] = await Promise.all([
      import('./pages/workbench/index'), import('./pages/workbench/review'), import('./pages/workbench/changes'), import('./pages/workbench/qualification'), import('./pages/workbench/method'), import('./evaluation-model'), import('../benchmarks/review-ledger.json'),
    ]);
    const needsEvaluation = current.view !== 'changes';
    const [data, evaluationText, candidateText] = await Promise.all([
      loadBench(),
      needsEvaluation ? fetch('/results/evaluation-v1.json', { cache: 'no-store' }).then(r => (r.ok ? r.text() : '')).catch(() => '') : '',
      fetch('/results/candidate-evidence-v1.json', { cache: 'no-store' }).then(r => (r.ok && r.headers.get('content-type')?.includes('json') ? r.text() : '')).catch(() => ''),
    ]);
    if (token !== request || path !== location.pathname) return;
    const payload = JSON.stringify([location.search, data.signature, evaluationText.length, evaluationText.slice(0, 400), candidateText]);
    if (!force && payload === lastPayload) return;
    lastPayload = payload;
    let evaluation: EvaluationReport | null = null, problem: string | null = needsEvaluation ? 'No evaluation report published' : null;
    if (evaluationText) { try { const parsed = JSON.parse(evaluationText); problem = evaluationProblem(parsed, await hashes); if (!problem) evaluation = parsed; } catch { problem = 'Evaluation report is unreadable'; } }
    let candidate: CandidateReport | undefined, candidateIssue: string | undefined;
    if (candidateText) { try { const parsed = JSON.parse(candidateText); candidateIssue = candidateProblem(parsed) ?? undefined; if (!candidateIssue) candidate = parsed; } catch { candidateIssue = 'Candidate evidence is unreadable'; } }
    const classes = reviewClasses(ledger as unknown as ReviewLedgerFile);
    const changes = { data, baseline, candidate, candidateProblem: candidateIssue, fixtures };
    const labels: Record<string, string> = { overview: 'Workbench', review: 'Review queue', changes: 'Changes', qualification: 'Qualification', method: current.id };
    const body = current.view === 'review' ? reviewPage(classes, current.id, evaluation)
      : current.view === 'changes' ? changesPage(changes, new URLSearchParams(location.search).get('corpus') === 'expanded' ? 'expanded-corpus' : 'fixed-corpus')
      : current.view === 'qualification' ? qualificationPage(data, evaluation)
      : current.view === 'method' ? (evaluation ? methodPage(evaluation, current.id) : workbenchPage({ data, evaluation, evaluationProblem: problem, classes, changes }))
      : workbenchPage({ data, evaluation, evaluationProblem: problem, classes, changes });
    shell(body, labels[current.view] ?? 'Workbench');
    bindCopy(); bindExplorer();
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
