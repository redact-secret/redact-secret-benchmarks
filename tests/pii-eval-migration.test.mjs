import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import record from '../benchmarks/pii-eval-migration.json' with { type: 'json' };
import { buildConversion, manifestFor, observationFor, oracleInput, rosterFor, snapshotFor, VIEWS } from '../scripts/lib/pii-population-conversion.mjs';
import { renderReport } from '../scripts/lib/pii-population-report.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const dual = record.benchmarkPopulationDualRun;
const report = JSON.parse(read(dual.report.path));

test('PII migration pins the four product populations separately and changes no authority', async () => {
  assert.equal(record.authorityChanged, false);
  assert.deepEqual(record.benchmarkPopulations.views.map(row => row.id), VIEWS);
  assert.equal(new Set(record.benchmarkPopulations.plans.map(row => row.family)).size, 6);
  assert.equal(record.upstreamParity.compatibilityDifferences, 0);
  assert.equal(record.upstreamParity.canonicalClassifications.unexplained, 0);
  assert.equal(record.acceptance.benchmarkPopulationDualRun, 'accepted');
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/check-pii-eval-migration.mjs']);
  assert.match(stdout, /consistent/);
});

test('the dual run has zero unexplained differences and says exactly what it did not cover', () => {
  assert.equal(report.verdict.unexplainedDifferences, 0);
  assert.equal(report.verdict.populations, 4);
  assert.equal(report.supportClaims, false);
  assert.equal(report.authorityChanged, false);
  const classes = new Set(report.populations.flatMap(p => p.classifiedDifferences.map(d => d.class)));
  assert.deepEqual([...classes], ['compatibility']);
  for (const p of report.populations) {
    assert.equal(p.conversion.convertedCases + p.conversion.excludedCases, p.conversion.benchmarkCases);
    assert.equal(p.unexplained, 0);
    assert.equal(p.artifact.schemaVersion, '1.4');
    assert.equal(p.artifact.semanticDigestRecomputed, true);
    assert.equal(p.artifact.validatedAgainstSnapshotAndRoster, true);
    assert.equal(p.projection.mode, 'exploratory');
    assert.equal(p.projection.bindingsEqualToManifest, true);
    assert.equal(p.comparisonDetectsInjectedDifferences, true);
  }
  assert.equal(dual.coverage.carriedCases + dual.coverage.notRepresentableCases, dual.coverage.benchmarkCases);
  assert.equal(dual.coverage.notRepresentableCases, 0);
  assert.equal(dual.coverage.locatedCases + dual.coverage.unresolvedRangeCases, dual.coverage.carriedCases);
  assert.equal(record.acceptance.residual.notRepresentableCases, dual.coverage.notRepresentableCases);
});

test('at least two same-input runs have one semantic digest and byte-identical documents', () => {
  for (const p of report.populations) {
    assert.ok(p.determinism.replays >= 2);
    assert.equal(p.determinism.equalSemanticDigest, true);
    assert.equal(p.determinism.byteIdenticalDocuments, true);
    assert.deepEqual(p.determinism.scannersLaunched, [0, 0, 0]);
  }
});

test('wrong population, activation, candidate, product kind and configuration bindings are refused by the engine', () => {
  const byName = Object.fromEntries(report.bindingRejections.map(row => [row.case, row]));
  assert.equal(byName['control-same-population'].exit, 0);
  for (const name of ['wrong-population', 'wrong-population-snapshot', 'wrong-activation', 'wrong-candidate', 'released-instead-of-candidate', 'wrong-configuration']) {
    assert.equal(byName[name].exit, 4, name);
    assert.equal(byName[name].outputWritten, false, name);
    assert.match(byName[name].refusal, /^provenance-mismatch: /, name);
  }
});

test('the conversion is deterministic, keeps populations separate and never invents an identity', () => {
  const a = buildConversion(), b = buildConversion();
  assert.deepEqual(a.populations.map(p => p.view), VIEWS);
  let carried = 0;
  for (const [index, bucket] of a.populations.entries()) {
    const digests = [a, b].map(ctx => {
      const bk = ctx.populations[index];
      const snapshot = snapshotFor(bk, ctx);
      return [snapshot.semanticDigest, manifestFor(snapshot, ctx).semanticDigest, observationFor(bk, snapshot, ctx).semanticDigest, JSON.stringify(rosterFor(bk))];
    });
    assert.deepEqual(digests[0], digests[1]);
    assert.equal(bucket.cases.length + bucket.excluded.length, record.benchmarkPopulations.views[index].cases);
    assert.ok(bucket.excluded.every(row => row.reason === 'identity-not-established'));
    assert.ok(bucket.cases.every(row => (row.rangeless ? row.type === 'not-established' && row.candidate === null && row.sensitivity === 'not-established' : row.type === 'valid' || row.type === 'invalid')));
    assert.equal(new Set(bucket.cases.map(row => row.id)).size, bucket.cases.length);
    const input = oracleInput(bucket);
    assert.equal(input.population.visibility, 'public-synthetic');
    assert.ok(input.cases.every(row => row.method === 'schema-only'));
    carried += bucket.cases.length;
  }
  assert.equal(carried, dual.coverage.carriedCases);
  // One population's digest is not another's: no pooling.
  assert.equal(new Set(dual.artifacts.map(row => row.snapshotDigest)).size, 4);
});

test('the Markdown report is the rendering of the record and the record holds no input text', () => {
  assert.equal(read(dual.report.markdown), renderReport(report));
  const published = [read(dual.report.path), read(dual.report.markdown), ...dual.artifacts.map(row => read(row.path))].join('\n');
  const ctx = buildConversion();
  for (const bucket of ctx.populations) for (const row of bucket.cases) {
    if (row.value.length >= 12) assert.ok(!published.includes(row.value), `a matched value of ${row.id} appears in a published record`);
  }
});

test('the checked-in artifacts are the 1.4 projection of the pinned populations only', () => {
  for (const item of dual.artifacts) {
    const artifact = JSON.parse(read(item.path));
    assert.equal(artifact.schemaVersion, '1.4');
    assert.equal(artifact.semantic.runClass, 'public-synthetic');
    assert.equal(artifact.semantic.population.visibility, 'public-synthetic');
    assert.deepEqual(artifact.semantic.productProjection.requiredViews, [item.view]);
    assert.equal(new Set(artifact.semantic.productProjection.rows.map(row => row.family)).size, artifact.semantic.productProjection.rows.length);
  }
});
