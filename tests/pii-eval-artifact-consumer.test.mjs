import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  consume, loadPins, parseStrictJson, semanticDigest, verifyArtifact,
} from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';
import {
  buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, validatePiiSupportMatrixV2,
} from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiEvalMeasurementFrom } from '../scripts/pii-publication-inputs.ts';

const directory = 'tests/fixtures/pii-eval';
const files = [
  `${directory}/population-a-v2.public-synthetic-artifact.json`,
  `${directory}/population-b-v1.public-synthetic-artifact.json`,
];
const read = file => readFile(file, 'utf8');

async function evidence() {
  const pins = loadPins(await read(`${directory}/pins.json`));
  const artifacts = await Promise.all(files.map(async file => ({ name: file.split('/').at(-1), text: await read(file) })));
  return { pins, artifacts, report: consume(pins, artifacts) };
}

test('strict consumer preserves two populations, ten denominators, withheld values, and immutable build identity', async () => {
  const { report } = await evidence();
  assert.equal(report.complete, true);
  assert.equal(report.decision, 'none');
  assert.equal(report.pooling, 'none');
  assert.equal(report.build.commit, '6157cbc5918b3888c8e84b1884719ea8f3278b36');
  assert.equal(report.build.binarySha256, '532b51347ae8696d444d7cf35b11ce00f975444a29f8ebc22a59f78c120bce26');
  assert.deepEqual(report.populations.map(row => ({ ...row.populationCounts })), [
    { authoredCases: 3, occurrences: 6, variants: 6 },
    { authoredCases: 2, occurrences: 5, variants: 5 },
  ]);
  for (const population of report.populations) {
    assert.equal(population.scanners[0].metrics.length, 10);
    assert.ok(population.scanners[0].metrics.some(metric => metric.value.state === 'withheld'));
    assert.ok(population.scanners[0].metrics.every(metric => metric.counts.total === metric.counts.eligible + metric.counts.notApplicable));
    assert.ok(Object.values(population.unavailable).every(state => state === 'schema-1.1-does-not-carry'));
  }
});

test('strict JSON and semantic digest reject duplicate keys, floats, null, extra structure, and body tampering', async () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}'), /duplicate-key/);
  assert.throws(() => parseStrictJson('{"a":1.0}'), /float-not-allowed/);
  assert.throws(() => parseStrictJson('{"a":null}'), /null-not-allowed/);
  const { pins, artifacts } = await evidence();
  const doc = parseStrictJson(artifacts[0].text);
  doc.semantic.populationCounts.authoredCases++;
  assert.ok(verifyArtifact(doc, pins).reasons.some(reason => reason.code === 'digest-mismatch'));
  const extra = parseStrictJson(artifacts[0].text);
  extra.unsigned = 'not-covered';
  assert.ok(verifyArtifact(extra, pins).reasons.some(reason => ['document-malformed', 'unexpected-top-level-field'].includes(reason.code)));
  assert.notEqual(semanticDigest(doc), doc.semanticDigest);
});

test('candidate/release, scanner/configuration/activation/population, completeness and supersession bindings fail closed', async () => {
  const { pins, artifacts } = await evidence();
  const mutations = [
    [doc => { doc.semantic.scanners[0].identity.product = { kind: 'released' }; }, 'scanner-product-mismatch'],
    [doc => { doc.semantic.scanners[0].identity.configurationDigest = 'f'.repeat(64); }, 'scanner-configuration-mismatch'],
    [doc => { doc.semantic.scanners[0].identity.activationDigest = 'f'.repeat(64); }, 'scanner-activation-mismatch'],
    [doc => { doc.semantic.population.populationVersion++; }, 'population-version-mismatch'],
    [doc => { doc.semantic.completeness = 'partial'; }, 'incomplete-measurement'],
  ];
  for (const [mutate, code] of mutations) {
    const doc = parseStrictJson(artifacts[0].text);
    mutate(doc);
    doc.semanticDigest = semanticDigest(doc);
    assert.ok(verifyArtifact(doc, pins).reasons.some(reason => reason.code === code), code);
  }
  const retired = structuredClone(pins);
  retired.populations[0].retiredArtifactDigests = [retired.populations[0].artifactDigest];
  retired.populations[0].artifactDigest = 'f'.repeat(64);
  assert.ok(verifyArtifact(parseStrictJson(artifacts[0].text), retired).reasons.some(reason => reason.code === 'artifact-superseded'));
  assert.equal(consume(pins, artifacts.slice(0, 1)).complete, false);
});

test('publication input and support matrix bind evidence without changing benchmark-owned verdicts', async () => {
  const report = await piiEvalMeasurementFrom(`${directory}/pins.json`, files);
  const baseline = buildPiiSupportMatrixV2();
  const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: report });
  assert.deepEqual(matrix.distribution, baseline.distribution);
  assert.deepEqual(matrix.families, baseline.families);
  assert.equal(validatePiiSupportMatrixV2(matrix).piiEvalMeasurement?.populations.length, 2);

  const tampered = structuredClone(matrix);
  tampered.piiEvalMeasurement.populations[0].scanners[0].metrics[0].counts.denominator = 999;
  tampered.artifactCommitment = piiSupportMatrixV2Commitment(tampered);
  assert.throws(() => validatePiiSupportMatrixV2(tampered), /schema|measurement evidence/);
});
