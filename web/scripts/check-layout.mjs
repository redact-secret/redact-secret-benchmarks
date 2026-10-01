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
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { checkTarget, pickWorkers } from './layout-check-lib.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePath = process.env.BASE_PATH ?? '/next';
const WIDTHS = [320, 375, 768];
const MAX_WORD = 24;
const ROUTES = ['report', 'report/?level=T2', 'report/?level=T3&peers=1', 'report/providers', 'report/providers/?q=github&show=signal', 'report/families', 'report/families/?show=empty', 'comparison', 'comparison/feature', 'comparison/runtime', 'comparison/runtime/?view=speed', 'comparison/runtime/?view=accuracy', 'comparison/runtime/?analysis=internal&domain=pii', 'comparison/runtime/?analysis=external&domain=credentials',
  // #562/#563: outcome rows, the legend and shares in every measured panel, at each view that changes what is drawn.
  'comparison/runtime/?analysis=internal&domain=pii&view=accuracy', 'comparison/runtime/?analysis=internal&domain=credentials', 'comparison/runtime/?analysis=external&domain=credentials&view=accuracy', 'comparison/runtime/?analysis=external&domain=pii&view=speed'];
// The real family pages (#556): the family with the most fixtures (paged rows), one with a few, and one with none.
const repoRoot = path.resolve(webRoot, '..');
const taxonomy = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/support/taxonomy.json'), 'utf8'));
const index = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/fixture-index.json'), 'utf8'));
const perFamily = new Map();
for (const f of index.fixtures) for (const id of f.familyIds) perFamily.set(id, (perFamily.get(id) ?? 0) + 1);
const slugOf = id => id.replace(':', '--');
const largest = [...perFamily.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const small = [...perFamily.entries()].find(([, n]) => n > 0 && n <= 10)?.[0];
const none = taxonomy.families.find(f => !perFamily.has(f.id))?.id;
for (const id of [largest, small, none]) if (id) ROUTES.push(`report/families/${slugOf(id)}`);
if (largest) ROUTES.push(`report/families/${slugOf(largest)}/?page=2`);
// #589: a family with a long dossier (notes, open questions, look-alikes, six sources, seven research issues), and one with several peer rules.
ROUTES.push('report/families/github--fine-grained-personal-access-token');
// The rows, suite, fixture, detector and findings pages (#559), and the level and scanner controls (#560).
ROUTES.push('report/rows/T1', 'report/rows/T2/?show=leaked&scanners=product', 'report/rows/T3/?show=flagged', 'report/fixtures', 'report/detectors', 'report/detectors/?show=signal', 'report/findings', 'report/families/?level=T2', 'report/providers/?level=T3');
if (largest) ROUTES.push(`report/families/${slugOf(largest)}/?scanners=all&level=T1`);
const detectors = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/detectors.json'), 'utf8')).detectors;
ROUTES.push(`report/detectors/${detectors[0].id}`, `report/detectors/${detectors.at(-1).id}`);
const suites = JSON.parse(await readFile(path.join(repoRoot, 'benchmarks/categories.json'), 'utf8')).filter(c => !c.calibrationOnly);
// A fixture page: the first fixture of a small suite, and the largest single fixture of the corpus (a 72 KB line-heavy input).
const firstOf = new Map();
for (const f of index.fixtures) { const [category, ...rest] = f.slug.split('--'); if (!firstOf.has(category)) firstOf.set(category, rest.join('--')); }
const smallSuite = suites.find(c => c.id === 'common-formats') ?? suites[0];
ROUTES.push(`report/fixtures/${smallSuite.id}`, `report/fixtures/${smallSuite.id}/?fixture=${firstOf.get(smallSuite.id)}`, 'report/fixtures/context-edges');
try {
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
// The accuracy pair page (#570): every switch that changes what is drawn, each peer, both data views, the gated and shown policy level and the narrowest scope.
ROUTES.push('comparison/accuracy', 'comparison/accuracy/?with=trufflehog&level=T2', 'comparison/accuracy/?with=flare-redact&scope=listed', 'comparison/accuracy/?with=openredaction&level=T3',
  'comparison/accuracy/?level=T3&peers=1', 'comparison/accuracy/?with=openredaction&level=T3&scope=listed&peers=1', 'comparison/accuracy/?data=pii', 'comparison/accuracy/?data=pii&with=openredaction');
const PAGE_ONLY = ['404.html'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.txt': 'text/plain' };

/** Serves storybook-static at `/` and the static export at BASE_PATH. */
function serve() {
  const roots = [[basePath || '/', path.join(webRoot, 'out')], ['/', path.join(webRoot, 'storybook-static')]];
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
      } catch { if (prefix !== '/') break; /* a missing file under the export never falls back to Storybook */ }
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
    stories = Object.values(index.entries).filter(e => e.type === 'story').map(e => e.id);
  } catch { console.error('storybook-static/index.json is missing; run npm run build-storybook first'); process.exitCode = 1; }

  const targets = [
    ...stories.map(id => ({ name: `story ${id}`, url: `${origin}/iframe.html?id=${id}&viewMode=story`, ready: 'body.sb-show-main', header: false })),
    ...ROUTES.map(r => ({ name: `page /${r}`, url: `${origin}${basePath}/${r.includes('?') ? r.replace('?', '/?').replace('//', '/') : `${r}/`}`, ready: /[?&]fixture=/.test(r) ? '[data-fixture-ready]' : 'main', header: true })),
    ...PAGE_ONLY.map(r => ({ name: `page /${r}`, url: `${origin}${basePath}/${r}`, ready: 'main', header: true })),
    ...STATES.map(state => ({ ...state, name: `page /${state.route} (${state.name})`, url: `${origin}${basePath}/${state.route.replace('?', '/?').replace('//', '/')}`, header: true })),
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
    console.log(`layout ok: ${targets.length} stories and pages (${STATES.length} of them loading, loaded and error states) at ${WIDTHS.join('/')}px, no page overflow, no mid-word breaks, no shift when data arrives`);
  }
}

await main();
