import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { TWIN_SCOPE_CATEGORY, TWIN_SCOPE_TWINS, buildTwinScopeCorpus } from '../fixtures/generated/twin-scope.mjs';
import { exportPopulation } from '../benchmarks/qualification/population-snapshot.ts';
import { twinScopeMapProblems, TWIN_SCOPE_ID, qualificationCategories } from '../benchmarks/qualification/twin-scope.ts';
import { checkQualificationInputs } from '../scripts/check-qualification-inputs.mjs';

// The project twin-scope corpus (#602): cross-provider twins carried with their parent's family. Structure only: no count, digest or ledger value is asserted.

const corpus = () => buildTwinScopeCorpus();

test('every twin is carried with its parent, and its contract is the family its parent targets', () => {
  const fixtures = corpus().fixtures;
  const byId = new Map(fixtures.map(f => [f.id, f]));
  assert.equal(fixtures.filter(f => f.twinOf).length, TWIN_SCOPE_TWINS.length);
  for (const f of fixtures.filter(f => f.twinOf)) {
    const parent = byId.get(f.twinOf);
    assert.ok(parent, `${f.id} twins ${f.twinOf}, which the corpus carries`);
    assert.equal(f.assessment.kind, 'must-not-flag');
    // The twin's family is its parent's: this is what lets the engine scope it.
    assert.deepEqual([f.assessment.contract], (parent.arrivalTargets ?? parent.detectors).slice(0, 1));
    assert.equal(parent.assessment.kind, 'must-redact');
    assert.notEqual(parent.assessment.tier, 'T0', 'a copy keeps the tier of its original, so its pair is scored');
  }
});

test('the corpus is a byte-for-byte copy of authored fixtures and names the category it copies', () => {
  const corpora = buildCorpora();
  for (const f of corpus().fixtures) {
    const source = corpora[f.copyOf]?.fixtures.find(x => x.id === f.id);
    assert.ok(source, `${f.id} is authored in ${f.copyOf}`);
    assert.equal(f.content, source.content);
    assert.deepEqual(f.expected, source.expected);
    assert.deepEqual(f.assessment, source.assessment);
  }
});

test('the category is measured by the qualification path only: the regression population exports it, no legacy partition, catalog or generated corpus lists it', async () => {
  assert.ok(!(TWIN_SCOPE_CATEGORY in buildCorpora()));
  assert.deepEqual(await qualificationCategories(), [TWIN_SCOPE_CATEGORY]);
  assert.deepEqual(await checkQualificationInputs(), []);
  const regression = JSON.parse(await readFile(new URL('../corpora/regression/manifest.json', import.meta.url), 'utf8'));
  assert.ok(!regression.categories.includes(TWIN_SCOPE_CATEGORY));
  const catalog = JSON.parse(await readFile(new URL('../benchmarks/categories.json', import.meta.url), 'utf8'));
  assert.ok(!catalog.some(c => c.id === TWIN_SCOPE_CATEGORY));
  const exported = await exportPopulation('regression-corpus');
  assert.ok(exported.categories.includes(TWIN_SCOPE_CATEGORY));
  const mine = exported.snapshot.cases.filter(c => c.id.startsWith(`${TWIN_SCOPE_CATEGORY}--`));
  assert.equal(mine.length, corpus().fixtures.length);
  for (const c of mine.filter(c => c.twin)) assert.ok(c.grouping.family, `${c.id} carries a family in the snapshot`);
  for (const c of mine) assert.ok(exported.metadata[c.id].axisCategory, `${c.id} names the category it copies`);
});

test('a twin-scope map is validated structurally: identity, one to one, and project ids in a twin-scope category', () => {
  const ok = { schemaVersion: 1, id: TWIN_SCOPE_ID, population: 'public-evidence-snapshot', scopedBy: 'regression-corpus', owner: 'redact-secret-benchmarks',
    snapshot: { corpusDigest: `sha256:${'a'.repeat(64)}`, cases: 10 }, derivation: { join: 'j', familyLessTwins: 3, mapped: 2, categories: ['cat'] },
    twins: { 'pub--x': 'cat--x', 'pub--y': 'cat--y' } };
  assert.deepEqual(twinScopeMapProblems(ok), []);
  assert.ok(twinScopeMapProblems(null).length);
  assert.ok(twinScopeMapProblems({ ...ok, id: 'other' }).some(p => /identity/.test(p)));
  assert.ok(twinScopeMapProblems({ ...ok, twins: { 'pub--x': 'cat--x', 'pub--y': 'cat--x' }, derivation: { ...ok.derivation } }).some(p => /one to one/.test(p)));
  assert.ok(twinScopeMapProblems({ ...ok, derivation: { ...ok.derivation, mapped: 1 } }).some(p => /mapped/.test(p)));
  assert.ok(twinScopeMapProblems({ ...ok, twins: { 'pub--x': 'other--x', 'pub--y': 'cat--y' } }).some(p => /twin-scope category/.test(p)));
  assert.ok(twinScopeMapProblems({ ...ok, snapshot: { corpusDigest: 'nope', cases: 1 } }).some(p => /corpusDigest/.test(p)));
});
