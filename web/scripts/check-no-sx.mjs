/**
 * Source rules for the web app (#547), run by `npm run check:no-sx` and by
 * tests/web-conventions.test.mjs at the repository root (pure node, no install
 * needed there). Rules, each from docs/decisions/2026-09-30-...:
 *
 *  no-sx          the MUI `sx` prop / key is banned: components are styled by
 *                 class names from CSS Modules, not inline style objects.
 *  no-styled      `styled()` (MUI or emotion) is banned in feature code.
 *  fetch-scope    the browser may fetch one thing: a same-origin GET of a JSON file the
 *                 build emitted under <basePath>/data/, through the one helper
 *                 lib/build-data.ts (docs/decisions/2026-09-30-allow-same-origin-fetch-
 *                 of-build-emitted-data.md). `fetch(` anywhere else, any other network
 *                 API (XHR, WebSocket, EventSource, beacons, SWR, axios), any other origin
 *                 in the helper, and any runtime API route are violations. See the
 *                 `helper` and `route` rules below.
 *  css-layer      every CSS Module rule sits in `@layer components`, so it
 *                 outranks MUI's `@layer mui` by layer order.
 *  layers-first   layers.css is the first stylesheet imported by the app layout
 *                 and by Storybook's preview, which is what fixes the layer order.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const SCAN_DIRS = ['app', 'components', 'lib', 'services', 'resolvers', 'theme', '.storybook'];

/** Remove comments; leaves strings alone, which is enough for these patterns. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

/** The one module that may call `fetch`. */
export const FETCH_HELPER = 'lib/build-data.ts';
/** The only folder that may hold a route handler: handlers there write static files at build time. */
export const DATA_ROUTES = 'app/data/';
/** Who may import the helper: pages and their client wrappers, never a block, a service or a resolver. */
const HELPER_IMPORTERS = /^(?:app|lib)\//;

const CODE_RULES = [
  ['no-sx', /(?<![\w$.])sx\s*=\s*\{|(?<![\w$.])sx\s*:(?!:)/, 'the `sx` prop is not allowed; use a class from a CSS Module'],
  ['no-styled', /\bimport\b[^;]*\bstyled\b[^;]*\bfrom\b|from\s+['"]@emotion\/styled['"]|from\s+['"]@mui\/system['"]|\bstyled\s*\(/, '`styled()` is not allowed in feature code; use a CSS Module'],
  ['no-other-network', /\bXMLHttpRequest\b|\bWebSocket\b|\bEventSource\b|\bsendBeacon\b|\buseSWR\b|\baxios\b|\bimportScripts\b|\bnew\s+Worker\s*\(|\bserviceWorker\b/, 'the only network call allowed is fetch through lib/build-data.ts, for build-emitted data under <basePath>/data/'],
];

/** Problems with how a file uses `fetch` and the helper, by the file's own path (relative to web/). */
function fetchProblems(code, file) {
  const problems = [];
  const at = (index, rule, message) => problems.push({ file, line: code.slice(0, index).split('\n').length, rule, message });
  const posix = file.split(path.sep).join('/');
  for (const m of code.matchAll(/(?<![\w$.])fetch\s*\(/g)) {
    if (posix !== FETCH_HELPER) at(m.index, 'fetch-scope', `fetch is allowed only in ${FETCH_HELPER}, for build-emitted data under <basePath>/data/; import loadBuildData / useBuildData instead`);
  }
  if (posix !== FETCH_HELPER && /from\s+['"][^'"]*\bbuild-data['"]/.test(code) && !HELPER_IMPORTERS.test(posix)) {
    const m = /from\s+['"][^'"]*\bbuild-data['"]/.exec(code);
    at(m.index, 'fetch-scope', 'a block, service or resolver must not import lib/build-data; a page-level client wrapper loads the data and passes it down as props');
  }
  if (posix === FETCH_HELPER) {
    const calls = [...code.matchAll(/(?<![\w$.])fetch\s*\(/g)];
    if (calls.length !== 1) problems.push({ file, line: 1, rule: 'fetch-helper', message: `${FETCH_HELPER} must contain exactly one fetch call, found ${calls.length}` });
    for (const m of calls) {
      const call = code.slice(m.index, m.index + 400);
      if (!/^fetch\(\s*dataUrl\(/.test(call)) at(m.index, 'fetch-helper', 'the fetch URL must come from dataUrl(), which only builds build-emitted paths');
      for (const option of [/method:\s*'GET'/, /credentials:\s*'omit'/, /mode:\s*'same-origin'/]) {
        if (!option.test(call)) at(m.index, 'fetch-helper', `the fetch call must set ${option.source.replace(/\\s\*/g, ' ')}`);
      }
    }
    if (/['"`]\s*(?:https?:)?\/\/[\w.-]/.test(code)) problems.push({ file, line: 1, rule: 'fetch-helper', message: `${FETCH_HELPER} must not name another origin: only same-origin, build-emitted paths` });
    if (!/BUILD_DATA_PATH\.test\(/.test(code)) problems.push({ file, line: 1, rule: 'fetch-helper', message: 'dataUrl() must validate the path against BUILD_DATA_PATH (lib/data-paths.ts)' });
    const options = /fetch\(\s*dataUrl\([^)]*\)\s*,\s*(\{[^}]*\})/.exec(code)?.[1] ?? '';
    if (/\b(?:headers|body)\s*:/.test(options)) problems.push({ file, line: 1, rule: 'fetch-helper', message: 'the fetch call sends no headers and no body: a plain GET' });
  }
  return problems;
}

/** A route handler is allowed only under app/data/, must be static, and may only answer GET. */
function routeProblems(source, code, file) {
  const posix = file.split(path.sep).join('/');
  if (!/^app\/(?:.*\/)?route\.[cm]?[jt]s$/.test(posix)) return [];
  if (!posix.startsWith(DATA_ROUTES)) return [{ file, line: 1, rule: 'route', message: `a route handler may only live under ${DATA_ROUTES} (static files written at build time); the site has no runtime API` }];
  const problems = [];
  if (!/export\s+const\s+dynamic\s*=\s*'force-static'/.test(code)) problems.push({ file, line: 1, rule: 'route', message: "a data route must export dynamic = 'force-static'" });
  if (/export\s+(?:async\s+)?(?:function|const)\s+(?:POST|PUT|PATCH|DELETE|OPTIONS)\b/.test(code)) problems.push({ file, line: 1, rule: 'route', message: 'a data route answers GET only' });
  return problems;
}

/** Violations in one source file. `file` selects which rules apply. */
export function findViolations(source, file) {
  const problems = [];
  const base = path.basename(file);
  if (CODE.test(base)) {
    const code = stripComments(source);
    code.split('\n').forEach((line, i) => {
      for (const [rule, pattern, message] of CODE_RULES) {
        if (pattern.test(line)) problems.push({ file, line: i + 1, rule, message });
      }
    });
    problems.push(...fetchProblems(code, file), ...routeProblems(source, code, file));
    if (/^(?:layout\.tsx|preview\.tsx)$/.test(base)) {
      const firstCssImport = /^\s*import\s+['"]([^'"]+\.css)['"]/m.exec(source);
      if (!firstCssImport || !/(?:^|\/)layers\.css$/.test(firstCssImport[1])) {
        problems.push({ file, line: 1, rule: 'layers-first', message: 'the first CSS import must be theme/layers.css, which fixes the layer order' });
      }
    }
  } else if (/\.module\.css$/.test(base)) {
    problems.push(...cssModuleProblems(source, file));
  }
  return problems;
}

/** Every top-level statement of a CSS Module must be `@layer components { ... }`. */
function cssModuleProblems(source, file) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
  const problems = [];
  let depth = 0, prelude = '', line = 1;
  for (const ch of css) {
    if (ch === '\n') line++;
    if (ch === '{') {
      if (depth === 0 && prelude.trim().replace(/\s+/g, ' ') !== '@layer components') {
        problems.push({ file, line, rule: 'css-layer', message: `top-level rule "${prelude.trim()}" is outside @layer components` });
      }
      depth++;
      if (depth === 1) prelude = '';
    } else if (ch === '}') {
      depth--;
    } else if (depth === 0) {
      prelude += ch;
    }
  }
  if (prelude.trim()) problems.push({ file, line, rule: 'css-layer', message: `top-level statement "${prelude.trim()}" is outside @layer components` });
  return problems;
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'out', 'coverage', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

export async function checkWeb(webRoot) {
  const problems = [];
  for (const dir of SCAN_DIRS) {
    try { await readdir(path.join(webRoot, dir)); } catch { continue; }
    for await (const file of walk(path.join(webRoot, dir))) {
      if (!CODE.test(file) && !/\.module\.css$/.test(file)) continue;
      problems.push(...findViolations(await readFile(file, 'utf8'), path.relative(webRoot, file)));
    }
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const problems = await checkWeb(webRoot);
  for (const p of problems) console.error(`${p.file}:${p.line} [${p.rule}] ${p.message}`);
  if (problems.length) process.exit(1);
  console.log('web source rules: no sx, no styled, fetch only of build-emitted data through lib/build-data.ts, static data routes only, CSS Modules layered');
}
