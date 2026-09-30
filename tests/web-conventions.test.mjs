import test from 'node:test';
import assert from 'node:assert/strict';
import { checkWeb, findViolations } from '../web/scripts/check-no-sx.mjs';

const rules = (source, file = 'components/x/X.tsx') => findViolations(source, file).map(v => v.rule);

test('the sx prop and key are rejected, prose and lookalikes are not', () => {
  assert.deepEqual(rules('<Box sx={{ p: 2 }} />'), ['no-sx']);
  assert.deepEqual(rules('const style = { sx: 1 };'), ['no-sx']);
  assert.deepEqual(rules('// never use sx={{}} here\nconst a = 1;'), []);
  assert.deepEqual(rules('const props = { ...rest }; const isx = 3;'), []);
});

test('styled() and client fetches are rejected', () => {
  assert.deepEqual(rules("import { styled } from '@mui/material/styles';"), ['no-styled']);
  assert.deepEqual(rules("import styled from '@emotion/styled';"), ['no-styled']);
  assert.deepEqual(rules("const r = await fetch('/results/summary.json');"), ['no-client-fetch']);
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
