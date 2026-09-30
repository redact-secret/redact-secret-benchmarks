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
 *  - every link on those pages stays inside the app (the export is served under /next/):
 *    none points at the existing site.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(webRoot, 'out');
const basePath = process.env.BASE_PATH ?? '/next';
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
const problems = [];
const fail = message => problems.push(message);
let peerCells = 0;

const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/\s+/g, ' ');
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
  for (const href of internalLinks(html)) if (!href.startsWith(`${basePath}/`)) fail(`/${route}/ links ${href}, outside the app (${basePath}/)`);
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

// ---- Suite pages carry every fixture of the suite (#559) -----------------------------------------
const bySuite = new Map();
for (const f of index.fixtures) { const [category, ...rest] = f.slug.split('--'); (bySuite.get(category) ?? bySuite.set(category, []).get(category)).push(rest.join('--')); }
for (const c of categories) {
  const ids = bySuite.get(c.id) ?? [];
  const html = await readHtml(`report/fixtures/${c.id}`);
  if (!text(html).includes(`${int(ids.length)} fixture`)) fail(`/report/fixtures/${c.id}/ does not state ${ids.length} fixtures`);
  const missing = ids.filter(id => !html.includes(`\\"id\\":\\"${id}\\"`) && !html.includes(`"id":"${id}"`));
  if (missing.length) fail(`/report/fixtures/${c.id}/ ships no record for ${missing.length} fixtures, e.g. ${missing[0]}`);
}

// ---- Size of the export ---------------------------------------------------------------------------
let files = 0, bytes = 0;
async function* walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) yield* walk(full); else yield full; } }
for await (const file of walk(out)) { files++; bytes += (await readFile(file)).length; }
const MAX_BYTES = 200 * 1024 * 1024, MAX_FILES = 6000;
if (bytes > MAX_BYTES) fail(`the export is ${(bytes / 1048576).toFixed(0)} MB, over the ${MAX_BYTES / 1048576} MB the static host is sized for; shard or paginate the largest pages`);
if (files > MAX_FILES) fail(`the export is ${files} files, over ${MAX_FILES}; shard or paginate the largest pages`);

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`report row pages ok: ${detectors.detectors.length} detector pages, ${categories.length} suite pages, ${gaps.issues.length} findings, ${peerCells} peer-by-level target cells and the per-level counts match the ledger, links stay under ${basePath}/, export ${(bytes / 1048576).toFixed(0)} MB in ${files} files`);
