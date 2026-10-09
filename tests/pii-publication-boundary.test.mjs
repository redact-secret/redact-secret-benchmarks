import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { piiBenignCollisionEvidence as committedEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-contract.ts';
import { piiBenignCollisionEvidence as oracleEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiPopulationContract } from '../benchmarks/evaluation/domains/pii/population-contracts.ts';
import { unmeasuredPiiPopulationArtifacts, validatePiiPopulationArtifact, piiPopulationReportCommitment } from '../benchmarks/evaluation/domains/pii/population-artifacts.ts';
import { buildPiiPopulationReport } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2, piiSupportMatrixV2Commitment } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { buildPiiSupportMatrixV2 as buildOracleMatrix } from '../benchmarks/evaluation/domains/pii/support-oracle.ts';
import { populationBindingsFrom, populationOracleBindingsFrom, piiEvalMeasurementFrom } from '../scripts/pii-publication-inputs.ts';
import { piiSupportMatrixProblem } from '../benchmarks/shared/pii-support-model.ts';
import { piiPublicationProductProofProblem } from '../benchmarks/evaluation/domains/pii/publication-product-proof.ts';
import { consume, loadPins } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const files = ['population-a-v2', 'population-b-v1'].map(name => `tests/fixtures/pii-eval/${name}.public-synthetic-artifact.json`);

test('neutral committed contract and absence reports preserve exact oracle bytes and all authored strata', () => {
  assert.deepEqual(committedEvidence, oracleEvidence);
  const reports = unmeasuredPiiPopulationArtifacts();
  assert.deepEqual(reports, reports.map(report => buildPiiPopulationReport(piiPopulationContract, oracleEvidence, [], report.population)));
  assert.deepEqual(buildPiiSupportMatrixV2(), buildOracleMatrix());
  assert.ok(reports.flatMap(report => report.strata).every(row => row.falseAlarmRate === null));
  assert.deepEqual(buildPiiSupportMatrixV2({ populations: reports.map(report => ({ report })) }),
    buildOracleMatrix({ populations: reports.map(report => ({ report, rows: [] })) }));
});

test('a recomputed commitment cannot turn absence into measured legacy population evidence', () => {
  const report = unmeasuredPiiPopulationArtifacts()[0];
  report.observation = { ...report.observation, kind: 'product-observation', candidateArtifactHash: 'a'.repeat(64),
    runId: '00000000-0000-4000-8000-000000000001', scanner: { id: 'redact-secret', version: '0.12.0', configurationHash: 'b'.repeat(64) } };
  report.status = 'partial';
  report.observation.reportArtifactCommitment = piiPopulationReportCommitment(report);
  assert.throws(() => validatePiiPopulationArtifact(report), /bounded oracle/);
  assert.throws(() => buildPiiSupportMatrixV2({ populations: [
    { report }, { report: unmeasuredPiiPopulationArtifacts()[1] },
  ] }), /bounded oracle/);
});

test('current publication refuses raw legacy bundles and comparisons; oracle product binding remains exact', () => {
  assert.throws(() => populationBindingsFrom({ schemaVersion: 1 }, null), /explicit bounded population oracle/);
  const product = { sourceCommit: 'a'.repeat(40), coreSha256: 'b'.repeat(64) };
  const bundle = { schemaVersion: 1, candidate: { sourceCommit: product.sourceCommit, components: { core: product.coreSha256 } },
    comparisons: unmeasuredPiiPopulationArtifacts().map(report => ({ population: report.population,
      baselineReport: report, candidateReport: report, baselineRows: [], candidateRows: [] })) };
  assert.equal(populationOracleBindingsFrom(bundle, product).populations.length, 2);
  assert.throws(() => populationOracleBindingsFrom(bundle, { ...product, coreSha256: 'c'.repeat(64) }), /another product/);
  assert.throws(() => populationOracleBindingsFrom(bundle, { ...product, sourceCommit: 'c'.repeat(40) }), /another product/);
  assert.throws(() => buildPiiSupportMatrixV2({ comparisons: populationOracleBindingsFrom(bundle, product).comparisons }), /bounded oracle/);
});

test('strict engine measurements preserve protocol quantities and unavailable denominators without changing support policy', async () => {
  const measurement = await piiEvalMeasurementFrom('tests/fixtures/pii-eval/pins.json', files);
  const matrix = buildPiiSupportMatrixV2({ piiEvalMeasurement: measurement }), empty = buildPiiSupportMatrixV2();
  assert.deepEqual(matrix.families, empty.families);
  assert.deepEqual(matrix.populationReports, empty.populationReports);
  assert.deepEqual(matrix.populationComparisons, empty.populationComparisons);
  for (const population of measurement.populations) {
    assert.ok(population.scanners[0].metrics.some(metric => metric.value.state === 'withheld'));
    assert.deepEqual(matrix.piiEvalMeasurement.populations.find(row => row.populationId === population.populationId).populationCounts, { ...population.populationCounts });
    assert.deepEqual(matrix.piiEvalMeasurement.populations.find(row => row.populationId === population.populationId).scanners[0].metrics.map(({ quantity, ...metric }) => metric), JSON.parse(JSON.stringify(population.scanners[0].metrics)));
  }
  assert.equal(matrix.piiEvalMeasurement.quantityBasis.protocol, 'pii-v1');
  assert.equal(matrix.piiEvalMeasurement.quantityBasis.verdictReads, 'b11');
  assert.equal(matrix.piiEvalMeasurement.quantityBasis.thresholdsApplied, false);
});

test('engine scorer, population and product pin substitution is refused independently of legacy computation', async () => {
  const pins = loadPins(await readFile('tests/fixtures/pii-eval/pins.json', 'utf8'));
  const artifacts = await Promise.all(files.map(async name => ({ name, text: await readFile(name, 'utf8') })));
  for (const mutate of [
    pin => { pin.protocol.version++; },
    pin => { pin.populations[0].population.populationDigest = 'f'.repeat(64); },
    pin => { pin.populations[0].scanners[0].artifactDigest = 'f'.repeat(64); },
    pin => { pin.populations[0].artifactDigest = 'f'.repeat(64); },
  ]) {
    const other = structuredClone(pins); mutate(other);
    const report = consume(other, artifacts);
    assert.equal(report.complete, false);
    assert.ok(report.rejections.length > 0);
  }
});


test('matching source alone is insufficient; every receipt product, engine, scorer and population identity must match', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-publication-binding-'));
  try {
    const pins = JSON.parse(await readFile('tests/fixtures/pii-eval/pins.json', 'utf8'));
    const product = { sourceCommit: 'a'.repeat(40), coreSha256: 'b'.repeat(64) };
    for (const pin of pins.populations) pin.scanners[0].candidateSourceCommit = product.sourceCommit;
    const pinsFile = path.join(directory, 'pins.json');
    await writeFile(pinsFile, JSON.stringify(pins));
    const proof = { state: 'matched', ...product, packageTreeSha256: pins.populations[0].scanners[0].artifactDigest,
      engineCommit: pins.build.commit, protocol: { id: pins.protocol.id, revision: pins.protocol.version },
      populationDigests: Object.fromEntries(pins.populations.map(row => [row.population.populationId, row.population.populationDigest])) };
    const read = binding => piiEvalMeasurementFrom(pinsFile, files, product, { productBindingLoader: () => binding });
    const same = await read(proof);
    assert.ok(same.populations.every(row => row.productBinding.state === 'measures-publication-product'));
    const published = buildPiiSupportMatrixV2({ piiEvalMeasurement: same });
    assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(published))).artifactCommitment, published.artifactCommitment);
    assert.equal(await piiSupportMatrixProblem(published, published.artifactCommitment), null);
    for (const mutate of [
      value => { delete value.piiEvalMeasurement.populations[0].productBinding.proof; },
      value => { delete value.piiEvalMeasurement.publicationProduct; },
      value => { value.piiEvalMeasurement.populations[0].productBinding.proof.coreSha256 = 'c'.repeat(64); },
      value => { value.piiEvalMeasurement.populations[0].productBinding.proof.packageTreeSha256 = 'c'.repeat(64); },
      value => { value.piiEvalMeasurement.populations[0].productBinding.proof.engineCommit = 'c'.repeat(40); },
      value => { value.piiEvalMeasurement.populations[0].productBinding.proof.protocol.revision++; },
      value => { value.piiEvalMeasurement.populations[0].productBinding.proof.populationDigest = 'c'.repeat(64); },
      value => { value.piiEvalMeasurement.populations[0].productBinding.candidateSourceCommit = 'c'.repeat(40); },
    ]) {
      const tampered = structuredClone(published); mutate(tampered);
      tampered.artifactCommitment = piiSupportMatrixV2Commitment(tampered);
      assert.throws(() => validatePiiSupportMatrixV2(tampered), /proof|schema/);
      assert.ok(piiPublicationProductProofProblem(tampered.piiEvalMeasurement));
      assert.ok(await piiSupportMatrixProblem(tampered, tampered.artifactCommitment), 'the shared/browser reader must reject a rehashed inconsistent proof');
    }
    for (const binding of [{ state: 'absent', reason: 'not-recorded' }, { state: 'invalid', reason: 'receipt-invalid' }]) {
      const absent = await read(binding);
      assert.ok(absent.populations.every(row => row.productBinding.state === 'publication-artifact-not-bound'));
      assert.doesNotThrow(() => buildPiiSupportMatrixV2({ piiEvalMeasurement: absent }));
    }
    for (const mutate of [
      value => { value.sourceCommit = 'c'.repeat(40); },
      value => { value.coreSha256 = 'c'.repeat(64); },
      value => { value.packageTreeSha256 = 'c'.repeat(64); },
      value => { value.engineCommit = 'c'.repeat(40); },
      value => { value.protocol.id = 'b11'; },
      value => { value.protocol.revision++; },
      value => { for (const id of Object.keys(value.populationDigests)) value.populationDigests[id] = 'c'.repeat(64); },
    ]) {
      const bad = structuredClone(proof); mutate(bad);
      assert.ok((await read(bad)).populations.every(row => row.productBinding.state === 'publication-artifact-not-bound'));
    }
    assert.ok((await read({ state: 'other-product', reason: 'core-tarball-mismatch' })).populations.every(row => row.productBinding.state === 'other-product'));
    await assert.rejects(piiEvalMeasurementFrom(pinsFile, files, { ...product, sourceCommit: 'not-a-sha' }), /Invalid measured product/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
