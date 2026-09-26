import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { adjudicationProblems } from '../benchmarks/lib/adversarial-adjudication.ts';
import { fileDigest } from '../benchmarks/lib/adversarial-intake.ts';
import { loadPacks } from '../benchmarks/lib/adversarial-packs.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const pack = loadPacks(root).find(p => p.record.id === 'beta9-external-inputs');
const firstRun = fileDigest(pack.firstRunBytes);
const knownGaps = JSON.parse((await import('node:fs')).readFileSync(new URL('../benchmarks/known-gaps.json', import.meta.url), 'utf8'));

test('the beta9 adjudication is consistent with the frozen intake and first run', () => {
  assert.ok(pack.adjudication);
  assert.deepEqual(adjudicationProblems(pack.adjudication, pack.record, firstRun), []);
});

test('#322: each of the three product-822 fixtures is adjudicated separately and none is in the raw-input contract', () => {
  const record = knownGaps.issues.find(issue => issue.id === 'product-822');
  const adjudicated = new Map(pack.adjudication.fixtures.map(row => [`beta9-external-inputs--${row.fixtureId}`, row]));
  for (const fixture of record.fixtures) {
    assert.ok(adjudicated.has(fixture), fixture);
    assert.equal(adjudicated.get(fixture).inRawInputContract, false, fixture);
  }
  assert.deepEqual(
    pack.adjudication.fixtures.map(row => row.adjudication),
    ['presentation-only-example', 'presentation-only-example', 'downstream-normalization-scenario'],
  );
  assert.doesNotMatch(record.disposition.reason, /never span a line terminator/);
  assert.doesNotMatch(record.disposition.reason, /real but out-of-contract false negative/);
});

const clone = () => structuredClone(pack.adjudication);

test('an adjudication cannot carry a changed expectation', () => {
  const changed = clone();
  changed.fixtures[0].submittedExpected = [{ start: 0, end: 10 }];
  assert.match(adjudicationProblems(changed, pack.record, firstRun).join('\n'), /material maintainer edit/);
});

test('an adjudication must name the frozen digest and first run', () => {
  const wrong = { ...clone(), expectationsDigest: 'a'.repeat(64) };
  assert.match(adjudicationProblems(wrong, pack.record, firstRun).join('\n'), /expectations digest/);
  assert.match(adjudicationProblems(clone(), pack.record, 'b'.repeat(64)).join('\n'), /frozen first run/);
});

test('inRawInputContract must agree with the adjudication kind, and fixtures must exist', () => {
  const inconsistent = clone();
  inconsistent.fixtures[0].inRawInputContract = true;
  assert.match(adjudicationProblems(inconsistent, pack.record, firstRun).join('\n'), /inRawInputContract/);
  const unknown = clone();
  unknown.fixtures[0].fixtureId = 'no-such-fixture';
  assert.match(adjudicationProblems(unknown, pack.record, firstRun).join('\n'), /no such fixture/);
});
