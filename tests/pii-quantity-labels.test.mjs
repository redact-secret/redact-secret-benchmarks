// The published PII matrix names the quantity of every metric (#795, accepted 2026-10-06). The ten metric ids are shared by `pii-v1` accounting and the
// benchmark's `b11` scorer, so a consumer of the published JSON must be able to tell a generic type miss from a sensitive miss without outside knowledge.
// No ledger value is asserted: the labels are checked against the registry they are derived from, on the committed public artifacts.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { quantityOf } from '../benchmarks/evaluation/domains/pii/metric-basis.mjs';
import { buildPiiSupportMatrixV2, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiEvalMeasurementFrom } from '../scripts/pii-publication-inputs.ts';

const root = new URL('../', import.meta.url).pathname;
const views = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];

const every = (measurement, visit) => {
  for (const population of measurement.populations) {
    for (const scanner of population.scanners) scanner.metrics.forEach(visit);
    for (const row of population.productProjection?.rows ?? []) {
      row.metrics.forEach(visit);
      for (const stratum of [...(row.byLanguage ?? []), ...(row.byControlClass ?? [])]) stratum.metrics.forEach(visit);
    }
  }
};

async function publishedMatrix() {
  const pins = ['benchmarks/pii-eval-public-synthetic-pins.json', 'benchmarks/pii-eval-population-pins.json'].map(file => root + file);
  const demo = root + JSON.parse(readFileSync(`${root}benchmarks/pii-eval-public-synthetic-source.json`, 'utf8')).durableCopy.path;
  const files = views.map(view => `${root}benchmarks/pii-eval-population-dual-run/${view}.public-synthetic-artifact.json`);
  return buildPiiSupportMatrixV2({ piiEvalMeasurement: await piiEvalMeasurementFrom(pins, [demo, ...files]) });
}

test('every published metric carries its quantity and the matrix defines the ten quantities', async () => {
  const published = (await publishedMatrix()).piiEvalMeasurement;
  let seen = 0;
  every(published, item => { seen += 1; assert.equal(item.quantity, quantityOf('pii-v1', item.metric.id).quantity); assert.match(item.quantity, /^pii-v1:/); });
  assert.ok(seen > 0);
  assert.equal(published.quantityBasis.protocol, 'pii-v1');
  assert.equal(published.quantityBasis.verdictReads, 'b11', 'a verdict never reads a pii-v1 number');
  assert.equal(published.quantityBasis.thresholdsApplied, false);
  assert.equal(published.quantityBasis.definitions.length, 10);
  assert.equal(new Set(published.quantityBasis.definitions.map(row => row.name)).size, 10, 'ten distinct quantity names');
  const typeMiss = published.quantityBasis.definitions.find(row => row.id === 'type-miss-rate');
  assert.match(typeMiss.name, /generic, every context/, 'the generic type miss says so; it is not a sensitive miss');
});

test('an unlabelled, relabelled or redefined published matrix is refused, never repaired', async () => {
  const matrix = await publishedMatrix();
  const tamper = change => { const copy = structuredClone(matrix); change(copy.piiEvalMeasurement); return copy; };
  assert.doesNotThrow(() => validatePiiSupportMatrixV2(structuredClone(matrix)));
  assert.throws(() => validatePiiSupportMatrixV2(tamper(m => every(m, item => { delete item.quantity; }))), /quantity|Inconsistent/);
  assert.throws(() => validatePiiSupportMatrixV2(tamper(m => { m.populations[0].scanners[0].metrics[0].quantity = 'b11:type-miss-rate'; })), /quantity|Inconsistent/);
  assert.throws(() => validatePiiSupportMatrixV2(tamper(m => { m.quantityBasis.verdictReads = 'pii-v1'; })), /quantity|schema|Inconsistent/);
  assert.throws(() => validatePiiSupportMatrixV2(tamper(m => { delete m.quantityBasis; })), /quantity|Inconsistent/);
});
