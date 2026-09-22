import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLedgerDecisions, decidedOperators, undecidedNotAssertableEntries } from '../scripts/check-ledger-decisions.mjs';

const entry = (status, operator) => ({ status, firstSeenRun: 'r', note: operator ? `Mutation review-required by construction: operator \`${operator}\` breaks the fixture's lexical contract. Class: operator=${operator}.` : 'Standing note. Class: t0-pending-fixture.' });

test('the real tree has an ADR for every not-assertable operator class', async () => {
  assert.deepEqual(await checkLedgerDecisions(), []);
});

test('an accepted ADR under docs/specs/decisions/ claims every operator class this record reclassifies', async () => {
  const decided = await decidedOperators();
  for (const id of ['lexical.invalid-alphabet', 'lexical.length-minus-one', 'lexical.prefix-change', 'boundary.remove-delimiter', 'lexical.length-plus-one', 'structural.remove-segment', 'lexical.replace-last'])
    assert.ok(decided.has(id), `${id} has no ADR decision`);
});

test('#125: an accepted ADR claims the differential pending-fixture decision class through the decided-classes marker', async () => {
  const decided = await decidedOperators();
  assert.equal(decided.get('differential.t0-pending-fixture'), '2026-09-22-settle-differential-disagreements-on-pending-fixtures.md');
});

test('a not-assertable entry under a decision= class passes only when an ADR claims that class', () => {
  const decisionEntry = id => ({ status: 'not-assertable', firstSeenRun: 'r', note: `Not assertable from this corpus: the fixture is pending. Class: decision=${id}.` });
  const ledger = { schemaVersion: 1, entries: { decided: decisionEntry('differential.t0-pending-fixture'), undecided: decisionEntry('differential.made-up') } };
  const problems = undecidedNotAssertableEntries(ledger, new Map([['differential.t0-pending-fixture', 'some-adr.md']]));
  assert.deepEqual(problems, ['undecided: marked not-assertable for class "decision=differential.made-up", which no ADR under docs/specs/decisions/ records a decision for']);
});

test('a not-assertable entry for an undecided operator class fails the gate', () => {
  const decided = new Map([['lexical.length-minus-one', 'some-adr.md']]);
  const ledger = {
    schemaVersion: 1,
    entries: {
      decided: entry('not-assertable', 'lexical.length-minus-one'),
      undecided: entry('not-assertable', 'lexical.length-plus-one'),
    },
  };
  const problems = undecidedNotAssertableEntries(ledger, decided);
  assert.deepEqual(problems, ['undecided: marked not-assertable for class "operator=lexical.length-plus-one", which no ADR under docs/specs/decisions/ records a decision for']);
});

test('open and resolved entries are never checked against the decided set, only not-assertable ones', () => {
  const ledger = { schemaVersion: 1, entries: { a: entry('open', 'lexical.length-minus-one'), b: entry('resolved', 'lexical.length-minus-one') } };
  assert.deepEqual(undecidedNotAssertableEntries(ledger, new Map()), []);
});

test('a not-assertable entry carrying no operator class at all fails the gate, not just an undecided one', () => {
  const ledger = { schemaVersion: 1, entries: { a: entry('not-assertable', null) } };
  assert.deepEqual(undecidedNotAssertableEntries(ledger, new Map()), ['a: marked not-assertable for class "t0-pending-fixture", which no ADR under docs/specs/decisions/ records a decision for']);
});
