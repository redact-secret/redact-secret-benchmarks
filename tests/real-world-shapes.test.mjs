import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyFixture, contracts, matches, AXES, REAL_WORLD_AXES } from '../benchmarks/lib/assessment.ts';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const corpus = await read('fixtures/real-world-shapes/corpus.json');
const assignments = await read('benchmarks/fixture-detectors.json');
const fixtures = corpus.fixtures;

test('real-world-shapes has fixtures to test', () => {
  assert.ok(fixtures.length > 0);
});

test('no fixture in the category carries `detectors`, and every fixture-detectors.json entry for it is empty (#95, untargeted by construction)', () => {
  for (const f of fixtures) {
    assert.equal(f.detectors, undefined, f.id);
    assert.deepEqual(assignments[`real-world-shapes--${f.id}`] ?? [], [], f.id);
  }
});

test('every fixture classifies to must-not-flag/T3 — never pending', () => {
  for (const f of fixtures) {
    const assessment = classifyFixture('real-world-shapes', f);
    assert.equal(assessment.kind, 'must-not-flag', f.id);
    assert.equal(assessment.tier, 'T3', f.id);
    assert.deepEqual(assessment, f.assessment, `${f.id}: stale corpus assessment`);
  }
});

test('REAL_WORLD_AXES is disjoint from AXES (#91 family-control vocabulary) and covers every fixture group', () => {
  assert.equal(REAL_WORLD_AXES.filter(a => AXES.includes(a)).length, 0);
  for (const f of fixtures) assert.ok(REAL_WORLD_AXES.includes(f.group), `${f.id}: ${f.group}`);
});

test('no fixture content matches any contracts[*].pattern — the machine-checkable form of "contains no live credential"', () => {
  const families = Object.entries(contracts).filter(([, c]) => c.pattern).map(([family]) => family);
  assert.ok(families.length > 0);
  for (const f of fixtures) {
    for (const family of families) {
      assert.equal(matches(family, f.content), false, `${f.id} matches ${family}'s pattern`);
    }
  }
});
