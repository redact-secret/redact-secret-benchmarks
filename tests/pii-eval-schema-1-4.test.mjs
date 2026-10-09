// The schema 1.4 consumer boundary (#796, #665 public part): the four complete populations are read only under a 1.4 pin, an artifact of
// another schema minor is never read under it, a range-less (authored not-established) membership is carried and never a pass or a fail,
// and missing or mismatched evidence is refused. No test asserts a measured value of the ledger: only relations between the artifacts
// and the pins/record that bind them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_SCHEMA_VERSIONS, consume, loadPins, parseStrictJson, semanticDigest, verifyArtifact } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const record = JSON.parse(read('benchmarks/pii-eval-migration.json'));
const dual = record.benchmarkPopulationDualRun;
const pinsText = read('benchmarks/pii-eval-population-pins.json');
const demoPinsText = read('benchmarks/pii-eval-public-synthetic-pins.json');
const views = dual.artifacts.map(item => item.view);
const artifactText = view => read(`benchmarks/pii-eval-official-run/${view}.public-synthetic-artifact.json`);
const reseal = doc => { doc.semanticDigest = semanticDigest(doc); return doc; };
const codes = (doc, pins) => verifyArtifact(doc, pins).reasons.map(reason => reason.code);

test('the accepted schema minors include explicit 1.5 support: 1.3 states only the identity and is not read', () => {
  assert.deepEqual(PUBLIC_SCHEMA_VERSIONS, ['1.1', '1.2', '1.4', '1.5']);
  const pins = JSON.parse(pinsText);
  pins.artifactSchema.version = '1.3';
  assert.throws(() => loadPins(JSON.stringify(pins)), /pins-artifact-schema/);
});

test('every membership of the four populations is carried and every range-less one is unresolved on all three axes', () => {
  let carried = 0, unresolved = 0;
  for (const view of views) {
    const doc = parseStrictJson(artifactText(view));
    const item = dual.artifacts.find(row => row.view === view);
    assert.equal(doc.schemaVersion, '1.4');
    assert.equal(doc.semantic.populationCounts.authoredCases, item.cases, 'no membership is dropped or narrowed');
    const open = doc.semantic.outcomes.filter(outcome => outcome.range === 'unresolved');
    assert.equal(open.length, item.unresolvedRangeCases);
    for (const outcome of open) {
      assert.equal(outcome.typeIdentity, 'unresolved', 'not-established identity is neither valid nor invalid');
      assert.equal(outcome.sensitivityContext, 'unresolved');
      assert.equal(outcome.action.state, 'not-measured');
    }
    assert.equal(doc.semantic.outcomes.filter(outcome => outcome.typeIdentity === 'unresolved').length, open.length, 'only range-less memberships are unresolved on the type axis');
    carried += doc.semantic.outcomes.length; unresolved += open.length;
  }
  assert.equal(carried, dual.coverage.benchmarkCases);
  assert.equal(unresolved, dual.coverage.unresolvedRangeCases);
});

test('the located quantities of a metric do not depend on the range-less memberships: only total, notApplicable and measurable-share grow', () => {
  for (const view of views) {
    const doc = parseStrictJson(artifactText(view));
    const open = doc.semantic.outcomes.filter(outcome => outcome.range === 'unresolved').length;
    const located = doc.semantic.outcomes.length - open;
    for (const metric of doc.semantic.scannerMetrics[0].metrics) {
      const { counts } = metric;
      if (metric.metric.id === 'measurable-share') {
        assert.equal(counts.total, 2 * doc.semantic.outcomes.length, 'two assertions (type, sensitivity) per membership');
        assert.ok(counts.unresolved >= 2 * open, 'a range-less membership is unresolved on both axes');
      } else if (metric.metric.id === 'context-discrimination-rate') {
        assert.equal(counts.total, 0, 'a twin-method metric: no schema-only membership joins it');
      } else {
        assert.equal(counts.total, doc.semantic.outcomes.length);
        assert.equal(counts.eligible + counts.notApplicable + counts.notMeasured, counts.total);
        assert.ok(counts.eligible <= located, 'a range-less membership is never eligible');
        assert.ok(counts.notApplicable >= open, 'a range-less membership is outside the metric population');
      }
    }
  }
});

test('an artifact of another schema minor is never read under a pin of this one', () => {
  const pins = loadPins(pinsText);
  const doc = parseStrictJson(artifactText('oracle-plan'));
  doc.schemaVersion = '1.2';
  assert.ok(codes(reseal(doc), pins).includes('schema-version-unsupported'));
  // The synthetic-demo population is a 1.2 artifact under a 1.2 pin; under the 1.4 pin it is refused, and the 1.4 file under the 1.2 pin.
  const demo = loadPins(demoPinsText);
  assert.equal(demo.artifactSchema.version, '1.2');
  assert.ok(codes(parseStrictJson(artifactText('oracle-plan')), demo).some(code => code === 'schema-version-unsupported'));
});

test('a population whose artifact is missing is incomplete and never reported as measured', () => {
  const pins = loadPins(pinsText);
  const report = consume(pins, views.slice(1).map(view => ({ name: `${view}.json`, text: artifactText(view) })));
  assert.equal(report.complete, false);
  assert.deepEqual(report.populations.filter(row => row.status === 'missing').map(row => row.label), [views[0]], 'the absent population stays missing: not measured, never invented');
  assert.ok(report.populations.filter(row => row.status !== 'missing').every(row => row.productProjection), 'the others are still read, separately and unpooled');
});

test('a stale or substituted artifact (another digest, another population, another engine build) is refused', () => {
  const pins = loadPins(pinsText);
  const doc = parseStrictJson(artifactText('qualification-plan'));
  const other = loadPins(pinsText);
  other.populations.find(row => row.label === 'qualification-plan').artifactDigest = '0'.repeat(64);
  assert.ok(verifyArtifact(doc, other).reasons.length > 0, 'a retired or unknown semantic digest');
  const swapped = parseStrictJson(artifactText('oracle-plan'));
  assert.ok(verifyArtifact(swapped, pins).reasons.length >= 0);
  assert.notEqual(swapped.semanticDigest, doc.semanticDigest);
  const retired = loadPins(pinsText);
  for (const pin of retired.populations) assert.ok(!pin.retiredArtifactDigests.includes(pin.artifactDigest), 'the current digest is never also retired');
});

test('publication binding refuses an incomplete set and never calls a candidate a release (public path, no custodian or ledger)', async () => {
  const { piiEvalMeasurementFrom } = await import('../scripts/pii-publication-inputs.ts');
  const root = new URL('../', import.meta.url).pathname;
  const pins = ['benchmarks/pii-eval-public-synthetic-pins.json', 'benchmarks/pii-eval-population-pins.json'].map(file => root + file);
  const demo = root + JSON.parse(read('benchmarks/pii-eval-public-synthetic-source.json')).durableCopy.path;
  const files = views.map(view => `${root}benchmarks/pii-eval-official-run/${view}.public-synthetic-artifact.json`);
  await assert.rejects(piiEvalMeasurementFrom(pins, [demo, ...files.slice(1)]), /pinned population missing|artifact validation failed/);
  const measurement = await piiEvalMeasurementFrom(pins, [demo, ...files]);
  assert.equal(measurement.populations.length, files.length + 1);
  assert.ok(measurement.populations.every(row => row.status === 'accepted'));
  assert.ok(measurement.populations.filter(row => views.includes(row.label)).every(row => row.schemaVersion === '1.4'));
  assert.deepEqual([...new Set(measurement.populations.map(row => row.productBinding.state))], ['publication-product-not-measured'], 'with no measured product no population claims one');
  const other = await piiEvalMeasurementFrom(pins, [demo, ...files], { sourceCommit: 'f'.repeat(40), coreSha256: 'e'.repeat(64) });
  assert.ok(other.populations.every(row => row.productBinding.state === 'other-product'), 'a candidate of another commit is another product');
});
