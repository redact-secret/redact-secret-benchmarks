import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { categoriesOf, loadPopulations, populationProblems } from '../fixtures/generated/populations.mjs';
import { materializationReport } from '../scripts/check-public-materialization.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const generator = ['--import', 'tsx', 'scripts/generate-fixtures.mjs'];

// Synthetic inputs only: the tests state the rules, never what the committed ledger holds.
const manifest = {
  schemaVersion: 1,
  populations: [
    { id: 'regression-corpus', categories: ['reg-a'], qualificationOnlyCategories: ['reg-q'] },
    { id: 'policy-corpus', categories: ['pol-a'] },
    { id: 'public-evidence-snapshot', remainder: true },
  ],
};
const inputs = {
  manifest,
  generatedIds: ['reg-a', 'pol-a', 'pub-a', 'pub-b'],
  qualificationInputs: { populations: [{ id: 'regression-corpus' }, { id: 'public-evidence-snapshot' }, { id: 'policy-corpus', currentLocation: { category: 'pol-a' } }] },
  regressionManifest: { categories: ['reg-a'], qualificationCategories: ['reg-q'] },
};
const clone = value => JSON.parse(JSON.stringify(value));

test('the remainder population owns every category no product population lists', () => {
  const ids = inputs.generatedIds;
  assert.deepEqual(categoriesOf(manifest, 'regression-corpus', ids), ['reg-a']);
  assert.deepEqual(categoriesOf(manifest, 'policy-corpus', ids), ['pol-a']);
  assert.deepEqual(categoriesOf(manifest, 'public-evidence-snapshot', ids), ['pub-a', 'pub-b']);
  assert.throws(() => categoriesOf(manifest, 'nope', ids), /Unknown generated population/);
});

test('a consistent partition has no problems', () => {
  assert.deepEqual(populationProblems(inputs), []);
});

test('a category in two populations, a missing generator, a second remainder and a drifted product list are each a problem', () => {
  const twice = clone(inputs);
  twice.manifest.populations[1].categories.push('reg-a');
  assert.match(populationProblems(twice).join('\n'), /reg-a is in regression-corpus and policy-corpus/);

  const missing = clone(inputs);
  missing.manifest.populations[0].categories.push('ghost');
  assert.match(populationProblems(missing).join('\n'), /names ghost, which no generator builds/);

  const two = clone(inputs);
  two.manifest.populations[0].remainder = true;
  assert.match(populationProblems(two).join('\n'), /exactly one population owns the remainder/);

  const drift = clone(inputs);
  drift.regressionManifest.categories.push('pub-a');
  assert.match(populationProblems(drift).join('\n'), /regression-corpus categories differ/);

  const policy = clone(inputs);
  policy.qualificationInputs.populations[2].currentLocation.category = 'pub-b';
  assert.match(populationProblems(policy).join('\n'), /policy-corpus category differs/);

  const unknown = clone(inputs);
  unknown.manifest.populations[0].id = 'other-corpus';
  assert.match(populationProblems(unknown).join('\n'), /other-corpus is not a population of benchmarks\/qualification-inputs.json/);
});

test('the committed partition holds against the committed generators and population files', async () => {
  const { buildCorpora } = await import('../fixtures/generated/build.mjs');
  const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
  const problems = populationProblems({
    manifest: loadPopulations(),
    generatedIds: Object.keys(buildCorpora()),
    qualificationInputs: read('benchmarks/qualification-inputs.json'),
    regressionManifest: read('corpora/regression/manifest.json'),
  });
  assert.deepEqual(problems, []);
});

test('materialization: same bytes are kept, absent bytes are loss, a different span is reported not failed', () => {
  const fixtures = [
    { category: 'c', id: 'same', content: 'a', expected: [{ start: 0, end: 1 }] },
    { category: 'c', id: 'moved', content: 'b', expected: [{ start: 0, end: 1 }] },
    { category: 'c', id: 'gone', content: 'z', expected: [] },
  ];
  const cases = [
    { id: 'x--same', content: 'a', expected: [{ start: 0, end: 1, role: 'secret' }] },
    { id: 'x--moved', content: 'b', expected: [] },
  ];
  const report = materializationReport({ fixtures, cases });
  assert.equal(report.kept, 2);
  assert.deepEqual(report.loss, [{ category: 'c', id: 'gone' }]);
  assert.deepEqual(report.differing, [{ category: 'c', id: 'moved', snapshotCases: ['x--moved'] }]);
});

test('a population run needs --check or --ensure and refuses an unknown population', () => {
  const run = args => spawnSync(process.execPath, [...generator, ...args], { cwd: root, encoding: 'utf8' });
  assert.notEqual(run(['--population', 'policy-corpus']).status, 0);
  const unknown = run(['--check', '--population', 'nope']);
  assert.notEqual(unknown.status, 0);
  assert.match(unknown.stderr, /Unknown generated population nope/);
});

test('a population run checks only that population and writes nothing outside it', () => {
  const result = spawnSync(process.execPath, [...generator, '--ensure', '--population', 'policy-corpus'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Checked populations policy-corpus/);
  assert.doesNotMatch(result.stdout, /Checked sendgrid-regressions/);
});
