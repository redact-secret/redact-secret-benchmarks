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
  if (/pin-manifest|evidence\/429|evidence\/562|runtime-comparison-v2|feature-claims|peer-pii-runtime|support\/taxonomy|public\/results|results\/summary|known-gaps|fixture-index|summary\.json/.test(text)) fail(`${path.relative(out, file)} names a ledger file: ledger data must be read at build time only`);
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
const SETTINGS = ['default', 'pii-global', 'pii-global-us'];
const plan2 = await readJson('qualification/runtime-comparison-v2.json');
const reports = {};
for (const id of SETTINGS) { try { reports[id] = await readJson(`evidence/562/runtime-comparison-${id}.json`); } catch { /* not committed */ } }
let snapshot;
try { snapshot = await readJson('evidence/429/peer-pii-runtime-throughput.json'); } catch { /* not committed */ }
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
  if (!runtimePage.includes('local build · unreleased')) fail('/comparison/runtime/ does not state that redact-secret was a local unreleased build');
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
  if (!runtimePage.includes('local build · unreleased')) fail('/comparison/runtime/ does not state that redact-secret was a local unreleased build');
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
}
if (summary && !/Accuracy · \d{4}-\d{2}-\d{2} · (published|candidate) ·/.test(hub)) fail('/comparison/ does not state the accuracy run date and mode');

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`static export ok: ${ROUTES.length} routes, ${taxonomy.families.length} family pages, report numbers match the ledger, under ${basePath}/, layer order first, MUI in @layer mui`);
