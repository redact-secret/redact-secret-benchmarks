// The PII metric boundary (#795): one definition and one owner per quantity, distinct names for quantities that share an id, hand-calculated
// boundary cases through the real benchmark scorer, and the generated comparison equal to a fresh derivation. No test asserts a ledger value:
// the boundary cases are synthetic and the comparison is checked against the files it is derived from.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
import { B11_QUANTITIES, PII_PROTOCOLS, PII_V1_QUANTITIES, ambiguousIds, quantityId, quantityOf } from '../benchmarks/evaluation/domains/pii/metric-basis.mjs';
import { PII_METRIC_IDS, PII_METRIC_LABELS } from '../benchmarks/evaluation/domains/pii/profile.ts';
import { b11ScoreTable } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';

test('every published metric id has exactly one pii-v1 and one b11 definition, each with an owner', () => {
  assert.deepEqual(Object.keys(PII_V1_QUANTITIES).sort(), [...PII_METRIC_IDS].sort());
  assert.deepEqual(Object.keys(B11_QUANTITIES).sort(), [...PII_METRIC_IDS].sort());
  assert.deepEqual(Object.keys(PII_PROTOCOLS).sort(), ['b11', 'pii-v1']);
  for (const id of PII_METRIC_IDS) {
    const q = quantityOf('pii-v1', id);
    assert.deepEqual([q.population, q.numerator, q.denominator], PII_METRIC_LABELS[id], `${id}: the pii-v1 definition is the accounting report's own wording`);
    assert.equal(q.owner, 'pii-eval');
    assert.equal(quantityOf('b11', id).owner, 'redact-secret-benchmarks');
  }
});

test('no two quantities share a name or a quantity id: a generic type miss cannot be read as a sensitive miss', () => {
  const names = new Set(), ids = new Set();
  for (const protocol of Object.keys(PII_PROTOCOLS)) for (const id of PII_METRIC_IDS) {
    const q = quantityOf(protocol, id);
    assert.ok(!names.has(q.name), `duplicate name ${q.name}`); names.add(q.name);
    assert.ok(!ids.has(q.quantity)); ids.add(q.quantity);
    assert.equal(q.quantity, quantityId(protocol, id));
  }
  assert.equal(ambiguousIds().length, 10, 'every id is defined by more than one wording, so a bare id is never a label');
  assert.match(quantityOf('pii-v1', 'type-miss-rate').name, /generic, every context/);
  assert.equal(quantityOf('pii-v1', 'type-miss-rate').sensitiveOnly, false);
  assert.equal(quantityOf('b11', 'type-miss-rate').sensitiveOnly, true);
  assert.throws(() => quantityOf('pii-v1', 'type-miss'));
});

const range = (start, end) => ({ start, end });
const row = (id, over) => ({ id, source: 'population-plan', views: ['oracle-plan'], language: 'en', input: 'abcdefghij', identity: 'valid', sensitivity: 'sensitive', candidate: range(0, 5),
  target: range(0, 5), expectedFinding: true, axis: 'a', twinOf: null, scored: true, lineSensitive: [], revision: null, ...over });
const seen = (id, family = []) => ({ id, family, otherPii: [], otherPiiAtTarget: false, credential: 0, ranges: [], outsidePreserved: true, scanRedactAgree: true });

test('hand-calculated boundary case: the same four memberships, read by each protocol', () => {
  // c1 sensitive, found exactly; c2 sensitive, not found; c3 authored non-sensitive valid-type (benign context), not flagged;
  // c4 authored not-established, flagged.
  const table = [row('c1', {}), row('c2', {}), row('c3', { sensitivity: 'non-sensitive', candidate: range(0, 5), expectedFinding: false }),
    row('c4', { identity: 'not-established', sensitivity: 'not-established', candidate: null, target: null, expectedFinding: false })];
  const lane = { lane: 'node-addon', selection: 'union', activationIdentity: null, artifact: null,
    cases: [seen('c1', [[0, 5, 'redact']]), seen('c2'), seen('c3'), seen('c4', [[0, 5, 'redact']])] };
  const view = b11ScoreTable('pii:global:email', table, lane, null).views.find(v => v.view === 'oracle-plan');
  const b11 = Object.fromEntries(view.metrics.map(m => [m.id, `${m.numerator}/${m.denominator}`]));
  // b11: sensitive cases are c1 and c2 only.
  assert.equal(b11['type-miss-rate'], '1/2');
  assert.equal(b11['sensitive-miss-rate'], '1/2');
  assert.equal(b11['wrong-family-rate'], '0/2');
  assert.equal(b11['non-sensitive-flag-rate'], '0/1');
  // b11 counts the authored not-established c4 as benign: its finding makes it a failed suppression (coercion, named in the registry).
  assert.equal(b11['benign-suppression-rate'], '1/2');
  assert.equal(b11['measurable-share'], '4/4');
  assert.equal(quantityOf('b11', 'benign-suppression-rate').coercesNotEstablished, true);
  assert.equal(view.notEstablished.cases, 1);
  assert.equal(view.notEstablished.falseAlarm, 1);
  // pii-v1 (registry definitions, hand-calculated; the engine's own controls are pii-eval crates/pii-eval-kernel/tests/not_established_range.rs):
  //   type-miss-rate: valid-type occurrences are c1, c2, c3; type miss = no finding at the occurrence: c2 and c3 -> 2/3. c4 is outside (unresolved).
  //   sensitive-miss-rate: authored-sensitive occurrences c1, c2; miss c2 -> 1/2 (equal to b11).
  //   non-sensitive-flag-rate: c3 only, not flagged -> 0/1 (equal to b11).
  //   benign-suppression-rate: needs the pii-benign method; not applicable on a schema-only population.
  //   measurable-share: 4 memberships x 2 axes = 8 assertions; c4 contributes 2 unresolved, c3's sensitivity is authored non-sensitive (resolved).
  const piiV1 = { 'type-miss-rate': [2, 3], 'sensitive-miss-rate': [1, 2], 'non-sensitive-flag-rate': [0, 1] };
  assert.notDeepEqual([1, 2], piiV1['type-miss-rate'], 'the same metric id is two different quantities on the same cases');
  assert.deepEqual(piiV1['sensitive-miss-rate'], [1, 2]);
  assert.equal(quantityOf('pii-v1', 'benign-suppression-rate').method, 'pii-benign');
});

test('the generated comparison equals a fresh derivation and records the before and after memberships', async () => {
  const { stdout } = await promisify(execFile)(process.execPath, ['scripts/pii-scorer-basis.mjs', '--check']);
  assert.match(stdout, /equals a fresh derivation/);
});
