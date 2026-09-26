/**
 * Optional browser QA for the redesigned site. Install Playwright outside the
 * repo or provide PLAYWRIGHT_MODULE; point UI_BASE_URL at `npm run dev` or
 * `npm run preview`. Needs current results: npm run bench && npm run eval &&
 * npm run eval:publish.
 *
 * Checks: every route on direct navigation and reload; every pre-redesign path
 * redirects; figures equal the published JSON; the review queue equals the
 * ledger; 1280 and 360 in light and dark with no page overflow; rendered text
 * contrast; keyboard reach and a visible focus ring; the three empty states.
 */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const origin = process.env.UI_BASE_URL ?? 'http://localhost:4173';
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const summary = await json('public/results/summary.json');
const ledger = await json('benchmarks/review-ledger.json');
const categories = (await json('benchmarks/categories.json')).filter(category => !category.calibrationOnly);
const registry = await json('benchmarks/detectors.json');
const output = 'results-output/ui-verification';
await mkdir(output, { recursive: true });

const percent = v => `${(v * 100).toFixed(1)}%`;
const fixture = 'milestone-6-closed--issue-255-postgres-literal';
const ROUTES = ['/report', '/report?level=T2', '/report?level=T3', '/coverage', '/coverage?show=thin', '/coverage?show=inventory', '/coverage/detectors/github-token', '/coverage/github:classic-personal-access-token', '/scenarios/context-and-encoding', '/support', '/support?status=unsupported', '/suites/accuracy', `/fixture/${fixture}`,
  '/workbench', '/workbench/review/lexical-invalid-alphabet', '/workbench/review/t0-fixtures', '/workbench/changes', '/workbench/changes?corpus=expanded', '/workbench/qualification',
  ...['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'].map(m => `/workbench/method/${m}`), '/how-to-read'];
const LEGACY = { '/': '/report', '/benchmark': '/report', '/benchmark/github-token': '/coverage/detectors/github-token', '/benchmark/accuracy': '/suites/accuracy', '/coverage/github-token': '/coverage/detectors/github-token', '/coverage-gaps': '/coverage', '/evaluation': '/workbench', '/pending': '/workbench/review/t0-fixtures',
  '/evaluation/reviews': '/workbench', '/evaluation/failures': '/workbench', '/evaluation/operators': '/workbench/method/mutation', '/evaluation/method/twin': '/workbench/method/twin', '/evaluation/detector/github-token': '/coverage/detectors/github-token', '/methodology': '/how-to-read', '/#/github-token': '/coverage/detectors/github-token' };
const KEYBOARD = ['/report', '/coverage', '/scenarios/context-and-encoding', `/fixture/${fixture}`, '/workbench', '/workbench/changes', '/how-to-read'];

const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [], routes = [], contrast = [], keyboard = [];
const open = async (options = {}) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...options });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  return page;
};
const ready = async page => { await page.locator('#main h1').first().waitFor({ timeout: 30000 }); await page.evaluate(() => document.fonts.ready); };
const name = route => route.replace(/^\//, '').replace(/[/?=&]/g, '_') || 'root';

/** Rendered contrast of every text node against the first opaque background behind it. Large text needs 3:1, the rest 4.5:1. */
const measureContrast = () => {
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[,/ ]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const backgroundOf = el => { for (let n = el; n; n = n.parentElement) { const s = getComputedStyle(n), c = parse(s.backgroundColor); if (s.backgroundImage !== 'none') return null; if (c && c.a === 1) return c; } return parse(getComputedStyle(document.body).backgroundColor); };
  const failures = []; let lowest = Infinity, measured = 0;
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const el = node.parentElement;
    if (!node.textContent.trim() || !el || !el.getClientRects().length) continue;
    const style = getComputedStyle(el), color = parse(style.color), bg = backgroundOf(el);
    if (!color || color.a < 1 || !bg || style.visibility === 'hidden') continue; // lanes are transparent by design; gradients are covered by the token test
    const [hi, lo] = [lum(color), lum(bg)].sort((a, b) => b - a), ratio = (hi + 0.05) / (lo + 0.05);
    const size = parseFloat(style.fontSize), large = size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700);
    measured++; lowest = Math.min(lowest, ratio);
    if (ratio < (large ? 3 : 4.5)) failures.push(`${el.tagName.toLowerCase()}.${el.className} "${node.textContent.trim().slice(0, 30)}" ${ratio.toFixed(2)}`);
  }
  return { failures: failures.slice(0, 8), lowest: Number(lowest.toFixed(2)), measured };
};

try {
  // 1. Every route, direct and reloaded; numbers equal the published JSON.
  let page = await open();
  for (const route of ROUTES) {
    await page.goto(origin + route); await ready(page);
    await page.reload(); await ready(page);
    const main = await page.locator('#main').innerText();
    assert.ok(!/did not load|Page not found|No such/.test(main), `${route}: ${main.slice(0, 80)}`);
    routes.push({ route, heading: await page.locator('#main h1').first().innerText() });
  }
  await page.goto(origin + '/report'); await ready(page);
  const mine = summary.overall['redact-secret'], t1 = mine['must-redact/T1'], c1 = mine['must-not-flag/T1'];
  const figures = (await page.locator('.figs').innerText()).replace(/\s+/g, ' ');
  assert.ok(figures.includes(`at most ${percent(t1.leakedSpanRate.bound)}`) && figures.includes(`${t1.leakedSpans} of ${t1.spans} secret spans leaked`), figures);
  assert.ok(figures.includes(`at most ${percent(c1.falseAlarmRate.bound)}`) && figures.includes(`${c1.flaggedFiles} of ${c1.files} controls flagged`), figures);
  assert.ok(figures.includes(`at least ${percent(t1.twins.rate.bound)}`) && figures.includes(`${t1.twins.discriminated} of ${t1.twins.pairs} pairs discriminated`), figures);
  assert.equal(await page.locator('.figs .st-held').count() > 0, c1.files < 30, 'Few samples sits beside the small n');
  assert.equal(await page.locator('.seg a').first().getAttribute('aria-current'), 'true', 'T1 is the first and default segment');
  assert.equal(await page.locator('#main .banner, #main .notice').count(), 0, 'no page-level disclaimer banner');
  await page.locator('.fig .v a').first().click();
  assert.match(page.url(), /#rows$/, 'a figure leads to the rows behind it');
  const reportLeaves = page.locator('[data-report-leaf]');
  await reportLeaves.first().waitFor({ state: 'attached', timeout: 30000 });
  const leafCount = await reportLeaves.count();
  const leafSlugs = await reportLeaves.evaluateAll(rows => rows.map(row => row.dataset.slug));
  assert.equal(new Set(leafSlugs).size, leafCount, 'every report fixture has exactly one display bucket');
  await page.locator('[data-tree-signal]').selectOption('all');
  await page.locator('[data-tree-filter]').fill('Amazon Web Services');
  assert.ok(await page.locator('[data-tree-provider]:visible').count() > 0, 'provider search keeps matching branches');
  assert.equal(await page.locator('[data-tree-provider]:visible:not([open])').count(), 0, 'search exposes matching provider branches');
  assert.match(await page.locator('[data-tree-status]').innerText(), /of .* fixtures in this selection/);
  await page.locator('[data-tree-filter]').fill('no-such-report-fixture');
  assert.ok(await page.locator('[data-tree-empty]').isVisible(), 'a no-match selection has an explicit empty state');
  await page.locator('[data-tree-filter]').fill('');
  await page.locator('[data-tree-signal]').selectOption('signal');

  await page.goto(origin + '/coverage?show=detectors'); await ready(page);
  assert.equal(await page.locator('.cov-row:not(.cov-head)').count(), registry.detectors.length);
  assert.equal(await page.locator('.cov-row .bar u').count(), registry.detectors.length, 'minimum sample size drawn on every bar');
  assert.equal(await page.locator('aside').count(), 0, 'the detector sidebar is gone');

  await page.goto(origin + '/workbench'); await ready(page);
  const open_ = Object.values(ledger.entries).filter(e => e.status === 'open').length;
  assert.ok((await page.locator('#main').innerText()).includes(`${open_.toLocaleString('en-US')} open of ${Object.keys(ledger.entries).length.toLocaleString('en-US')}`));
  assert.equal(await page.locator('.health > *').count(), 5);
  const queue = await page.locator('.decision-card > b').allInnerTexts();
  assert.equal(queue.reduce((n, v) => n + Number(v.replace(/,/g, '')), 0), open_, 'queue groups add up to the ledger');
  assert.ok(queue.length <= 12, 'groups, not rows');

  const currentCategory = await page.locator('.decision-card').evaluateAll(cards => cards.map(card => ({ href: card.getAttribute('href'), count: Number(card.querySelector('b')?.textContent?.replace(/,/g, '')) })).find(card => card.count > 0 && !card.href.endsWith('/release-historical'))?.href);
  if (currentCategory) {
    await page.goto(origin + currentCategory); await ready(page);
    assert.ok(await page.locator('button[data-copy]').count() > 0, 'a reproduced entry has a copy path');
    JSON.parse(await page.locator('pre.snippet').first().innerText());
  } else {
    assert.ok((await page.locator('#main').innerText()).includes('Resolution is locked:'), 'an unverifiable published queue locks all current decision paths');
  }
  await page.goto(origin + '/workbench/review/release-historical'); await ready(page);
  assert.equal(await page.locator('button[data-copy]').count(), 0, 'historical entries without adjudication have no copy path');
  assert.equal(await page.locator('pre.snippet').count(), 0, 'historical entries expose no selectable draft');
  await page.goto(origin + '/workbench/method/holdout'); await ready(page);
  assert.equal(await page.locator('#main a[href^="/fixture/"]').count(), 0, 'holdout has no fixture drill-down');
  await page.goto(origin + '/workbench/method/mutation'); await ready(page);
  await page.locator('[data-eval-filter="status"]').selectOption('review-required');
  assert.equal(await page.locator('#evaluation-rows [data-eval="fail"]').count(), 0, 'review is not failure');
  await page.locator('#evaluation-next').click();
  await page.waitForTimeout(5500);
  assert.match(await page.locator('#evaluation-page').innerText(), /Page 2/, 'filter and page survive the polling refresh');

  await page.goto(origin + `/fixture/${fixture}`); await ready(page);
  assert.ok(await page.locator('.bytes .env .sec').count() > 0, 'secret bytes sit inside the underlined envelope');
  assert.ok(await page.locator('.lane i.fill').count() > 0 && await page.locator('.lane i.outline').count() > 0, 'covered and missed are different shapes');
  const green = await page.evaluate(() => { const want = getComputedStyle(document.documentElement).getPropertyValue('--brand-green').trim(); const probe = document.createElement('i'); probe.style.background = want; document.body.append(probe); const rgb = getComputedStyle(probe).backgroundColor; probe.remove(); return [...document.querySelectorAll('#main *')].filter(el => getComputedStyle(el).backgroundColor === rgb).map(el => el.className); });
  assert.ok(green.length && green.every(c => /\bsec\b/.test(c)), `in the data area green means secret bytes only: ${green}`);
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#download-fixture').click()]);
  assert.ok(download.suggestedFilename().length > 0);

  // 2. No bookmark breaks.
  for (const [from, to] of Object.entries(LEGACY)) { await page.goto(origin + from); await ready(page); assert.equal(new URL(page.url()).pathname, to, from); }

  // 3. Global search replaces the detector list.
  await page.goto(origin + '/report'); await ready(page);
  await page.keyboard.press('/'); await page.keyboard.type('github tok');
  await page.locator('#global-search-list a').first().waitFor();
  await page.keyboard.press('Enter'); await ready(page);
  assert.equal(new URL(page.url()).pathname, '/coverage/detectors/github-token');
  await page.locator('#global-search').fill(fixture.split('--')[1]); await page.keyboard.press('Enter'); await ready(page);
  assert.equal(new URL(page.url()).pathname, `/fixture/${fixture}`);
  await page.context().close();

  // 4a. Report hierarchy breakpoints from the spec: two-column summaries at
  // 1080, compact nested rails at 760, and scrolling contained by the table.
  for (const width of [1080, 760]) {
    page = await open({ viewport: { width, height: 900 } });
    await page.goto(origin + '/report'); await ready(page);
    await page.locator('[data-tree-signal]').selectOption('all');
    await page.locator('[data-tree-filter]').fill('SendGrid');
    const provider = page.locator('[data-tree-provider]:visible').first();
    assert.ok(await provider.isVisible(), `report provider visible at ${width}`);
    const family = provider.locator('[data-tree-family]:visible').first();
    if (!(await family.getAttribute('open'))) await family.locator(':scope > summary').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `report page overflow at ${width}`);
    if (width === 760) assert.ok(await family.locator('.tbl').first().evaluate(table => table.scrollWidth > table.clientWidth), 'wide outcome table scrolls inside its region at 760px');
    await page.screenshot({ path: `${output}/report-hierarchy-${width}.png`, fullPage: true });
    await page.context().close();
  }

  // 4. Desktop 1280 and mobile 360, light and dark: overflow, screenshots, rendered contrast.
  for (const theme of ['light', 'dark']) for (const width of [1280, 360]) {
    page = await open({ viewport: { width, height: width === 360 ? 740 : 900 }, colorScheme: theme });
    for (const route of ROUTES) {
      await page.goto(origin + route); await ready(page);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `page overflow at ${width}: ${route}`);
      const result = await page.evaluate(measureContrast);
      contrast.push({ route, theme, width, lowest: result.lowest, measured: result.measured });
      assert.deepEqual(result.failures, [], `contrast ${theme} ${width} ${route}`);
      if (width === 360) {
        assert.ok(await page.locator('.tabs').isVisible() && !(await page.locator('.nav').isVisible()), 'top nav becomes bottom tabs');
        assert.equal(await page.locator('.tabs a[aria-current]').count(), 1);
      }
      await page.screenshot({ path: `${output}/${name(route)}-${width}-${theme}.png`, fullPage: true });
    }
    await page.context().close();
  }

  // 5. Keyboard only: every link, segment, tab and control is a tab stop, and focus is visible.
  page = await open();
  for (const route of KEYBOARD) {
    await page.goto(origin + route); await ready(page);
    const expected = await page.evaluate(() => [...document.querySelectorAll('a[href], button:not([disabled]), input, select, summary, [tabindex="0"]')].filter(el => el.getClientRects().length && el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true })).length);
    await page.evaluate(() => { document.activeElement?.blur(); window.__seen = new Set(); window.__rings = 0; });
    for (let i = 0; i < expected + 5; i++) {
      await page.keyboard.press('Tab');
      await page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return; window.__seen.add(el); const s = getComputedStyle(el); if (el.matches(':focus-visible') && s.outlineStyle === 'solid' && parseFloat(s.outlineWidth) >= 2) window.__rings++; });
    }
    const reached = await page.evaluate(() => ({ seen: window.__seen.size, rings: window.__rings, missed: [...document.querySelectorAll('a[href], button:not([disabled]), input, select, summary, [tabindex="0"]')].filter(el => el.getClientRects().length && el.checkVisibility({ visibilityProperty: true, contentVisibilityAuto: true }) && !window.__seen.has(el)).map(el => (el.textContent || el.id).trim().slice(0, 30)) }));
    keyboard.push({ route, tabStops: expected, reached: reached.seen, focusRings: reached.rings });
    assert.deepEqual(reached.missed, [], `keyboard cannot reach on ${route}`);
    assert.ok(reached.rings >= reached.seen, `${route}: every tab stop shows a 2px solid focus ring (${reached.rings} of ${reached.seen})`);
  }
  await page.goto(origin + '/report'); await ready(page);
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement?.className), 'skip', 'skip link is the first tab stop');
  await page.context().close();

  // 6. Empty states: what is missing, the next command, no apology.
  page = await open({ viewport: { width: 360, height: 740 } });
  let resultCase = 0;
  const results = async handler => { await page.unroute('**/results/*.json').catch(() => {}); await page.route('**/results/*.json', handler); await page.goto(`${origin}/report?qa=${++resultCase}`, { waitUntil: 'networkidle' }); await ready(page); return (await page.locator('#main').innerText()).replace(/\s+/g, ' '); };
  let text = await results(r => r.fulfill({ status: 404, body: '' }));
  assert.ok(text.includes('No benchmark results for this checkout') && text.includes('npm run bench'), text);
  await page.screenshot({ path: `${output}/empty-no-results-360.png`, fullPage: true });
  const [first, second] = categories;
  text = await results(async r => {
    const file = new URL(r.request().url()).pathname.split('/').pop().replace('.json', '');
    const body = await json(`public/results/${file}.json`).catch(() => null);
    if (!body) return r.fulfill({ status: 404, body: '' });
    if (file === first.id || file === second.id) body.runId = '2020-01-01T00:00:00.000Z-000000';
    if (file === 'summary') {
      body.categories = body.categories.filter(c => c !== first.id && c !== second.id);
      for (const category of [first.id, second.id]) for (const scanner of (await json(`public/results/${category}.json`)).scanners.filter(s => s.status === 'complete'))
        for (const [key, group] of Object.entries(scanner.groups)) for (const field of ['files', 'spans', 'leakedSpans', 'flaggedFiles'])
          if (typeof body.overall[scanner.id]?.[key]?.[field] === 'number') body.overall[scanner.id][key][field] -= Number(group[field] ?? 0);
    }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  assert.ok(text.includes('2 suites are from an older run') && text.includes(first.id) && text.includes('left out of every total'), text.slice(0, 400));
  await page.screenshot({ path: `${output}/empty-stale-run-360.png`, fullPage: true });
  text = await results(async r => {
    const file = new URL(r.request().url()).pathname.split('/').pop().replace('.json', '');
    const body = await json(`public/results/${file}.json`).catch(() => null);
    if (!body) return r.fulfill({ status: 404, body: '' });
    if (body.scanners && body.category) body.scanners = body.scanners.map(s => (s.id === 'trufflehog' ? { id: s.id, name: s.name, mode: s.mode, version: null, status: 'unavailable', message: 'Install the released binary and add it to PATH.' } : s));
    if (file === 'summary') { delete body.overall.trufflehog; for (const d of Object.values(body.byDetector)) delete d.trufflehog; Object.assign(body.scanners.find(s => s.id === 'trufflehog'), { status: 'unavailable', completeSuites: 0 }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  assert.ok(text.includes('trufflehog was not found on PATH') && text.includes('Not measured, not as zero'), text.slice(0, 400));
  assert.ok(await page.locator('.peers .st-nm').count() > 0, 'an absent scanner reads Not measured, never 0%');
  await page.screenshot({ path: `${output}/empty-scanner-unavailable-360.png`, fullPage: true });
  assert.ok(!/sorry|apolog|oops|unfortunately/i.test(text));
  await page.context().close();

  assert.deepEqual(errors, []);
  const lowest = contrast.reduce((a, b) => (a.lowest < b.lowest ? a : b));
  await writeFile(`${output}/checks.json`, JSON.stringify({ origin, routes, legacyRedirects: LEGACY, viewports: [1280, 1080, 760, 360], themes: ['light', 'dark'], contrast: { lowest, textNodesMeasured: contrast.reduce((n, c) => n + c.measured, 0), byPage: contrast }, keyboard, errors }, null, 2));
  console.log(`Browser QA passed: ${routes.length} routes reloaded, ${Object.keys(LEGACY).length} legacy redirects, 1280 and 360 in light and dark with no page overflow.`);
  console.log(`Rendered contrast: ${contrast.reduce((n, c) => n + c.measured, 0)} text nodes measured, lowest ${lowest.lowest}:1 (${lowest.route}, ${lowest.theme}, ${lowest.width}).`);
  console.log(`Keyboard: ${keyboard.map(k => `${k.route} ${k.reached}/${k.tabStops}`).join(', ')}; every stop shows a focus ring. Empty states: 3. Screenshots: ${output}`);
} finally { await browser.close(); }
