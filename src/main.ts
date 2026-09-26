import { categories, registry, fixtures, corpusHashes, baseline } from './catalog';
import { parseRoute, isAppPath, reportProblem } from './model.mjs';
import { mountShell, renderPage, setBuildLine, type NavItem, type SearchTarget } from './shell';
import { siteEnvOf, commitOf, envBanner, buildLine, type Provenance } from './provenance';
import { summaryProblem, PRODUCT, type BenchData, type RunSummary } from './pages/data';
import { reportPage, levelOf } from './pages/report';
import { coveragePage, coverageViewOf, detectorPage, bindInventory } from './pages/coverage';
import { suitePage } from './pages/suite';
import { fixturePage } from './pages/fixture';
import { howToRead } from './pages/how-to-read';
import { bindRows } from './pages/rows';
import { actionEmptyState } from './components';
import type { Report, Run } from './types';
import type { EvaluationReport } from './evaluation-types';
import type { CandidateReport, ReviewLedgerFile } from './evaluation-model';
import type { SupportMatrixFile } from './support-model';
import './tokens.css';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const hashes = corpusHashes();
let request = 0, lastPayload = '', downloadUrl = '';
/** Allowlist flag for a future customer-only build: set VITE_PUBLIC_ROUTES_ONLY=1 and Workbench paths stop resolving. */
const PUBLIC_ONLY = import.meta.env.VITE_PUBLIC_ROUTES_ONLY === '1';
/** Build-time environment and commit (#155); an unset VITE_SITE_ENV is a local build, never production. */
const SITE: Provenance = { env: siteEnvOf(import.meta.env.VITE_SITE_ENV), commit: commitOf(import.meta.env.VITE_BUILD_COMMIT) };
const suiteIds = categories.map(c => c.id);
const route = () => parseRoute(location.pathname, { suites: suiteIds, publicOnly: PUBLIC_ONLY });
// <details> state survives the 5-second polling re-render.
const openKeys = new Set<string>();

/** One search for what the sidebar's per-detector links used to do: detectors, suites and fixture slugs. */
const targets = (): SearchTarget[] => [
  ...registry.detectors.map(d => ({ href: `/coverage/${d.id}`, label: d.title, hint: `detector · ${fixtures.filter(f => f.detectors.includes(d.id)).length} fixtures` })),
  ...categories.map(c => ({ href: `/suites/${c.id}`, label: c.title, hint: 'case suite' })),
  ...fixtures.map(f => ({ href: `/fixture/${f.slug}`, label: f.slug, hint: 'fixture' })),
];
const under = (...roots: string[]) => (path: string) => roots.some(root => path === root || path.startsWith(root + '/'));
const NAV: NavItem[] = [
  { href: '/report', label: 'Report', short: 'Report', current: under('/report') },
  { href: '/coverage', label: 'Coverage', short: 'Coverage', current: under('/coverage', '/suites', '/fixture') },
  { href: '/support', label: 'Support', short: 'Support', current: under('/support') },
  { href: '/performance', label: 'Performance', short: 'Perf', current: under('/performance') },
  { href: '/workbench', label: 'Workbench', short: 'Workbench', current: under('/workbench') },
  { href: '/how-to-read', label: 'How to read', short: 'Read', current: under('/how-to-read') },
].filter(item => !PUBLIC_ONLY || item.href !== '/workbench');

function restoreDetails() {
  document.querySelectorAll<HTMLDetailsElement>('details[data-key]').forEach(d => {
    d.open = openKeys.has(d.dataset.key!);
    d.addEventListener('toggle', () => { if (d.open) openKeys.add(d.dataset.key!); else openKeys.delete(d.dataset.key!); });
  });
}

/** Run manifest, run summary and every suite report, each re-validated before a page may read it. */
async function loadBench(): Promise<BenchData & { signature: string }> {
  const sourceHashes = await hashes;
  // no-cache revalidates: an unchanged report costs a 304, not a download, on every 5-second poll.
  const json = <T>(url: string) => fetch(url, { cache: 'no-cache' }).then(r => (r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<T>) : undefined)).catch(() => undefined);
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

/** The evaluation report runs to megabytes, too large for some HTTP caches, so a poll asks for its validator and re-reads the body only when that changes. */
const bodies = new Map<string, { tag: string; body: string }>();
async function text(url: string): Promise<string> {
  try {
    const isJson = (r: Response) => r.ok && !!r.headers.get('content-type')?.includes('json');
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    if (!isJson(head)) { bodies.delete(url); return ''; }
    const tag = head.headers.get('etag') ?? head.headers.get('last-modified') ?? '', held = bodies.get(url);
    if (tag && held?.tag === tag) return held.body;
    const response = await fetch(url, { cache: 'no-cache' }), body = isJson(response) ? await response.text() : '';
    if (tag && body) bodies.set(url, { tag, body });
    return body;
  } catch { return ''; }
}

async function renderWorkbench(current: ReturnType<typeof route>, token: number, path: string, force: boolean) {
  if (force) renderPage('<p role="status" class="small">Loading Workbench evidence…</p>', 'Workbench');
  const [{ workbenchPage }, { reviewPage, bindCopy }, { changesPage }, { qualificationPage }, { methodPage, bindExplorer }, { reviewClasses, evaluationProblem, candidateProblem, reviewLedgerPublicationProblem }, { default: sourceLedger }] = await Promise.all([
    import('./pages/workbench/index'), import('./pages/workbench/review'), import('./pages/workbench/changes'), import('./pages/workbench/qualification'), import('./pages/workbench/method'), import('./evaluation-model'), import('../benchmarks/review-ledger.json'),
  ]);
  const needsEvaluation = current.view !== 'changes';
  const [data, evaluationText, reviewLedgerText, candidateText] = await Promise.all([loadBench(), needsEvaluation ? text('/results/evaluation-v1.json') : '', needsEvaluation ? text('/results/review-ledger-v2.json') : '', text('/results/candidate-evidence-v1.json')]);
  if (token !== request || path !== location.pathname) return;
  const payload = JSON.stringify([path, location.search, data.signature, evaluationText.length, evaluationText.slice(0, 400), reviewLedgerText.length, reviewLedgerText.slice(0, 200), candidateText]);
  if (!force && payload === lastPayload) return;
  lastPayload = payload;
  let evaluation: EvaluationReport | null = null, problem: string | null = needsEvaluation ? 'No evaluation report published' : null;
  if (evaluationText) { try { const parsed = JSON.parse(evaluationText); problem = evaluationProblem(parsed, await hashes); if (!problem) evaluation = parsed; } catch { problem = 'Evaluation report is unreadable'; } }
  let ledger = sourceLedger as unknown as ReviewLedgerFile, ledgerProblem: string | null = evaluation ? 'No published review provenance' : (problem ?? 'No validated evaluation report');
  if (evaluation && reviewLedgerText) { try { const parsed = JSON.parse(reviewLedgerText) as ReviewLedgerFile; ledgerProblem = reviewLedgerPublicationProblem(parsed, ledger, evaluation); if (!ledgerProblem) ledger = parsed; } catch { ledgerProblem = 'Published review provenance is unreadable'; } }
  let candidate: CandidateReport | undefined, candidateIssue: string | undefined;
  if (candidateText) { try { const parsed = JSON.parse(candidateText); candidateIssue = candidateProblem(parsed) ?? undefined; if (!candidateIssue) candidate = parsed; } catch { candidateIssue = 'Candidate evidence is unreadable'; } }
  const classes = reviewClasses(ledger);
  const changes = { data, baseline, candidate, candidateProblem: candidateIssue, site: SITE.env, fixtures };
  const home = () => workbenchPage({ data, evaluation, evaluationProblem: problem, reviewLedgerProblem: ledgerProblem, classes, changes });
  const labels: Record<string, string> = { overview: 'Workbench', review: 'Review queue', changes: 'Changes', qualification: 'Qualification', method: current.id };
  const body = current.view === 'review' ? reviewPage(classes, current.id, evaluation, ledgerProblem)
    : current.view === 'changes' ? changesPage(changes, new URLSearchParams(location.search).get('corpus') === 'expanded' ? 'expanded-corpus' : 'fixed-corpus')
    : current.view === 'qualification' ? qualificationPage(data, evaluation)
    : current.view === 'method' && evaluation ? methodPage(evaluation, current.id)
    : home();
  renderPage(body, labels[current.view] ?? 'Workbench');
  bindCopy(); bindExplorer(); restoreDetails();
}

/** The support matrix is a generated artifact like the evaluation report: read, re-validated, then rendered. No status is held in the app. */
async function renderSupport(token: number, path: string, force: boolean) {
  if (force) renderPage('<p role="status" class="small">Loading support matrix…</p>', 'Support');
  const [{ supportPage, supportFilterOf }, { supportMatrixProblem }] = await Promise.all([import('./pages/support'), import('./support-model')]);
  const body = await text('/results/support-matrix-v1.json');
  if (token !== request || path !== location.pathname) return;
  const payload = JSON.stringify([path, location.search, body]);
  if (!force && payload === lastPayload) return;
  lastPayload = payload;
  let matrix: SupportMatrixFile | null = null, problem: string | null = 'No support matrix published';
  if (body) { try { const parsed = JSON.parse(body); problem = supportMatrixProblem(parsed); if (!problem) matrix = parsed; } catch { problem = 'Support matrix is unreadable'; } }
  renderPage(supportPage(matrix, problem, supportFilterOf(location.search)), 'Support');
  restoreDetails();
}

async function refresh(force = false): Promise<void> {
  const current = route();
  if (current.kind === 'redirect') { history.replaceState(null, '', current.to + location.search + location.hash); lastPayload = ''; return refresh(true); }
  const token = ++request, path = location.pathname;
  if (current.kind === 'missing') { if (force) renderPage(`<div class="page-head"><div><h1>Page not found</h1></div></div>${actionEmptyState({ title: 'No page lives at this path', body: 'Search for a detector, a suite or a fixture, or <a href="/report">open the report</a>.' })}`, 'Not found'); return; }
  if (current.kind === 'how-to-read') { if (force) renderPage(howToRead(), 'How to read'); return; }
  if (current.kind === 'performance') { if (force) { const { performancePage } = await import('./pages/performance'); renderPage(performancePage(), 'Performance'); } return; }
  if (current.kind === 'workbench') return renderWorkbench(current, token, path, force);
  if (current.kind === 'support') return renderSupport(token, path, force);

  const fixture = current.kind === 'fixture' ? fixtures.find(f => f.slug === current.id) : undefined;
  const label = current.kind === 'report' ? 'Report' : current.kind === 'coverage' ? (registry.detectors.find(d => d.id === current.id)?.title ?? 'Coverage') : current.kind === 'suite' ? (categories.find(c => c.id === current.id)?.title ?? 'Suite') : (fixture?.id ?? 'Fixture');
  if (force) renderPage('<p role="status" class="small">Loading benchmark results…</p>', label);
  try {
    const data = await loadBench();
    if (token !== request || path !== location.pathname) return;
    const payload = JSON.stringify([path, location.search, data.signature]);
    if (!force && payload === lastPayload) return;
    lastPayload = payload;
    let body: string;
    if (current.kind === 'report') body = reportPage(data, levelOf(location.search), fixtures);
    else if (current.kind === 'coverage') body = current.id ? detectorPage(data, fixtures, current.id) : coveragePage(fixtures, coverageViewOf(location.search), data);
    else if (current.kind === 'suite') body = suitePage(data, fixtures, current.id);
    else if (fixture) { const loaded = data.loaded.find(l => l.category.id === fixture.category); body = fixturePage(fixture, loaded?.report, loaded?.problem); }
    else body = `<div class="page-head"><div><h1>No such fixture</h1></div></div>${actionEmptyState({ title: 'No fixture has this slug', body: 'A slug is <code>suite--fixture-id</code>. Search for it, or <a href="/coverage">open the coverage list</a>.' })}`;
    renderPage(body, label);
    restoreDetails(); bindRows(); bindInventory();
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
    const download = document.querySelector<HTMLAnchorElement>('#download-fixture');
    if (download && fixture) {
      // The exact bytes, not a re-encoding: BOM, CRLF and trailing whitespace survive.
      downloadUrl = URL.createObjectURL(new Blob([new TextEncoder().encode(fixture.content)], { type: 'application/octet-stream' }));
      download.href = downloadUrl;
      download.download = fixture.path.split('/').pop()!;
    }
  } catch {
    if (token === request) renderPage(`<div class="page-head"><div><h1>${label}</h1></div></div>${actionEmptyState({ title: 'The benchmark catalog did not load', body: 'Check that the development server is running, then reload.', command: 'npm run dev' })}`, label);
  }
}

function navigate(path: string) {
  history.pushState(null, '', path);
  lastPayload = '';
  void refresh(true).then(() => {
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    // Move focus with the view so keyboard and screen-reader users land on the new page, not the old link.
    document.querySelector<HTMLElement>('#main')?.focus({ preventScroll: true });
  });
}
document.addEventListener('click', event => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') || anchor.target) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || !isAppPath(url.pathname)) return;
  // A same-page anchor (a Figure pointing at its rows) is the browser's to handle.
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  event.preventDefault(); navigate(url.pathname + url.search + url.hash);
});
mountShell(app, { nav: NAV, targets, navigate, banner: envBanner(SITE.env), build: buildLine(SITE) });
/** Completes the footer from what was published: the version run.json measured (released, or on staging the candidate it names) and, off production, the candidate commit. */
async function loadProvenance() {
  const json = (url: string) => fetch(url, { cache: 'no-cache' }).then(r => (r.ok && r.headers.get('content-type')?.includes('json') ? (r.json() as Promise<unknown>) : undefined)).catch(() => undefined);
  const run = (await json('/results/run.json')) as Run | undefined;
  let candidateCommit: string | null = null;
  let candidateVersion: string | null = null;
  const semver = (value: unknown) => (typeof value === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value) ? value : null);
  // #201: a staging run that measured the candidate states that, and never calls its version released.
  const measured = SITE.env !== 'production' ? run?.candidate : undefined;
  if (measured) {
    setBuildLine(buildLine({ ...SITE, productVersion: null, candidateCommit: commitOf(measured.sourceCommit), candidateVersion: semver(measured.declaredVersion), measuredCandidate: true }));
    return;
  }
  if (SITE.env !== 'production') {
    const candidate = await json('/results/candidate-evidence-v1.json');
    // Checked with the Workbench's own contract validator, loaded only when a candidate file is published.
    if (candidate) { const { candidateProblem } = await import('./evaluation-model'); if (!candidateProblem(candidate)) { const { sourceCommit, declaredVersion } = (candidate as CandidateReport).candidate; candidateCommit = commitOf(sourceCommit); candidateVersion = semver(declaredVersion); } }
  }
  setBuildLine(buildLine({ ...SITE, productVersion: run?.scannerVersions?.[PRODUCT] ?? null, candidateCommit, candidateVersion }));
}
void loadProvenance();
window.addEventListener('popstate', () => { lastPayload = ''; void refresh(true); });
// Preserve bookmarks from the original hash navigation; parseRoute forwards the old path from there.
if (/^#\/[a-z0-9-]+$/.test(location.hash)) {
  const old = location.hash.slice(2);
  history.replaceState(null, '', old === 'methodology' ? '/methodology' : `/benchmark/${old}`);
}
void refresh(true);
setInterval(() => { void refresh(); }, 5000);
