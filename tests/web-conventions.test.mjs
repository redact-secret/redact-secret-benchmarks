import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkWeb, findViolations } from '../web/scripts/check-no-sx.mjs';
import { BUILD_DATA_PATH } from '../web/lib/data-paths.ts';

const rules = (source, file = 'components/x/X.tsx') => findViolations(source, file).map(v => v.rule);

test('the sx prop and key are rejected, prose and lookalikes are not', () => {
  assert.deepEqual(rules('<Box sx={{ p: 2 }} />'), ['no-sx']);
  assert.deepEqual(rules('const style = { sx: 1 };'), ['no-sx']);
  assert.deepEqual(rules('// never use sx={{}} here\nconst a = 1;'), []);
  assert.deepEqual(rules('const props = { ...rest }; const isx = 3;'), []);
});

test('styled() is rejected', () => {
  assert.deepEqual(rules("import { styled } from '@mui/material/styles';"), ['no-styled']);
  assert.deepEqual(rules("import styled from '@emotion/styled';"), ['no-styled']);
});

// The fetch rule (docs/decisions/2026-09-30-allow-same-origin-fetch-of-build-emitted-data.md): one helper, one kind of request.
const HELPER = 'lib/build-data.ts';
const OK_CALL = "fetch(dataUrl(path), { method: 'GET', credentials: 'omit', mode: 'same-origin', referrerPolicy: 'no-referrer' })";
const helperSource = (call = OK_CALL) => `
  export function dataUrl(path) { if (!BUILD_DATA_PATH.test(path)) throw new Error(path); return '/next/data/' + path; }
  const request = ${call};`;

test('fetch is allowed only in lib/build-data.ts, as a plain same-origin GET of dataUrl()', () => {
  assert.deepEqual(rules("const r = await fetch('/results/summary.json');"), ['fetch-scope'], 'a block may not fetch');
  assert.deepEqual(rules('await fetch(dataUrl(path));', 'app/report/RowsView.tsx'), ['fetch-scope'], 'a page may not fetch; it uses the helper');
  assert.deepEqual(rules("await fetch('https://example.com/x.json');", 'services/run.ts'), ['fetch-scope']);
  assert.deepEqual(rules(helperSource(), HELPER), [], 'the helper as committed passes');
  assert.deepEqual(rules(helperSource("fetch('/next/data/rows/level/T1/rows.json', { method: 'GET', credentials: 'omit', mode: 'same-origin' })"), HELPER), ['fetch-helper'], 'the URL must come from dataUrl()');
  assert.deepEqual(rules(helperSource("fetch(dataUrl(path), { method: 'GET', credentials: 'include', mode: 'same-origin' })"), HELPER), ['fetch-helper'], 'no credentials');
  assert.deepEqual(rules(helperSource("fetch(dataUrl(path), { method: 'POST', credentials: 'omit', mode: 'same-origin' })"), HELPER), ['fetch-helper'], 'GET only');
  assert.deepEqual(rules(helperSource("fetch(dataUrl(path), { method: 'GET', credentials: 'omit', mode: 'cors' })"), HELPER), ['fetch-helper'], 'same-origin only');
  assert.deepEqual(rules(helperSource("fetch(dataUrl(path), { method: 'GET', credentials: 'omit', mode: 'same-origin', headers: { a: 'b' } })"), HELPER), ['fetch-helper'], 'no custom headers');
  assert.deepEqual(rules(`${helperSource()}\nconst origin = 'https://example.com';`, HELPER), ['fetch-helper'], 'no other origin named');
  assert.deepEqual(rules(`${helperSource()}\nconst more = ${OK_CALL};`, HELPER), ['fetch-helper'], 'exactly one fetch');
  assert.deepEqual(rules(helperSource().replace('BUILD_DATA_PATH.test(path)', 'true'), HELPER), ['fetch-helper'], 'dataUrl() validates the path');
  assert.deepEqual(rules("// fetch('/x') is what the ADR allows\nconst a = 1;"), [], 'prose is not a call');
});

test('only pages and lib import the fetch helper, and no other network API exists', () => {
  assert.deepEqual(rules("import { useBuildData } from '../../lib/build-data';", 'components/report/X.tsx'), ['fetch-scope']);
  assert.deepEqual(rules("import { loadBuildData } from '../lib/build-data';", 'resolvers/rows.ts'), ['fetch-scope']);
  assert.deepEqual(rules("import { useBuildData } from '../../lib/build-data';", 'app/report/RowsView.tsx'), []);
  for (const api of ['new XMLHttpRequest()', 'new WebSocket(url)', 'new EventSource(url)', 'navigator.sendBeacon(url)', 'useSWR(key)', 'axios.get(url)']) {
    assert.deepEqual(rules(`const x = ${api};`, 'app/report/X.tsx'), ['no-other-network'], api);
  }
});

test('the only route handlers are static GETs under app/data/', () => {
  const ok = "export const dynamic = 'force-static';\nexport async function GET() { return Response.json({}); }";
  assert.deepEqual(rules(ok, 'app/data/rows/[kind]/[id]/rows.json/route.ts'), []);
  assert.deepEqual(rules(ok, 'app/api/route.ts'), ['route'], 'no runtime API outside app/data');
  assert.deepEqual(rules('export async function GET() { return Response.json({}); }', 'app/data/x/route.ts'), ['route'], 'must be force-static');
  assert.deepEqual(rules(`${ok}\nexport async function POST() { return new Response(); }`, 'app/data/x/route.ts'), ['route'], 'GET only');
});

test('CSS Module rules must all sit in @layer components', () => {
  assert.deepEqual(rules('@layer components { .a { color: red; } .b:hover { color: blue; } }', 'x.module.css'), []);
  assert.deepEqual(rules('.a { color: red; }', 'x.module.css'), ['css-layer']);
  assert.deepEqual(rules('@layer components { .a { color: red; } }\n.b { color: red; }', 'x.module.css'), ['css-layer']);
  assert.deepEqual(rules('@layer mui { .a { color: red; } }', 'x.module.css'), ['css-layer']);
});

test('layers.css must be the first stylesheet the layout and Storybook preview import', () => {
  assert.deepEqual(rules("import '../theme/layers.css';\nimport './globals.css';", 'app/layout.tsx'), []);
  assert.deepEqual(rules("import './globals.css';\nimport '../theme/layers.css';", 'app/layout.tsx'), ['layers-first']);
  assert.deepEqual(rules("import '../app/globals.css';", '.storybook/preview.tsx'), ['layers-first']);
});

test('the web app as committed passes every rule', async () => {
  const problems = await checkWeb(new URL('../web/', import.meta.url).pathname);
  assert.deepEqual(problems, []);
});

test('the export check and the browser helper allow the same data paths', () => {
  const script = readFileSync(new URL('../web/scripts/check-export-rows.mjs', import.meta.url), 'utf8');
  assert.equal(/const DATA_PATH = (\/.*\/i);/.exec(script)?.[1], String(BUILD_DATA_PATH));
});
