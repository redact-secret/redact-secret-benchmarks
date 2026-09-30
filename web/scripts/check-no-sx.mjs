/**
 * Source rules for the web app (#547), run by `npm run check:no-sx` and by
 * tests/web-conventions.test.mjs at the repository root (pure node, no install
 * needed there). Rules, each from docs/decisions/2026-09-30-...:
 *
 *  no-sx          the MUI `sx` prop / key is banned: components are styled by
 *                 class names from CSS Modules, not inline style objects.
 *  no-styled      `styled()` (MUI or emotion) is banned in feature code.
 *  no-client-fetch  nothing in web/ fetches: ledger data is read at build time
 *                 (lib/ledger.ts), never in the browser.
 *  css-layer      every CSS Module rule sits in `@layer components`, so it
 *                 outranks MUI's `@layer mui` by layer order.
 *  layers-first   layers.css is the first stylesheet imported by the app layout
 *                 and by Storybook's preview, which is what fixes the layer order.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CODE = /\.(?:[cm]?[jt]sx?)$/;
const SCAN_DIRS = ['app', 'components', 'lib', 'theme', '.storybook'];

/** Remove comments; leaves strings alone, which is enough for these patterns. */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const CODE_RULES = [
  ['no-sx', /(?<![\w$.])sx\s*=\s*\{|(?<![\w$.])sx\s*:(?!:)/, 'the `sx` prop is not allowed; use a class from a CSS Module'],
  ['no-styled', /\bimport\b[^;]*\bstyled\b[^;]*\bfrom\b|from\s+['"]@emotion\/styled['"]|from\s+['"]@mui\/system['"]|\bstyled\s*\(/, '`styled()` is not allowed in feature code; use a CSS Module'],
  ['no-client-fetch', /(?<![\w$.])fetch\s*\(|\bXMLHttpRequest\b|\buseSWR\b|\baxios\b/, 'no fetching in web/: ledger data is loaded at build time by lib/ledger.ts'],
];

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
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'out') continue;
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
  console.log('web source rules: no sx, no styled, no client fetch, CSS Modules layered');
}
