/**
 * Post-build check of the qualification case pages (#606), run by `npm run check:routes` after `next build`.
 *
 * The rows are read again here, independently of web/services and web/resolvers, from `public/results/qualification-v1.json`:
 * every case of every population is on exactly one page of each scope that claims it (the cases whose `detectors` name a
 * family, or the unattributed cases), in the view's order, in its own population's section, with each scanner's word as the
 * view's result says it, and no page exists past the last. Without a usable view (the normal state in CI) the pages must
 * say so and carry no case row. The page size below is the resolver's `QUALIFICATION_CASE_PAGE_ROWS`; if they drift, the
 * page counts disagree and this check fails.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE_ROWS = 50;
const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = rel => path.join(webRoot, 'out', rel);
const problems = [];
const fail = message => problems.push(message);
const read = rel => readFile(out(rel), 'utf8');
const decode = s => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

const overview = await read('evaluation/qualification/index.html');
const ready = overview.includes('Support status of the detector families');

if (!ready) {
  for (const rel of ['evaluation/qualification/unattributed/1/index.html', 'evaluation/qualification/families/view-unavailable/cases/1/index.html']) {
    if (!existsSync(out(rel))) { fail(`${rel} is missing: with no usable view the case routes keep one page that says so`); continue; }
    const html = await read(rel);
    if (/id="case-/.test(html) || /<table/.test(html)) fail(`${rel} shows a case row although the qualification view is not usable`);
    if (!/Not measured|Not shown/.test(html)) fail(`${rel} does not say why there is no view`);
  }
  if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
  console.log('qualification case pages ok: no usable view, the case routes say so and show no row');
  process.exit(0);
}

const resultsDir = process.env.WEB_RESULTS_DIR ?? path.join(webRoot, '..', 'public', 'results');
const view = JSON.parse(await readFile(path.join(resultsDir, 'qualification-v1.json'), 'utf8'));

const OUTCOMES = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
function word(result) {
  if (!result) return 'Not run';
  if (result.measurement === 'positive') {
    const o = result.outcomes ?? [];
    if (o.length === 0) return 'No span';
    if (o.length === 1) return o[0];
    return OUTCOMES.filter(x => o.includes(x)).map(x => `${x} ${o.filter(y => y === x).length}`).join(' · ');
  }
  if (result.measurement === 'control') return `${result.flagged ? 'Flagged' : 'Not flagged'}${result.coDetected ? ' · co-detected' : ''}`;
  return result.measurement === 'pending' ? 'Pending' : 'Not measured';
}

/** Remove tags until none are left, so a tag split by a removed one cannot survive a single pass. */
function stripTags(html) {
  let out = html;
  for (let prev = null; prev !== out;) { prev = out; out = out.replace(/<[^>]+>/g, ''); }
  return out;
}

/** The rows on one built page: [population section, case key, scanner words]. */
function rowsOf(html) {
  const rows = [];
  // Sections are the population headings; each table follows its own section's heading.
  for (const part of html.split(/<section\b/).slice(1)) {
    const heading = /<h2[^>]*>([^<]+)<\/h2>/.exec(part)?.[1];
    for (const tr of part.split('<tr>').slice(1)) {
      const id = /<details[^>]* id="case-([^"]+)"/.exec(tr)?.[1];
      if (!id) continue;
      const words = {};
      for (const m of tr.matchAll(/<td[^>]* data-label="([^"]+)"><span[^>]*>([\s\S]*?)<\/span><\/td>/g)) words[decode(m[1])] = decode(stripTags(m[2]));
      rows.push({ heading: decode(heading ?? ''), key: decode(id), words });
    }
  }
  return rows;
}

const scopes = [
  ...view.families.map(f => ({ rel: `evaluation/qualification/families/${f.family}/cases`, claims: c => c.detectors.includes(f.family) })),
  { rel: 'evaluation/qualification/unattributed', claims: c => c.detectors.length === 0 },
];
let rowsChecked = 0, pagesChecked = 0;
const claimedBy = new Map();

for (const scope of scopes) {
  const expected = view.populations.flatMap(p => p.cases.filter(scope.claims).map(c => ({ population: p.population, key: `${p.population}/${c.id}`, c })));
  const pages = Math.max(1, Math.ceil(expected.length / PAGE_ROWS));
  if (existsSync(out(`${scope.rel}/${pages + 1}/index.html`))) fail(`${scope.rel}/${pages + 1}/ exists but the scope has ${pages} page(s)`);
  for (let page = 1; page <= pages; page++) {
    const file = `${scope.rel}/${page}/index.html`;
    if (!existsSync(out(file))) { fail(`${file} is missing`); continue; }
    const html = await read(file);
    pagesChecked++;
    const shown = rowsOf(html);
    const want = expected.slice((page - 1) * PAGE_ROWS, page * PAGE_ROWS);
    if (shown.length !== want.length || shown.some((r, i) => r.key !== want[i].key)) { fail(`${file} lists ${shown.length} rows that are not the view's ${want.length} for this page, in order`); continue; }
    for (const [i, r] of shown.entries()) {
      if (r.heading !== want[i].population) fail(`${file}: ${r.key} is in the section ${r.heading}, its population is ${want[i].population}`);
      for (const scanner of view.scanners) {
        const expectedWord = word(want[i].c.results.find(x => x.scanner === scanner));
        if (r.words[scanner] !== expectedWord) fail(`${file}: ${r.key} shows "${r.words[scanner]}" for ${scanner}, the view says "${expectedWord}"`);
      }
      claimedBy.set(r.key, (claimedBy.get(r.key) ?? 0) + 1);
      rowsChecked++;
    }
  }
}
for (const p of view.populations) for (const c of p.cases) {
  const times = claimedBy.get(`${p.population}/${c.id}`) ?? 0;
  const wanted = c.detectors.length === 0 ? 1 : c.detectors.filter(d => view.families.some(f => f.family === d)).length;
  if (times !== wanted) fail(`${p.population}/${c.id} is shown ${times} time(s) across the case pages, the view's attribution claims it ${wanted} time(s)`);
}

if (problems.length) { console.error(problems.slice(0, 20).join('\n')); if (problems.length > 20) console.error(`... and ${problems.length - 20} more`); process.exit(1); }
console.log(`qualification case pages ok: ${pagesChecked} pages, ${rowsChecked} rows match the view (every case in each scope that claims it, in order, in its own population, with each scanner's word)`);
