import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';

// #141: the committed operational evidence is schema-valid and keeps its
// measurements, judgement and per-surface values apart.
const read = async p => JSON.parse(await readFile(new URL(p, import.meta.url), 'utf8'));
const schema = await read('../schemas/operational-evidence-v1.json');
const evidence = await read('../benchmarks/operational-evidence.json');
const summary = await read('../evidence/603/summary.json');
const acceptance = await read('../evidence/603/acceptance.json');

test('the committed evidence is schema-valid', () => {
  const validate = new Ajv({ strict: false }).compile(schema);
  assert.ok(validate(evidence), JSON.stringify(validate.errors));
});

test('it describes the same commit as the performance summary and verdict it cites', () => {
  assert.equal(evidence.sourceCommit, summary.sourceCommit);
  assert.equal(evidence.sourceCommit, acceptance.sourceCommit);
  assert.equal(evidence.judgement.status, acceptance.status);
  assert.equal(evidence.judgement.checksTotal, acceptance.checks.length);
});

test('initialization and processing are separate distributions for every row', () => {
  for (const row of evidence.measurements.timings) {
    assert.ok(row.initialization && row.processing, `${row.surface}/${row.profileId}`);
    assert.notDeepEqual(row.initialization, row.processing);
  }
});

test('every measured surface and profile is its own row, never a combined score', () => {
  const measured = summary.runs.filter(r => r.kind === 'performance').map(r => `${r.surface}/${r.profileId}`).sort();
  assert.deepEqual(evidence.measurements.timings.map(r => `${r.surface}/${r.profileId}`).sort(), measured);
  assert.ok(!('score' in evidence.measurements));
});

test('the judgement section carries no size verdict and the limitations disclaim cross-product ranking', () => {
  assert.match(evidence.judgement.note, /Artifact sizes carry no threshold/);
  assert.ok(evidence.limitations.some(l => /No cross-product speed comparison/.test(l)));
});
