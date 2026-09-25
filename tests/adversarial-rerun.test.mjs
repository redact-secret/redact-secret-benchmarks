import test from 'node:test';
import assert from 'node:assert/strict';
import { rerunResult, summarizeRerun, meetsExpectation } from '../benchmarks/lib/adversarial-rerun.ts';

const redact = { id: 'p', path: 'p.txt', content: '', action: 'must-redact', expected: [{ start: 2, end: 6 }] };
const benign = { id: 'n', path: 'n.txt', content: '', action: 'must-not-flag', expected: [] };
const firstRun = {
  results: [
    { fixtureId: 'p', scanner: 'redact-secret', status: 'complete', findings: [] },
    { fixtureId: 'n', scanner: 'redact-secret', status: 'complete', findings: [{ start: 0, end: 3 }] },
    { fixtureId: 'p', scanner: 'gitleaks', status: 'complete', findings: [{ start: 2, end: 6 }] },
  ],
};

test('rerunResult scores the candidate and the product first-run row with the same rule', () => {
  const fixed = rerunResult(redact, { status: 'complete', findings: [{ start: 2, end: 6 }] }, firstRun);
  assert.equal(fixed.outcome, 'redacted');
  assert.equal(fixed.firstRunOutcome, 'missed');
  const clean = rerunResult(benign, { status: 'complete', findings: [] }, firstRun);
  assert.equal(clean.outcome, 'clean');
  assert.equal(clean.firstRunOutcome, 'flagged');
  const failed = rerunResult(redact, { status: 'failed', findings: [] }, firstRun);
  assert.equal(failed.outcome, 'scanner-failed');
});

test('rerunResult has no first-run outcome for a fixture the product never scanned', () => {
  const row = rerunResult({ ...redact, id: 'x' }, { status: 'complete', findings: [] }, firstRun);
  assert.equal(row.firstRunOutcome, null);
});

test('summarizeRerun separates fixes from regressions and counts failures', () => {
  const rows = [
    rerunResult(redact, { status: 'complete', findings: [{ start: 2, end: 6 }] }, firstRun),
    rerunResult(benign, { status: 'complete', findings: [] }, firstRun),
    { fixtureId: 'r', action: 'must-redact', status: 'complete', findings: [], outcome: 'missed', firstRunOutcome: 'redacted' },
    { fixtureId: 'f', action: 'must-redact', status: 'failed', findings: [], outcome: 'scanner-failed', firstRunOutcome: 'partial' },
  ];
  const summary = summarizeRerun(rows);
  assert.equal(summary.fixtures, 4);
  assert.equal(summary.scannerFailed, 1);
  assert.deepEqual(summary.meetsExpectation, { firstRun: 1, candidate: 2 });
  assert.deepEqual(summary.fixedSinceFirstRun, ['p', 'n']);
  assert.deepEqual(summary.regressedSinceFirstRun, ['r']);
  assert.equal(summary.outcomes.candidate.redacted, 1);
  assert.equal(summary.outcomes.firstRun.partial, 1);
});

test('only an exact redaction or a clean benign meets the expectation', () => {
  assert.ok(meetsExpectation('redacted') && meetsExpectation('clean'));
  for (const outcome of ['overbroad', 'partial', 'missed', 'flagged', 'scanner-failed']) assert.equal(meetsExpectation(outcome), false);
});
