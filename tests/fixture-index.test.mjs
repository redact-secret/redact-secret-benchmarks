import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import { buildFixtureIndex, fixtureIndexProblems, fixtureSemanticIdentity } from '../benchmarks/lib/fixture-index.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const categories = await read('benchmarks/categories.json');
const taxonomy = await read('benchmarks/support/taxonomy.json');
const scenarios = await read('benchmarks/scenarios.json');
const reviewed = await read('benchmarks/fixture-semantics.json');
const committed = await read('benchmarks/fixture-index.json');
const corpora = Object.fromEntries(await Promise.all(categories.filter(c => !c.calibrationOnly).map(async c => [c.id, await read(c.corpus)])));
const build = (changes = {}) => buildFixtureIndex({ categories, corpora, taxonomy, scenarios, reviewed, ...changes });
const clone = value => structuredClone(value);

test('scenario registry, reviewed semantics, and generated index satisfy their versioned schemas', async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  for (const [value, file] of [[scenarios, 'schemas/scenarios-v1.json'], [reviewed, 'schemas/fixture-semantics-v1.json'], [committed, 'schemas/fixture-index-v1.json']]) {
    const validate = ajv.compile(await read(file));
    assert.equal(validate(value), true, `${file}: ${JSON.stringify(validate.errors)}`);
  }
});

test('the committed index is the deterministic projection of all 2,990 public fixtures', () => {
  assert.deepEqual(committed, build());
  assert.equal(committed.identity.fixtureCount, 2990);
  assert.deepEqual(fixtureIndexProblems(committed), []);
  assert.deepEqual(fixtureSemanticIdentity(committed), committed.identity);
  assert.equal(new Set(committed.fixtures.map(f => f.slug)).size, 2990);
  assert.equal(committed.fixtures.filter(f => !f.scenarioIds.length).length, 0);
  assert.equal(committed.fixtures.filter(f => !f.familyIds.length && !f.unscopedReason).length, 0);
  assert.ok(committed.fixtures.every(f => !Object.hasOwn(f, 'content') && !Object.hasOwn(f, 'expected') && !Object.hasOwn(f, 'assessment')));
});

test('index membership preserves canonical IDs, paths, suite corpora, and the public/holdout boundary', () => {
  const source = new Map(categories.filter(c => !c.calibrationOnly).flatMap(c => corpora[c.id].fixtures.map(f => [`${c.id}--${f.id}`, { category: c, fixture: f }])));
  assert.equal(source.size, committed.fixtures.length);
  for (const entry of committed.fixtures) {
    const authored = source.get(entry.slug);
    assert.ok(authored, entry.slug);
    assert.equal(entry.source.categoryId, authored.category.id);
    assert.equal(entry.source.fixtureId, authored.fixture.id);
    assert.equal(entry.source.corpus, authored.category.corpus);
    assert.equal(entry.source.path, authored.fixture.path);
    assert.ok(!entry.source.corpus.includes('holdout/'));
    if (authored.fixture.twinOf) assert.equal(entry.relations?.twinOf, `${authored.category.id}--${authored.fixture.twinOf}`);
  }
});

test('representative AWS, GitHub, SendGrid, global, multi-family, and beta.8 fixtures are explicit', () => {
  const at = slug => committed.fixtures.find(f => f.slug === slug);
  assert.ok(at('accuracy--aws-id').familyIds.includes('aws:iam-user-access-key'));
  assert.deepEqual(at('common-formats--github-token-ghp-plain').familyIds, ['github:classic-personal-access-token']);
  assert.ok(at('sendgrid-regressions--base62-bare').familyIds.includes('sendgrid:api-key'));
  assert.deepEqual(at('accuracy--ordinary-text').familyIds, []);
  assert.match(at('accuracy--ordinary-text').unscopedReason, /global benchmark control/);
  assert.deepEqual(at('sendgrid-regressions--base62-bearer').familyIds, ['generic:bearer-token', 'sendgrid:api-key']);
  assert.ok(at('sendgrid-regressions--base62-bearer').scenarioIds.includes('cross-family-interactions'));
  const regression = at('beta8-213d--databricks-personal-access-token-env');
  assert.ok(regression.scenarioIds.includes('regression-behavior'));
  assert.deepEqual({ milestone: regression.provenance.milestone, release: regression.provenance.release }, { milestone: 'beta.8', release: '0.1.0-beta.8' });
});

test('generation rejects missing, orphaned, duplicate, unscoped, and referentially invalid review data', () => {
  const missing = clone(reviewed); missing.fixtures.pop();
  assert.throws(() => build({ reviewed: missing }), /1 missing, 0 orphan/);
  const orphan = clone(reviewed); orphan.fixtures.push({ slug: 'unknown--fixture', familyIds: [], scenarioIds: ['regression-behavior'], unscopedReason: 'test' });
  assert.throws(() => build({ reviewed: orphan }), /0 missing, 1 orphan/);
  const duplicate = clone(reviewed); duplicate.fixtures.push(clone(duplicate.fixtures[0]));
  assert.throws(() => build({ reviewed: duplicate }), /Duplicate reviewed fixture slug/);
  const noReason = clone(reviewed); delete noReason.fixtures.find(f => !f.familyIds.length).unscopedReason;
  assert.throws(() => build({ reviewed: noReason }), /Unscoped fixture needs a reason/);
  const noScenario = clone(reviewed); noScenario.fixtures[0].scenarioIds = [];
  assert.throws(() => build({ reviewed: noScenario }), /no reviewed scenario/);
  const badFamily = clone(reviewed); badFamily.fixtures[0].familyIds = ['missing:family'];
  assert.throws(() => build({ reviewed: badFamily }), /Unknown family/);
  const badScenario = clone(reviewed); badScenario.fixtures[0].scenarioIds = ['missing-scenario'];
  assert.throws(() => build({ reviewed: badScenario }), /Unknown scenario/);
});

test('semantic identity binds schema, reviewed assignments, scenarios, and taxonomy for #336 snapshots', () => {
  const original = committed.identity.digest;
  const changedReview = clone(reviewed);
  changedReview.fixtures[0].scenarioIds = [...changedReview.fixtures[0].scenarioIds, 'regression-behavior'].sort();
  assert.notEqual(build({ reviewed: changedReview }).identity.digest, original);
  const changedScenarios = clone(scenarios); changedScenarios.scenarios[0].description += ' Reviewed change.';
  assert.notEqual(build({ scenarios: changedScenarios }).identity.digest, original);
  const changedTaxonomy = clone(taxonomy); changedTaxonomy.families[0].description += ' Reviewed change.';
  assert.notEqual(build({ taxonomy: changedTaxonomy }).identity.digest, original);
  const tampered = clone(committed); tampered.fixtures[0].scenarioIds.push('regression-behavior');
  assert.match(fixtureIndexProblems(tampered).join('\n'), /semantic identity does not match/);
});
