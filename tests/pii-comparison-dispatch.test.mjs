import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDispatch } from '../scripts/check-pii-comparison-dispatch.mjs';

const digest = 'a'.repeat(64);
const current = { id: 20, head_sha: 'b'.repeat(40) };
const valid = () => ({ runId: '20', attempt: '1', decisionDigest: digest, runs: [current], decisions: new Map([[current.head_sha, digest]]) });

test('one fresh dispatch is allowed', () => assert.doesNotThrow(() => checkDispatch(valid())));
test('a rerun cannot borrow the approval', () => assert.throws(() => checkDispatch({ ...valid(), attempt: '2' }), /single-attempt/));
test('copying an approval into another commit does not renew it', () => {
  const previous = { id: 19, head_sha: 'c'.repeat(40) };
  const input = valid(); input.runs.unshift(previous); input.decisions.set(previous.head_sha, digest);
  assert.throws(() => checkDispatch(input), /already-spent/);
});
test('an independently renewed decision does not borrow an older one', () => {
  const previous = { id: 19, head_sha: 'c'.repeat(40) };
  const input = valid(); input.runs.unshift(previous); input.decisions.set(previous.head_sha, 'd'.repeat(64));
  assert.doesNotThrow(() => checkDispatch(input));
});
test('missing current binding and oversized history fail closed', () => {
  assert.throws(() => checkDispatch({ ...valid(), decisions: new Map() }), /not-bound/);
  assert.throws(() => checkDispatch({ ...valid(), runs: Array(513).fill(current) }), /history-invalid/);
});
