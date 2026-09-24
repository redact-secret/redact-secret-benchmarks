import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import Ajv from 'ajv';
import { familyEvidence } from '../benchmarks/support/evidence.ts';
import { classifyFamilySupport } from '../benchmarks/support/status.ts';
import { contracts, registryContractIds } from '../benchmarks/lib/assessment.ts';
import { fixtureProfileReport, measureFixtureCells } from '../benchmarks/support/profiles.ts';

const exec = promisify(execFile);
const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = await read('schemas/support-status-report-v1.json');
const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

const emptyLedger = { schemaVersion: 1, entries: {} };


test('familyEvidence reads twin pairs and failures from the must-flip relation only, for the product scanner', () => {
  const byDetector = {
    'example-token': {
      'twin/redact-secret/must-redact:T1/present-within-envelope': { pass: 3, fail: 0, 'review-required': 0, 'not-measured': 0 },
      'twin/redact-secret/must-redact:T1->must-not-flag:T2/must-flip': { pass: 2, fail: 1, 'review-required': 0, 'not-measured': 0 },
      'twin/gitleaks/must-redact:T1->must-not-flag:T2/must-flip': { pass: 0, fail: 9, 'review-required': 0, 'not-measured': 0 },
    },
  };
  const evidence = familyEvidence('example-token', byDetector, {}, [], emptyLedger);
  assert.equal(evidence.twinPairs, 3);
  assert.equal(evidence.twinFailures, 1);
});

test('familyEvidence sums benign and metamorphic pass/fail for the product scanner only', () => {
  const byDetector = {
    'example-token': {
      'benign/redact-secret/must-not-flag:T2/absent': { pass: 4, fail: 1, 'review-required': 0, 'not-measured': 0 },
      'benign/gitleaks/must-not-flag:T2/absent': { pass: 0, fail: 5, 'review-required': 0, 'not-measured': 0 },
      'metamorphic/redact-secret/must-redact:T1/present-within-envelope': { pass: 7, fail: 2, 'review-required': 0, 'not-measured': 0 },
    },
  };
  const evidence = familyEvidence('example-token', byDetector, {}, [], emptyLedger);
  assert.equal(evidence.benignCases, 5);
  assert.equal(evidence.benignFalseAlarms, 1);
  assert.equal(evidence.metamorphicCriticalFailures, 2);
});

test('familyEvidence reports benignAxes/benignAxisIds from axesByDetector, keyed by family, and empty when absent (#92)', () => {
  const axesByDetector = { 'example-token': ['near-miss', 'placeholder'], 'other-token': ['reference'] };
  const evidence = familyEvidence('example-token', {}, axesByDetector, [], emptyLedger);
  assert.equal(evidence.benignAxes, 2);
  assert.deepEqual(evidence.benignAxisIds, ['near-miss', 'placeholder']);
  const missing = familyEvidence('never-registered', {}, axesByDetector, [], emptyLedger);
  assert.equal(missing.benignAxes, 0);
  assert.deepEqual(missing.benignAxisIds, []);
});

test('familyEvidence counts context-twin pairs by the authored context mutation, in any corpus, never by the context-edges category', () => {
  const twin = (category, id, mutationKind) => ({
    method: 'twin', targets: ['example-token'], source: { category, fixtureId: id },
    seed: { id: `${id}-positive`, expected: [{ start: 0, end: 1 }], group: 'g' }, twin: { id, twinOf: `${id}-positive`, mutationKind },
  });
  const cases = [
    twin('beta8-207', 'env-context-twin', 'context'),
    twin('detector-coverage', 'keyword-context-twin', 'context'),
    twin('beta8-212', 'legacy-context-twin', 'context'),
    // The same twin fixture seen twice (it is one pair).
    twin('beta8-207', 'env-context-twin', 'context'),
    // A value twin in context-edges is not a context-twin pair.
    twin('context-edges', 'length-twin', 'length'),
    twin('context-edges', 'prefix-twin', 'prefix'),
    twin('beta8-207', 'other-family-context-twin', 'context'),
  ];
  cases[6].targets = ['other-token'];
  const evidence = familyEvidence('example-token', {}, {}, [], emptyLedger, cases);
  assert.equal(evidence.contextTwinPairs, 3);
  assert.equal(evidence.confusionAxes, 3, 'length, prefix and context twin kinds are three confusion axes');
});

test('familyEvidence counts a hard mutation failure as unresolved even with no queue entry', () => {
  const byDetector = { 'example-token': { 'mutation/redact-secret/must-redact:T1/present-within-envelope': { pass: 1, fail: 3, 'review-required': 0, 'not-measured': 0 } } };
  const evidence = familyEvidence('example-token', byDetector, {}, [], emptyLedger);
  assert.equal(evidence.mutationUnresolvedCritical, 3);
});

test('familyEvidence treats a queued mutation review as resolved only when the ledger says so', () => {
  const byDetector = {};
  const queue = [
    { id: 'open-1', method: 'mutation', targets: ['example-token'] },
    { id: 'resolved-1', method: 'mutation', targets: ['example-token'] },
    { id: 'unknown-1', method: 'mutation', targets: ['example-token'] },
    { id: 'other-family', method: 'mutation', targets: ['other-token'] },
  ];
  const ledger = { schemaVersion: 1, entries: { 'open-1': { status: 'open', firstSeenRun: 'r', note: '' }, 'resolved-1': { status: 'resolved', firstSeenRun: 'r', note: '' } } };
  const evidence = familyEvidence('example-token', byDetector, {}, queue, ledger);
  assert.equal(evidence.mutationUnresolvedCritical, 2);
});

test('familyEvidence treats a not-assertable queue entry as settled, the same as resolved', () => {
  const byDetector = {};
  const queue = [
    { id: 'open-1', method: 'mutation', targets: ['example-token'] },
    { id: 'not-assertable-1', method: 'mutation', targets: ['example-token'] },
  ];
  const ledger = {
    schemaVersion: 1,
    entries: {
      'open-1': { status: 'open', firstSeenRun: 'r', note: '' },
      'not-assertable-1': { status: 'not-assertable', firstSeenRun: 'r', note: 'operator contract broken by construction' },
    },
  };
  const evidence = familyEvidence('example-token', byDetector, {}, queue, ledger);
  assert.equal(evidence.mutationUnresolvedCritical, 1, 'only the open entry counts; not-assertable is settled');
});

test('familyEvidence sources differential evidence from the review queue only, never byDetector', () => {
  const byDetector = { 'example-token': { 'differential/redact-secret/must-redact:T1/absolute': { pass: 1, fail: 99, 'review-required': 0, 'not-measured': 0 } } };
  const queue = [{ id: 'd-1', method: 'differential', targets: ['example-token'] }];
  const evidence = familyEvidence('example-token', byDetector, {}, queue, emptyLedger);
  assert.equal(evidence.differentialUnresolvedContractDisagreements, 1);
});

test('familyEvidence fails closed: an id absent from contracts carries no detector and no tier', () => {
  const evidence = familyEvidence('never-registered', {}, {}, [], emptyLedger);
  assert.deepEqual(evidence.detectors, []);
  assert.equal(evidence.positiveContractTier, null);
  assert.equal(evidence.hasProviderSource, false);
});

test('every registered family gets a positive-contract tier and hasProviderSource true only for T1 with a documented source', () => {
  for (const family of Object.keys(contracts)) {
    const evidence = familyEvidence(family, {}, {}, [], emptyLedger);
    assert.equal(evidence.detectors.length, 1);
    assert.equal(evidence.positiveContractTier, contracts[family].tier);
    assert.equal(evidence.hasProviderSource, contracts[family].tier === 'T1' && Boolean(contracts[family].providerSource));
  }
});

test('classifying the full registry from all-zero evidence gives exactly one status per family, with a reason unless stable', () => {
  const results = Object.keys(contracts).map(family => classifyFamilySupport(familyEvidence(family, {}, {}, [], emptyLedger)));
  assert.equal(results.length, Object.keys(contracts).length);
  for (const r of results) {
    assert.ok(['stable', 'provisional', 'pending', 'unsupported'].includes(r.status));
    if (r.status !== 'stable') assert.ok(r.reasons.length > 0, `${r.family} reports no reason for ${r.status}`);
  }
});

test('an un-probeable contract is distinguishable from ordinary missing twin evidence in the output shape', () => {
  const unprobeableFamilies = Object.entries(contracts).filter(([, c]) => c.unprobeable);
  assert.ok(unprobeableFamilies.length > 0);
  for (const [family, contract] of unprobeableFamilies) {
    assert.ok(contract.unprobeable.reason.trim().length > 0);
    assert.match(contract.unprobeable.observedAt, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('a real classify-support report, if present from a prior eval:classify run, satisfies its schema', async () => {
  let report;
  try { report = await read('results-output/support-status.json'); } catch { return; }
  assert.ok(validate(report), JSON.stringify(validate.errors));
  // eval:classify covers registry families only; Beta.8 arrival contracts have no product detector.
  assert.equal(report.familyCount, registryContractIds.length);
  assert.deepEqual(report.families.map(f => f.family).sort(), [...registryContractIds].sort());
  assert.equal(new Set(report.families.map(f => f.family)).size, report.familyCount);
  const total = Object.values(report.distribution).reduce((a, b) => a + b, 0);
  assert.equal(total, report.familyCount);
});

test('a synthetic report shaped like eval:classify output satisfies the schema', () => {
  const family = Object.keys(contracts)[0];
  const evidence = familyEvidence(family, {}, {}, [], emptyLedger);
  const assessment = classifyFamilySupport(evidence);
  const synthetic = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), runId: 'test-run', revision: 'abc', dirty: false,
    criteriaSchemaVersion: 1, fixtureProfilesVersion: 1, product: null, scanners: ['redact-secret', 'gitleaks', 'trufflehog'], caseCount: 1, variantCount: 1,
    familyCount: 1, distribution: { stable: Number(assessment.status === 'stable'), provisional: Number(assessment.status === 'provisional'), pending: Number(assessment.status === 'pending'), unsupported: 0 },
    stableDistribution: { documented: Number(assessment.qualificationProfile === 'documented'), empirical: Number(assessment.qualificationProfile === 'empirical') },
    families: [{ ...assessment, evidenceTier: evidence.positiveContractTier, evidenceBasis: evidence.evidenceBasis, taxonomyFamilies: [], evidence, unprobeable: contracts[family].unprobeable ?? null, fixtureProfile: fixtureProfileReport({ profile: null, explicit: false }, measureFixtureCells(family, [])) }],
  };
  assert.ok(validate(synthetic), JSON.stringify(validate.errors));
});

test('a synthetic report shaped like a candidate eval:classify run satisfies the schema', () => {
  const family = Object.keys(contracts)[0];
  const evidence = familyEvidence(family, {}, {}, [], emptyLedger);
  const assessment = classifyFamilySupport(evidence);
  const synthetic = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), runId: 'test-run', revision: 'abc', dirty: false,
    criteriaSchemaVersion: 1, fixtureProfilesVersion: 1,
    product: { sourceCommit: 'a'.repeat(40), packageName: '@redact-secret/core', declaredVersion: '9.9.9-candidate.1',
      artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'b'.repeat(64) })) },
    scanners: ['redact-secret', 'gitleaks', 'trufflehog'], caseCount: 1, variantCount: 1,
    familyCount: 1, distribution: { stable: Number(assessment.status === 'stable'), provisional: Number(assessment.status === 'provisional'), pending: Number(assessment.status === 'pending'), unsupported: 0 },
    stableDistribution: { documented: Number(assessment.qualificationProfile === 'documented'), empirical: Number(assessment.qualificationProfile === 'empirical') },
    families: [{ ...assessment, evidenceTier: evidence.positiveContractTier, evidenceBasis: evidence.evidenceBasis, taxonomyFamilies: [], evidence, unprobeable: contracts[family].unprobeable ?? null, fixtureProfile: fixtureProfileReport({ profile: null, explicit: false }, measureFixtureCells(family, [])) }],
  };
  assert.ok(validate(synthetic), JSON.stringify(validate.errors));
});

test('eval:classify CLI rejects a partial candidate flag set rather than silently measuring the published package', async () => {
  await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts',
    '--candidate-package=/tmp/does-not-matter.tgz', '--candidate-node-package=/tmp/does-not-matter.tgz'],
    { cwd: repositoryRoot, timeout: 30_000 }), /Usage: npm run eval:classify/);
});

test('eval:classify CLI rejects a malformed candidate source commit', async () => {
  await assert.rejects(exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts',
    '--candidate-package=/tmp/does-not-matter.tgz', '--candidate-node-package=/tmp/does-not-matter.tgz',
    '--candidate-wasm-package=/tmp/does-not-matter.tgz', '--candidate-source-commit=not-a-sha'],
    { cwd: repositoryRoot, timeout: 30_000 }), /Usage: npm run eval:classify/);
});
