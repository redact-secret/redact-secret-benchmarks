import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkQualificationInputs, qualificationInputProblems } from '../scripts/check-qualification-inputs.mjs';

const real = JSON.parse(await readFile(new URL('../benchmarks/qualification-inputs.json', import.meta.url), 'utf8'));
const always = async () => true;
const clone = () => structuredClone(real);

test('the real manifest passes against the real tree', async () => {
  assert.deepEqual(await checkQualificationInputs(), []);
});

test('a population that shares another population denominator fails', async () => {
  const m = clone();
  m.populations[2].denominator = m.populations[1].denominator;
  const problems = await qualificationInputProblems(m, always);
  assert.ok(problems.some(p => /share a denominator/.test(p)));
});

test('a missing population fails', async () => {
  const m = clone();
  m.populations.pop();
  assert.ok((await qualificationInputProblems(m, always)).some(p => /populations must be exactly/.test(p)));
});

test('protected and candidate populations cannot carry the public run class', async () => {
  const m = clone();
  m.populations.find(p => p.id === 'protected-holdout').runClasses = ['public'];
  m.populations.find(p => p.id === 'candidate-regression-inputs').runClasses = ['public', 'internal'];
  const problems = await qualificationInputProblems(m, always);
  assert.equal(problems.filter(p => /public run class/.test(p)).length, 2);
});

test('the superseded evidence release and a short revision are refused', async () => {
  const m = clone();
  const pin = m.populations[0].pin;
  pin.evidenceRelease = 'snapshot-2026.10.01';
  pin.sourceRevision = 'a5362d6';
  const problems = await qualificationInputProblems(m, always);
  assert.ok(problems.some(p => /superseded/.test(p)));
  assert.ok(problems.some(p => /40-hex/.test(p)));
});

test('a legacy input without an owner or with a missing path fails', async () => {
  const m = clone();
  delete m.legacyInputs[0].owner;
  const problems = await qualificationInputProblems(m, async path => path !== m.legacyInputs[1].path);
  assert.ok(problems.some(p => /owner is required/.test(p)));
  assert.ok(problems.some(p => /path does not exist/.test(p)));
});

test('a support status change needs an explicit product-policy reason and decision', async () => {
  const m = clone();
  m.supportStatusChanges.push({ family: 'example' });
  assert.ok((await qualificationInputProblems(m, always)).some(p => /supportStatusChanges entries need/.test(p)));
});

test('a support status change cites the product policy revision as the adapter stamps it', async () => {
  const m = clone();
  m.supportStatusChanges.push({ family: 'example', reason: 'r', decision: 'benchmarks/qualification-inputs.json', productPolicyRevision: 'abc123' });
  assert.ok((await qualificationInputProblems(m, always)).some(p => /must be an adapter stamp/.test(p)));
  m.supportStatusChanges[0].productPolicyRevision = `rs-policy-1:sha256:${'a'.repeat(64)}`;
  assert.deepEqual(await qualificationInputProblems(m, always), []);
});

test('a pending pin names the issue that resolves it', async () => {
  const m = clone();
  m.populations[1].pin.runArtifact = { state: 'pending' };
  assert.ok((await qualificationInputProblems(m, always)).some(p => /pending without a resolving issue/.test(p)));
});
