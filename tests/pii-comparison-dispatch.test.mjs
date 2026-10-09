import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'yaml';
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDispatch, verifyCurrentDispatch } from '../scripts/check-pii-comparison-dispatch.mjs';
import { comparisonDigest } from '../benchmarks/evaluation/domains/pii/candidate-comparison.mjs';

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

test('GitHub API null metadata is valid while the committed decision stays strict', () => {
  const decision = { decidedAt: '2026-10-08T13:20:49Z', state: 'approved' };
  const text = JSON.stringify(decision);
  const plan = { dispatch: { authorised: true, costDecision: 'cost.json', costDecisionSha256: comparisonDigest(decision) } };
  const environment = { GITHUB_REPOSITORY: 'redact-secret/redact-secret-benchmarks', GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1' };
  const readApi = endpoint => endpoint.includes('/runs?')
    ? JSON.stringify({ total_count: 1, workflow_runs: [{ ...current, conclusion: null, pull_requests: [],
      created_at: '2026-10-08T13:25:59Z', referenced_workflows: null }] })
    : JSON.stringify({ encoding: 'base64', content: Buffer.from(text).toString('base64'), _links: { git: null } });
  assert.doesNotThrow(() => verifyCurrentDispatch({ plan, environment, readApi, readDecision: () => text }));
  assert.throws(() => verifyCurrentDispatch({ plan, environment, readApi, readDecision: () => '{"decidedAt":null}' }), /null-not-allowed/);
});

test('official dispatch routes comparison lanes to existing same-repository reusable workflows', () => {
  const workflow = parse(readFileSync(new URL('../.github/workflows/pii-official-run.yml', import.meta.url), 'utf8'));
  for (const [lane, file] of [['candidate-comparison', 'pii-candidate-comparison.yml'], ['evidence-comparison', 'pii-evidence-comparison.yml']]) {
    const job = workflow.jobs[lane];
    assert.equal(job.uses, `./.github/workflows/${file}`);
    assert.match(job.if, new RegExp(`inputs\\.lane == '${lane}'`));
    const target = new URL(`../${job.uses}`, import.meta.url);
    assert.ok(existsSync(target), `the ${lane} dispatch workflow exists`);
    const reusable = parse(readFileSync(target, 'utf8'));
    assert.ok(reusable.on.workflow_call, `the ${lane} workflow accepts a reusable call`);
    assert.deepEqual(job.permissions, { contents: 'read', actions: 'read' });
  }
  for (const job of Object.values(workflow.jobs)) if (job.uses?.includes('/.github/workflows/'))
    assert.ok(job.uses.startsWith('./.github/workflows/'), 'local reusable workflows use ./, never $/');
});
