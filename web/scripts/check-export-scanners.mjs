/**
 * Post-build check of `/comparison/scanner/` (#612), run by `npm run check:routes` after `next build`.
 *
 * The page's facts are read again here, independently of web/services and web/resolvers: every scanner the run
 * lists is on the page with the version the run recorded and the mode line it recorded; every pin comes from the file
 * that pins it; every binary names the archive and checksum `scanners/peer-checksums.json` pins; every registry
 * statement of what is out of scope is shown; every in-page anchor exists; and the copy ranks nothing.
 * Without a published run (`WEB_REQUIRE_RUN` unset) the page must say so and show no run fact.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linkResolves } from './lib/links.mjs';
import { readAuthority } from './lib/authority.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const readJson = async rel => JSON.parse(await readFile(path.join(repoRoot, rel), 'utf8'));
// The legacy recount, kept intact as the oracle (#658): it applies when the authority is `legacy`. Under `new` the page is built from the official run
// and check-export-comparison.mjs recounts it against the qualification view.
if ((await readAuthority(repoRoot)) === 'new') {
  console.log('/comparison/scanner/: the authority is new, so check-export-comparison.mjs recounts it against the qualification view');
  process.exit(0);
}
const problems = [];
const fail = message => problems.push(message);

const html = await readFile(path.join(webRoot, 'out/comparison/scanner/index.html'), 'utf8');
const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? html;
const text = main.replace(/<(script|style)\b[\s\S]*?<\/\1[^>]*>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
if ((html.match(/<h1[\s>]/g) ?? []).length !== 1) fail('/comparison/scanner/ must have exactly one <h1>');

const suite = await readJson('qualification/suite-v1.json');
const pkg = await readJson('package.json');
const registry = (await readJson('scanners/peer-registry.json')).scanners;
const checksums = await readJson('scanners/peer-checksums.json');
const NPM = { 'redact-secret': '@redact-secret/core', 'flare-redact': 'flare-redact', openredaction: '@openredaction/core' };
const pinOf = id => suite.scanners[id] ?? pkg.dependencies?.[NPM[id]];

let summary;
try { summary = await readJson('public/results/summary.json'); } catch { /* no run published */ }

if (!summary) {
  if (!process.env.WEB_REQUIRE_RUN) {
    if (!text.includes('No benchmark run is published')) fail('/comparison/scanner/ has no run and must say so');
  } else fail('WEB_REQUIRE_RUN is set but public/results/summary.json is absent');
}

const ids = summary ? summary.scanners.map(s => s.id) : ['redact-secret', ...Object.keys(registry)];
let at = -1;
for (const id of ids) {
  const scanner = summary?.scanners.find(s => s.id === id);
  const name = scanner?.name ?? id;
  const position = html.indexOf(`id="${id}"`);
  if (position < 0) { fail(`/comparison/scanner/ has no section #${id}`); continue; }
  if (position < at) fail(`/comparison/scanner/ lists ${id} out of the run's order`);
  at = position;
  if (!html.includes(`href="#${id}"`)) fail(`/comparison/scanner/ roster does not link #${id}`);
  const version = scanner?.version ?? pinOf(id);
  if (!version || !text.includes(`${name} ${version}`)) fail(`/comparison/scanner/ does not state ${name} ${version}`);
  const pin = pinOf(id);
  if (!pin || !text.includes(pin)) fail(`/comparison/scanner/ does not state the pin ${pin} of ${id}`);
  if (scanner && !text.includes(scanner.mode)) fail(`/comparison/scanner/ does not state the mode line of ${id}: ${scanner.mode}`);
  const table = checksums[id];
  if (table?.assets) {
    const shown = Object.values(table.assets).some(a => text.includes(a.archive) && text.includes(a.sha256.slice(0, 12)));
    if (!shown) fail(`/comparison/scanner/ does not name a pinned release archive and its SHA-256 for ${id}`);
  }
  for (const statement of registry[id]?.outOfScope ?? []) if (!text.includes(statement)) fail(`/comparison/scanner/ does not show the out-of-scope statement for ${id}: ${statement}`);
}
if (summary) {
  if (!/Published|Candidate/.test(text)) fail('/comparison/scanner/ does not state published or candidate');
  if (!text.includes('Mode')) fail('/comparison/scanner/ does not state the mode of the run');
}

const FORBIDDEN = /fastest|slowest|faster|slower|\bbest\b|worst|winner|better|\brank(ed|ing)?\b|recommended|\bmissed\b|\bcaught\b/i;
if (FORBIDDEN.test(text)) fail(`/comparison/scanner/ contains a ranking or verdict word: ${FORBIDDEN.exec(text)[0]}`);
for (const [, href] of html.matchAll(/<a [^>]*href="(\/[^"#]*)/g)) {
  if (!(await linkResolves(path.join(webRoot, 'out'), '', href))) fail(`/comparison/scanner/ links outside the export: ${href}`);
}

if (problems.length) {
  for (const p of problems) console.error(`::error::${p}`);
  process.exit(1);
}
console.log(`/comparison/scanner/ matches the pins, the run and the registry for ${ids.length} scanners`);
