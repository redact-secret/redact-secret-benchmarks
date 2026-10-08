/**
 * Post-build checks on the credential report pages when the committed authority is `new` (#608), run by `npm run check:routes`
 * beside `check-export.mjs` and `check-export-rows.mjs`, which recount the same pages against the legacy files when the authority is
 * `legacy`. Exactly one of the two recounts applies to a build. Every expected value is read here, from the qualification view
 * (`public/results/qualification-v1.json`), the taxonomy and the detector registry, independently of web/services and web/resolvers,
 * and compared with what the built pages and data files say:
 *
 *  - every report page carries the stamp that names the pipeline (new, the authority) and the comparison page carries it too (#658)
 *    : no number is shown without the name of the pipeline behind it;
 *  - the hub, the level, family, provider, detector and suite pages state the counts recounted from the report population's cases
 *    (the population the population policy gives the floors and gates), and the three answers state the leaked, flagged and
 *    discriminated figures recounted from each case's own row;
 *  - the build-emitted data files hold exactly the rows and records the view has, with the bytes marked not recorded;
 *  - without a view (the normal state of a CI build) every page says there is none and no page shows a number from the legacy files.
 *
 * Nothing here is a ledger value written down: each number is recounted at run time from the view this checkout builds from.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAuthority, stampOf } from './lib/authority.mjs';
import { linkResolves } from './lib/links.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(webRoot, 'out');
const basePath = process.env.BASE_PATH ?? '';
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));

const authority = await readAuthority(repoRoot);
if (authority !== 'new') {
  console.log('credential pages: the authority is legacy, so check-export.mjs and check-export-rows.mjs recount them against the legacy files');
  process.exit(0);
}

const problems = [];
const fail = message => problems.push(message);
let summaryLine = '';
const text = html => html.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const int = n => n.toLocaleString('en-US');
const readHtml = async route => { try { return await readFile(path.join(out, route, 'index.html'), 'utf8'); } catch { fail(`missing page /${route}/`); return ''; } };
const slugOf = id => id.replace(':', '--');
async function* walk(dir) { for (const entry of await readdir(dir, { withFileTypes: true })) { const full = path.join(dir, entry.name); if (entry.isDirectory()) yield* walk(full); else yield full; } }

const [taxonomy, detectorRegistry, gaps] = await Promise.all([readJson('benchmarks/support/taxonomy.json'), readJson('benchmarks/detectors.json'), readJson('benchmarks/known-gaps.json')]);
let view;
try { view = await readJson('public/results/qualification-v1.json'); } catch { /* no view */ }

// Pages that show credential numbers: the stamp is on all of them.
const REPORT_PAGES = ['report', 'report/providers', 'report/families', 'report/detectors', 'report/fixtures', 'report/rows/T1', 'report/rows/T2', 'report/rows/T3'];
const stampProblem = (route, html, want) => {
  const stamp = stampOf(html);
  if (!stamp) fail(`/${route}/ carries no pipeline stamp`);
  else if (stamp.pipeline !== want.pipeline || stamp.role !== want.role) fail(`/${route}/ is stamped ${stamp.pipeline}/${stamp.role}, expected ${want.pipeline}/${want.role}`);
};

if (!view) {
  // ---- No view: every report page says so, shows no credential number, and names the new pipeline ------------------------
  for (const route of [...REPORT_PAGES, 'report/families/' + slugOf(taxonomy.families[0].id), `report/detectors/${detectorRegistry.detectors[0].id}`, 'report/fixtures/no-view', 'evaluation/credential']) {
    const html = await readHtml(route);
    if (!html) continue;
    stampProblem(route, html, { pipeline: 'new', role: 'authority' });
    if (route.startsWith('report') && !route.startsWith('report/families/') && !route.startsWith('report/detectors/') && !route.startsWith('report/fixtures/') && !text(html).includes('No qualification view for this build')) fail(`/${route}/ has no qualification view to read and must say so`);
    if (/Same [\d,]+ inputs for/.test(text(html))) fail(`/${route}/ states fixture counts for a scanner run but there is no view`);
  }
  if (process.env.WEB_REQUIRE_QUALIFICATION === '1') fail('WEB_REQUIRE_QUALIFICATION=1 but public/results/qualification-v1.json is absent: build the view before the web build');
} else {
  const report = view.populations.find(p => p.role === 'floors-and-gates');
  if (!report) { console.error('the view has no floors-and-gates population'); process.exit(1); }
  const cases = report.cases;
  const familyIds = new Set(taxonomy.families.map(f => f.id));
  const scanners = report.artifact.scanners.filter(s => s.status === 'complete').map(s => s.id);
  const resultOf = (c, scanner) => c.results.find(r => r.scanner === scanner);
  const familyOf = c => (c.family !== null && familyIds.has(c.family) ? c.family : null);
  const category = c => c.id.slice(0, c.id.indexOf('--') < 0 ? c.id.length : c.id.indexOf('--'));
  const idOf = c => c.id.slice(c.id.indexOf('--') < 0 ? 0 : c.id.indexOf('--') + 2);
  const leaked = o => o === 'PARTIAL' || o === 'MISS';

  // ---- Stamps ---------------------------------------------------------------------------------------------------------
  for (const route of [...REPORT_PAGES, `report/families/${slugOf(taxonomy.families[0].id)}`, `report/detectors/${[...new Set(cases.flatMap(c => c.detectors))].sort()[0]}`, `report/fixtures/${category(cases[0])}`, 'evaluation/credential']) {
    const html = await readHtml(route);
    if (html) stampProblem(route, html, { pipeline: 'new', role: 'authority' });
    if (html && route === 'report') {
      const t = text(html);
      if (!t.includes(report.population)) fail(`/report/ does not name the population ${report.population}`);
      if (!t.includes(report.artifact.semanticDigest.slice(0, 19))) fail('/report/ does not name the run it was built from');
      if (!t.includes(report.artifact.evidence.release.tag)) fail('/report/ does not name the evidence release');
    }
  }
  // The comparison page is built from the same official run (#658): the new pipeline, the authority; check-export-comparison.mjs recounts its figures.
  for (const route of ['comparison/accuracy']) {
    const html = await readHtml(route);
    if (html) stampProblem(route, html, { pipeline: 'new', role: 'authority' });
  }

  // ---- The hub: counts and the three answers, recounted from the cases -------------------------------------------------
  const hub = text(await readHtml('report'));
  const withFamily = new Set(cases.map(familyOf).filter(Boolean));
  const providersWithFixtures = taxonomy.providers.filter(p => taxonomy.families.some(f => f.provider === p.id && withFamily.has(f.id))).length;
  const detectorIds = [...new Set(cases.flatMap(c => c.detectors))].sort();
  if (!hub.includes(`${int(taxonomy.providers.length)} providers`) || !hub.includes(`${int(providersWithFixtures)} with fixtures`)) fail(`/report/ does not state ${taxonomy.providers.length} providers, ${providersWithFixtures} with fixtures`);
  if (!hub.includes(`${int(taxonomy.families.length)} families`) || !hub.includes(`${int(withFamily.size)} with fixtures`)) fail(`/report/ does not state ${taxonomy.families.length} families, ${withFamily.size} with fixtures`);
  if (!hub.includes(`${int(detectorIds.length)} detectors`) || !hub.includes(`${int(cases.filter(c => c.detectors.length).length)} fixtures exercise`)) fail(`/report/ does not state ${detectorIds.length} detectors and the fixtures that exercise them`);
  if (!hub.includes(`Same ${int(cases.length)} inputs for ${scanners.length} scanner`)) fail(`/report/ does not state ${cases.length} inputs for ${scanners.length} scanners`);
  if (!hub.includes(`All ${int(gaps.issues.length)} findings`)) fail(`/report/ does not state ${gaps.issues.length} findings`);
  if (!/Mode published ·/.test(hub)) fail('/report/ does not state its mode (published or candidate)');

  const byId = new Map(cases.map(c => [c.id, c]));
  const mine = c => resultOf(c, 'redact-secret');
  for (const level of ['T1', 'T2', 'T3']) {
    const positiveKind = level === 'T3' ? 'policy' : 'must-redact';
    const positives = cases.filter(c => c.kind === positiveKind && c.tier === level && mine(c)?.measurement === 'positive');
    const spans = positives.reduce((n, c) => n + mine(c).outcomes.length, 0);
    const leakedSpans = positives.reduce((n, c) => n + mine(c).outcomes.filter(leaked).length, 0);
    if (spans && !hub.includes(`${int(leakedSpans)} of ${int(spans)} secret spans leaked`)) fail(`/report/ does not state ${leakedSpans} of ${spans} spans leaked at ${level}`);
    const controls = cases.filter(c => c.kind === 'must-not-flag' && c.tier === level && mine(c)?.measurement === 'control');
    const flagged = controls.filter(c => mine(c).flagged).length;
    if (controls.length && !hub.includes(`${int(flagged)} of ${int(controls.length)} controls flagged`)) fail(`/report/ does not state ${flagged} of ${controls.length} controls flagged at ${level}`);
    let pairs = 0, discriminated = 0;
    for (const twin of cases) {
      if (!twin.twinOf || twin.tier === 'T0' || twin.kind !== 'must-not-flag') continue;
      const positive = byId.get(twin.twinOf);
      if (!positive || positive.kind === 'must-not-flag' || positive.tier === 'T0' || positive.kind !== positiveKind || positive.tier !== level) continue;
      const p = mine(positive), t = mine(twin);
      if (p?.measurement !== 'positive' || t?.measurement !== 'control') continue;
      pairs++;
      if (p.outcomes.every(o => o === 'EXACT' || o === 'COVERED') && !t.flagged) discriminated++;
    }
    if (pairs && discriminated !== undefined && !hub.includes(`${int(discriminated)} of ${int(pairs)} pairs discriminated`) && !hub.includes('Withheld')) fail(`/report/ does not state ${discriminated} of ${pairs} pairs discriminated at ${level}`);
    // Level rows page.
    const rowsText = text(await readHtml(`report/rows/${level}`));
    const rows = cases.filter(c => c.tier === level).length;
    if (!rowsText.includes(`${int(rows)} rows`)) fail(`/report/rows/${level}/ does not state ${int(rows)} rows`);
  }

  // ---- Providers, families, detectors, suites ----------------------------------------------------------------------------
  const perLevel = level => {
    const byFamily = new Map();
    for (const c of cases) { const f = familyOf(c); if (f && (level === 'all' || c.tier === level)) byFamily.set(f, (byFamily.get(f) ?? 0) + 1); }
    return byFamily;
  };
  const labels = { T1: 'Provider-documented', T2: 'Tool-corroborated', T3: 'Project policy', T0: 'Pending review' };
  const familiesText = text(await readHtml('report/families'));
  const providersText = text(await readHtml('report/providers'));
  if (!providersText.includes(`${int(taxonomy.providers.length)} providers`)) fail('/report/providers/ has the wrong provider count');
  if (!familiesText.includes(`${int(taxonomy.families.length)} families`)) fail('/report/families/ has the wrong family count');
  for (const level of ['T1', 'T2', 'T3', 'T0']) {
    const byFamily = perLevel(level);
    const families = taxonomy.families.filter(f => byFamily.has(f.id)).length;
    if (!familiesText.includes(`${labels[level]} · ${families} ${families === 1 ? 'family' : 'families'}`)) fail(`/report/families/ does not offer ${labels[level]} with ${families} families`);
    const known = taxonomy.providers.filter(p => taxonomy.families.some(f => f.provider === p.id && byFamily.has(f.id))).length;
    const label = new RegExp(`${labels[level]} · (\\d+) providers?`).exec(providersText);
    if (!label || Number(label[1]) !== known) fail(`/report/providers/ does not offer ${labels[level]} with ${known} providers (found ${label?.[1]})`);
  }
  const all = perLevel('all');
  for (const f of taxonomy.families) {
    const html = await readHtml(`report/families/${slugOf(f.id)}`);
    if (!html) continue;
    const t = text(html);
    const n = all.get(f.id) ?? 0;
    if (n > 0 && (!t.includes(f.name) || !new RegExp(`Fixtures\\s+${int(n)}\\b`).test(t))) fail(`family page ${f.id} does not state ${n} fixtures`);
    if (n === 0 && (!t.includes('No fixtures in this family yet') || !t.includes('Not measured'))) fail(`family page ${f.id} has no fixtures and must say "Not measured"`);
  }
  const perDetector = new Map();
  for (const c of cases) for (const d of c.detectors) perDetector.set(d, (perDetector.get(d) ?? 0) + 1);
  for (const [i, id] of detectorIds.entries()) {
    const html = await readHtml(`report/detectors/${id}`);
    if (html && i < 12 && !text(html).includes(`${int(perDetector.get(id))} fixture`)) fail(`/report/detectors/${id}/ does not state ${perDetector.get(id)} fixtures`);
  }
  const suites = new Map();
  for (const c of cases) (suites.get(category(c)) ?? suites.set(category(c), []).get(category(c))).push(c);
  const suitesText = text(await readHtml('report/fixtures'));
  if (!suitesText.includes(`${int(suites.size)} suites`)) fail(`/report/fixtures/ does not state ${suites.size} suites`);
  for (const [id, group] of suites) {
    const html = await readHtml(`report/fixtures/${id}`);
    if (html && !text(html).includes(`${int(group.length)} fixture`)) fail(`/report/fixtures/${id}/ does not state ${group.length} fixtures`);
  }

  // ---- Findings: the ledger's records; a fixture link only where the view holds the fixture ----------------------------
  const findingsHtml = await readHtml('report/findings');
  if (!text(findingsHtml).includes(`${int(gaps.issues.length)} findings`)) fail(`/report/findings/ does not state ${gaps.issues.length} findings`);
  for (const issue of gaps.issues) for (const slug of issue.fixtures) {
    const c = slug.split('--'); const linked = findingsHtml.includes(`href="${basePath}/report/fixtures/${c[0]}/?fixture=${encodeURIComponent(c.slice(1).join('--'))}"`);
    if (byId.has(slug) !== linked) fail(`/report/findings/ ${linked ? 'links' : 'does not link'} ${slug}, which the view ${byId.has(slug) ? 'holds' : 'does not hold'}`);
  }

  // ---- Links stay inside the app ---------------------------------------------------------------------------------------
  const internal = html => [...html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)].map(m => m[1]).filter(h => h.startsWith('/'));
  for (const route of ['report', 'report/providers', 'report/families', 'report/detectors', 'report/fixtures', 'report/findings', 'report/rows/T1', `report/families/${slugOf(taxonomy.families[0].id)}`, `report/fixtures/${[...suites.keys()][0]}`]) {
    for (const href of internal(await readHtml(route))) if (!(await linkResolves(path.join(webRoot, 'out'), basePath, href))) fail(`/${route}/ links ${href}, which is not a page or file of the export`);
  }

  // ---- The build-emitted data files hold the view's rows and records --------------------------------------------------
  const PAGE = 50; // resolvers/filters.ts PAGE_SIZE
  const dataRoot = path.join(out, 'data');
  const emitted = new Set();
  try { for await (const file of walk(dataRoot)) emitted.add(path.relative(dataRoot, file).split(path.sep).join('/')); } catch { fail('the export has no data/ folder: rows and records files are missing'); }
  const tables = [];
  for (const f of taxonomy.families) tables.push({ kind: 'family', id: slugOf(f.id), page: `report/families/${slugOf(f.id)}`, cases: cases.filter(c => familyOf(c) === f.id) });
  for (const [id, group] of suites) tables.push({ kind: 'suite', id, page: `report/fixtures/${id}`, cases: group });
  for (const id of detectorIds) tables.push({ kind: 'detector', id, page: `report/detectors/${id}`, cases: cases.filter(c => c.detectors.includes(id)) });
  for (const level of ['T1', 'T2', 'T3']) tables.push({ kind: 'level', id: level, page: `report/rows/${level}`, cases: cases.filter(c => c.tier === level) });
  const wanted = new Set([...tables.filter(t => t.cases.length > PAGE).map(t => `rows/${t.kind}/${t.id}/rows.json`), ...[...suites.keys()].map(id => `fixtures/${id}/records.json`), 'comparison/accuracy/differences.json']);
  // The lists behind the method counts (#623) are the evaluation's, not the view's: check-export-method-checks.mjs recounts which exist and what each holds.
  for (const file of emitted) if (/^evaluation\/(?:twin|benign|metamorphic|mutation|differential)\/[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*\/(?:fail|review-required|complete)\/checks\.json$/i.test(file)) wanted.add(file);
  for (const file of wanted) if (!emitted.has(file)) fail(`data/${file} is missing from the export`);
  for (const file of emitted) if (!wanted.has(file)) fail(`data/${file} is emitted but no page asks for it`);

  const LETTER = { EXACT: 'E', COVERED: 'C', OVERBROAD: 'O', PARTIAL: 'P', MISS: 'M' };
  // The packed row of the records files (resolvers/fixtures.ts packRow) written out again from the view's own fields.
  const packRow = r => !r || r.measurement === 'not-measured' ? null : [
    r.measurement === 'positive' ? r.outcomes.map(o => LETTER[o]).join('') || '=' : '-',
    r.measurement === 'control' ? (r.flagged ? '1' : '0') : '-',
    '', r.measurement === 'positive' ? r.leakedBytes ?? '' : '', r.measurement === 'positive' ? r.collateralBytes ?? '' : '', r.measurement === 'control' ? r.findings ?? '' : '', r.observed,
  ].join('|');
  const wordOf = r => (!r || r.measurement === 'not-measured' ? 'Not measured'
    : r.measurement === 'positive' ? (r.outcomes.some(leaked) ? 'Left readable' : r.outcomes.includes('OVERBROAD') ? 'Too much' : 'Redacted')
    : r.measurement === 'control' ? (r.flagged ? 'Flagged' : 'Quiet') : 'Unscored');
  const linkedRows = html => {
    const caption = /<caption[^>]*>Fixtures in [^<]*<\/caption>/.exec(html);
    if (!caption) return null;
    const start = html.indexOf('<tbody', caption.index);
    const body = html.slice(start, html.indexOf('</tbody>', start));
    return [...body.matchAll(/href="[^"]*\/report\/fixtures\/([^/"]+)\/\?fixture=([^"]+)"/g)].map(m => `${m[1]}--${decodeURIComponent(m[2])}`);
  };
  let dataRows = 0, dataFiles = 0;
  for (const table of tables) {
    const html = await readHtml(table.page);
    const linked = linkedRows(html);
    if (table.cases.length === 0) continue;
    if (!linked) { fail(`/${table.page}/ shows no rows table for its ${table.cases.length} fixtures`); continue; }
    if (table.cases.length <= PAGE) {
      if (linked.length !== table.cases.length || !table.cases.every(c => linked.includes(c.id))) fail(`/${table.page}/ must list all ${table.cases.length} of its fixtures (it ships whole), it links ${linked.length}`);
      continue;
    }
    const file = `rows/${table.kind}/${table.id}/rows.json`;
    let data;
    try { data = JSON.parse(await readFile(path.join(dataRoot, file), 'utf8')); } catch { fail(`data/${file} is not readable JSON`); continue; }
    dataFiles++; dataRows += data.items?.length ?? 0;
    const held = (data.items ?? []).map(item => `${item.c}--${item.i}`);
    if (held.length !== table.cases.length || new Set(held).size !== held.length || !table.cases.every(c => held.includes(c.id))) fail(`data/${file} holds ${held.length} rows, the view has ${table.cases.length} cases for it`);
    if (JSON.stringify(data.scanners.map(s => s.id)) !== JSON.stringify(report.artifact.scanners.map(s => s.id))) fail(`data/${file} has scanner columns ${data.scanners.map(s => s.id)}, the view lists ${report.artifact.scanners.map(s => s.id)}`);
    if (JSON.stringify(linked) !== JSON.stringify(held.slice(0, PAGE))) fail(`/${table.page}/ first page is not the first ${PAGE} rows of data/${file}`);
    const rowsById = new Map(table.cases.map(c => [c.id, c]));
    let wrong = 0;
    for (const item of data.items) {
      const c = rowsById.get(`${item.c}--${item.i}`);
      if (!c) { wrong++; continue; }
      data.scanners.forEach((s, k) => { if (data.statuses[item.o[k]]?.label !== wordOf(resultOf(c, s.id))) wrong++; });
      const m = mine(c);
      if (((item.f & 2) !== 0) !== (m?.measurement === 'positive' && m.outcomes.some(leaked)) || ((item.f & 4) !== 0) !== (m?.measurement === 'control' && m.flagged === true)) wrong++;
      if (item.l !== c.tier) wrong++;
    }
    if (wrong) fail(`data/${file}: ${wrong} outcome words, flags or levels disagree with the view`);
  }
  for (const [id, group] of suites) {
    const where = `data/fixtures/${id}/records.json`;
    let file;
    try { file = JSON.parse(await readFile(path.join(dataRoot, `fixtures/${id}/records.json`), 'utf8')); } catch { continue; }
    dataFiles++;
    if (!Array.isArray(file.records) || !file.shared) { fail(`${where} is not a records file`); continue; }
    const ids = file.records.map(r => `${id}--${r.id}`);
    if (ids.length !== group.length || !group.every(c => ids.includes(c.id))) fail(`${where} holds ${ids.length} records, the view has ${group.length} cases`);
    if (JSON.stringify(file.shared.scanners.map(s => s.id)) !== JSON.stringify(report.artifact.scanners.map(s => s.id))) fail(`${where} has scanners ${file.shared.scanners.map(s => s.id)}`);
    const byRecord = new Map(group.map(c => [idOf(c), c]));
    let differs = 0;
    for (const record of file.records) {
      const c = byRecord.get(record.id);
      if (!c) { differs++; continue; }
      // The bytes are not in the view: a record carries none, says so, and never a stand-in.
      if (record.noContent !== true || record.content !== '' || record.sha !== '') differs++;
      if (JSON.stringify(record.expected) !== JSON.stringify(c.expected) || record.path !== c.path || record.kind !== c.kind || record.tier !== c.tier) differs++;
      if (record.rows.length !== report.artifact.scanners.length) differs++;
      else record.rows.forEach((packed, k) => { if (packed !== packRow(resultOf(c, report.artifact.scanners[k].id))) differs++; });
    }
    if (differs) fail(`${where}: ${differs} records differ from the view's expected spans, paths, levels or rows`);
  }

  // ---- What a visitor downloads: limits (the totals are information only) --------------------------------------------
  let files = 0, bytes = 0, largestPage = { bytes: 0, file: '' }, largestData = { bytes: 0, file: '' }, largestTablePage = { bytes: 0, file: '' };
  for await (const file of walk(out)) {
    const size = (await readFile(file)).length, rel = path.relative(out, file).split(path.sep).join('/');
    files++; bytes += size;
    if (rel.startsWith('data/') && size > largestData.bytes) largestData = { bytes: size, file: rel };
    if (rel.endsWith('.html') && size > largestPage.bytes) largestPage = { bytes: size, file: rel };
    if (/^report\/(?:rows|fixtures|families|detectors)\/[^/]+(?:\/[^/]+)?\/index\.html$/.test(rel) && size > largestTablePage.bytes) largestTablePage = { bytes: size, file: rel };
  }
  const MB = 1048576;
  if (largestData.bytes > 2 * MB) fail(`${largestData.file} is ${(largestData.bytes / MB).toFixed(1)} MB, over the 2 MB a single fetch may cost`);
  if (largestPage.bytes > 1.5 * MB) fail(`${largestPage.file} is ${(largestPage.bytes / MB).toFixed(2)} MB, over the 1.5 MB a page may weigh`);
  if (largestTablePage.bytes > 320 * 1024) fail(`${largestTablePage.file} is ${(largestTablePage.bytes / 1024).toFixed(0)} KB, over the 320 KB a rows page may weigh: its rows belong in a data file`);
  summaryLine = `credential pages (authority new): ${tables.length} tables and ${dataFiles} data files (${dataRows.toLocaleString('en-US')} rows) recounted from the view, stamps, hub counts and three answers match; export ${(bytes / MB).toFixed(1)} MB in ${files} files, for information (largest page ${(largestPage.bytes / 1024).toFixed(0)} KB, largest table page ${(largestTablePage.bytes / 1024).toFixed(0)} KB)`;
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(view ? summaryLine : 'credential pages (authority new, no view): every report page names the new pipeline and says no qualification view backs the build');
