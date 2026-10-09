import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { historicalBytes, historicalJson, historicalReplayOptions } from './helpers/historical-evidence-archive.mjs';
import { corpusDigest as digest2 } from '../benchmarks/corpora/credential-carriers/corpus-r2.mjs';
import { corpusDigest as digest1 } from '../benchmarks/corpora/credential-carriers/corpus.mjs';

// Round 3 (#739): the replay of the exact candidate 4e004108 on the unchanged frozen corpora.
const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const gz = (p) => JSON.parse(gunzipSync(historicalBytes(p)).toString('utf8'));
const CANDIDATE = '4e0041081aad22d0101bd52db52017b67b5bd3db';
const report = () => historicalJson('evidence/739/round3/report.json');
const ledger = () => historicalJson('evidence/739/ledger.json');

test('the frozen corpora are unchanged by the replay', () => {
  assert.equal(digest2(), read('benchmarks/corpora/credential-carriers/FROZEN-r2.json').sha256);
  assert.equal(digest1(), read('benchmarks/corpora/credential-carriers/FROZEN.json').sha256);
});

test('original round-3 replay binds the unchanged frozen corpora', historicalReplayOptions, () => {
  assert.equal(report().corpora.round2.sha256, digest2());
  assert.equal(report().corpora.round1.sha256, digest1());
});

test('the committed round-3 observations are of the candidate on the frozen corpora, all four surfaces', historicalReplayOptions, () => {
  for (const [name, digest] of [['r2c7', digest2()], ['r2c1', digest2()], ['r1c7', digest1()], ['r1c1', digest1()]]) {
    const o = gz(`evidence/739/round3/observations-candidate-${name}.json.gz`);
    assert.equal(o.sourceCommit, CANDIDATE);
    assert.equal(o.corpus.sha256, digest);
    assert.deepEqual(Object.keys(o.surfaces).sort(), ['cli', 'node', 'python', 'wasm']);
    assert.equal(o.chunkBytes, name.endsWith('c1') ? 1 : 7);
  }
});

test('the report records the difference list against a148dadf without a regression', historicalReplayOptions, () => {
  const v = report().versusPreviousCandidate;
  assert.equal(v.regressions.length, 0);
  assert.equal(v.stillFailing.length, 0);
  assert.equal(v.differences.length, v.distinctCases);
  assert.equal(v.observationsChanged7, v.distinctCases * 8);
  assert.equal(v.round1CorpusDifferences, 0);
  assert.equal(report().batch1.differences7, 0);
});

test('a row leaves "reproduced gap" only when the replay shows no failing case; the conflicts stay recorded', historicalReplayOptions, () => {
  for (const f of ledger().families) {
    assert.ok(f.round3, f.family);
    if (/^fixed by candidate/.test(f.coverage)) assert.equal(f.round3.failingCases.length, 0, f.family);
    if (/reproduced product gap/.test(f.coverage)) assert.ok(f.round3.failingCases.length > 0, f.family);
  }
  const by = Object.fromEntries(ledger().families.map((f) => [f.family, f]));
  assert.ok(by['x:oauth1-access-token-secret'].contractEvidenceConflict);
  assert.ok(by['mongodb-atlas:database-user-password'].contractEvidenceConflict);
  assert.match(by['mongodb-atlas:programmatic-api-private-key'].coverage, /conflict/);
});
