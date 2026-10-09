import { historicalArchive, historicalReplayOptions, historicalJson } from './helpers/historical-evidence-archive.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { cases, corpusDigest, CORPUS_VERSION, FAMILY_IDS } from '../benchmarks/corpora/credential-carriers/corpus.mjs';

const frozen = JSON.parse(readFileSync(new URL('../benchmarks/corpora/credential-carriers/FROZEN.json', import.meta.url), 'utf8'));
const readiness = historicalArchive ? historicalJson('evidence/739/readiness.json') : null;

test('the Batch 2 corpus is the frozen one', () => {
  assert.equal(CORPUS_VERSION, frozen.corpusVersion);
  assert.equal(corpusDigest(), frozen.sha256);
  assert.equal(cases.length, frozen.cases);
});

test('historical round 1 uses only families marked ready in original evidence', historicalReplayOptions, () => {
  const ready = new Set(readiness.families.filter((f) => f.status === 'ready').map((f) => f.family));
  for (const f of FAMILY_IDS) assert.ok(ready.has(f), f);
  assert.equal(FAMILY_IDS.length, 30);
  for (const f of FAMILY_IDS) assert.ok(cases.some((c) => c.family === f), f);
});

test('case ids are unique, spans are in bounds, and every positive carries a contract expectation', () => {
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    if (c.kind !== 'positive') { assert.equal(c.expected, null); continue; }
    assert.ok(c.expected.end > c.expected.start && c.expected.end <= Buffer.byteLength(c.text), c.id);
    assert.ok(c.expectedType && c.expectedAction, c.id);
  }
});

test('every current carrier family has authored cases', () => {
  assert.equal(new Set(FAMILY_IDS).size, FAMILY_IDS.length);
  for (const family of FAMILY_IDS) assert.ok(cases.some(row => row.family === family), family);
});
