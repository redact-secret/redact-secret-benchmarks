/**
 * Post-build check of the lists behind the method counts (#623), run by `npm run check:routes` after `next build`.
 *
 * The checks are read again here, independently of web/services and web/resolvers, from the evaluation bundle the pages were built from
 * (`public/results/evaluation-bundle-v1.json`, its manifest and its case parts; the legacy whole file only when no pointer exists) and
 * recounted with the method pages' own row rules. Every list the run records has exactly one build-emitted file
 * (`data/evaluation/<method>/<row>/<scanner>/<status>/checks.json`) holding its checks in run order, bound to the run; no other file is
 * emitted; the method page links each list from a cell whose figure is the list's length, and the method's checks page lists each one with
 * the same figure and address. Without a usable evaluation no file is emitted, no method page links a list and every checks page says why.
 */
import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const METHODS = ['twin', 'benign', 'metamorphic', 'mutation', 'differential'];
const PRODUCT = 'redact-secret';
const SEGMENT = /^[a-z0-9][a-z0-9._-]*$/i;
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = rel => path.join(webRoot, 'out', rel);
const resultsDir = process.env.WEB_RESULTS_DIR ?? path.join(webRoot, '..', 'public', 'results');
const problems = [];
const fail = message => problems.push(message);
const read = rel => readFile(out(rel), 'utf8');
const decode = s => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = html => { let s = html, prev; do { prev = s; s = s.replace(/<[^<>]*>/g, ''); } while (s !== prev); return decode(s).trim(); };
const dirs = rel => { try { return readdirSync(out(rel), { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; } };

/** Every list file in the export, by `<method>/<row>/<scanner>/<status>`. */
function exportedLists() {
  const lists = new Map();
  for (const method of METHODS) {
    const base = `data/evaluation/${method}`;
    for (const row of dirs(base)) for (const scanner of dirs(`${base}/${row}`)) for (const status of dirs(`${base}/${row}/${scanner}`)) {
      lists.set(`${method}/${row}/${scanner}/${status}`, `${base}/${row}/${scanner}/${status}/checks.json`);
    }
  }
  return lists;
}

/** The lists an HTML page links, with the figure each link shows: `<method>/<row>/<scanner>/<status>` -> number. */
function linksIn(html, method) {
  const linked = new Map();
  for (const m of html.matchAll(/<a[^>]*href="([^"]*\/evaluation\/method\/[^/"]+\/checks\/\?[^"]*)"[^>]*>(.*?)<\/a>/g)) {
    const url = new URL(decode(m[1]), 'https://example.invalid');
    const q = url.searchParams;
    if (!url.pathname.endsWith(`/evaluation/method/${method}/checks/`) || q.has('page')) continue;
    const words = text(m[2]);
    const figure = /^([\d,]+)/.exec(words)?.[1] ?? /([\d,]+) unscored/.exec(words)?.[1];
    linked.set(`${method}/${q.get('row')}/${q.get('scanner')}/${q.get('status')}`, Number((figure ?? 'NaN').replace(/,/g, '')));
  }
  return linked;
}

const twinPage = await read('evaluation/method/twin/index.html');
const measured = !/Not measured: no evaluation published/.test(twinPage);
const exported = exportedLists();

// The one stated file a build writes when it has no list (resolvers/evaluation-checks-view.ts UNAVAILABLE_CHECKS): no page links it and it holds no check.
const UNAVAILABLE = 'twin/not-published/none/fail';
if (exported.has(UNAVAILABLE)) {
  const file = JSON.parse(await read(exported.get(UNAVAILABLE)));
  if ('checks' in file || typeof file.unavailable !== 'string') fail(`data/evaluation/${UNAVAILABLE}/checks.json is not the stated no-list file`);
  exported.delete(UNAVAILABLE);
}

if (!measured) {
  if (exported.size !== 0) fail(`with no usable evaluation the export holds ${exported.size} list files, expected none`);
  for (const method of METHODS) {
    if (linksIn(await read(`evaluation/method/${method}/index.html`), method).size) fail(`/evaluation/method/${method}/ links a list although no evaluation is usable`);
    const rel = `evaluation/method/${method}/checks/index.html`;
    if (!existsSync(out(rel))) { fail(`${rel} is missing`); continue; }
    if (!/Not measured/.test(await read(rel))) fail(`${rel} does not say why there is nothing to list`);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('method check lists ok: no usable evaluation, no list file is emitted, no method page links a list and every checks page says so');
  process.exit(0);
}

// ---- The cases, read again from the bundle (or the legacy whole file when no pointer exists) ---------------------------------
const pointerFile = path.join(resultsDir, 'evaluation-bundle-v1.json');
const bundle = existsSync(pointerFile) ? await (async () => {
  const pointer = JSON.parse(await readFile(pointerFile, 'utf8'));
  const dir = path.join(resultsDir, path.dirname(pointer.manifest.path));
  return { dir, manifest: JSON.parse(await readFile(path.join(resultsDir, pointer.manifest.path), 'utf8')) };
})() : undefined;
const legacy = bundle ? undefined : JSON.parse(await readFile(path.join(resultsDir, 'evaluation-v1.json'), 'utf8'));

async function* casesOf(method) {
  if (bundle) {
    for (const ref of bundle.manifest.cases.filter(r => r.method === method)) yield* JSON.parse(await readFile(path.join(bundle.dir, ref.path), 'utf8')).cases;
    return;
  }
  yield* legacy.cases.filter(c => c.method === method);
}
const report = bundle ? JSON.parse(await readFile(path.join(bundle.dir, bundle.manifest.summary.path), 'utf8')).report : legacy;
const complete = new Set(report.scanners.filter(s => s.status === 'complete' && SEGMENT.test(s.id)).map(s => s.id));

/** The row a check falls in, by the method pages' rules (twin sides, benign taxonomy, one row per operator then the text on its own). */
function rowOf(method, c, a, variant) {
  if (method === 'twin') return { 'must-flip': 'pair', 'present-within-envelope': 'positive', absent: 'negative' }[a.type];
  if (method === 'benign') return a.type === 'absent' && c.taxonomy ? `${c.taxonomy.startsWith('realworld-') ? 'u' : 't'}\u0000${c.taxonomy}` : undefined;
  if (variant.operator === 'identity' || (method === 'mutation' && variant.operator === 'authored.twin')) return undefined;
  if (a.type === 'same-detection' || a.type === 'absolute') return `r\u0000${variant.operator}`;
  if (a.type === 'present-within-envelope') return 'a\u0000detected';
  if (a.type === 'absent') return 'a\u0000left-alone';
  return undefined;
}
const keyOf = row => row.split('\u0000').pop();
const DIFFERENCES = { none: 'same', 'range-disagreement': 'range', 'redact-secret-only': 'product-only', 'peer-only': 'peer-only', 'classification-disagreement': 'classification' };

/** The lists the method pages should link, recounted: `<method>/<row>/<scanner>/<status>` -> case ids in run order. */
async function expectedLists(method) {
  const lists = new Map();
  if (method === 'differential') {
    const per = new Map();
    for await (const c of casesOf(method)) for (const x of c.comparisons) {
      if (x.status !== 'complete' || !DIFFERENCES[x.disagreement]) continue;
      const k = `${method}/${DIFFERENCES[x.disagreement]}/${x.peer}/complete`;
      (per.get(k) ?? per.set(k, []).get(k)).push(c.id);
    }
    for (const [k, ids] of per) { const peer = k.split('/')[2]; if (complete.has(peer) && peer !== PRODUCT) lists.set(k, ids); }
    return lists;
  }
  const rows = new Map();
  for await (const c of casesOf(method)) {
    const variants = new Map(c.variants.map(v => [v.id, v]));
    for (const a of c.assertions) {
      const variant = variants.get(a.variant || a.candidate);
      if (!variant) continue;
      const row = rowOf(method, c, a, variant);
      if (!row) continue;
      const byScanner = rows.get(row) ?? rows.set(row, new Map()).get(row);
      const t = byScanner.get(a.scanner) ?? byScanner.set(a.scanner, { pass: 0, fail: [], review: [] }).get(a.scanner);
      if (a.status === 'pass') t.pass++;
      else if (a.status === 'fail') t.fail.push(c.id);
      else if (a.status === 'review-required') t.review.push(c.id);
    }
  }
  const keys = [...rows.keys()].map(keyOf);
  for (const [row, byScanner] of rows) {
    const key = keyOf(row);
    if (!SEGMENT.test(key) || keys.filter(k => k === key).length !== 1) continue;
    for (const [scanner, t] of byScanner) {
      if (!complete.has(scanner)) continue;
      const scored = t.pass + t.fail.length;
      if (t.fail.length > 0) lists.set(`${method}/${key}/${scanner}/fail`, t.fail);
      else if (scored === 0 && t.review.length > 0) lists.set(`${method}/${key}/${scanner}/review-required`, t.review);
    }
  }
  return lists;
}

/** The fixture ids a suite page can open (its records file), memoised per suite; none when the export has no such suite. */
const fixtureIds = new Map();
async function fixtureIdsOf(suite) {
  if (!fixtureIds.has(suite)) {
    let ids = new Set();
    try { ids = new Set(JSON.parse(await read(`data/fixtures/${suite}/records.json`)).records.map(r => r.id)); } catch { /* no suite page */ }
    fixtureIds.set(suite, ids);
  }
  return fixtureIds.get(suite);
}

let listsChecked = 0, rowsChecked = 0, largest = 0;
for (const method of METHODS) {
  const expected = await expectedLists(method);
  const cells = linksIn(await read(`evaluation/method/${method}/index.html`), method);
  const index = linksIn(await read(`evaluation/method/${method}/checks/index.html`), method);
  const files = new Map([...exported].filter(([k]) => k.startsWith(`${method}/`)));
  for (const k of expected.keys()) {
    if (!files.has(k)) fail(`data/evaluation/${k}/checks.json is missing: the run recorded ${expected.get(k).length} checks for it`);
    if (!cells.has(k)) fail(`/evaluation/method/${method}/ does not link the list ${k}`);
    if (!index.has(k)) fail(`/evaluation/method/${method}/checks/ does not list ${k}`);
  }
  for (const k of files.keys()) if (!expected.has(k)) fail(`data/evaluation/${k}/checks.json is emitted but the run records no such list`);
  for (const k of cells.keys()) if (!expected.has(k)) fail(`/evaluation/method/${method}/ links ${k}, a list the run does not record`);
  for (const k of index.keys()) if (!expected.has(k)) fail(`/evaluation/method/${method}/checks/ lists ${k}, a list the run does not record`);

  for (const [k, ids] of expected) {
    if (cells.has(k) && cells.get(k) !== ids.length) fail(`/evaluation/method/${method}/ shows ${cells.get(k)} for ${k}; the run recorded ${ids.length}`);
    if (index.has(k) && index.get(k) !== ids.length) fail(`/evaluation/method/${method}/checks/ shows ${index.get(k)} for ${k}; the run recorded ${ids.length}`);
    if (!files.has(k)) continue;
    const raw = await readFile(out(files.get(k)), 'utf8');
    largest = Math.max(largest, Buffer.byteLength(raw));
    let file;
    try { file = JSON.parse(raw); } catch { fail(`data/evaluation/${k}/checks.json is not JSON`); continue; }
    const [, row, scanner, status] = k.split('/');
    if (file.schema !== 'redact-secret/evaluation-checks/v1' || file.method !== method || file.row !== row || file.scanner !== scanner || file.status !== status) fail(`data/evaluation/${k}/checks.json names another list`);
    if (file.runId !== report.runId) fail(`data/evaluation/${k}/checks.json is bound to run ${file.runId}, the pages to ${report.runId}`);
    // A source fixture names a page only when the export has that fixture on its suite page.
    for (const c of Array.isArray(file.checks) ? file.checks : []) {
      if (!c[7]) continue;
      const suite = String(c[1]).split('--')[0];
      const known = await fixtureIdsOf(suite);
      if (!known.has(c[7])) fail(`data/evaluation/${k}/checks.json names the fixture page ${suite}/?fixture=${c[7]}, which the export does not hold`);
    }
    const shown = Array.isArray(file.checks) ? file.checks.map(c => c[0]) : [];
    if (JSON.stringify(shown) !== JSON.stringify(ids)) fail(`data/evaluation/${k}/checks.json holds ${shown.length} checks, the run recorded ${ids.length} (or in another order)`);
    rowsChecked += shown.length;
    listsChecked++;
  }
}

if (problems.length) { for (const p of problems.slice(0, 50)) console.error(p); if (problems.length > 50) console.error(`... and ${problems.length - 50} more`); process.exit(1); }
console.log(`method check lists ok: ${listsChecked} list files (${rowsChecked.toLocaleString('en-US')} checks, largest ${(largest / 1024).toFixed(0)} KB) recounted from the evaluation the pages were built from, each linked from its method cell and its checks page with the same figure`);
