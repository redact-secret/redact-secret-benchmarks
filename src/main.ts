import { categories, registry, fixtures, corpusHashes } from './catalog';
import { parseRoute, reportProblem } from './model.mjs';
import { overview, fixturePage, fixtureList, comparison, stats, title } from './pages/browse';
import { accuracy } from './pages/accuracy';
import { methodology } from './pages/methodology';
import { escape as e, type Report } from './types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const hashes = corpusHashes();
let request = 0, lastPayload = '', downloadUrl = '';
const route = () => parseRoute(location.pathname);
const link = (id: string, label: string, count?: number) => `<a href="/benchmark${id ? '/'+e(id) : ''}" ${(id ? route().kind === 'benchmark' && route().id === id : route().kind === 'overview') ? 'aria-current="page"' : ''}>${e(label)}${count == null ? '' : `<small>${count}</small>`}</a>`;

function shell(content: string, label: string) {
  document.title = `${label} · Secret Benchmarks`;
  const covered = registry.detectors.filter(d => fixtures.some(f => f.detectors.includes(d.id)));
  const uncovered = registry.detectors.filter(d => !covered.includes(d));
  app.innerHTML = `<aside><a class="brand" href="/benchmark"><span class="brand-icon">▥</span>secret<span>benchmarks</span></a><nav aria-label="Benchmarks"><div class="nav-label">WORKSPACE</div>${link('', 'Overview')}<details open><summary>Detectors <small>${covered.length} covered</small></summary><div class="nav-group">${covered.map(d => link(d.id,d.title,fixtures.filter(f => f.detectors.includes(d.id)).length)).join('')}<details ${uncovered.some(d => d.id === route().id) ? 'open' : ''}><summary>Not covered (${uncovered.length})</summary><div class="nav-group">${uncovered.map(d => link(d.id,d.title,0)).join('')}</div></details></div></details><details ${categories.some(c => c.id === route().id) || route().kind === 'fixture' ? 'open' : ''}><summary>Cases & regressions</summary><div class="nav-group">${categories.map(c => link(c.id,c.title)).join('')}</div></details><a href="/methodology" ${route().kind === 'methodology' ? 'aria-current="page"' : ''}>Methodology</a></nav><div class="sidebar-bottom"><span class="dot"></span> Independent benchmarks<p>Shared inputs. Inspectable results.</p><code>npm run bench</code></div></aside><main><header><span><a href="/benchmark">BENCHMARK LAB</a> <b>/</b> ${e(label)}</span><a href="https://github.com/redact-secret/redact-secret-benchmarks">Repository ↗</a></header><div class="content">${content}</div><footer>Independent evaluation · Synthetic fixtures only<span>Refreshes every 5s</span></footer></main>`;
}

function bindFilter(value: string, focused: boolean) {
  const input = document.querySelector<HTMLInputElement>('#filter');
  if (!input) return;
  input.value = value;
  const apply = () => {
    let visible = 0;
    document.querySelectorAll<HTMLElement>('[data-search]').forEach(row => {
      row.hidden = !row.dataset.search!.includes(input.value.toLowerCase());
      if (!row.hidden) visible++;
    });
    const empty = document.querySelector<HTMLElement>('#no-matches');
    if (empty) empty.hidden = visible > 0;
  };
  input.addEventListener('input', apply);
  apply();
  if (focused) input.focus();
}

async function refresh(force = false) {
  const token = ++request, path = location.pathname, current = route();
  if (current.kind === 'methodology') { if (force) shell(methodology(), 'Methodology'); return; }
  const detector = current.kind === 'benchmark' ? registry.detectors.find(d => d.id === current.id) : undefined;
  const category = current.kind === 'benchmark' ? categories.find(c => c.id === current.id) : undefined;
  const fixture = current.kind === 'fixture' ? fixtures.find(f => f.slug === current.id) : undefined;
  if (current.kind !== 'overview' && !detector && !category && !fixture) {
    shell('<h1>Page not found.</h1><a class="text-link" href="/benchmark">Return to benchmark overview →</a>', 'Not found'); return;
  }
  const label = detector?.title ?? category?.title ?? fixture?.id ?? 'Benchmark overview';
  if (force) shell('<p role="status">Loading benchmark results…</p>', label);
  try {
    const sourceHashes = await hashes;
    const relevant = fixture ? categories.filter(c => c.id === fixture.category) : category ? [category] : detector ? categories.filter(c => fixtures.some(f => f.category === c.id && f.detectors.includes(detector.id))) : categories;
    const loaded = await Promise.all(relevant.map(async c => {
      try {
        const response = await fetch(`/results/${c.id}.json`, {cache:'no-store'});
        if (!response.ok) throw new Error('missing');
        const report: Report = await response.json();
        const problem = reportProblem(report,c.id,sourceHashes[c.id],fixtures);
        return { category:c, report: problem ? undefined : report, problem };
      } catch { return {category:c, report:undefined, problem:'Missing or unreadable report'}; }
    }));
    if (token !== request || path !== location.pathname) return;
    const payload = JSON.stringify(loaded);
    if (!force && payload === lastPayload) return;
    lastPayload = payload;
    const reports = loaded.flatMap(item => item.report ? [item.report] : []);
    const problems = loaded.filter(item => item.problem);
    const notice = problems.length ? `<div class="notice"><div><strong>${problems.length} case report(s) excluded</strong><p>${problems.map(item => `${e(item.category.title)}: ${e(item.problem)}`).join('<br>')}</p><p>Run <code>npm run bench</code> to refresh measurements. Fixture inputs remain available.</p></div></div>` : '';
    let body = '';
    if (fixture) body = fixturePage(fixture,reports);
    else if (detector) {
      const selected = fixtures.filter(f => f.detectors.includes(detector.id));
      body = title(detector.title, `Fixtures targeting ${detector.id}, across all case suites.`, 'BENCHMARK / DETECTOR') + stats(selected) + (selected.length ? comparison(selected,reports) : '<div class="notice">This detector is registered upstream but has no assigned fixtures yet. No coverage claim is made.</div>') + fixtureList(selected,reports);
    } else if (category) {
      const report = reports[0];
      body = title(category.title, category.description, 'BENCHMARK / CASE') + (report ? `<p class="run-line">Measured ${e(new Date(report.generatedAt).toLocaleString())} · <a class="text-link" href="/results/${e(category.id)}.json" download>Export JSON ↗</a></p>${accuracy(report)}<details class="panel provenance"><summary>Run provenance</summary><dl><dt>Corpus SHA-256</dt><dd>${e(report.corpusHash)}</dd><dt>Lockfile SHA-256</dt><dd>${e(report.lockHash)}</dd><dt>Revision</dt><dd>${e(report.revision)}${report.dirty ? ' (modified)' : ''}</dd><dt>Environment</dt><dd>${e(report.runtime.node)} / ${e(report.runtime.platform)} / ${e(report.runtime.arch)}</dd><dt>Matching rule</dt><dd>${e(report.matching)}</dd></dl></details>` : stats(fixtures.filter(f => f.category === category.id)) + fixtureList(fixtures.filter(f => f.category === category.id),reports));
      if (report && !report.scanners.some(s => s.status === 'complete')) body += fixtureList(fixtures.filter(f => f.category === category.id), reports);
    } else body = overview(reports);
    const filter = document.querySelector<HTMLInputElement>('#filter');
    const value = filter?.value ?? '', focused = document.activeElement === filter;
    // Keep user-opened navigation and content disclosures stable across polling updates.
    const openDetails = [...document.querySelectorAll('details')].map(d => d.open);
    shell(notice + body,label);
    if (!force) document.querySelectorAll('details').forEach((d,i) => { if (openDetails[i] != null) d.open = openDetails[i]; });
    bindFilter(value,focused);
    if (downloadUrl) { URL.revokeObjectURL(downloadUrl); downloadUrl = ''; }
    const download = document.querySelector<HTMLAnchorElement>('#download-fixture');
    if (download && fixture) {
      downloadUrl = URL.createObjectURL(new Blob([new TextEncoder().encode(fixture.content)], {type:'application/octet-stream'}));
      download.href = downloadUrl;
      download.download = fixture.path.split('/').pop()!;
    }
  } catch {
    if (token === request) shell('<h1>Unable to load benchmark catalog.</h1><p>Reload this page and check the development server.</p>',label);
  }
}

function navigate(path: string) {
  history.pushState(null,'',path);
  lastPayload = '';
  void refresh(true);
  window.scrollTo(0,0);
}
document.addEventListener('click', event => {
  const anchor = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
  if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || anchor.hasAttribute('download') || anchor.target) return;
  const url = new URL(anchor.href);
  if (url.origin !== location.origin || !/^\/(benchmark|fixture|methodology)(\/|$)/.test(url.pathname)) return;
  event.preventDefault(); navigate(url.pathname);
});
window.addEventListener('popstate', () => { lastPayload = ''; void refresh(true); });
// Preserve bookmarks from the original hash navigation.
if (location.hash.startsWith('#/')) {
  const old = location.hash.slice(2);
  history.replaceState(null,'',old === 'methodology' ? '/methodology' : `/benchmark/${old}`);
} else if (location.pathname === '/') history.replaceState(null,'','/benchmark');
void refresh(true);
setInterval(() => { void refresh(); },5000);
