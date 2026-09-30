/**
 * Post-build checks on the static export in web/out (#547), run by
 * `npm run check:routes` after `next build`:
 *
 *  - all six routes exist as pages and each has a level-one heading;
 *  - the export is served under BASE_PATH (default /next), never at the root,
 *    so it cannot shadow the existing site;
 *  - the CSS layer order is fixed first: the first stylesheet on every page
 *    contains the `@layer` order statement, and no other stylesheet precedes it;
 *  - MUI styles are emitted inside `@layer mui`;
 *  - no ledger file name or client fetch of results reaches the shipped scripts.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(webRoot, 'out');
const basePath = process.env.BASE_PATH ?? '/next';
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const ROUTES = ['report', 'report/providers', 'report/families', 'comparison', 'comparison/feature', 'comparison/runtime'];
const LAYER_ORDER = /@layer\s+theme\s*,\s*base\s*,\s*mui\s*,\s*components\s*,\s*utilities\s*;/;

const problems = [];
const fail = message => problems.push(message);

for (const route of ROUTES) {
  let html;
  try { html = await readFile(path.join(out, route, 'index.html'), 'utf8'); } catch { fail(`missing page /${route}/`); continue; }
  if (!/<h1[\s>]/.test(html)) fail(`/${route}/ has no <h1>`);
  const sheets = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(m => m[1]).filter(h => !/^https?:/.test(h));
  if (!sheets.length) { fail(`/${route}/ links no stylesheet`); continue; }
  for (const href of sheets) if (!href.startsWith(`${basePath}/`)) fail(`/${route}/ stylesheet ${href} is outside ${basePath}/`);
  const first = await readFile(path.join(out, href_to_file(sheets[0])), 'utf8');
  if (!LAYER_ORDER.test(first)) fail(`/${route}/: the first stylesheet does not declare the layer order`);
  if (!/data-emotion="mui[^"]*">@layer mui\{/.test(html)) fail(`/${route}/: MUI styles are not inside @layer mui`);
}

function href_to_file(href) {
  return href.slice(basePath.length + 1);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
for await (const file of walk(path.join(out, '_next', 'static'))) {
  if (!file.endsWith('.js')) continue;
  const text = await readFile(file, 'utf8');
  if (/pin-manifest|evidence\/429|feature-claims|peer-pii-runtime|support\/taxonomy|public\/results|results\/summary|known-gaps|fixture-index|summary\.json/.test(text)) fail(`${path.relative(out, file)} names a ledger file: ledger data must be read at build time only`);
}

// ---- The report pages carry the ledger's numbers (#556) ----------------------------------
// Expected values are read here, from the committed taxonomy and fixture index and from the
// run files, independently of web/services and web/resolvers.
// Readable text of a page, for substring checks. Entities stay as written; every string checked here has none.
const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const int = n => n.toLocaleString('en-US');
const taxonomy = await readJson('benchmarks/support/taxonomy.json');
const index = await readJson('benchmarks/fixture-index.json');
const perFamily = new Map();
for (const f of index.fixtures) for (const id of f.familyIds) perFamily.set(id, (perFamily.get(id) ?? 0) + 1);
const slug = id => id.replace(':', '--');
const page = async route => text(await readFile(path.join(out, route, 'index.html'), 'utf8'));

const report = await page('report');
const providersPage = await page('report/providers');
const familiesPage = await page('report/families');
const withFixtures = taxonomy.families.filter(f => perFamily.has(f.id)).length;
if (!report.includes(`${int(taxonomy.providers.length)} providers`)) fail(`/report/ does not state ${taxonomy.providers.length} providers`);
if (!report.includes(`${int(taxonomy.families.length)} families`) || !report.includes(`${int(withFixtures)} with fixtures`)) fail(`/report/ does not state ${taxonomy.families.length} families, ${withFixtures} with fixtures`);
if (!providersPage.includes(`${int(taxonomy.providers.length)} providers`)) fail('/report/providers/ has the wrong provider count');
if (!familiesPage.includes(`${int(taxonomy.families.length)} families`)) fail('/report/families/ has the wrong family count');
for (const p of taxonomy.providers.slice(0, 3)) if (!providersPage.includes(p.name)) fail(`/report/providers/ does not list ${p.name}`);
const gaps = await readJson('benchmarks/known-gaps.json');
if (!report.includes(`All ${int(gaps.issues.length)} findings`)) fail(`/report/ does not state ${gaps.issues.length} findings`);

// Every family is a page; check one with fixtures and one without.
const withRows = taxonomy.families.find(f => (perFamily.get(f.id) ?? 0) > 0);
const without = taxonomy.families.find(f => !perFamily.has(f.id));
for (const f of taxonomy.families) {
  try { await readFile(path.join(out, 'report/families', slug(f.id), 'index.html')); } catch { fail(`missing family page for ${f.id}`); }
}
if (withRows) {
  const t = await page(`report/families/${slug(withRows.id)}`);
  if (!t.includes(withRows.name) || !new RegExp(`Fixtures\\s+${int(perFamily.get(withRows.id))}\\b`).test(t)) fail(`family page ${withRows.id} does not state ${perFamily.get(withRows.id)} fixtures`);
}
if (without) {
  const t = await page(`report/families/${slug(without.id)}`);
  if (!t.includes('No fixtures in this family yet') || !t.includes('Not measured')) fail(`family page ${without.id} has no fixtures and must say "Not measured"`);
}
try { const nf = text(await readFile(path.join(out, '404.html'), 'utf8')); if (!nf.includes('Page not found')) fail('404.html is not the not-found page'); } catch { fail('missing 404.html'); }

// The run. Absent locally is allowed (the pages say "Not measured"); CI sets WEB_REQUIRE_RUN=1.
let summary;
try { summary = await readJson('public/results/summary.json'); } catch { /* no run */ }
if (!summary) {
  if (process.env.WEB_REQUIRE_RUN === '1') fail('WEB_REQUIRE_RUN=1 but public/results/summary.json is absent: run npm run bench before the web build');
  else if (!report.includes('No benchmark results for this checkout')) fail('/report/ has no run to read and must say so');
} else {
  const mine = summary.overall['redact-secret'];
  const t1 = mine['must-redact/T1'], c1 = mine['must-not-flag/T1'];
  if (!report.includes(`${int(t1.leakedSpans)} of ${int(t1.spans)}`)) fail(`/report/ does not state ${t1.leakedSpans} of ${t1.spans} leaked spans at T1`);
  if (!report.includes(`${int(c1.flaggedFiles)} of ${int(c1.files)}`)) fail(`/report/ does not state ${c1.flaggedFiles} of ${c1.files} controls flagged at T1`);
  if (!/Mode published ·|Mode candidate ·/.test(report)) fail('/report/ does not state its mode (published or candidate)');
  if (!/Mode (published|candidate) ·/.test(providersPage)) fail('/report/providers/ does not state its mode');
  if (report.includes('No benchmark results for this checkout')) fail('/report/ says there is no run, but public/results exists');
}

// ---- The comparison pages carry the ledger's numbers (#557) ------------------------------
// Read independently of web/services and web/resolvers, from the committed snapshot.
const hub = await page('comparison');
const runtimeHtml = await readFile(path.join(out, 'comparison/runtime/index.html'), 'utf8');
const runtimePage = text(runtimeHtml);
const featurePage = await page('comparison/feature');
const ms = n => (n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
const mbs = n => (n / 1e6).toFixed(1);
let snapshot;
try { snapshot = await readJson('evidence/429/peer-pii-runtime-throughput.json'); } catch { /* not committed */ }
if (!snapshot) {
  if (!runtimePage.includes('Not measured yet')) fail('/comparison/runtime/ has no snapshot to read and must say "Not measured yet"');
} else {
  for (const o of snapshot.observations) {
    const times = new RegExp(`Usual time\\s*ms[\\s\\S]*?${ms(o.summary.medianMs).replace(/[.,]/g, m => `\\${m}`)}\\b`);
    if (!times.test(runtimePage)) fail(`/comparison/runtime/ does not state ${ms(o.summary.medianMs)} ms for ${o.tool} on ${o.workload}`);
    if (!runtimePage.includes(mbs(o.summary.medianBytesPerSecond))) fail(`/comparison/runtime/ does not state ${mbs(o.summary.medianBytesPerSecond)} MB/s for ${o.tool} on ${o.workload}`);
  }
  for (const t of snapshot.tools) if (!runtimePage.includes(t.version)) fail(`/comparison/runtime/ does not state ${t.id} ${t.version}`);
  if (!runtimePage.includes(snapshot.generatedAt.slice(0, 10))) fail('/comparison/runtime/ does not state the run date');
  if (!runtimePage.includes('local build · unreleased')) fail('/comparison/runtime/ does not state that redact-secret was a local unreleased build');
  if (!hub.includes(snapshot.generatedAt.slice(0, 10)) || !hub.includes(`${new Set(snapshot.observations.map(o => o.workload)).size} test texts`)) fail('/comparison/ does not state the runtime run date and test-text count');
}
for (const key of ['external-pii-all', 'external-pii-speed', 'external-pii-accuracy', 'internal-pii', 'internal-credentials', 'external-credentials']) {
  if (!runtimeHtml.includes(`data-key="${key}"`)) fail(`/comparison/runtime/ has no panel for ${key}`);
}
for (const q of ['analysis', 'domain', 'view']) if (!runtimeHtml.includes(`data-${q}`) && !runtimeHtml.includes(`dataset.${q}`)) fail(`/comparison/runtime/ does not carry the ${q} query state`);
let claims;
try { claims = await readJson('benchmarks/feature-claims.json'); } catch { /* not committed yet */ }
if (!claims) {
  if (!featurePage.includes('No feature claims recorded yet')) fail('/comparison/feature/ has no claims file and must say so');
  if (!hub.includes('Not recorded yet')) fail('/comparison/ must say the features are not recorded yet');
} else {
  for (const l of claims.libraries) if (!featurePage.includes(l.name) || !featurePage.includes(l.version)) fail(`/comparison/feature/ does not list ${l.name} ${l.version}`);
  if (featurePage.includes('No feature claims recorded yet')) fail('/comparison/feature/ says nothing is recorded, but the claims file exists');
  // Every row, note, mark word, source link and "tested" chip in the file is on the page, and nothing extra is (#564).
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
  const featureHtml = await readFile(path.join(out, 'comparison/feature/index.html'), 'utf8');
  const MARK_WORD = { yes: 'Yes', partly: 'Opt-in or partly', no: 'Not listed' };
  const rows = claims.groups.flatMap(g => g.rows);
  const cells = rows.flatMap(r => Object.entries(r.cells).map(([lib, c]) => ({ r, lib, c })));
  for (const g of claims.groups) if (!featurePage.includes(esc(g.label))) fail(`/comparison/feature/ does not show the group ${g.label}`);
  for (const r of rows) if (!featurePage.includes(esc(r.label))) fail(`/comparison/feature/ does not show the row ${r.label}`);
  for (const { r, lib, c } of cells) {
    const shown = `${MARK_WORD[c.mark]}. ${c.note ? esc(c.note) : c.mark === 'yes' ? 'Yes' : '—'}`;
    // A literal note renders in <code>: the tags become spaces in the stripped text.
    if (!featurePage.replace(/ ([.,])/g, '$1').includes(c.literal ? `${MARK_WORD[c.mark]}. ${esc(c.note)}` : shown)) fail(`/comparison/feature/ does not show ${lib} on ${r.id} as recorded: ${shown}`);
  }
  const testedCells = cells.filter(x => x.c.tested).length;
  const tableHtml = /<table[\s\S]*<\/table>/.exec(featureHtml)?.[0] ?? '';
  const chips = (tableHtml.match(/>tested</g) ?? []).length;
  if (chips !== testedCells) fail(`/comparison/feature/ shows ${chips} "tested" chips in its table, the file records ${testedCells}`);
  for (const s of claims.sources) for (const l of s.links ?? []) if (!featureHtml.includes(`href="${esc(l.href)}"`)) fail(`/comparison/feature/ does not link the source ${l.href}`);
  if (!featurePage.includes(`Read on ${claims.readOn}`)) fail('/comparison/feature/ does not state the date the docs were read');
  if (!hub.includes(`${rows.length} features`) || !hub.includes(`${rows.filter(r => Object.values(r.cells).some(c => c.tested)).length} checked by us`)) fail('/comparison/ does not state the feature count and how many are checked by us');
  if (!hub.includes(`docs read ${claims.readOn}`)) fail('/comparison/ does not state when the docs were read');
  // The runtime page's "About the libraries" table carries the package facts (install size, runs in, dependencies).
  const kib = n => `${(n / 1024).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KiB`;
  for (const l of claims.libraries) {
    if (!l.facts) continue;
    const packed = l.facts.install.packages.reduce((t, p) => t + p.packedBytes, 0);
    for (const want of [`${kib(packed)} packed`, esc(l.facts.runsIn), esc(l.facts.dependencies)]) if (!runtimePage.includes(want)) fail(`/comparison/runtime/ does not state ${l.id}: ${want}`);
  }
}
if (summary && !/Accuracy · \d{4}-\d{2}-\d{2} · (published|candidate) ·/.test(hub)) fail('/comparison/ does not state the accuracy run date and mode');

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`static export ok: ${ROUTES.length} routes, ${taxonomy.families.length} family pages, report numbers match the ledger, under ${basePath}/, layer order first, MUI in @layer mui`);
