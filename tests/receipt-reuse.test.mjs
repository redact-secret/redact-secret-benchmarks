import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { receiptProblems } from '../benchmarks/qualification/receipt-reuse.ts';
import { METHODS_STEP, PLAIN_STEP, reusableStages } from '../scripts/retry-receipts.mjs';

const want = { population: 'public-evidence-snapshot', platform: 'linux-x64', methods: false, engineRevision: 'abc', runs: 2, candidateId: null, attributionId: null, evidenceTag: null };
const record = () => ({
  schema: 'redact-secret-benchmarks/official-run-record/v1', population: 'public-evidence-snapshot', platform: 'linux-x64', engine: { revision: 'abc' },
  artifact: { digest: 'sha256:aa' }, determinism: { runs: 2, semanticDigestsEqual: true },
});

test('a receipt of the same stage, engine and inputs is compatible (#707)', () => {
  assert.deepEqual(receiptProblems(record(), 'sha256:aa', want), []);
});

test('every difference of identity makes a receipt incompatible, so the stage measures fresh (#707)', () => {
  const cases = [
    [r => { r.population = 'regression-corpus'; }, /is of regression-corpus/],
    [r => { r.platform = 'darwin-arm64'; }, /is of darwin-arm64/],
    [r => { r.kind = 'methods'; }, /methods run/],
    [r => { r.engine.revision = 'zzz'; }, /engine zzz/],
    [r => { r.artifact.digest = 'sha256:bb'; }, /does not match the digest/],
    [r => { r.determinism.runs = 1; }, /determinism check of 1/],
    [r => { r.determinism.semanticDigestsEqual = false; }, /determinism/],
    [r => { r.productCandidate = { id: 'core-x' }; }, /product candidate/],
    [r => { r.attribution = { id: 'core-beta.12' }; }, /attribution/],
    [r => { r.evidenceOverride = { tag: 'snapshot-2026.10.04.3' }; }, /evidence release/],
    [r => { r.schema = 'redact-secret-benchmarks/diagnostic-record/v1'; }, /not an official run record/],
  ];
  for (const [mutate, expected] of cases) {
    const r = record(); mutate(r);
    assert.ok(receiptProblems(r, 'sha256:aa', want).some(p => expected.test(p)), String(expected));
  }
});

test('a methods receipt must carry the pinned selection and evaluation (#707)', () => {
  const methodsRun = { methods: ['a', 'b'], reference: 'ref', seed: 's', evidenceDigest: 'sha256:ee' };
  const r = { ...record(), kind: 'methods', methods: ['b', 'a'], evaluation: { reference: 'ref', seed: 's', evidenceDigest: 'sha256:ee' } };
  assert.deepEqual(receiptProblems(r, 'sha256:aa', { ...want, methods: true, methodsRun }), []);
  assert.ok(receiptProblems({ ...r, methods: ['a'] }, 'sha256:aa', { ...want, methods: true, methodsRun }).some(p => /methods selection/.test(p)));
  assert.ok(receiptProblems({ ...r, evaluation: { ...r.evaluation, seed: 'x' } }, 'sha256:aa', { ...want, methods: true, methodsRun }).some(p => /seed/.test(p)));
});

test('only a step GitHub recorded as successful is offered for reuse (#707)', () => {
  const job = conclusions => ({ steps: [{ name: PLAIN_STEP, conclusion: conclusions[0] }, { name: METHODS_STEP, conclusion: conclusions[1] }] });
  assert.deepEqual(reusableStages(job(['success', 'failure'])), { plain: 'reuse', methods: 'fresh' });
  assert.deepEqual(reusableStages(job(['success', 'success'])), { plain: 'reuse', methods: 'reuse' });
  assert.deepEqual(reusableStages(job(['failure', 'skipped'])), { plain: 'fresh', methods: 'fresh' });
  assert.deepEqual(reusableStages(undefined), { plain: 'fresh', methods: 'fresh' });
});

test('the workflow wires the retry beside, not into, the view-only reuse (#707)', async () => {
  const yml = (await readFile(new URL('../.github/workflows/official-runs.yml', import.meta.url), 'utf8')).replace(/^\s*#.*$/gm, '');
  assert.match(yml, /retry_run_id:/);
  assert.match(yml, /retry_run_id is exclusive with reuse_run_id, reuse_candidate_run_id and diagnostic mode/);
  assert.match(yml, /--reuse-receipt "\$RECEIPT"/);
  assert.match(yml, /actions: read # download the receipts/);
  const driver = await readFile(new URL('../scripts/run-official-credential-eval.ts', import.meta.url), 'utf8');
  assert.match(driver, /receipt not reused/);
  assert.match(driver, /bindingProblems\(a\.artifact, bindPin/, 'a reused artifact is still bound to the current pins');
});
