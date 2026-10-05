import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cases, corpusDigest, CORPUS_VERSION, FAMILY_IDS } from '../benchmarks/batch2/corpus.mjs';

const frozen = JSON.parse(readFileSync(new URL('../benchmarks/batch2/FROZEN.json', import.meta.url), 'utf8'));
const readiness = JSON.parse(readFileSync(new URL('../evidence/739/readiness.json', import.meta.url), 'utf8'));

test('the Batch 2 corpus is the frozen one', () => {
  assert.equal(CORPUS_VERSION, frozen.corpusVersion);
  assert.equal(corpusDigest(), frozen.sha256);
  assert.equal(cases.length, frozen.cases);
});

test('only evidence-ready families have cases, and every ready family has some', () => {
  const ready = readiness.families.filter((f) => f.status === 'ready').map((f) => f.family).sort();
  assert.deepEqual([...FAMILY_IDS].sort(), ready);
  for (const f of ready) assert.ok(cases.some((c) => c.family === f), f);
});

test('case ids are unique, spans are in bounds, and every positive carries a contract expectation', () => {
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    if (c.kind !== 'positive') { assert.equal(c.expected, null); continue; }
    assert.ok(c.expected.end > c.expected.start && c.expected.end <= Buffer.byteLength(c.text), c.id);
    assert.ok(c.expectedType && c.expectedAction, c.id);
  }
});
