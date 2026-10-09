/**
 * Post-build checks on the static export in web/out (#547), run by
 * `npm run check:routes` after `next build`:
 *
 *  - all six routes exist as pages and each has a level-one heading;
 *  - the export is the site root (BASE_PATH is empty by default, docs/decisions/2026-10-02-serve-the-next-export-at-the-site-root.md):
 *    `/` is the landing page (one h1, the three questions linking /report/, /comparison/performance/ and /evaluation/, no redirect), robots.txt allows crawling, favicon.svg is present, no page carries a robots meta
 *    (staging's noindex is CloudFront's header), and nothing in the export names the retired /next/ prefix;
 *  - the CSS layer order is fixed first: the first stylesheet on every page
 *    contains the `@layer` order statement, and no other stylesheet precedes it;
 *  - MUI styles are emitted inside `@layer mui`;
 *  - no ledger file name reaches the shipped scripts (the only browser fetch is of data/, see check-no-sx.mjs).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAuthority, stampOf } from './lib/authority.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(webRoot, 'out');
const basePath = process.env.BASE_PATH ?? '';
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const ROUTES = ['report', 'report/providers', 'report/families', 'comparison', 'comparison/feature', 'comparison/runtime', 'evaluation/rc'];
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

// ---- The export is the site root (#602) -------------------------------------------------------------------------------
{
  const root = await readFile(path.join(out, 'index.html'), 'utf8');
  if ((root.match(/<h1[\s>]/g) ?? []).length !== 1) fail('/ must have exactly one <h1>');
  if (/http-equiv="refresh"/.test(root)) fail('/ is the landing page and must not redirect');
  for (const target of ['/report/', '/comparison/performance/', '/evaluation/']) if (!root.includes(`href="${basePath}${target}"`)) fail(`/ does not link ${target}`);
  try {
    const robots = await readFile(path.join(out, 'robots.txt'), 'utf8');
    if (!/^User-agent: \*\s+Allow: \/\s*$/.test(robots)) fail('robots.txt must allow crawling (User-agent: * / Allow: /); staging noindex is the CloudFront header');
  } catch { fail('missing robots.txt'); }
  try { await readFile(path.join(out, 'favicon.svg'), 'utf8'); } catch { fail('missing favicon.svg'); }
  // One copy of each is kept beside the legacy site's own until that source is removed.
  for (const name of ['robots.txt', 'favicon.svg']) {
    const legacy = await readFile(path.join(repoRoot, 'public', name), 'utf8').catch(() => null);
    if (legacy !== null && legacy !== await readFile(path.join(out, name), 'utf8').catch(() => null)) fail(`${name} differs from public/${name}`);
  }
}
for await (const file of walkAll(out)) {
  if (!/\.(html|txt|js|css|json|svg|xml)$/.test(file)) continue;
  const text = await readFile(file, 'utf8');
  if (/["'(=]\/next\/|["']\/next["']/.test(text)) fail(`${path.relative(out, file)} names the retired /next/ prefix`);
  // Next marks its own not-found pages noindex; every page a reader can reach must not carry the tag.
  if (file.endsWith('.html') && !/(^|\/)(404\.html|_not-found\/index\.html|404\/index\.html)$/.test(path.relative(out, file)) && /<meta[^>]+name="robots"/.test(text)) fail(`${path.relative(out, file)} carries a robots meta; the published site is indexable and staging's noindex is a response header`);
}

function href_to_file(href) {
  return href.slice(basePath.length + 1);
}

async function* walkAll(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkAll(full);
    else yield full;
  }
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
  if (/pin-manifest|evidence\/429|evidence\/562|runtime-comparison-v2|feature-claims|peer-pii-runtime|support\/taxonomy|public\/results|results\/summary|known-gaps|fixture-index|summary\.json/.test(text)) fail(`${path.relative(out, file)} names a ledger file: ledger data must be read at build time only`);
}

// ---- The report pages carry the ledger's numbers (#556) ----------------------------------
// Expected values are read here, from the committed taxonomy and fixture index and from the
// run files, independently of web/services and web/resolvers.
// Readable text of a page, for substring checks. Entities stay as written; every string checked here has none.
const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const int = n => n.toLocaleString('en-US');
const taxonomy = await readJson('benchmarks/support/taxonomy.json');
// The legacy run, read for the legacy recount below. The comparison and scanner pages follow the authority (#658): check-export-accuracy/-scanners under `legacy`, check-export-comparison under `new`.
let summary;
try { summary = await readJson('public/results/summary.json'); } catch { /* no run */ }
const authority = await readAuthority(repoRoot);

const slug = id => id.replace(':', '--');
const page = async route => text(await readFile(path.join(out, route, 'index.html'), 'utf8'));

if (authority === 'legacy') {
const index = await readJson('benchmarks/fixture-index.json');
const perFamily = new Map();
for (const f of index.fixtures) for (const id of f.familyIds) perFamily.set(id, (perFamily.get(id) ?? 0) + 1);

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
// Every report page names the pipeline it was built from: the legacy one, the authority.
for (const route of ['report', 'report/providers', 'report/families']) {
  const stamp = stampOf(await readFile(path.join(out, route, 'index.html'), 'utf8'));
  if (!stamp || stamp.pipeline !== 'legacy' || stamp.role !== 'authority') fail(`/${route}/ must carry the legacy/authority pipeline stamp (authority legacy), found ${stamp ? `${stamp.pipeline}/${stamp.role}` : 'none'}`);
}
} else {
  console.log('credential pages: the authority is new, so check-export-credential.mjs recounts them against the qualification view');
}

// ---- The comparison pages carry the ledger's numbers (#557) ------------------------------
// Read independently of web/services and web/resolvers, from the committed snapshot.
const hub = await page('comparison');
const runtimeHtml = await readFile(path.join(out, 'comparison/runtime/index.html'), 'utf8');
const runtimePage = text(runtimeHtml);
const featurePage = await page('comparison/feature');
const ms = n => (n < 100 ? n.toFixed(1) : Math.round(n).toLocaleString('en-US'));
const mbs = n => (n / 1e6).toFixed(1);
const SETTINGS = ['default', 'pii-global', 'pii-global-us'];
const plan2 = await readJson('qualification/runtime-comparison-v2.json');
const reports = {};
// The build chip follows the report: a published package reads "npm", a local build of the pinned commit reads "local build · unreleased".
function checkBuildChip(report) {
  const kind = report.tools.find(t => t.id === 'redact-secret').provenance.kind;
  const local = kind === 'local-source-build';
  if (!runtimePage.includes(local ? 'local build · unreleased' : 'npm')) fail(`/comparison/runtime/ does not state the redact-secret build as ${local ? 'a local unreleased build' : 'the npm package'} (${kind})`);
  if (!local && runtimePage.includes('local build · unreleased')) fail('/comparison/runtime/ calls a published redact-secret a local unreleased build');
}
for (const id of SETTINGS) { try { reports[id] = await readJson(`benchmarks/inputs/runtime/runtime-comparison-${id}.json`); } catch { /* not committed */ } }
let snapshot;
try { snapshot = await readJson('benchmarks/inputs/runtime/peer-pii-runtime-throughput.json'); } catch { /* not committed */ }
const cells = html => [...html.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].map(m => ({ outcome: /data-outcome="([^"]+)"/.exec(m[1])?.[1], text: text(m[1]).trim() }));
const rowsOf = html => [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map(m => ({ label: text(/<th\b[^>]*>([\s\S]*?)<\/th>/.exec(m[1])?.[1] ?? '').trim(), cells: cells(m[1]) })).filter(r => r.label);
const panelChunk = key => runtimeHtml.split('data-key="').find(chunk => chunk.startsWith(`${key}"`));

if (Object.keys(reports).length) {
  // Outcomes and times are recomputed here from the committed reports and the plan, never through web/resolvers.
  const outcomeOf = (report, tool, workload, i) => {
    const rec = report.outcomes.find(o => o.tool === tool && o.workload === workload.id).lines[i];
    const line = workload.lines[i];
    if (!rec.changed && tool === 'redact-secret' && line.values.every(v => v.family && !report.setting.families.includes(v.family))) return 'not-applicable';
    return rec.valuesHidden === line.values.length ? 'replaced' : rec.valuesHidden > 0 || rec.changed ? 'partial' : 'unchanged';
  };
  const hiddenOf = (report, tool, workload) => {
    const total = workload.lines.reduce((n, l) => n + l.values.length, 0);
    const hidden = report.outcomes.find(o => o.tool === tool && o.workload === workload.id).lines.reduce((n, l) => n + l.valuesHidden, 0);
    return { percent: `${Math.round((hidden / total) * 100)}%`, count: `${hidden.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}` };
  };
  // [analysis, domain, columns]: a column is a tool measured in one setting's report.
  const libs = setting => ['redact-secret', 'flare-redact', 'openredaction'].map(tool => ({ tool, setting }));
  const PANELS = [
    ['external', 'pii', libs('pii-global')],
    ['internal', 'pii', SETTINGS.map(setting => ({ tool: 'redact-secret', setting }))],
    ['internal', 'credentials', SETTINGS.map(setting => ({ tool: 'redact-secret', setting }))],
    ['external', 'credentials', libs('default')],
  ];
  let checkedQuestions = 0;
  for (const [analysis, domain, columns] of PANELS) {
    const needed = [...new Set(columns.map(c => c.setting))];
    const workloads = plan2.workloads.filter(w => w.domain === domain);
    for (const view of ['all', 'speed', 'accuracy']) {
      const key = `${analysis}-${domain}-${view}`;
      if (needed.some(s => !reports[s])) {
        if (!panelChunk(`${analysis}-${domain}`) || !text(panelChunk(`${analysis}-${domain}`)).includes('Not measured yet')) fail(`/comparison/runtime/ panel ${analysis}-${domain} lacks a snapshot and must say "Not measured yet"`);
        break;
      }
      const chunk = panelChunk(key);
      if (!chunk) { fail(`/comparison/runtime/ has no panel for ${key}`); continue; }
      if (!chunk.includes('aria-label="Outcome key"')) fail(`/comparison/runtime/ ${key} has no outcome key`);
      for (const workload of workloads) {
        const section = chunk.split('<section').find(part => part.includes(`id="${key}-${workload.id}-h"`));
        if (!section) { fail(`/comparison/runtime/ ${key} has no question for ${workload.id}`); continue; }
        checkedQuestions++;
        const rows = rowsOf(section);
        if (view !== 'accuracy') {
          const timeRow = rows.find(r => r.label.startsWith('Usual time')), speed = rows.find(r => r.label.startsWith('Speed'));
          columns.forEach((c, i) => {
            const o = reports[c.setting].observations.find(x => x.tool === c.tool && x.workload === workload.id);
            if (timeRow?.cells[i]?.text !== ms(o.summary.medianMs)) fail(`/comparison/runtime/ ${key} ${workload.id}: ${c.tool} in ${c.setting} shows ${timeRow?.cells[i]?.text} ms, the snapshot says ${ms(o.summary.medianMs)}`);
            if (speed?.cells[i]?.text !== mbs(o.summary.medianBytesPerSecond)) fail(`/comparison/runtime/ ${key} ${workload.id}: ${c.tool} in ${c.setting} shows ${speed?.cells[i]?.text} MB/s, the snapshot says ${mbs(o.summary.medianBytesPerSecond)}`);
          });
        }
        if (view !== 'speed') {
          workload.lines.forEach(line => {
            const row = rows.find(r => r.label === line.label);
            const index = workload.lines.indexOf(line);
            if (!row) { fail(`/comparison/runtime/ ${key} ${workload.id} has no row "${line.label}"`); return; }
            columns.forEach((c, i) => {
              const want = outcomeOf(reports[c.setting], c.tool, workload, index);
              if (row.cells[i]?.outcome !== want) fail(`/comparison/runtime/ ${key} ${workload.id} "${line.label}": ${c.tool} in ${c.setting} shows ${row.cells[i]?.outcome}, the snapshot records ${want}`);
            });
          });
          const hiddenRow = rows.find(r => r.label === 'Hidden');
          columns.forEach((c, i) => {
            const want = hiddenOf(reports[c.setting], c.tool, workload);
            if (hiddenRow?.cells[i]?.text.replace(/\s+/g, '') !== `${want.percent}${want.count}`.replace(/\s+/g, '')) fail(`/comparison/runtime/ ${key} ${workload.id}: ${c.tool} in ${c.setting} shows hidden "${hiddenRow?.cells[i]?.text}", the snapshot says ${want.percent} ${want.count}`);
          });
        }
      }
    }
  }
  const newest = Object.values(reports).map(r => r.generatedAt).sort().at(-1);
  const pii = reports['pii-global'] ?? Object.values(reports)[0];
  for (const t of pii.tools) if (!runtimePage.includes(t.version)) fail(`/comparison/runtime/ does not state ${t.id} ${t.version}`);
  if (!runtimePage.includes(newest.slice(0, 10))) fail('/comparison/runtime/ does not state the run date');
  checkBuildChip(pii);
  const measuredTexts = new Set(Object.values(reports).flatMap(r => r.observations.map(o => o.workload))).size;
  if (!hub.includes(newest.slice(0, 10)) || !hub.includes(`${measuredTexts} test texts`)) fail('/comparison/ does not state the runtime run date and test-text count');
  if (!checkedQuestions) fail('/comparison/runtime/: no measured question was checked against the snapshots');
} else if (!snapshot) {
  if (!runtimePage.includes('Not measured yet')) fail('/comparison/runtime/ has no snapshot to read and must say "Not measured yet"');
} else {
  for (const o of snapshot.observations) {
    const times = new RegExp(`Usual time\\s*ms[\\s\\S]*?${ms(o.summary.medianMs).replace(/[.,]/g, m => `\\${m}`)}\\b`);
    if (!times.test(runtimePage)) fail(`/comparison/runtime/ does not state ${ms(o.summary.medianMs)} ms for ${o.tool} on ${o.workload}`);
    if (!runtimePage.includes(mbs(o.summary.medianBytesPerSecond))) fail(`/comparison/runtime/ does not state ${mbs(o.summary.medianBytesPerSecond)} MB/s for ${o.tool} on ${o.workload}`);
  }
  for (const t of snapshot.tools) if (!runtimePage.includes(t.version)) fail(`/comparison/runtime/ does not state ${t.id} ${t.version}`);
  if (!runtimePage.includes(snapshot.generatedAt.slice(0, 10))) fail('/comparison/runtime/ does not state the run date');
  checkBuildChip(snapshot);
  if (!hub.includes(snapshot.generatedAt.slice(0, 10)) || !hub.includes(`${new Set(snapshot.observations.map(o => o.workload)).size} test texts`)) fail('/comparison/ does not state the runtime run date and test-text count');
}
// A panel with a measurement has one panel per view, keyed analysis-domain-view; one without has a single panel, keyed analysis-domain.
for (const key of ['external-pii', 'internal-pii', 'internal-credentials', 'external-credentials']) {
  if (!runtimeHtml.includes(`data-key="${key}"`) && !runtimeHtml.includes(`data-key="${key}-all"`)) fail(`/comparison/runtime/ has no panel for ${key}`);
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
console.log(`static export ok: ${ROUTES.length} routes, ${taxonomy.families.length} family pages, report numbers match the ledger (or, under authority new, the view), under ${basePath}/, layer order first, MUI in @layer mui`);
