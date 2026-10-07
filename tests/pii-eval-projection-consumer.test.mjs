import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { consume, loadPins, parseStrictJson, semanticDigest, verifyArtifact, PROJECTION_MODES, PROJECTION_VIEWS } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const pinsText = read('benchmarks/pii-eval-population-pins.json');
const views = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];
const artifactText = view => read(`benchmarks/pii-eval-official-run/${view}.public-synthetic-artifact.json`);
const clone = value => structuredClone(value);
const reseal = doc => { doc.semanticDigest = semanticDigest(doc); return doc; };
const codes = (doc, pins) => verifyArtifact(doc, pins).reasons.map(reason => reason.code);
/** A pin set that follows a mutated artifact, so the mutation is judged by the projection rules and not by the digest pin. */
const pinsFor = (doc, view = doc.semantic.projection ?? 'oracle-plan') => {
  const pins = loadPins(pinsText);
  const pin = pins.populations.find(row => row.label === view);
  pin.artifactDigest = doc.semanticDigest;
  return pins;
};
const base = view => parseStrictJson(artifactText(view));

test('the four benchmark populations are accepted with their projections, separately and never pooled', () => {
  const pins = loadPins(pinsText);
  const report = consume(pins, views.map(view => ({ name: `${view}.json`, text: artifactText(view) })));
  assert.equal(report.complete, true);
  assert.equal(report.pooling, 'none');
  assert.equal(report.decision, 'none');
  assert.deepEqual(report.rejections, []);
  assert.deepEqual(report.populations.map(row => row.label), views);
  for (const population of report.populations) {
    assert.equal(population.schemaVersion, '1.4');
    assert.equal(population.unavailable, undefined, 'a 1.4 artifact has nothing to mark unavailable');
    assert.deepEqual(population.productProjection.requiredViews, [population.label]);
    assert.ok(population.productProjection.rows.every(row => row.mode === pins.populations.find(pin => pin.label === population.label).projection.mode && row.view === population.label));
    assert.equal(population.productProjection.rows.reduce((n, row) => n + row.counts.authoredCases, 0), population.populationCounts.authoredCases);
  }
  assert.equal(new Set(report.populations.map(row => row.population.populationDigest)).size, 4);
});

test('the vocabulary is closed', () => {
  assert.deepEqual(PROJECTION_VIEWS, [...views].sort());
  assert.deepEqual(PROJECTION_MODES, ['exploratory', 'official']);
});

test('a duplicate family and view row is rejected', () => {
  const doc = base('oracle-plan');
  doc.semantic.productProjection.rows.push(clone(doc.semantic.productProjection.rows[0]));
  reseal(doc);
  assert.ok(codes(doc, pinsFor(doc, 'oracle-plan')).includes('projection-row-duplicate'));
});

test('an absent required view is rejected, from the artifact and from the pin', () => {
  const doc = base('oracle-plan');
  doc.semantic.productProjection.rows = [];
  reseal(doc);
  assert.ok(codes(doc, pinsFor(doc)).includes('projection-view-missing'));
  const pins = loadPins(pinsText);
  pins.populations[0].projection.requiredViews = ['oracle-plan', 'qualification-plan'];
  assert.ok(codes(base('oracle-plan'), pins).includes('projection-view-missing'));
});

test('a view that is not a required view of the artifact is an unknown view', () => {
  const doc = base('oracle-plan');
  doc.semantic.productProjection.rows[0].view = 'qualification-plan';
  reseal(doc);
  assert.ok(codes(doc, pinsFor(doc)).includes('projection-view-unknown'));
});

test('pooled denominators are rejected: a row, a stratum, a metric and the sum of rows', () => {
  let doc = base('oracle-plan');
  const first = doc.semantic.productProjection.rows[0];
  first.counts = { authoredCases: first.counts.authoredCases + 5, occurrences: first.counts.occurrences + 5, variants: first.counts.variants + 5 };
  first.methodCoverage[0].cases += 5; first.methodCoverage[0].variants += 5;
  assert.ok(codes(reseal(doc), pinsFor(doc)).includes('projection-pooled-denominator'));
  doc = base('oracle-plan');
  const metric = doc.semantic.productProjection.rows[0].metrics.find(m => m.metric.id === 'type-miss-rate');
  metric.counts.total = doc.semantic.productProjection.rows[0].counts.authoredCases + 1;
  metric.counts.eligible = metric.counts.total; metric.counts.measured = metric.counts.total; metric.counts.numerator = 0; metric.counts.notApplicable = 0;
  assert.ok(codes(reseal(doc), pinsFor(doc)).includes('projection-pooled-denominator'));
  doc = base('oracle-plan');
  const language = doc.semantic.productProjection.rows.find(row => row.byLanguage?.length);
  language.byLanguage[0].counts = { ...language.counts };
  language.byLanguage.push({ ...clone(language.byLanguage[0]), language: 'zz' });
  assert.ok(codes(reseal(doc), pinsFor(doc)).includes('projection-pooled-denominator'), 'strata that add up to more than their row');
});

test('rows that do not add up to the population are rejected as a count mismatch', () => {
  const doc = base('oracle-plan');
  doc.semantic.productProjection.rows.pop();
  reseal(doc);
  assert.ok(codes(doc, pinsFor(doc)).includes('projection-counts-mismatch'));
});

test('unknown and mixed modes and views are rejected', () => {
  let doc = base('oracle-plan');
  const pinnedMode = loadPins(pinsText).populations.find(row => row.label === 'oracle-plan').projection.mode;
  doc.semantic.productProjection.rows[0].mode = pinnedMode === 'official' ? 'exploratory' : 'official';
  assert.ok(codes(reseal(doc), pinsFor(doc)).includes('projection-mode-mismatch'), 'a row that differs from the pinned mode');
  doc = base('oracle-plan');
  doc.semantic.productProjection.rows[0].mode = 'staging';
  assert.ok(codes(reseal(doc), pinsFor(doc)).some(code => ['document-malformed', 'projection-mode-unknown'].includes(code)), 'unknown mode');
  doc = base('oracle-plan');
  doc.semantic.productProjection.rows[0].view = 'everything';
  doc.semantic.productProjection.requiredViews = ['everything'];
  assert.ok(codes(reseal(doc), pinsFor(doc)).some(code => ['document-malformed', 'projection-view-unknown'].includes(code)), 'unknown view');
});

test('a row whose scanner, configuration, activation, candidate or population binding differs from the artifact is rejected', () => {
  const mutate = change => { const doc = base('oracle-plan'); change(doc.semantic.productProjection.rows[0].binding); return reseal(doc); };
  const another = 'a'.repeat(64);
  for (const [name, change] of [
    ['activation', binding => { binding.activationDigest = another; }],
    ['configuration', binding => { binding.configurationDigest = another; }],
    ['candidate', binding => { binding.product = { kind: 'candidate', candidateDigest: another }; }],
    ['released instead of candidate', binding => { binding.product = { kind: 'released' }; }],
    ['population', binding => { binding.population = { ...binding.population, populationDigest: another }; }],
    ['scanner', binding => { binding.scannerId = 'another-scanner'; }],
  ]) {
    const doc = mutate(change);
    assert.ok(codes(doc, pinsFor(doc)).includes('projection-binding-mismatch'), name);
  }
});

test('another roster, a missing block and an unpinned block are rejected', () => {
  const pins = loadPins(pinsText);
  pins.populations[0].projection.rosterDigest = 'b'.repeat(64);
  assert.ok(codes(base('oracle-plan'), pins).includes('projection-roster-mismatch'));
  const doc = base('oracle-plan');
  delete doc.semantic.productProjection;
  assert.ok(codes(reseal(doc), pinsFor(doc)).some(code => ['projection-missing', 'document-malformed'].includes(code)));
  const unpinned = loadPins(pinsText);
  delete unpinned.populations[0].projection;
  assert.throws(() => loadPins(JSON.stringify(unpinned)), /pins-projection/);
});

test('a projection pin needs schema 1.2 and a 1.2 artifact is not read under a 1.1 pin', () => {
  const pins = JSON.parse(pinsText);
  pins.artifactSchema.version = '1.1';
  assert.throws(() => loadPins(JSON.stringify(pins)), /pins-projection/);
  for (const population of pins.populations) delete population.projection;
  const old = loadPins(JSON.stringify(pins));
  assert.ok(codes(base('oracle-plan'), old).includes('schema-version-unsupported'));
  // and a 1.1 artifact is not read under a 1.2 pin
  const legacy = parseStrictJson(read('tests/fixtures/pii-eval/population-a-v2.public-synthetic-artifact.json'));
  assert.ok(codes(legacy, loadPins(pinsText)).some(code => ['schema-version-unsupported', 'population-not-pinned'].includes(code)));
});

test('the engine, protocol, run class and population identity of a projection artifact stay bound', () => {
  const doc = base('qualification-plan');
  const pins = loadPins(pinsText);
  assert.deepEqual(codes(doc, pins), []);
  const other = clone(doc);
  other.semantic.population.populationDigest = 'c'.repeat(64);
  assert.ok(codes(reseal(other), pins).includes('population-digest-mismatch'));
  const wrongRun = clone(doc);
  wrongRun.semantic.runClass = 'protected';
  assert.ok(codes(reseal(wrongRun), pins).some(code => ['run-class-mismatch', 'document-malformed'].includes(code)));
});
