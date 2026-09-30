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
  if (/pin-manifest|support\/taxonomy|public\/results|results\/summary/.test(text)) fail(`${path.relative(out, file)} names a ledger file: ledger data must be read at build time only`);
}

if (problems.length) {
  for (const p of problems) console.error(p);
  process.exit(1);
}
console.log(`static export ok: ${ROUTES.length} routes under ${basePath}/, layer order first, MUI in @layer mui`);
