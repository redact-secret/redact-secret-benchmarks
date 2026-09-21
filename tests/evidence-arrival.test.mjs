import test from 'node:test';
import assert from 'node:assert/strict';
import { checkEvidenceArrival, familyArrivalProblems } from '../scripts/check-evidence-arrival.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';

const seed = (overrides = {}) => ({ twinOf: null, expected: [{ start: 0, end: 1, role: 'secret' }], ...overrides });
const casesOf = (methods, overrides = {}) => methods.map(method => ({ method, targets: ['example-token'], seed: seed(overrides) }));
const FULL_CONTRACT = { tier: 'T1', providerSource: { url: 'https://example.invalid', observedAt: '2026-09-20', formatVersion: '1', covers: 'the whole shape' } };
const FULL_CASES = casesOf(['differential', 'twin', 'benign', 'metamorphic', 'mutation']);

test('the CI gate that keeps every registered family\'s arrival evidence complete passes on this tree', async () => {
  assert.deepEqual(await checkEvidenceArrival(), []);
});

test('every registered detector carries a contract this gate can read', () => {
  assert.ok(Object.keys(contracts).length > 0);
  for (const contract of Object.values(contracts)) assert.ok(contract.tier, 'every contract declares a tier');
});

test('a family with every element present clears the gate', () => {
  assert.deepEqual(familyArrivalProblems('example-token', FULL_CASES, FULL_CONTRACT), []);
});

test('a brand-new family missing everything fails closed on every element, not silently', () => {
  const problems = familyArrivalProblems('new-token', [], { tier: 'T0' });
  assert.equal(problems.length, 7, 'all seven required elements are reported, not just the first one hit');
  assert.ok(problems.every(p => p.startsWith('new-token: missing ')), 'every problem names the family it belongs to');
  const elements = problems.map(p => p.split('missing ')[1].split(' — ')[0]);
  assert.deepEqual([...elements].sort(), [
    'adversarial benign controls', 'canonical positives', 'differential observation',
    'metamorphic cases', 'mutation cases', 'negative twins', 'provider/tool evidence',
  ]);
});

test('missing provider or tool evidence is reported even when every case exists', () => {
  const problems = familyArrivalProblems('example-token', FULL_CASES, { tier: 'T2' });
  assert.deepEqual(problems, ['example-token: missing provider/tool evidence — record a providerSource, twinSource, candidateSource, or at least one corroboration entry for "example-token" in benchmarks/lib/assessment.ts, each carrying a url, an observedAt date, and what it establishes']);
});

test('provider/tool evidence is satisfied by a twinSource, a candidateSource, or tool corroboration alone, not only a providerSource', () => {
  for (const contract of [
    { tier: 'T3', twinSource: { url: 'https://example.invalid', observedAt: '2026-09-20', formatVersion: '1', covers: 'what it mutates' } },
    { tier: 'T0', candidateSource: { url: 'https://example.invalid', observedAt: '2026-09-20', formatVersion: '1', covers: 'the prefix only' } },
    { tier: 'T2', corroboration: [{ tool: 'gitleaks 8.30.1', label: 'x', url: 'https://example.invalid' }] },
  ]) assert.deepEqual(familyArrivalProblems('example-token', FULL_CASES, contract).filter(p => p.includes('provider/tool evidence')), []);
});

test('a family with no authored twin still clears the negative-twins element once it is recorded un-probeable (#33)', () => {
  const withoutTwin = casesOf(['differential', 'benign', 'metamorphic', 'mutation']);
  const stillMissing = familyArrivalProblems('example-token', withoutTwin, FULL_CONTRACT);
  assert.ok(stillMissing.some(p => p.includes('negative twins')), 'no twin and no recorded reason is a real gap');

  const unprobeable = { ...FULL_CONTRACT, unprobeable: { reason: 'The provider documents nothing a twin could mutate.', observedAt: '2026-09-20' } };
  const documented = familyArrivalProblems('example-token', withoutTwin, unprobeable);
  assert.deepEqual(documented, [], 'a documented un-probeable reason satisfies the element without an authored twin');
});

test('a differential case whose fixture is itself a twin does not count as a canonical positive', () => {
  const cases = casesOf(['twin', 'benign', 'metamorphic', 'mutation'])
    .concat([{ method: 'differential', targets: ['example-token'], seed: seed({ twinOf: 'example-token-canonical' }) }]);
  const problems = familyArrivalProblems('example-token', cases, FULL_CONTRACT);
  assert.ok(problems.some(p => p.includes('canonical positives')));
});

test('the gate only ever judges cases targeting the family in question', () => {
  const elsewhere = casesOf(['differential', 'twin', 'benign', 'metamorphic', 'mutation']).map(c => ({ ...c, targets: ['some-other-family'] }));
  const problems = familyArrivalProblems('example-token', elsewhere, FULL_CONTRACT);
  assert.equal(problems.length, 6, 'none of another family\'s cases satisfy this family\'s elements');
});
