/**
 * Post-build checks on the report pages added in #558, #559 and #560, run by
 * `npm run check:routes` after `check-export.mjs`. Every expected value is read here,
 * from the committed ledger files and the run, independently of web/services and
 * web/resolvers, and compared with what the built pages say:
 *
 *  - the peer section's three "rules target" columns for every peer at every level (#558):
 *    inputs targeted, spans left readable on them and elsewhere, recounted from each
 *    scanner's rows and `scanners/peer-rule-families.json`;
 *  - the per-level family and provider counts (#560): the level control's option labels
 *    on the lists and on a family page, recounted from the rows' tiers and the index;
 *  - the rows, suite, detector and findings pages (#559): every route exists, states its
 *    counts, and every figure links to its rows;
 *  - every link on those pages stays inside the app (the export is the site root): every
 *    internal link names a page or file of the export, so none points at a legacy route;
 *  - the build-emitted data files (web/app/data/): exactly the files the pages ask for, each
 *    holding the rows or records the ledger has (ids, scanner columns, outcome words, flags, levels,
 *    corpus bytes and expected spans), and the first page in each table's HTML is the first page of
 *    its file (docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md);
 *  - what a visitor downloads: the largest data file (one fetch), the largest page and the largest rows
 *    page each stay under a limit. The export's total size and file count are printed, never judged:
 *    the site is static and no host limit applies to them (docs/decisions/2026-10-01-test-the-web-app-with-vitest-and-playwright.md).
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readAuthority } from './lib/authority.mjs';
import { linkResolves } from './lib/links.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(webRoot, 'out');
const basePath = process.env.BASE_PATH ?? '';
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
// Under authority `new` the same pages are built from the qualification view and recounted by check-export-credential.mjs.
if ((await readAuthority(repoRoot)) === 'new') {
  console.log('report row pages: the authority is new, so check-export-credential.mjs recounts them against the qualification view');
  process.exit(0);
}
const problems = [];
const fail = message => problems.push(message);
let peerCells = 0;

const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const int = n => n.toLocaleString('en-US');
const readHtml = async route => { try { return await readFile(path.join(out, route, 'index.html'), 'utf8'); } catch { fail(`missing page /${route}/`); return ''; } };
const slugOf = id => id.replace(':', '--');
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const [taxonomy, index, detectors, assignments, gaps, peerMap, registry, inventory] = await Promise.all([
  readJson('benchmarks/support/taxonomy.json'), readJson('benchmarks/fixture-index.json'), readJson('benchmarks/detectors.json'),
  readJson('benchmarks/fixture-detectors.json'), readJson('benchmarks/known-gaps.json'),
  readJson('scanners/peer-rule-families.json'), readJson('scanners/peer-registry.json'), readJson('benchmarks/detector-inventory.json'),
]);
const familiesOf = new Map(index.fixtures.map(f => [f.slug, f.familyIds]));

// ---- The run, read from the suite reports -------------------------------------------------
let run;
try { run = await readJson('public/results/run.json'); } catch { /* no run */ }
const rowsByScanner = new Map(); // scanner id -> Map(slug -> row with kind and tier)
const tierOf = new Map();
if (run) {
  for (const category of run.categories) {
    const report = await readJson(`public/results/${category}.json`);
    if (report.runId !== run.runId) continue;
    for (const scanner of report.scanners) {
      if (scanner.status !== 'complete') continue;
      const held = rowsByScanner.get(scanner.id) ?? rowsByScanner.set(scanner.id, new Map()).get(scanner.id);
      for (const row of scanner.rows ?? []) { held.set(`${category}--${row.id}`, row); tierOf.set(`${category}--${row.id}`, { kind: row.kind, tier: row.tier }); }
    }
  }
}

// ---- Routes ------------------------------------------------------------------------------------
for (const route of ['report/detectors', 'report/findings', 'report/fixtures', 'report/rows/T1', 'report/rows/T2', 'report/rows/T3']) {
  const html = await readHtml(route);
  if (html && !/<h1[\s>]/.test(html)) fail(`/${route}/ has no <h1>`);
}
for (const d of detectors.detectors) await readHtml(`report/detectors/${d.id}`).then(html => { if (html && !text(html).includes(d.title)) fail(`/report/detectors/${d.id}/ does not name ${d.title}`); });
const categories = (await readJson('benchmarks/categories.json')).filter(c => !c.calibrationOnly);
for (const c of categories) await readHtml(`report/fixtures/${c.id}`);

// ---- Hub: the Detectors tile is back and every link stays inside the app --------------------
const hubHtml = await readHtml('report');
const hubText = text(hubHtml);
const withDetectors = new Set(Object.values(assignments).flat());
if (!hubText.includes(`${int(detectors.detectors.length)} detectors`)) fail(`/report/ does not state ${detectors.detectors.length} detectors`);
if (!hubHtml.includes(`href="${basePath}/report/detectors/"`)) fail('/report/ has no Detectors tile linking to /report/detectors/');
if (!hubHtml.includes(`href="${basePath}/report/findings/"`)) fail('/report/ does not link its findings inside the app');
if (!hubText.includes(`${int(Object.keys(assignments).filter(slug => assignments[slug].length).length)} fixtures exercise`) && withDetectors.size) fail('/report/ does not state how many fixtures exercise a detector');

const internalLinks = html => [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map(m => m[1]).filter(h => h.startsWith('/'));
const linkPages = ['report', 'report/detectors', 'report/findings', 'report/fixtures', 'report/rows/T1', 'report/providers', 'report/families', `report/families/${slugOf(taxonomy.families[0].id)}`, `report/detectors/${detectors.detectors[0].id}`, `report/fixtures/${categories[0].id}`];
for (const route of linkPages) {
  const html = await readHtml(route);
  for (const href of internalLinks(html)) if (!(await linkResolves(path.join(webRoot, 'out'), basePath, href))) fail(`/${route}/ links ${href}, which is not a page or file of the export`);
}

if (run) {
  // ---- The three answers link to the rows behind them (#559) -------------------------------------
  const summary = await readJson('public/results/summary.json');
  const mine = summary.overall['redact-secret'];
  for (const level of ['T1', 'T2', 'T3']) {
    const leakKey = level === 'T3' ? 'policy/T3' : `must-redact/${level}`;
    const base = `${basePath}/report/rows/${level}/`;
    if (mine[leakKey] && !hubHtml.includes(`href="${base}?show=leaked"`)) fail(`/report/ does not link the ${level} leak figure to ${base}?show=leaked`);
    if (mine[`must-not-flag/${level}`] && !hubHtml.includes(`href="${base}?show=flagged"`)) fail(`/report/ does not link the ${level} false-alarm figure to ${base}?show=flagged`);
  }

  // ---- Level rows pages carry their counts -------------------------------------------------------
  for (const level of ['T1', 'T2', 'T3']) {
    const rows = [...tierOf.values()].filter(r => r.tier === level).length;
    const t = text(await readHtml(`report/rows/${level}`));
    if (!t.includes(`${int(rows)} rows`)) fail(`/report/rows/${level}/ does not state ${int(rows)} rows`);
    if (!t.includes('Every scanner')) fail(`/report/rows/${level}/ has no per-scanner columns control`);
  }

  // ---- Peer columns: what each scanner's own rules target (#558) ---------------------------------
  const levels = { T1: ['must-redact', 'T1'], T2: ['must-redact', 'T2'], T3: ['policy', 'T3'] };
  const reportText = hubText;
  for (const [peerId, set] of Object.entries(peerMap.scanners)) {
    const rows = rowsByScanner.get(peerId);
    const scanner = summary.scanners.find(s => s.id === peerId);
    if (!rows || !scanner) continue;
    const targeted = new Set(Object.values(set.rules).flatMap(r => r.families));
    for (const [level, [kind, tier]] of Object.entries(levels)) {
      const inputs = [...tierOf.entries()].filter(([, v]) => v.kind === kind && v.tier === tier).map(([slug]) => slug);
      const split = { hit: { n: 0, spans: 0, leaked: 0 }, other: { n: 0, spans: 0, leaked: 0 } };
      for (const slug of inputs) {
        const row = rows.get(slug);
        const bucket = (familiesOf.get(slug) ?? []).some(f => targeted.has(f)) ? split.hit : split.other;
        bucket.n++; bucket.spans += row.spanOutcomes.length; bucket.leaked += row.spanOutcomes.filter(o => o === 'PARTIAL' || o === 'MISS').length;
      }
      const group = summary.overall[peerId][levels[level].join('/')];
      if (group && (split.hit.spans + split.other.spans !== group.spans || split.hit.leaked + split.other.leaked !== group.leakedSpans)) { fail(`${peerId} ${level}: the recount from rows (${split.hit.spans + split.other.spans} spans, ${split.hit.leaked} + ${split.other.leaked} leaked) does not match the summary (${group.spans}, ${group.leakedSpans})`); continue; }
      const name = `${scanner.name} ${scanner.version}`;
      const row = new RegExp(`${escapeRe(name)}[\\s\\S]{0,900}?${escapeRe(int(split.hit.n))} of ${escapeRe(int(inputs.length))}[\\s\\S]{0,400}?${escapeRe(int(split.hit.leaked))} of ${escapeRe(int(split.hit.spans))} spans[\\s\\S]{0,400}?${escapeRe(int(split.other.leaked))} of ${escapeRe(int(split.other.spans))} spans`);
      peerCells++;
      if (!row.test(reportText)) fail(`/report/ does not state, for ${name} at ${level}, ${split.hit.n} of ${inputs.length} inputs targeted, ${split.hit.leaked} of ${split.hit.spans} spans left readable there and ${split.other.leaked} of ${split.other.spans} elsewhere`);
    }
    if (!reportText.includes(`${int(Object.keys(set.rules).length)} of its ${int(set.ruleCount)} rules target a credential family`)) fail(`/report/ does not state ${Object.keys(set.rules).length} of ${set.ruleCount} rules for ${peerId}`);
    if (!reportText.includes(registry.scanners[peerId].description)) fail(`/report/ does not state the registry description of ${peerId}`);
  }
  if (!reportText.includes('Inputs its rules target')) fail('/report/ does not show the "Inputs its rules target" column');

  // ---- Per-level family and provider counts (#560) -----------------------------------------------
  const perLevel = level => {
    const byFamily = new Map();
    for (const f of index.fixtures) {
      const tier = tierOf.get(f.slug)?.tier;
      if (level !== 'all' && tier !== level) continue;
      for (const id of f.familyIds) byFamily.set(id, (byFamily.get(id) ?? 0) + 1);
    }
    return byFamily;
  };
  const labels = { T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy', T0: 'Pending review' };
  const familiesText = text(await readHtml('report/families'));
  const providersText = text(await readHtml('report/providers'));
  for (const level of ['T1', 'T2', 'T3', 'T0']) {
    const byFamily = perLevel(level);
    const families = taxonomy.families.filter(f => byFamily.has(f.id)).length;
    const providers = taxonomy.providers.filter(p => taxonomy.families.some(f => f.provider === p.id && byFamily.has(f.id))).length + (taxonomy.families.some(f => f.provider === null && byFamily.has(f.id)) ? 1 : 0);
    if (!familiesText.includes(`${labels[level]} · ${families} ${families === 1 ? 'family' : 'families'}`)) fail(`/report/families/ does not offer ${labels[level]} with ${families} families`);
    // The provider list counts the group for families no provider owns as a provider of its own.
    const providerLabel = new RegExp(`${labels[level]} · (\\d+) providers?`).exec(providersText);
    const known = taxonomy.providers.filter(p => taxonomy.families.some(f => f.provider === p.id && byFamily.has(f.id))).length;
    if (!providerLabel || Number(providerLabel[1]) !== known) fail(`/report/providers/ does not offer ${labels[level]} with ${known} providers (found ${providerLabel?.[1]}); ${providers} counts the generic group`);
  }
  // A family page offers its levels with the row counts the index and the rows give.
  const all = perLevel('all');
  const multi = taxonomy.families.find(f => ['T1', 'T2', 'T3'].filter(l => (perLevel(l).get(f.id) ?? 0) > 0).length >= 2);
  if (multi) {
    const html = text(await readHtml(`report/families/${slugOf(multi.id)}`));
    if (!html.includes(`All levels (${int(all.get(multi.id))})`)) fail(`family page ${multi.id} does not offer "All levels (${all.get(multi.id)})"`);
    for (const level of ['T1', 'T2', 'T3']) {
      const n = perLevel(level).get(multi.id) ?? 0;
      if (n > 0 && !html.includes(`${labels[level]} (${int(n)})`)) fail(`family page ${multi.id} does not offer ${labels[level]} with ${n} rows`);
    }
  }
}

// ---- Detector pages state their fixture counts (#559) -----------------------------------------
const perDetector = new Map();
for (const ids of Object.values(assignments)) for (const id of ids) perDetector.set(id, (perDetector.get(id) ?? 0) + 1);
for (const d of detectors.detectors.slice(0, 12)) {
  const n = perDetector.get(d.id) ?? 0;
  const t = text(await readHtml(`report/detectors/${d.id}`));
  if (!t.includes(`${int(n)} fixture`)) fail(`/report/detectors/${d.id}/ does not state ${n} fixtures`);
}
const detectorsText = text(await readHtml('report/detectors'));
if (!detectorsText.includes(`${int(detectors.detectors.length)} detectors`)) fail(`/report/detectors/ does not state ${detectors.detectors.length} detectors`);

// ---- Findings inventory ---------------------------------------------------------------------------
const findingsHtml = await readHtml('report/findings');
const findingsText = text(findingsHtml);
if (!findingsText.includes(`${int(gaps.issues.length)} findings`)) fail(`/report/findings/ does not state ${gaps.issues.length} findings`);
for (const issue of gaps.issues) if (!findingsText.includes(`#${issue.number}`)) fail(`/report/findings/ does not list #${issue.number}`);
const known = new Set(index.fixtures.map(f => f.slug));
for (const issue of gaps.issues) for (const slug of issue.fixtures) {
  const [category, ...rest] = slug.split('--');
  const linked = findingsHtml.includes(`href="${basePath}/report/fixtures/${category}/?fixture=${encodeURIComponent(rest.join('--'))}"`);
  if (known.has(slug) && !linked) fail(`/report/findings/ does not link ${slug} to its fixture page`);
  if (!known.has(slug) && linked) fail(`/report/findings/ links ${slug}, which the corpus does not hold`);
}

// ---- The build-emitted data files match the ledger (fetch decision) -------------------------------
// A table with more rows than one page ships its first page in the page and every row in
// data/rows/<kind>/<id>/rows.json; a suite ships data/fixtures/<suite>/records.json. The expected
// tables and records are recomputed here from the index, the assignments, the corpora and the run,
// never through web/resolvers, and compared with the files and with the first page in the HTML.
import assert from 'node:assert/strict';

const PAGE = 50; // resolvers/filters.ts PAGE_SIZE
// The same pattern as web/lib/data-paths.ts (tests/web-conventions.test.mjs keeps the two equal).
const DATA_PATH = /^(?:rows\/(?:level|family|suite|detector)\/[a-z0-9][a-z0-9._-]*\/rows|fixtures\/[a-z0-9][a-z0-9._-]*\/records|comparison\/accuracy\/differences|evaluation\/(?:twin|benign|metamorphic|mutation|differential)\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/(?:fail|review-required|complete)\/checks)\.json$/i;
const dataRoot = path.join(out, 'data');
const emitted = new Set();
try {
  for await (const file of walk(dataRoot)) emitted.add(path.relative(dataRoot, file).split(path.sep).join('/'));
} catch { fail('the export has no data/ folder: rows and records files are missing'); }
for (const file of emitted) if (!DATA_PATH.test(file)) fail(`data/${file} is not a path the browser may request (lib/data-paths.ts)`);

const summaryForData = run ? await readJson('public/results/summary.json') : undefined;
const scannerIds = summaryForData ? summaryForData.scanners.map(s => s.id) : ['redact-secret'];
const scannerNames = summaryForData ? summaryForData.scanners.map(s => s.name) : ['redact-secret'];
const slugsOfSuite = new Map();
for (const f of index.fixtures) (slugsOfSuite.get(f.source.categoryId) ?? slugsOfSuite.set(f.source.categoryId, []).get(f.source.categoryId)).push(f.slug);

/** Every rows table of the site: where its page is, its data path and the fixtures it must hold. */
const tables = [];
for (const f of taxonomy.families) tables.push({ kind: 'family', id: slugOf(f.id), page: `report/families/${slugOf(f.id)}`, slugs: index.fixtures.filter(x => x.familyIds.includes(f.id)).map(x => x.slug) });
for (const c of categories) tables.push({ kind: 'suite', id: c.id, page: `report/fixtures/${c.id}`, slugs: slugsOfSuite.get(c.id) ?? [] });
for (const d of detectors.detectors) tables.push({ kind: 'detector', id: d.id, page: `report/detectors/${d.id}`, slugs: Object.entries(assignments).filter(([, ids]) => ids.includes(d.id)).map(([slug]) => slug) });
if (run) for (const level of ['T1', 'T2', 'T3']) tables.push({ kind: 'level', id: level, page: `report/rows/${level}`, slugs: [...tierOf.entries()].filter(([, v]) => v.tier === level).map(([slug]) => slug) });

const wanted = new Set([...tables.filter(t => t.slugs.length > PAGE).map(t => `rows/${t.kind}/${t.id}/rows.json`), ...categories.map(c => `fixtures/${c.id}/records.json`), 'comparison/accuracy/differences.json' /* /comparison/accuracy (#570); its content is checked by check-export-accuracy.mjs */]);
// The lists behind the method counts (#623): which files must exist, and what each holds, is recounted from the evaluation by check-export-method-checks.mjs.
for (const file of emitted) if (file.startsWith('evaluation/') && DATA_PATH.test(file)) wanted.add(file);
for (const file of wanted) if (!emitted.has(file)) fail(`data/${file} is missing from the export`);
for (const file of emitted) if (!wanted.has(file)) fail(`data/${file} is emitted but no page asks for it (a table that fits one page ships whole)`);

// The packed row of the records files (resolvers/fixtures.ts packRow), written out again here from the run's own fields.
const LETTER = { EXACT: 'E', COVERED: 'C', OVERBROAD: 'O', PARTIAL: 'P', MISS: 'M' };
const packRow = row => [
  row.spanOutcomes ? row.spanOutcomes.map(o => LETTER[o]).join('') || '=' : '-',
  row.flagged == null ? '-' : row.flagged ? '1' : '0',
  (row.actual ?? []).map(r => `${r.start}-${r.end}`).join(','),
  row.leakedBytes ?? '', row.collateralBytes ?? '', row.findings ?? '',
].join('|');

const labelOf = row => (!row ? 'Not measured'
  : row.spanOutcomes ? (row.spanOutcomes.some(o => o === 'PARTIAL' || o === 'MISS') ? 'Left readable' : row.spanOutcomes.includes('OVERBROAD') ? 'Too much' : 'Redacted')
  : row.flagged != null ? (row.flagged ? 'Flagged' : 'Quiet') : 'Unscored');
/** The fixtures linked from a page's rows table, in order: "suite--id". */
const linkedRows = html => {
  const caption = /<caption[^>]*>Fixtures in [^<]*<\/caption>/.exec(html);
  if (!caption) return null;
  const start = html.indexOf('<tbody', caption.index);
  const body = html.slice(start, html.indexOf('</tbody>', start));
  return [...body.matchAll(/href="[^"]*\/report\/fixtures\/([^/"]+)\/\?fixture=([^"]+)"/g)].map(m => `${m[1]}--${decodeURIComponent(m[2])}`);
};

let dataRows = 0, dataFiles = 0;
const indexBySlug = new Map(index.fixtures.map(f => [f.slug, f]));
const scenarioTitles = new Map((await readJson('benchmarks/scenarios.json')).scenarios.map(x => [x.id, x.title]));
for (const table of tables) {
  const where = `/${table.page}/`;
  const html = await readHtml(table.page);
  const linked = linkedRows(html);
  if (table.slugs.length === 0) continue;
  if (!linked) { fail(`${where} shows no rows table for its ${table.slugs.length} fixtures`); continue; }
  if (table.slugs.length <= PAGE) {
    if (linked.length !== table.slugs.length || !table.slugs.every(s => linked.includes(s))) fail(`${where} must list all ${table.slugs.length} of its fixtures in its page (it ships whole), it links ${linked.length}`);
    if (html.includes('rows.json')) fail(`${where} names a rows file but fits one page`);
    continue;
  }
  const file = `rows/${table.kind}/${table.id}/rows.json`;
  if (!html.includes(file)) fail(`${where} does not name its rows file ${file}`);
  let data;
  try { data = JSON.parse(await readFile(path.join(dataRoot, file), 'utf8')); } catch { fail(`data/${file} is not readable JSON`); continue; }
  dataFiles++;
  if (!Array.isArray(data.items) || !Array.isArray(data.statuses) || !Array.isArray(data.dictionary) || !Array.isArray(data.scanners)) { fail(`data/${file} is not a rows table`); continue; }
  dataRows += data.items.length;
  const held = data.items.map(item => `${item.c}--${item.i}`);
  if (held.length !== table.slugs.length || new Set(held).size !== held.length || !table.slugs.every(s => held.includes(s))) fail(`data/${file} holds ${held.length} rows, the ledger has ${table.slugs.length} fixtures for it`);
  if (JSON.stringify(data.scanners.map(s => s.id)) !== JSON.stringify(scannerIds) || JSON.stringify(data.scanners.map(s => s.name)) !== JSON.stringify(scannerNames)) fail(`data/${file} has scanner columns ${data.scanners.map(s => s.id)}, the run lists ${scannerIds}`);
  if (JSON.stringify(linked) !== JSON.stringify(held.slice(0, PAGE))) fail(`${where} first page is not the first ${PAGE} rows of data/${file}`);
  // Each outcome word and the flags the filters read are recomputed from the run's rows.
  let wrong = 0;
  for (const item of data.items) {
    const slug = `${item.c}--${item.i}`;
    if (item.o.length !== data.scanners.length) { wrong++; continue; }
    data.scanners.forEach((s, k) => { if (data.statuses[item.o[k]]?.label !== labelOf(rowsByScanner.get(s.id)?.get(slug))) wrong++; });
    const mine = rowsByScanner.get('redact-secret')?.get(slug);
    const leaked = !!mine?.spanOutcomes?.some(o => o === 'PARTIAL' || o === 'MISS');
    if (((item.f & 2) !== 0) !== leaked || ((item.f & 4) !== 0) !== (mine?.flagged === true)) wrong++;
    if (tierOf.has(slug) && item.l !== tierOf.get(slug).tier) wrong++;
  }
  if (wrong) fail(`data/${file}: ${wrong} outcome words, flags or levels disagree with the run`);
}

// A suite's records: every fixture with the corpus bytes and expected spans, one packed row per scanner.
const corpora = new Map();
for (const c of categories) {
  const slugs = slugsOfSuite.get(c.id) ?? [];
  const where = `data/fixtures/${c.id}/records.json`;
  let file;
  try { file = JSON.parse(await readFile(path.join(dataRoot, `fixtures/${c.id}/records.json`), 'utf8')); } catch { continue; }
  dataFiles++;
  if (!Array.isArray(file.records) || !file.shared) { fail(`${where} is not a records file`); continue; }
  const ids = file.records.map(r => `${c.id}--${r.id}`);
  if (ids.length !== slugs.length || !slugs.every(s => ids.includes(s))) fail(`${where} holds ${ids.length} records, the suite has ${slugs.length} fixtures`);
  if (JSON.stringify(file.shared.scanners.map(s => s.id)) !== JSON.stringify(run ? scannerIds : [])) fail(`${where} has scanners ${file.shared.scanners.map(s => s.id)}, the run lists ${run ? scannerIds : []}`);
  const corpusPath = index.fixtures.find(f => f.source.categoryId === c.id)?.source.corpus;
  if (corpusPath && !corpora.has(corpusPath)) corpora.set(corpusPath, new Map((await readJson(corpusPath)).fixtures.map(f => [f.id, f])));
  let differs = 0;
  for (const record of file.records) {
    const source = corpora.get(corpusPath)?.get(record.id);
    try { assert.deepStrictEqual({ content: record.content, expected: record.expected }, { content: source?.content, expected: source?.expected }); } catch { differs++; }
    if (record.rows.length !== (run ? scannerIds.length : 0)) differs++;
    else if (run) record.rows.forEach((packed, k) => {
      const held = rowsByScanner.get(scannerIds[k])?.get(`${c.id}--${record.id}`);
      if ((packed === null) !== !held) differs++;
      // The fixture page shows these rows: every outcome, flag, range and byte count is recomputed from the run, not from the resolver.
      else if (held && packed !== packRow(held)) differs++;
    });
    // What the page says about the fixture (the file's hash, its group label, axis, scenarios, milestone, why no family owns it) is the corpus's and the index's.
    const slug = `${c.id}--${record.id}`;
    const entry = indexBySlug.get(slug);
    const sha = createHash('sha256').update(Buffer.from(source?.content ?? '', 'utf8')).digest('hex').slice(0, 12);
    const textOf = i => (i === undefined ? undefined : file.shared.texts?.[i]);
    const wantScenarios = (entry?.scenarioIds ?? []).map(id => scenarioTitles.get(id));
    const gotScenarios = (record.scenarios ?? []).map(i => file.shared.scenarios?.[i]?.title);
    if (record.sha !== sha || textOf(record.group) !== source?.group || textOf(record.axis) !== source?.contextAxis || textOf(record.action) !== source?.expectedAction
      || textOf(record.milestone) !== entry?.provenance?.milestone || textOf(record.unscoped) !== entry?.unscopedReason
      || JSON.stringify(gotScenarios) !== JSON.stringify(wantScenarios) || JSON.stringify(record.families) !== JSON.stringify(entry?.familyIds)) differs++;
  }
  if (differs) fail(`${where}: ${differs} records differ from the corpus bytes, expected spans, hashes, labels or the run's rows`);
  if (run && file.shared.run?.date !== summaryForData?.generatedAt?.slice(0, 10)) fail(`${where}: shared.run.date ${file.shared.run?.date} is not the run's date`);
  if (!run && file.shared.run) fail(`${where} names a run, but none was published`);
  const html = await readHtml(`report/fixtures/${c.id}`);
  if (!text(html).includes(`${int(slugs.length)} fixture`)) fail(`/report/fixtures/${c.id}/ does not state ${slugs.length} fixtures`);
  if (!html.includes(`fixtures/${c.id}/records.json`)) fail(`/report/fixtures/${c.id}/ does not name its records file`);
  if (html.includes('followUps')) fail(`/report/fixtures/${c.id}/ embeds fixture records; they belong in data/fixtures/${c.id}/records.json`);
}

// ---- Family pages (#589): research record, benchmark counts per level and per scanner, peer rules, sources -----
{
  const { parseFrontmatter } = await import('../../scripts/scaffold-dossiers.mjs');
  const { readdir: ls } = await import('node:fs/promises');
  const dossierDir = path.join(repoRoot, 'benchmarks/support/dossiers');
  const entries = new Map();
  for (const file of (await ls(dossierDir)).filter(f => f.endsWith('.md') && !f.startsWith('_') && f !== 'README.md')) {
    const body = await readFile(path.join(dossierDir, file), 'utf8');
    const parsed = parseFrontmatter(body);
    if (!parsed.data) { fail(`dossier ${file}: ${parsed.error}`); continue; }
    for (const f of parsed.data.families) entries.set(f.id, f.research);
  }
  const VERDICT = { unresearched: 'Not researched', ready: 'Ready', 'issuance-gated': 'Issuance-gated', 'date-gated': 'Date-gated', 'not-found': 'Not found', rejected: 'Rejected' };
  const TIER = { T0: 'Pending', T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy' };
  const summary = run ? await readJson('public/results/summary.json') : null;
  const mode = run ? (run.candidate ? 'candidate' : 'published') : null;
  const tally = (slugs, rows) => {
    const t = { n: slugs.length, left: 0, much: 0, alarm: 0, none: 0 };
    for (const slug of slugs) {
      const row = rows?.get(slug);
      if (!row) { t.none++; continue; }
      if (row.spanOutcomes?.some(o => o === 'PARTIAL' || o === 'MISS')) t.left++;
      if (row.spanOutcomes?.includes('OVERBROAD')) t.much++;
      if (row.flagged === true) t.alarm++;
    }
    return t;
  };
  const figures = t => (t.n > 0 && t.none === t.n ? '— — — —' : `${t.left} ${t.much} ${t.alarm}`) + (t.none ? ` ${t.none}` : '');
  let checked = 0;
  for (const family of taxonomy.families) {
    const slugs = index.fixtures.filter(x => x.familyIds.includes(family.id)).map(x => x.slug);
    const page = text(await readHtml(`report/families/${slugOf(family.id)}`)).replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    const where = `family page ${family.id}`;
    const research = entries.get(family.id);
    if (!research) { fail(`${where}: no dossier entry`); continue; }
    // The research record is the dossier's own frontmatter.
    const record = `Research ${VERDICT[research.verdict]} Evidence level ${research.tier ? `${research.tier} · ${TIER[research.tier]}` : 'Not recorded'} Researched ${research.researchedAt ?? 'Not recorded'}`;
    if (!page.includes(record)) fail(`${where} does not state its research record "${record}"`);
    for (const source of research.sources) if (!page.includes(new URL(source).host)) fail(`${where} does not list the dossier source ${source}`);
    for (const ref of research.issues) if (!page.includes(ref)) fail(`${where} does not list the research issue ${ref}`);
    // Peer rules: every rule the reviewed map names for the family, with its basis, and no other.
    const mapped = Object.entries(peerMap.scanners).flatMap(([id, set]) => Object.entries(set.rules).filter(([, r]) => r.families.includes(family.id)).map(([rule, r]) => ({ id, rule, basis: r.basis })));
    for (const m of mapped) if (!page.includes(`${m.rule} ${m.basis}`)) fail(`${where} does not list ${m.id} rule ${m.rule} with its basis`);
    if (!mapped.length && !page.includes('No peer rule maps to this family')) fail(`${where} has no peer rule and must say so`);
    // Benchmark: nothing measured for a family with no fixtures; otherwise every level and every scanner recounted.
    if (!slugs.length) {
      if (!page.includes('In this benchmark') || !page.includes('No fixtures in this family yet')) fail(`${where} has no fixtures and must say "Not measured"`);
      continue;
    }
    if (mode && !page.includes(`Counts are for redact-secret in ${mode} ·`)) fail(`${where} does not state the ${mode} mode`);
    const byTier = new Map();
    for (const x of index.fixtures.filter(f => f.familyIds.includes(family.id))) byTier.set(x.tier ?? tierOf.get(x.slug)?.tier, [...(byTier.get(x.tier ?? tierOf.get(x.slug)?.tier) ?? []), x.slug]);
    if (run && byTier.size > 1) {
      for (const [tier, group] of byTier) {
        const t = tally(group, rowsByScanner.get('redact-secret'));
        if (!page.includes(`${tier} ${({ T0: 'Pending review', T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy' })[tier]} ${group.length} ${figures(t)}`)) fail(`${where}: the ${tier} row does not match the run (${group.length} fixtures, ${figures(t)})`);
      }
    }
    if (run) {
      for (const s of summary.scanners) {
        const t = tally(slugs, rowsByScanner.get(s.id));
        if (!page.includes(` ${slugs.length} ${figures(t)} `) && !page.includes(` ${slugs.length} ${figures(t)}`)) fail(`${where}: ${s.name} counts do not match its rows (${slugs.length} fixtures, ${figures(t)})`);
      }
    }
    checked++;
  }
  console.log(`family pages ok: ${checked} with fixtures recounted per level and scanner from the run, research record, sources and peer rules from the dossiers and the rule map`);
}

// ---- What a visitor downloads: per-request and per-page limits. Totals are information only. --------
let files = 0, bytes = 0, dataBytes = 0, largestPage = { bytes: 0, file: '' }, largestData = { bytes: 0, file: '' }, largestTablePage = { bytes: 0, file: '' };
async function* walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) yield* walk(full); else yield full; } }
for await (const file of walk(out)) {
  const size = (await readFile(file)).length, rel = path.relative(out, file).split(path.sep).join('/');
  files++; bytes += size;
  if (rel.startsWith('data/')) { dataBytes += size; if (size > largestData.bytes) largestData = { bytes: size, file: rel }; }
  if (rel.endsWith('.html') && size > largestPage.bytes) largestPage = { bytes: size, file: rel };
  if (/^report\/(?:rows|fixtures|families|detectors)\/[^/]+(?:\/[^/]+)?\/index\.html$/.test(rel) && size > largestTablePage.bytes) largestTablePage = { bytes: size, file: rel };
}
const MB = 1048576;
const LIMIT = { dataFile: 2 * MB, page: 1.5 * MB, tablePage: 320 * 1024 };
if (largestData.bytes > LIMIT.dataFile) fail(`${largestData.file} is ${(largestData.bytes / MB).toFixed(1)} MB, over the ${LIMIT.dataFile / MB} MB a single fetch may cost`);
if (largestPage.bytes > LIMIT.page) fail(`${largestPage.file} is ${(largestPage.bytes / MB).toFixed(2)} MB, over the ${LIMIT.page / MB} MB a page may weigh`);
if (largestTablePage.bytes > LIMIT.tablePage) fail(`${largestTablePage.file} is ${(largestTablePage.bytes / 1024).toFixed(0)} KB, over the ${LIMIT.tablePage / 1024} KB a rows page may weigh: its rows belong in a data file`);

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`report row pages ok: ${detectors.detectors.length} detector pages, ${categories.length} suite pages, ${gaps.issues.length} findings, ${peerCells} peer-by-level target cells and the per-level counts match the ledger, ${dataFiles} data files (${dataRows.toLocaleString('en-US')} rows) match the run and the corpora, links stay under ${basePath}/, export ${(bytes / MB).toFixed(1)} MB in ${files} files, for information (data ${(dataBytes / MB).toFixed(1)} MB, largest page ${(largestPage.bytes / 1024).toFixed(0)} KB, largest table page ${(largestTablePage.bytes / 1024).toFixed(0)} KB)`);
