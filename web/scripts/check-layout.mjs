/**
 * Browser layout check (#554), run by `npm run check:layout` after
 * `npm run build && npm run build-storybook`. It loads every Storybook story and
 * every exported page at 320, 375 and 768 CSS pixels and fails on:
 *
 *  - page overflow: the document is wider than the viewport. A wide table must
 *    scroll inside its own region; the page never scrolls sideways;
 *  - mid-word breaks: an ordinary word (up to MAX_WORD characters) whose letters
 *    land on two lines. Squeezed table cells are the usual cause. Longer tokens
 *    (a hash, a path) may break, because nothing else could hold them.
 *
 * The states of a page that fetches its data (#543 fetch decision) are checked too, each at the
 * three widths, by holding or failing the request for the build-emitted file:
 *
 *  - loading: the request is held; the page must already show its frame and be free of overflow,
 *    and once the request is released the table region must not have moved (no layout shift);
 *  - loaded: the same page after the file arrives;
 *  - error: the request fails; the retry note and the rows already drawn must fit.
 *
 * On the exported pages it also checks the header: both canonical logo images
 * load, the visible one has the size the `--logo-w` token gives, and the header
 * carries no inline drawing of the mark.
 *
 * Chromium comes from Playwright; set PW_CHANNEL=chrome to use an installed
 * Google Chrome instead of a downloaded browser. CI runs
 * `npx playwright install --with-deps chromium` first.
 */
import http from 'node:http';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { checkTarget, pickWorkers } from './layout-check-lib.mjs';
import { readAuthority, stampOf } from './lib/authority.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// LAYOUT_SELECT (#656): a JSON `{ routes: [address prefix], stories: [story file] }` from scripts/ci-plan.mjs restricts the run to the pages and stories a
// change can reach; `{ all: true }`, an empty value or an unreadable one is every story and page. The routes below are still built from the whole export.
const select = (() => { try { const v = JSON.parse(process.env.LAYOUT_SELECT || 'null'); return v && !v.all && Array.isArray(v.routes) && Array.isArray(v.stories) ? v : null; } catch { return null; } })();
// `a/b` is that page; `a/b/*` is the pages below it (a dynamic segment).
const routeSelected = route => !select || select.routes.some(entry => { const r = route.split('?')[0].replace(/^\/+|\/+$/g, ''); return entry.endsWith('*') ? r.startsWith(entry.slice(0, -1)) : r === entry; });
const basePath = process.env.BASE_PATH ?? '';
const STORYBOOK = '/__storybook__';
const WIDTHS = [320, 375, 768];
const MAX_WORD = 24;
const ROUTES = ['report', 'report/?level=T2', 'report/?level=T3&peers=1', 'report/providers', 'report/providers/?q=github&show=signal', 'report/families', 'report/families/?show=empty', 'comparison', 'comparison/feature', 'comparison/runtime', 'comparison/runtime/?view=speed', 'comparison/runtime/?view=accuracy', 'comparison/runtime/?analysis=internal&domain=pii', 'comparison/runtime/?analysis=external&domain=credentials',
  // #562/#563: outcome rows, the legend and shares in every measured panel, at each view that changes what is drawn.
  'comparison/runtime/?analysis=internal&domain=pii&view=accuracy', 'comparison/runtime/?analysis=internal&domain=credentials', 'comparison/runtime/?analysis=external&domain=credentials&view=accuracy', 'comparison/runtime/?analysis=external&domain=pii&view=speed',
  // #612: the scanner roster and one environment profile per scanner.
  'evaluation/scanner'];
// The real family pages (#556): the family with the most fixtures (paged rows), one with a few, and one with none.
const repoRoot = path.resolve(webRoot, '..');
const taxonomy = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/support/taxonomy.json'), 'utf8'));
// Which pages hold data depends on the pipeline the export was built from (#608): the fixtures of the legacy corpora under `legacy`, the cases of the
// qualification view under `new` (none without a view). The routes below are read from the same source the export was built from.
// The routes must follow the export being served, not the committed value: CI builds the legacy export for the browser checks while the committed
// value is `new`. The stamp on /report/ names the pipeline the export was built from; the committed value is the fallback when there is no export yet.
const builtFrom = stampOf(await readFile(path.join(webRoot, 'out/report/index.html'), 'utf8').catch(() => ''));
const authority = builtFrom?.pipeline ?? await readAuthority(repoRoot);
let view;
if (authority === 'new') { try { view = JSON.parse(await readFile(path.join(repoRoot, 'public/results/qualification-v1.json'), 'utf8')); } catch { /* no view */ } }
const viewCases = view?.populations.find(p => p.role === 'floors-and-gates')?.cases ?? [];
const slugsOfIndex = authority === 'new' ? viewCases.map(c => ({ slug: c.id, familyIds: c.family && taxonomy.families.some(f => f.id === c.family) ? [c.family] : [] })) : JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/fixture-index.json'), 'utf8')).fixtures;
const index = { fixtures: slugsOfIndex };
const perFamily = new Map();
for (const f of index.fixtures) for (const id of f.familyIds) perFamily.set(id, (perFamily.get(id) ?? 0) + 1);
const slugOf = id => id.replace(':', '--');
const largest = [...perFamily.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const small = [...perFamily.entries()].find(([, n]) => n > 0 && n <= 10)?.[0];
const none = taxonomy.families.find(f => !perFamily.has(f.id))?.id;
for (const id of [largest, small, none]) if (id) ROUTES.push(`report/families/${slugOf(id)}`);
if (largest) ROUTES.push(`report/families/${slugOf(largest)}/?page=2`);
// #589: a family with a long dossier (notes, open questions, look-alikes, six sources, seven research issues), and one with several peer rules.
if (authority === 'legacy') ROUTES.push('report/families/github--fine-grained-personal-access-token');
// The rows, suite, fixture, detector and findings pages (#559), and the level and scanner controls (#560).
ROUTES.push('report/rows/T1', 'report/rows/T2/?show=leaked&scanners=product', 'report/rows/T3/?show=flagged', 'report/fixtures', 'report/detectors', 'report/detectors/?show=signal', 'report/findings', 'report/families/?level=T2', 'report/providers/?level=T3');
if (largest) ROUTES.push(`report/families/${slugOf(largest)}/?scanners=all&level=T1`);
const detectors = authority === 'new' ? [...new Set(viewCases.flatMap(c => c.detectors))].sort().map(id => ({ id })) : JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/detectors.json'), 'utf8')).detectors;
if (!detectors.length) detectors.push(...JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/detectors.json'), 'utf8')).detectors.slice(0, 1));
ROUTES.push(`report/detectors/${detectors[0].id}`, `report/detectors/${detectors.at(-1).id}`);
const suites = authority === 'new' ? (viewCases.length ? [...new Set(viewCases.map(c => c.id.split('--')[0]))].sort().map(id => ({ id })) : [{ id: 'no-view' }]) : JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/categories.json'), 'utf8')).filter(c => !c.calibrationOnly);
// A fixture page: the first fixture of a small suite, and the largest single fixture of the corpus (a 72 KB line-heavy input).
const firstOf = new Map();
for (const f of index.fixtures) { const [category, ...rest] = f.slug.split('--'); if (!firstOf.has(category)) firstOf.set(category, rest.join('--')); }
let smallSuite = suites.find(c => c.id === 'common-formats') ?? suites[0];
if (authority === 'new') {
  // The fixture-loading skeleton cannot know a family's breadcrumb, so the state checks use a fixture no family owns (the same crumbs as the skeleton);
  // a fixture with a long family and provider name is still laid out by the page checks.
  const unowned = viewCases.find(c => !index.fixtures.find(f => f.slug === c.id)?.familyIds.length);
  if (unowned) { smallSuite = { id: unowned.id.split('--')[0] }; firstOf.set(smallSuite.id, unowned.id.split('--').slice(1).join('--')); }
}
ROUTES.push(`report/fixtures/${smallSuite.id}`, ...(firstOf.get(smallSuite.id) ? [`report/fixtures/${smallSuite.id}/?fixture=${firstOf.get(smallSuite.id)}`] : []));
if (authority === 'new') {
  // A fixture of the view with a near-twin: the page that names its twin without the bytes.
  const twin = viewCases.find(c => c.twinOf);
  if (twin) ROUTES.push(`report/fixtures/${twin.id.split('--')[0]}/?fixture=${twin.id.split('--').slice(1).join('--')}`);
} else ROUTES.push('report/fixtures/context-edges');
if (authority === 'legacy') try {
  const corpus = JSON.parse(await readFile(path.join(repoRoot, 'fixtures/generated/context-edges.json'), 'utf8'));
  const big = corpus.fixtures.reduce((a, b) => (b.content.length > a.content.length ? b : a));
  ROUTES.push(`report/fixtures/context-edges/?fixture=${big.id}`);
  // The fixture page of #588: a fixture with two twins and a family crumb, one with hidden characters, and the quiet twin.
  ROUTES.push('report/fixtures/beta8-211/?fixture=github-fine-grained-pat-terraform-provider', 'report/fixtures/context-edges/?fixture=bom', 'report/fixtures/beta8-211/?fixture=github-fine-grained-pat-terraform-provider-alphabet-twin');
} catch { /* the generated corpus is materialised by npm ci */ }
// The performance pair page (#569): the default pair, the other library, and the setting that changes what redact-secret did.
ROUTES.push('comparison/performance', 'comparison/performance/?with=openredaction&setting=default', 'comparison/performance/?with=openredaction&setting=pii-global');
// States of the pages that fetch build-emitted data (rows tables, fixture pages), by how the request to /data/ is treated.
const firstFixture = firstOf.get(smallSuite.id);
const STATES = [
  { name: 'rows loading', route: 'report/rows/T1/?show=leaked&page=2', gate: true, wait: '[aria-busy="true"]', loaded: () => !document.querySelector('[aria-busy="true"]'), anchor: 'main [role="region"]' },
  { name: 'rows error', route: 'report/rows/T1/?show=leaked', abort: true, wait: 'main div[role="alert"]' },
  ...(largest ? [{ name: 'family rows loading', route: `report/families/${slugOf(largest)}/?scanners=all`, gate: true, wait: '[aria-busy="true"]', loaded: () => !document.querySelector('[aria-busy="true"]'), anchor: 'main [role="region"]' }] : []),
  ...(firstFixture ? [
    { name: 'fixture loading', route: `report/fixtures/${smallSuite.id}/?fixture=${firstFixture}`, gate: true, wait: '[data-fixture-state="loading"]', loaded: () => !!document.querySelector('[data-fixture-ready]'), anchor: '[data-fixture-state] h1' },
    { name: 'fixture error', route: `report/fixtures/${smallSuite.id}/?fixture=${firstFixture}`, abort: true, wait: '[data-fixture-state="error"]' },
  ] : []),
];
// A new-pipeline export with no view has no rows or fixture files to hold back: its pages are checked as pages, and the no-view text by check:routes.
if (authority === 'new' && !viewCases.length) STATES.length = 0;
// The accuracy pair page (#570): every switch that changes what is drawn, each peer, both data views, the gated and shown policy level and the narrowest scope.
ROUTES.push('comparison/accuracy', 'comparison/accuracy/?with=trufflehog&level=T2', 'comparison/accuracy/?with=flare-redact&scope=listed', 'comparison/accuracy/?with=openredaction&level=T3',
  'comparison/accuracy/?level=T3&peers=1', 'comparison/accuracy/?with=openredaction&level=T3&scope=listed&peers=1', 'comparison/accuracy/?data=pii', 'comparison/accuracy/?data=pii&with=openredaction');
// The Evaluation overview and its six method pages (epic #543 follow-up, P1): every page of the section's first phase.
ROUTES.push('evaluation', 'evaluation/method', 'evaluation/credential', 'evaluation/pii', 'evaluation/pii/evidence', ...['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(m => `evaluation/method/${m}`));
// The checks behind a method count (#623): every method's index of lists, and the first list the export holds a file for.
ROUTES.push(...['twin', 'benign', 'metamorphic', 'mutation', 'differential'].map(m => `evaluation/method/${m}/checks`));
const firstDir = (rel) => { try { return readdirSync(path.join(webRoot, 'out', rel), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()[0]; } catch { return undefined; } };
const checksList = (() => {
  for (const method of ['twin', 'benign', 'metamorphic', 'mutation', 'differential']) {
    const row = firstDir(`data/evaluation/${method}`), scanner = row && firstDir(`data/evaluation/${method}/${row}`), status = scanner && firstDir(`data/evaluation/${method}/${row}/${scanner}`);
    if (status) return `evaluation/method/${method}/checks/?row=${encodeURIComponent(row)}&scanner=${encodeURIComponent(scanner)}&status=${status}`;
  }
  return undefined;
})();
if (checksList) {
  ROUTES.push(checksList);
  STATES.push(
    { name: 'checks loading', route: checksList, gate: true, wait: '[data-checks-state="loading"]', loaded: () => !!document.querySelector('[data-checks-ready]'), anchor: '[data-checks-state] h1' },
    { name: 'checks error', route: checksList, abort: true, wait: '[data-checks-state="error"]' },
  );
}
// The landing page is the root (`''`), which the route list's trailing-slash rule would write as `//`.
const PAGE_ONLY = ['', '404.html'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };

/** Serves the static export at BASE_PATH (the site root by default) and storybook-static under /__storybook__, so neither can answer for the other. */
function serve() {
  // Storybook first: the export may own `/`, and `/__storybook__` must not fall into it.
  const roots = [[STORYBOOK, path.join(webRoot, 'storybook-static')], [basePath || '/', path.join(webRoot, 'out')]];
  const server = http.createServer(async (req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    for (const [prefix, root] of roots) {
      if (prefix !== '/' && !(url === prefix || url.startsWith(`${prefix}/`))) continue;
      let rel = prefix === '/' ? url : url.slice(prefix.length);
      if (rel.endsWith('/') || rel === '') rel += 'index.html';
      const file = path.join(root, rel);
      if (!file.startsWith(root)) break;
      try {
        const body = await readFile(file);
        res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
        return res.end(body);
      } catch { break; /* a missing file never falls back to the other root */ }
    }
    res.writeHead(404).end('not found');
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const server = await serve();
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || undefined });
  const context = await browser.newContext();

  let stories = [];
  try {
    const index = JSON.parse(await readFile(path.join(webRoot, 'storybook-static', 'index.json'), 'utf8'));
    stories = Object.values(index.entries).filter(e => e.type === 'story' && (!select || select.stories.includes(e.importPath))).map(e => e.id);
  } catch { console.error('storybook-static/index.json is missing; run npm run build-storybook first'); process.exitCode = 1; }

  const targets = [
    ...stories.map(id => ({ name: `story ${id}`, url: `${origin}${STORYBOOK}/iframe.html?id=${id}&viewMode=story`, ready: 'body.sb-show-main', header: false })),
    ...ROUTES.filter(routeSelected).map(r => ({ name: `page /${r}`, url: `${origin}${basePath}/${r.includes('?') ? r.replace('?', '/?').replace('//', '/') : `${r}/`}`, ready: /[?&]fixture=/.test(r) ? '[data-fixture-ready]' : /[?&]row=/.test(r) ? '[data-checks-ready]' : 'main', header: true })),
    ...PAGE_ONLY.filter(routeSelected).map(r => ({ name: `page /${r}`, url: `${origin}${basePath}/${r}`, ready: 'main', header: true })),
    ...STATES.filter(state => routeSelected(state.route)).map(state => ({ ...state, name: `page /${state.route} (${state.name})`, url: `${origin}${basePath}/${state.route.replace('?', '/?').replace('//', '/')}`, header: true })),
  ];

  const failures = [];
  const workers = pickWorkers();
  let next = 0;
  const worker = async () => {
    const page = await context.newPage();
    for (let target = targets[next++]; target; target = targets[next++]) failures.push(...(await checkTarget(page, target, { widths: WIDTHS, maxWord: MAX_WORD })));
    await page.close();
  };
  await Promise.all(Array.from({ length: Math.min(workers, targets.length) }, worker));
  await browser.close();
  server.close();

  if (failures.length) {
    console.error(`${failures.length} layout problem(s):\n${failures.sort().map(f => `  ${f}`).join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`layout ok${select ? ` (selected: ${select.routes.length} route prefix(es), ${select.stories.length} story file(s))` : ''}: ${targets.length} stories and pages (${targets.filter(t => t.gate || t.abort).length} of them loading, loaded and error states) at ${WIDTHS.join('/')}px, no page overflow, no mid-word breaks, no shift when data arrives`);
  }
}

await main();
