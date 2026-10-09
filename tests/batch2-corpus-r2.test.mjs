import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { AXES, cases, corpusDigest, partDigest, PARTS, FAMILY_IDS } from '../benchmarks/corpora/credential-carriers/corpus-r2.mjs';
import { corpusDigest as round1Digest } from '../benchmarks/corpora/credential-carriers/corpus.mjs';

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const frozen = read('benchmarks/corpora/credential-carriers/FROZEN-r2.json');
const round1 = read('benchmarks/corpora/credential-carriers/FROZEN.json');

test('round 1 is untouched and round 2 is the frozen corpus', () => {
  assert.equal(round1Digest(), round1.sha256);
  assert.equal(corpusDigest(), frozen.sha256);
  for (const p of PARTS) assert.equal(partDigest(p), frozen.parts[p].sha256);
  assert.equal(cases.length, frozen.cases);
});

test('every case names axes that are defined, ids are unique, spans are in bounds', () => {
  assert.equal(new Set(cases.map((c) => c.id)).size, cases.length);
  for (const c of cases) {
    for (const a of c.axes) assert.ok(AXES[a], `${c.id}: ${a}`);
    if (c.kind !== 'positive') continue;
    for (const s of [c.expected, ...c.expectedExtra]) assert.ok(s.end > s.start && s.end <= Buffer.byteLength(c.text), c.id);
    assert.ok(c.expectedType && c.expectedAction, c.id);
  }
  assert.ok(FAMILY_IDS.length >= 57);
});

test('new-rows part covers exactly the rows evidence marked newly ready', () => {
  const readiness = read('evidence/739/readiness.json');
  const newly = new Set(cases.filter((c) => c.part === 'new-rows').map((c) => c.family));
  assert.equal(newly.size, 28);
  for (const f of newly) assert.equal(readiness.families.find((r) => r.family === f).status, 'ready');
});
