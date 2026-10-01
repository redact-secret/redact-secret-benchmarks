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

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const basePath = process.env.BASE_PATH ?? '/next';
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
// The Evaluation overview and its six method pages (epic #543 follow-up, P1): every page of the section's first phase.
ROUTES.push('evaluation', ...['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(m => `evaluation/method/${m}`));
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

/** Runs in the page. Returns the problems found in the rendered document. */
function inspect({ maxWord }) {
  const problems = [];
  const doc = document.documentElement;
  if (doc.scrollWidth > doc.clientWidth + 1) {
    // Name the outermost boxes that stick out of the viewport and are not inside a scroll region.
    const inScroller = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true; } return false; };
    const culprits = [...document.body.querySelectorAll('*')]
      .filter(el => el.getBoundingClientRect().right > doc.clientWidth + 1 && getComputedStyle(el).position !== 'fixed' && !inScroller(el))
      .filter(el => ![...el.children].some(c => c.getBoundingClientRect().right > doc.clientWidth + 1))
      .slice(0, 3)
      .map(el => `<${el.tagName.toLowerCase()}${typeof el.className === 'string' && el.className ? `.${el.className.split(' ')[0]}` : ''}>`);
    problems.push(`page is ${doc.scrollWidth}px wide in a ${doc.clientWidth}px viewport${culprits.length ? ` (${culprits.join(', ')})` : ''}`);
  }
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!el || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    const text = node.textContent ?? '';
    // A run of non-space characters is one token. A token longer than maxWord (a
    // hash, a path, a hyphenated id) is allowed to break wherever it must; inside
    // a shorter one, every word must stay on one line.
    for (const token of text.matchAll(/\S+/g)) {
      if (token[0].length > maxWord) continue;
      for (const m of token[0].matchAll(/[\p{L}\p{N}']+/gu)) {
        if (m[0].length < 3) continue;
        const start = token.index + m.index;
        const range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, start + m[0].length);
        const rects = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0);
        if (rects.length < 2) continue;
        const tops = new Set(rects.map(r => Math.round(r.top / 2)));
        if (tops.size > 1 && !seen.has(m[0])) {
          seen.add(m[0]);
          const cls = typeof el.className === 'string' ? el.className.split(' ')[0] : '';
          problems.push(`word "${m[0]}" is broken across lines in <${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''}>`);
        }
      }
    }
  }
  return problems;
}

/** Runs in the page, on exported pages only. */
function inspectHeader() {
  const problems = [];
  const header = document.querySelector('header');
  if (!header) return ['no <header>'];
  const imgs = [...header.querySelectorAll('img')];
  const light = imgs.find(i => /\/logo-light\.svg$/.test(i.getAttribute('src') ?? '') || /logo-light\.svg/.test(i.currentSrc));
  const dark = imgs.find(i => /logo-dark\.svg/.test(i.getAttribute('src') ?? '') || /logo-dark\.svg/.test(i.currentSrc));
  if (!light || !dark) problems.push('header must carry both canonical logo images (logo-light.svg, logo-dark.svg)');
  const visible = imgs.filter(i => getComputedStyle(i).display !== 'none');
  if (visible.length !== 1) problems.push(`exactly one logo image must be visible, found ${visible.length}`);
  for (const img of visible) {
    if (!img.complete || img.naturalWidth === 0) problems.push('the logo image did not load');
    const probe = document.createElement('div');
    probe.style.width = 'var(--logo-w)';
    document.body.append(probe);
    const want = probe.getBoundingClientRect().width;
    probe.remove();
    const got = img.getBoundingClientRect().width;
    if (Math.abs(got - want) > 0.5) problems.push(`the logo is ${got}px wide, the --logo-w token is ${want}px`);
    const ratio = img.getBoundingClientRect().width / img.getBoundingClientRect().height;
    if (Math.abs(ratio - 944 / 817) > 0.02) problems.push(`the logo is stretched (ratio ${ratio.toFixed(3)}, asset 944:817)`);
  }
  if (header.querySelector('svg path')) problems.push('header draws its own mark inline instead of using the canonical asset');
  return problems;
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
  let next = 0;
  const worker = async () => {
    const page = await context.newPage();
    for (;;) {
      const target = targets[next++];
      if (!target) break;
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        // One retry: a cold browser under load occasionally misses the render signal.
        for (let attempt = 1; attempt <= 2; attempt++) {
          // A state target holds (gate) or fails (abort) every request for build-emitted data while the page is inspected.
          let release = () => {};
          if (target.gate || target.abort) {
            const gate = new Promise(resolve => { release = resolve; });
            await page.route('**/data/**', async route => { if (target.abort) return route.abort('failed'); await gate; return route.continue().catch(() => {}); });
          }
          try {
            await page.goto(target.url, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector(target.ready ?? target.wait, { timeout: 20000 });
            await page.evaluate(() => document.fonts.ready).catch(() => {});
            await page.waitForTimeout(50);
            const found = await page.evaluate(inspect, { maxWord: MAX_WORD });
            if (target.header) found.push(...(await page.evaluate(inspectHeader)));
            for (const problem of found) failures.push(`${target.name} @${width}: ${problem}`);
            if (target.gate) {
              // Let the file arrive: the loaded state must fit too, and what sits above the rows must not have moved.
              const before = await page.evaluate(anchor => document.querySelector(anchor)?.getBoundingClientRect().top + window.scrollY, target.anchor);
              release();
              await page.waitForFunction(target.loaded, null, { timeout: 20000 });
              await page.waitForTimeout(100);
              const after = await page.evaluate(anchor => document.querySelector(anchor)?.getBoundingClientRect().top + window.scrollY, target.anchor);
              if (process.env.LAYOUT_DEBUG) console.log(`${target.name} @${width}: ${target.anchor} top ${before} -> ${after}`);
              if (before === undefined || after === undefined || Math.abs(before - after) > 1) failures.push(`${target.name} @${width}: ${target.anchor} moved from ${before} to ${after} when the data arrived (layout shift)`);
              for (const problem of await page.evaluate(inspect, { maxWord: MAX_WORD })) failures.push(`${target.name.replace(/loading/, 'loaded')} @${width}: ${problem}`);
            }
            break;
          } catch (error) {
            if (attempt === 2) failures.push(`${target.name} @${width}: did not render (${String(error.message).split('\n')[0]})`);
          } finally {
            release();
            await page.unroute('**/data/**').catch(() => {});
          }
        }
      }
    }
    await page.close();
  };
  await Promise.all(Array.from({ length: 4 }, worker));
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
