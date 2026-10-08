import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { syntheticEvidenceComparison, syntheticFutureEvidenceOfficialUpload } from './helpers/pii-evidence-comparison-fixture.mjs';
import { collectEvidenceComparison } from '../scripts/record-pii-evidence-comparison.mjs';
import { PII_EVIDENCE_DIRECTORY, PII_EVIDENCE_INDEX, PII_EVIDENCE_VIEW, piiEvidencePublication, piiEvidencePublicationProblems, writePiiEvidencePublication } from '../scripts/pii-evidence-publication.mjs';

async function root(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'pii-evidence-publication-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('an absent record publishes a separate population state without zero measurements', async t => {
  const dir = await root(t), result = await writePiiEvidencePublication(dir);
  assert.equal(result.index.populationScope, 'pii-evidence-derived-only');
  assert.equal(result.index.pooledWithBenchmarkPopulations, false);
  assert.equal(result.view.comparison.state, 'absent');
  assert.equal(result.view.comparison.qualified, false);
  assert.equal(result.view.comparison.supportClaims, false);
  assert.equal(result.view.comparison.metrics, undefined);
  assert.equal(result.view.comparison.counts, undefined);
  assert.deepEqual(await piiEvidencePublicationProblems(dir), []);
  const text = await readFile(path.join(dir, PII_EVIDENCE_VIEW), 'utf8');
  assert.equal(result.index.view.sha256, createHash('sha256').update(text).digest('hex'));
});

test('malformed public input fails closed before writing either publication file', async t => {
  const dir = await root(t);
  await mkdir(path.join(dir, PII_EVIDENCE_DIRECTORY), { recursive: true });
  await writeFile(path.join(dir, PII_EVIDENCE_DIRECTORY, 'plan.json'), '{');
  assert.equal((await piiEvidencePublication(dir)).view.comparison.state, 'invalid');
  await assert.rejects(writePiiEvidencePublication(dir), /inputs-invalid/);
  await assert.rejects(readFile(path.join(dir, PII_EVIDENCE_INDEX)), { code: 'ENOENT' });
  await assert.rejects(readFile(path.join(dir, PII_EVIDENCE_VIEW)), { code: 'ENOENT' });
});

test('publication index and view tampering are rejected independently', async t => {
  const dir = await root(t), original = await writePiiEvidencePublication(dir);
  await writeFile(path.join(dir, PII_EVIDENCE_INDEX), JSON.stringify({ ...original.index, qualified: true }));
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-index-mismatch']);
  await writePiiEvidencePublication(dir);
  await writeFile(path.join(dir, PII_EVIDENCE_VIEW), '{}');
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-view-mismatch']);
  await writeFile(path.join(dir, PII_EVIDENCE_INDEX), '{');
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-malformed']);
});

test('fixed public source bytes are bound even before a measurement is recorded', async t => {
  const dir = await root(t);
  await mkdir(path.join(dir, PII_EVIDENCE_DIRECTORY), { recursive: true });
  const file = path.join(dir, PII_EVIDENCE_DIRECTORY, 'plan.json');
  await writeFile(file, JSON.stringify(syntheticEvidenceComparison().plan));
  const before = await writePiiEvidencePublication(dir);
  assert.deepEqual(before.index.sources.map(row => row.path), [`${PII_EVIDENCE_DIRECTORY}/plan.json`]);
  await writeFile(file, '{ "synthetic": true }');
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-index-mismatch']);
});

test('missing output is unavailable, and protected or authority files are not inputs', async t => {
  const dir = await root(t);
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-missing']);
  // A root with no authority or protected data is sufficient for public absence.
  assert.equal((await piiEvidencePublication(dir)).view.comparison.state, 'absent');
});

test('verified synthetic comparison publishes every metric and outcome without pooling', async t => {
  const dir = await root(t), input = syntheticEvidenceComparison();
  const folder = path.join(dir, PII_EVIDENCE_DIRECTORY);
  await mkdir(folder, { recursive: true });
  for (const name of ['plan', 'receipt', 'populationIndex']) {
    await writeFile(path.join(folder, `${name === 'populationIndex' ? 'population-index' : name}.json`), JSON.stringify(input[name]));
  }
  for (const row of input.artifacts) await writeFile(path.join(folder, `${row.side}.public-synthetic-artifact.json`), row.text);
  const result = await writePiiEvidencePublication(dir);
  assert.equal(result.view.comparison.state, 'recorded');
  assert.equal(result.view.comparison.qualified, false);
  const source = JSON.parse(input.artifacts[0].text).semantic;
  assert.equal(result.view.comparison.metrics.length, source.scannerMetrics[0].metrics.length);
  assert.equal(result.view.comparison.outcomes.length, source.outcomes.length);
  assert.equal(result.view.comparison.population.digest, input.plan.population.digest);
  assert.deepEqual(await piiEvidencePublicationProblems(dir), []);
  await writeFile(path.join(folder, 'baseline.public-synthetic-artifact.json'), `${input.artifacts[0].text} `);
  assert.deepEqual(await piiEvidencePublicationProblems(dir), ['pii-evidence-publication-index-mismatch']);
  await assert.rejects(writePiiEvidencePublication(dir), /inputs-invalid/);
});

test('duplicate keys in public JSON fail closed instead of choosing a pin', async t => {
  const dir = await root(t);
  await mkdir(path.join(dir, PII_EVIDENCE_DIRECTORY), { recursive: true });
  await writeFile(path.join(dir, PII_EVIDENCE_DIRECTORY, 'plan.json'), '{"schema":"synthetic","schema":"other"}');
  assert.equal((await piiEvidencePublication(dir)).view.comparison.state, 'invalid');
});

test('an orphan canonical record is invalid without its receipt', async t => {
  const dir = await root(t);
  await mkdir(path.join(dir, PII_EVIDENCE_DIRECTORY), { recursive: true });
  await writeFile(path.join(dir, PII_EVIDENCE_DIRECTORY, 'record.json'), '{}');
  assert.equal((await piiEvidencePublication(dir)).view.comparison.state, 'invalid');
  await assert.rejects(writePiiEvidencePublication(dir), /inputs-invalid/);
});

test('a future reviewed snapshot publishes against its plan instead of the initial anchor', async t => {
  const dir = await root(t), input = syntheticFutureEvidenceOfficialUpload();
  const { record } = collectEvidenceComparison(input);
  const folder = path.join(dir, PII_EVIDENCE_DIRECTORY);
  await mkdir(folder, { recursive: true });
  for (const [name, value] of Object.entries({ plan: input.plan, receipt: input.receipt, record, 'population-index': input.populationIndex }))
    await writeFile(path.join(folder, `${name}.json`), JSON.stringify(value));
  for (const row of input.artifacts) await writeFile(path.join(folder, `${row.side}.public-synthetic-artifact.json`), row.text);
  const result = await writePiiEvidencePublication(dir);
  assert.equal(result.view.comparison.state, 'recorded');
  assert.equal(result.view.comparison.evidence.snapshot.id, input.plan.evidence.snapshot.id);
  assert.notEqual(result.view.comparison.evidence.snapshot.id, syntheticEvidenceComparison().plan.evidence.snapshot.id);
  assert.equal(result.view.comparison.qualified, false);
  assert.deepEqual(await piiEvidencePublicationProblems(dir), []);
});
