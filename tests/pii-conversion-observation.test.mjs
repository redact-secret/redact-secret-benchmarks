import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadPiiConversionObservation, validatePiiConversionObservation, PII_CONVERSION_OBSERVATION_SOURCE } from '../benchmarks/evaluation/domains/pii/conversion-observation.mjs';
import { buildConversion, snapshotFor, manifestFor, observationFor } from '../scripts/lib/pii-population-conversion.mjs';
import migration from '../benchmarks/pii-eval-migration.json' with { type: 'json' };
const input = JSON.parse(readFileSync(new URL('../benchmarks/inputs/pii/conversion-observation.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
test('current conversion input retains only primary-lane findings and original candidate identity', () => {
  const data = loadPiiConversionObservation();
  assert.equal(PII_CONVERSION_OBSERVATION_SOURCE.sha256, migration.benchmarkPopulations.observation.sha256);
  assert.equal(PII_CONVERSION_OBSERVATION_SOURCE.path, migration.benchmarkPopulations.observation.path);
  assert.equal(data.candidate.sourceCommit, migration.benchmarkPopulations.candidate.sourceCommit);
  assert.equal(data.candidate.artifactSetCommitment, migration.benchmarkPopulations.candidate.artifactSetCommitment);
  assert.equal(data.candidate.families.length, 6);
  for (const family of data.candidate.families) {
    assert.equal(family.lanes.length, 1);
    assert.equal(family.lanes[0].lane, 'node-addon');
    assert.equal(family.lanes[0].selection, 'union');
    for (const row of family.lanes[0].cases)
      assert.deepEqual(Object.keys(row), ['id', 'family', 'otherPiiCount', 'otherPiiAtTarget']);
  }
});
test('rehashed source, artifact, case span, missing lane and envelope forgeries fail closed', () => {
  for (const mutate of [v => { v.source.revision = '0'.repeat(40); }, v => { v.source.sha256 = '0'.repeat(64); },
    v => { v.data.candidate.components.core = '0'.repeat(64); }, v => { v.data.candidate.families[0].lanes[0].cases[0].family = [[0, 1, 'redact']]; },
    v => { v.data.candidate.families[0].lanes.length = 0; }, v => { v.ownerAcceptance = 'invented'; }]) {
    const changed = structuredClone(input); mutate(changed); changed.dataSha256 = hash(changed.data);
    assert.throws(() => validatePiiConversionObservation(changed), /binding mismatch/);
  }
});
test('conversion preserves all accepted snapshot and manifest identities and 1188 memberships', () => {
  const ctx = buildConversion();
  let count = 0;
  for (const bucket of ctx.populations) {
    const pinned = migration.benchmarkPopulationDualRun.artifacts.find(row => row.view === bucket.view);
    const snapshot = snapshotFor(bucket, ctx), manifest = manifestFor(snapshot, ctx);
    assert.equal(snapshot.semanticDigest, pinned.snapshotDigest);
    assert.equal(manifest.semanticDigest, pinned.manifestDigest);
    const observation = observationFor(bucket, snapshot, ctx);
    assert.ok(observation.semantic.inputs.length > 0);
    count += bucket.cases.length;
  }
  assert.equal(count, 1188);
});
