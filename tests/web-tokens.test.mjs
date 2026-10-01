/**
 * Token drift test for web/ (#544). Pure node, no web/ install needed, run by
 * the root `npm test`. The design system's values are vendored once
 * (src/tokens.json + src/tokens.css, guarded by tests/design-tokens.test.mjs);
 * this file guards how web/ *uses* them, so a component cannot drift from the
 * system by inventing a colour, a length or a variable:
 *
 *  1. every `var(--x)` in web/ CSS resolves to a token, a measure, or a
 *     property the same file (or a component's inline style) defines;
 *  2. no hex or rgb/hsl colour, no shadow, nothing round, radius tokens only,
 *     no raw px outside @media conditions and the one device hairline;
 *  3. the MUI theme maps the same colour values tokens.css declares, in both
 *     themes, and its base radius is the radius-sm token;
 *  4. every component has a story, a CSS Module and a barrel export, and none
 *     imports data (components are pure render).
 *
 * At cutover the tokens move into web/; only TOKENS_CSS / TOKENS_JSON change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const ROOT = new URL('../', import.meta.url);
const WEB = new URL('web/', ROOT);
const read = url => readFile(url, 'utf8');
const TOKENS_CSS = new URL('src/tokens.css', ROOT);
const TOKENS_JSON = new URL('src/tokens.json', ROOT);
const MEASURES_CSS = new URL('theme/measures.css', WEB);

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.next', 'out', 'storybook-static', 'coverage', 'test-results', 'playwright-report'].includes(entry.name)) continue;
    const full = new URL(entry.name + (entry.isDirectory() ? '/' : ''), dir);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}
async function collect(test_) {
  const found = [];
  for await (const file of walk(WEB)) if (test_(file.pathname)) found.push(file);
  return found;
}
const rel = url => path.relative(WEB.pathname, url.pathname);
const stripComments = css => css.replace(/\/\*[\s\S]*?\*\//g, '');

const cssFiles = await collect(p => p.endsWith('.css'));
const codeFiles = await collect(p => /\.(?:tsx?|mjs)$/.test(p) && !p.endsWith('.d.ts'));
const declared = css => new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));

test('web/ has CSS to check (guards the guard)', () => {
  assert.ok(cssFiles.length >= 40, `only ${cssFiles.length} css files found`);
});

test('every var(--x) in web/ CSS resolves to a token, a measure or a local definition', async () => {
  const tokens = declared(await read(TOKENS_CSS));
  const measures = declared(await read(MEASURES_CSS));
  assert.ok(tokens.has('--ink') && measures.has('--hairline'), 'token and measure sources parsed');
  // Custom properties set from a component's inline style, e.g. style={{ '--fill': '40%' }}.
  const inline = new Set();
  for (const file of codeFiles) for (const m of (await read(file)).matchAll(/['"](--[a-z0-9-]+)['"]\s*:/g)) inline.add(m[1]);
  const problems = [];
  for (const file of cssFiles) {
    const css = stripComments(await read(file));
    const local = declared(css);
    for (const m of css.matchAll(/var\(\s*(--[a-z0-9-]+)/g)) {
      const name = m[1];
      if (!tokens.has(name) && !measures.has(name) && !local.has(name) && !inline.has(name)) problems.push(`${rel(file)}: var(${name}) is defined nowhere`);
    }
  }
  assert.deepEqual(problems, []);
});

test('web/ CSS uses tokens only: no colour literals, shadows, pills, raw px or !important', async () => {
  const problems = [];
  for (const file of cssFiles) {
    const name = rel(file);
    const css = stripComments(await read(file));
    const noConditions = css.replace(/@media[^{]+\{/g, '@media{');
    const isMeasures = file.pathname === MEASURES_CSS.pathname;
    if (/#[0-9a-fA-F]{3,8}\b(?![-\w])/.test(css)) problems.push(`${name}: hex colour`);
    if (/\b(?:rgba?|hsla?|oklch|color-mix)\(/.test(css)) problems.push(`${name}: colour function`);
    if (/box-shadow|text-shadow|drop-shadow/.test(css)) problems.push(`${name}: shadows do not separate surfaces here; use rules`);
    if (/border-radius:\s*(?:50%|100%|9999|999px)/.test(css)) problems.push(`${name}: no pills or circles`);
    if (/!important/.test(css)) problems.push(`${name}: !important; layer order wins instead`);
    const radii = [...noConditions.matchAll(/border-radius:\s*([^;]+);/g)].map(m => m[1].trim());
    for (const r of radii) if (!/^(?:0|var\(--radius-(?:0|sm|md)\)|(?:0|var\(--radius-(?:0|sm|md)\))(?: (?:0|var\(--radius-(?:0|sm|md)\)))+)$/.test(r)) problems.push(`${name}: radius "${r}" is not a token`);
    const px = (isMeasures ? noConditions.replace(/--hairline:\s*1px;/, '') : noConditions).match(/(?<![\w.-])\d*\.?\d+px\b/g);
    if (px) problems.push(`${name}: raw px ${[...new Set(px)].join(', ')} (use tokens or measures.css)`);
  }
  assert.deepEqual(problems, []);
});

test('inline styles and code carry no raw px (stories may assert computed styles)', async () => {
  const problems = [];
  for (const file of codeFiles.filter(f => !f.pathname.endsWith('.stories.tsx'))) {
    const code = (await read(file)).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    if (/\b\d+px\b/.test(code)) problems.push(`${rel(file)}: raw px in code`);
  }
  assert.deepEqual(problems, []);
});

test('measures.css derives from tokens: no colour and no length except the hairline', async () => {
  const css = stripComments(await read(MEASURES_CSS));
  for (const [, value] of css.matchAll(/--[a-z0-9-]+:\s*([^;]+);/g)) {
    assert.ok(!/#|rgb|hsl/.test(value), `colour in measures: ${value}`);
  }
  const rawLengths = css.replace(/--hairline:\s*1px;/, '').match(/(?<![\w.-])\d*\.?\d+(?:px|rem)\b/g) ?? [];
  assert.deepEqual(rawLengths, []);
});

/* ---- the MUI theme maps the same values tokens.css declares ---- */

function block(css, selector) {
  const start = css.indexOf(selector);
  assert.ok(start >= 0, `missing block ${selector}`);
  const open = css.indexOf('{', start), close = css.indexOf('}', open);
  return Object.fromEntries([...css.slice(open + 1, close).matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]));
}
const tokensCss = await read(TOKENS_CSS);
const resolveIn = (theme, name) => { let v = theme[name]; for (let i = 0; i < 4 && /^var\(/.test(v); i++) v = theme[/var\(--([a-z0-9-]+)\)/.exec(v)[1]]; return v; };

test('web/theme/tokens.ts resolves to the values tokens.css declares, in both themes', async () => {
  const { colorsFor } = await import('../web/theme/tokens.ts');
  const system = JSON.parse(await read(TOKENS_JSON));
  for (const [scheme, css] of [['light', block(tokensCss, ':root, [data-theme="light"]')], ['dark', block(tokensCss, ':root[data-theme="dark"]')]]) {
    const mapped = colorsFor(scheme);
    assert.equal(Object.keys(mapped).length, system.color.tokens.length);
    for (const [name, value] of Object.entries(mapped)) assert.equal(value, resolveIn(css, name), `${name} (${scheme})`);
  }
});

test('the MUI theme base radius is the radius-sm token and it maps palette from tokens, not literals', async () => {
  const system = JSON.parse(await read(TOKENS_JSON));
  const radiusSm = system.radius.tokens.find(t => t.name === 'radius-sm').value;
  const theme = await read(new URL('theme/theme.ts', WEB));
  assert.equal(`${/borderRadius:\s*(\d+)/.exec(theme)[1]}px`, radiusSm);
  assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(theme.replace(/\/\*[\s\S]*?\*\//g, '')), 'theme.ts holds no hex colour; colours come from colorsFor()');
});

test('layout and Storybook preview load the same token and measure sheets', async () => {
  for (const file of ['app/layout.tsx', '.storybook/preview.tsx']) {
    const src = await read(new URL(file, WEB));
    assert.match(src, /theme\/measures\.css/, `${file} imports measures.css`);
    assert.match(src, /src\/tokens\.css/, `${file} imports tokens.css`);
  }
});

/* ---- component contract: pure render, story + module + barrel ---- */

test('every component has a story and a CSS Module, is exported by its barrel, and imports no data', async () => {
  // A group is a folder of components with a barrel. A folder that only holds groups (`evaluation/`, one folder per
  // phase of the Evaluation section) is a namespace and needs no barrel of its own.
  const groups = [];
  const collectGroups = async relative => {
    for (const entry of await readdir(new URL(`components/${relative}`, WEB), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const child = `${relative}${entry.name}/`;
      const inner = await readdir(new URL(`components/${child}`, WEB), { withFileTypes: true });
      if (inner.some(e => e.isFile() && e.name.endsWith('.tsx'))) groups.push(child.slice(0, -1));
      await collectGroups(child);
    }
  };
  await collectGroups('');
  assert.ok(groups.length >= 7, `groups: ${groups.join(', ')}`);
  const problems = [];
  for (const group of groups) {
    const dir = new URL(`components/${group}/`, WEB);
    const files = await readdir(dir);
    const barrel = await read(new URL('index.ts', dir)).catch(() => '');
    if (!barrel) problems.push(`${group}: no index.ts barrel`);
    for (const f of files.filter(n => n.endsWith('.tsx') && !n.endsWith('.stories.tsx'))) {
      const base = f.replace(/\.tsx$/, '');
      if (!files.includes(`${base}.stories.tsx`)) problems.push(`${group}/${base}: no story`);
      if (!files.includes(`${base}.module.css`)) problems.push(`${group}/${base}: no CSS Module`);
      if (!new RegExp(`from '\\./${base}'`).test(barrel)) problems.push(`${group}/${base}: not exported by the barrel`);
      const source = await read(new URL(f, dir));
      for (const m of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (/(?:^|\/)lib\/ledger|(?:^|\/)app\/|^node:|^fs$|\/scripts\//.test(m[1])) problems.push(`${group}/${base}: imports ${m[1]}; components are pure render`);
      }
      if (/\b(?:useEffect|useSWR|localStorage|sessionStorage)\b/.test(source)) problems.push(`${group}/${base}: effect or browser storage in a primitive`);
    }
  }
  assert.deepEqual(problems, []);
});
