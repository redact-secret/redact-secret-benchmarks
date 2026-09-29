import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkReviewQueueCoverage } from '../scripts/check-review-queue-coverage.mjs';
import { HANDOFF_PATH, makeHandoff, readHandoff, removeHandoff, writeHandoff } from '../benchmarks/lib/review-queue-handoff.ts';

const binding = { revision: 'a'.repeat(40), clean: true, inputDigest: 'b'.repeat(64), ledgerDigest: 'c'.repeat(64), productVersion: '1.2.3' };
const entry = { id: 'f'.repeat(64), method: 'differential', targets: ['x'], caseId: 'case-1' };
const scratch = () => mkdtemp(path.join(tmpdir(), 'queue-handoff-'));

test('readHandoff returns the queue only when every binding matches', async () => {
  const root = await scratch();
  try {
    assert.match((await readHandoff(root, binding)).reason, /no eval:classify handoff/);
    await writeHandoff(root, makeHandoff(binding, 'run-1', [entry]));
    assert.equal((await stat(path.join(root, HANDOFF_PATH))).mode & 0o777, 0o600);
    assert.deepEqual(await readHandoff(root, binding), { queue: [entry], runId: 'run-1' });
    for (const [key, value] of [['revision', 'd'.repeat(40)], ['inputDigest', 'e'.repeat(64)], ['ledgerDigest', 'e'.repeat(64)], ['productVersion', '9.9.9']])
      assert.match((await readHandoff(root, { ...binding, [key]: value })).reason, new RegExp(key));
    assert.match((await readHandoff(root, { ...binding, clean: false })).reason, /not clean/);
    await removeHandoff(root);
    assert.match((await readHandoff(root, binding)).reason, /no eval:classify handoff/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('readHandoff rejects a dirty producer, an edited queue and garbage', async () => {
  const root = await scratch();
  try {
    await writeHandoff(root, makeHandoff({ ...binding, clean: false }, 'run-2', [entry]));
    assert.match((await readHandoff(root, binding)).reason, /not clean/);
    await writeHandoff(root, makeHandoff(binding, 'run-3', [entry]));
    const file = path.join(root, HANDOFF_PATH);
    const tampered = JSON.parse(await readFile(file, 'utf8'));
    tampered.reviewQueue = [];
    await writeFile(file, JSON.stringify(tampered));
    assert.match((await readHandoff(root, binding)).reason, /digest mismatch/);
    await writeFile(file, '{not json');
    assert.match((await readHandoff(root, binding)).reason, /unreadable/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('queue:check reuses a matching handoff without evaluating, and recomputes on any stale binding', async () => {
  const root = await scratch();
  const handoffFile = path.join(root, 'handoff.json');
  const neverEvaluate = async () => { throw new Error('runEvaluation must not run on the reuse path'); };
  const tree = { revision: 'a'.repeat(40), clean: true };
  try {
    let bound, evaluations = 0;
    const recompute = async () => { evaluations += 1; return { reviewQueue: [entry] }; };
    // No handoff: standalone behaviour is unchanged, the queue is computed here.
    const standalone = await checkReviewQueueCoverage({ evaluate: recompute, tree: () => tree, handoffFile, onBinding: b => { bound = b; } });
    assert.equal(evaluations, 1);
    assert.equal(standalone.length, 1);
    assert.match(standalone[0], /has no benchmarks\/review-ledger\.json row/);

    // A handoff bound to this exact tree: same verdict, no evaluation.
    await writeHandoff(root, makeHandoff(bound, 'run-x', [entry]), handoffFile);
    const logs = [];
    const reused = await checkReviewQueueCoverage({ evaluate: neverEvaluate, tree: () => tree, handoffFile, log: m => logs.push(m) });
    assert.deepEqual(reused, standalone);
    assert.match(logs.join('\n'), /Reusing the review queue eval:classify computed in run run-x/);

    // An empty handoff means the gate passes, exactly as an empty computed queue does.
    await writeHandoff(root, makeHandoff(bound, 'run-y', []), handoffFile);
    assert.deepEqual(await checkReviewQueueCoverage({ evaluate: neverEvaluate, tree: () => tree, handoffFile }), []);

    // Stale artifacts: another commit or a dirty tree fall back to computing.
    await writeHandoff(root, makeHandoff(bound, 'run-x', []), handoffFile);
    for (const stale of [{ revision: 'd'.repeat(40), clean: true }, { revision: tree.revision, clean: false }]) {
      evaluations = 0;
      const problems = await checkReviewQueueCoverage({ evaluate: recompute, tree: () => stale, handoffFile });
      assert.equal(evaluations, 1, JSON.stringify(stale));
      assert.deepEqual(problems, standalone);
    }
    // A handoff computed against a different ledger falls back too.
    await writeHandoff(root, makeHandoff({ ...bound, ledgerDigest: '0'.repeat(64) }, 'run-z', []), handoffFile);
    evaluations = 0;
    assert.deepEqual(await checkReviewQueueCoverage({ evaluate: recompute, tree: () => tree, handoffFile }), standalone);
    assert.equal(evaluations, 1);
  } finally { await rm(root, { recursive: true, force: true }); }
});
