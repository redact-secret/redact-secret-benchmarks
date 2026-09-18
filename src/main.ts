import { categories, registry, fixtures, corpusHashes } from './catalog';
import { parseRoute, reportProblem } from './model.mjs';
import { overview, fixturePage, fixtureList, comparison, stats, title, readingNote, runLine } from './pages/browse';
import { accuracy } from './pages/accuracy';
import { methodology } from './pages/methodology';
import { escape as e, type Report, type Run } from './types';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app')!;
const hashes = corpusHashes();
let request = 0, lastPayload = '', downloadUrl = '';
const route = () => parseRoute(location.pathname);
// Per-route UI state survives the 5-second polling re-render.
const listState = new Map<string, { filter: string; showAll: boolean; page: number }>();
const openKeys = new Set<string>();
const splitState = new Map<string, boolean>();
const expanded = new Set<string>();
const RECENT = 'secret-benchmarks:recent';

type Target = { href: string; label: string; hint: string };
const targets = (): Target[] => [
  { href: '/benchmark', label: 'Overview', hint: 'workspace' },
  { href: '/coverage-gaps', label: 'Coverage gaps', hint: 'workspace' },
  { href: '/pending', label: 'Pending review', hint: `${fixtures.filter(f => f.assessment.tier === 'T0').length} unscored` },
  { href: '/methodology', label: 'Methodology', hint: 'protocol v4' },
  ...registry.detectors.map(d => ({ href: `/benchmark/${d.id}`, label: d.title, hint: `detector · ${fixtures.filter(f => f.detectors.includes(d.id)).length} fixtures` })),
  ...categories.map(c => ({ href: `/benchmark/${c.id}`, label: c.title, hint: 'case suite' })),
];
const recent = (): string[] => { try { return JSON.parse(localStorage.getItem(RECENT) ?? '[]'); } catch { return []; } };
const remember = (href: string) => { try { localStorage.setItem(RECENT, JSON.stringify([href, ...recent().filter(h => h !== href)].slice(0, 6))); } catch {} };
const navLink = (t: Target) => `<a href="${e(t.href)}" role="option" ${location.pathname.replace(/\/+$/, '') === t.href ? 'aria-current="page" aria-selected="true"' : 'aria-selected="false"'}>${e(t.label)}<small>${e(t.hint)}</small></a>`;

function shell(content: string, label: string) {
  document.title = `${label} · Secret Benchmarks`;
  const all = targets();
  const recents = recent().map(h => all.find(t => t.href === h)).filter((t): t is Target => Boolean(t));
  app.innerHTML = `<aside><a class="brand" href="/benchmark"><span class="brand-icon">▥</span>secret<span>benchmarks</span></a><nav aria-label="Benchmarks"><div class="nav-label">WORKSPACE</div>${all.slice(0, 4).map(navLink).join('')}<div class="nav-label">FIND A DETECTOR OR SUITE</div><div class="combobox"><input id="nav-query" type="search" role="combobox" aria-expanded="true" aria-controls="nav-options" aria-autocomplete="list" placeholder="Type to filter ${registry.detectors.length} detectors, ${categories.length} suites…" autocomplete="off"><div id="nav-options" role="listbox" aria-label="Detectors and suites">${all.slice(4).map(navLink).join('')}</div></div>${recents.length ? `<div class="nav-label">RECENTLY VIEWED</div><div class="nav-group">${recents.map(navLink).join('')}</div>` : ''}</nav><div class="sidebar-bottom"><span class="dot"></span> Project-maintained benchmarks<p>Shared inputs. Inspectable results.</p><code>npm run bench</code></div></aside><main><header><span><a href="/benchmark">BENCHMARK LAB</a> <b>/</b> ${e(label)}</span><a href="https://github.com/redact-secret/redact-secret-benchmarks">Repository ↗</a></header><p class="banner">Corpus-relative measurements per kind × tier on one run id. Not accuracy, not a ranking. <a class="text-link" href="/methodology">How to read this →</a></p><div class="content">${content}</div><footer>Project-maintained evaluation · Synthetic fixtures only<span>Refreshes every 5s</span></footer></main>`;
  bindNav();
}

function bindNav() {
  const input = document.querySelector<HTMLInputElement>('#nav-query');
  const list = document.querySelector<HTMLElement>('#nav-options');
  if (!input || !list) return;
  const apply = () => {
    const q = input.value.trim().toLowerCase();
    let shown = 0;
    list.querySelectorAll<HTMLAnchorElement>('a').forEach(a => { a.hidden = Boolean(q) && !a.textContent!.toLowerCase().includes(q); if (!a.hidden) shown++; });
    input.setAttribute('aria-expanded', String(shown > 0));
  };
  input.addEventListener('input', apply);
  input.addEventListener('keydown', ev => { if (ev.key === 'Enter') { const first = Array.from(list.querySelectorAll<HTMLAnchorElement>('a')).find(a => !a.hidden); if (first) { ev.preventDefault(); navigate(new URL(first.href).pathname); } } });
}

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
  if (current.kind === 'coverage-gaps' && !force) return;
  const token = ++request, path = location.pathname;
  if (current.kind === 'coverage-gaps') {
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
  if (current.kind === 'methodology') { if (force) shell(methodology(), 'Methodology'); return; }
  const detector = current.kind === 'benchmark' ? registry.detectors.find(d => d.id === current.id) : undefined;
  const category = current.kind === 'benchmark' ? categories.find(c => c.id === current.id) : undefined;
  const fixture = current.kind === 'fixture' ? fixtures.find(f => f.slug === current.id) : undefined;
  const pending = current.kind === 'pending';
  if (current.kind !== 'overview' && !pending && !detector && !category && !fixture) {
    shell('<h1>Page not found.</h1><a class="text-link" href="/benchmark">Return to benchmark overview →</a>', 'Not found'); return;
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
      body = title(detector.title, `Fixtures targeting ${detector.id}, across all case suites.`, 'BENCHMARK / DETECTOR') + runLine(run, reports) + stats(selected) + readingNote('Detector views overlap; do not sum them.') + (selected.length ? comparison(selected, reports, run) : '<div class="notice">This detector is registered upstream but has no assigned fixtures yet. No coverage claim is made.</div>') + fixtureList(selected, reports, run);
    } else if (pending) {
      const selected = fixtures.filter(f => f.assessment.tier === 'T0');
      body = title('Pending review', 'T0 fixtures: observations are inspectable but excluded from every comparative number until evidence exists.', 'BENCHMARK / PENDING') + fixtureList(selected, reports, run);
    } else if (category) {
      const report = reports[0];
      body = title(category.title, category.description, 'BENCHMARK / CASE') + (report ? `<p class="run-line">Run <span class="mono">${e(report.runId)}</span> · measured ${e(new Date(report.generatedAt).toLocaleString())} · <a class="text-link" href="/results/${e(category.id)}.json" download>Export JSON ↗</a></p>${accuracy(report, run)}<details class="panel provenance" data-key="provenance"><summary>Run provenance</summary><dl><dt>Corpus SHA-256</dt><dd>${e(report.corpusHash)}</dd><dt>Lockfile SHA-256</dt><dd>${e(report.lockHash)}</dd><dt>Revision</dt><dd>${e(report.revision)}${report.dirty ? ' (modified)' : ''}</dd><dt>Environment</dt><dd>${e(report.runtime.node)} / ${e(report.runtime.platform)} / ${e(report.runtime.arch)}</dd><dt>Matching rule</dt><dd>${e(report.matching)}</dd></dl></details>` : stats(fixtures.filter(f => f.category === category.id)) + fixtureList(fixtures.filter(f => f.category === category.id), reports, run));
    } else body = overview(reports, run);
    shell(notice + body, label);
    remember(location.pathname.replace(/\/+$/, ''));
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
  if (url.origin !== location.origin || !/^\/(benchmark|fixture|methodology|coverage-gaps|pending)(\/|$)/.test(url.pathname)) return;
  event.preventDefault(); navigate(url.pathname);
});
window.addEventListener('popstate', () => { lastPayload = ''; void refresh(true); });
// Preserve bookmarks from the original hash navigation.
if (location.hash.startsWith('#/')) {
  const old = location.hash.slice(2);
  history.replaceState(null, '', old === 'methodology' ? '/methodology' : `/benchmark/${old}`);
} else if (location.pathname === '/') history.replaceState(null, '', '/benchmark');
void refresh(true);
setInterval(() => { void refresh(); }, 5000);
