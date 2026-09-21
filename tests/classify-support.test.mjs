import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import Ajv from 'ajv';
import { familyEvidence } from '../benchmarks/support/evidence.ts';
import { classifyFamilySupport } from '../benchmarks/support/status.ts';
import { contracts } from '../benchmarks/lib/assessment.ts';

const exec = promisify(execFile);
const repositoryRoot = path.resolve(new URL('..', import.meta.url).pathname);
const hashFile = async file => createHash('sha256').update(await readFile(file)).digest('hex');

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = await read('schemas/support-status-report-v1.json');
const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

const emptyLedger = { schemaVersion: 1, entries: {} };

async function pack(directory) {
  const { stdout } = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--json'], { cwd: directory });
  return path.join(directory, JSON.parse(stdout)[0].filename);
}

// A minimal candidate build: enough for installCandidate/loadCandidate to
// accept it, never a real product build. Mirrors tests/candidate.test.mjs.
async function candidatePackages() {
  const root = await mkdtemp(path.join(tmpdir(), 'classify-candidate packages with spaces '));
  const nodeName = '@redact-secret/node-test';
  const core = path.join(root, 'core'), node = path.join(root, 'node'), wasm = path.join(root, 'wasm');
  await Promise.all([mkdir(path.join(core, 'dist'), { recursive: true }), mkdir(node), mkdir(wasm)]);
  await writeFile(path.join(core, 'package.json'), JSON.stringify({ name: '@redact-secret/core', version: '9.9.9-candidate.1', type: 'module',
    exports: './dist/index.js', dependencies: { '@redact-secret/wasm': '9.9.9-candidate.1' }, optionalDependencies: { [nodeName]: '9.9.9-candidate.1' } }));
  await writeFile(path.join(core, 'dist/index.js'), `export const VERSION='9.9.9-candidate.1'; export async function initialize(){} export function scan(){return []}`);
  await writeFile(path.join(node, 'package.json'), JSON.stringify({ name: nodeName, version: '9.9.9-candidate.1' }));
  await writeFile(path.join(wasm, 'package.json'), JSON.stringify({ name: '@redact-secret/wasm', version: '9.9.9-candidate.1' }));
  return { root, core: await pack(core), node: await pack(node), wasm: await pack(wasm) };
}

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
  assert.equal(report.familyCount, Object.keys(contracts).length);
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
    criteriaSchemaVersion: 1, product: null, scanners: ['redact-secret', 'gitleaks', 'trufflehog'], caseCount: 1, variantCount: 1,
    familyCount: 1, distribution: { stable: 0, provisional: Number(assessment.status === 'provisional'), pending: Number(assessment.status === 'pending'), unsupported: 0 },
    families: [{ ...assessment, taxonomyFamilies: [], evidence, unprobeable: contracts[family].unprobeable ?? null }],
  };
  assert.ok(validate(synthetic), JSON.stringify(validate.errors));
});

test('a synthetic report shaped like a candidate eval:classify run satisfies the schema', () => {
  const family = Object.keys(contracts)[0];
  const evidence = familyEvidence(family, {}, {}, [], emptyLedger);
  const assessment = classifyFamilySupport(evidence);
  const synthetic = {
    schemaVersion: 1, generatedAt: new Date().toISOString(), runId: 'test-run', revision: 'abc', dirty: false,
    criteriaSchemaVersion: 1,
    product: { sourceCommit: 'a'.repeat(40), packageName: '@redact-secret/core', declaredVersion: '9.9.9-candidate.1',
      artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'b'.repeat(64) })) },
    scanners: ['redact-secret', 'gitleaks', 'trufflehog'], caseCount: 1, variantCount: 1,
    familyCount: 1, distribution: { stable: 0, provisional: Number(assessment.status === 'provisional'), pending: Number(assessment.status === 'pending'), unsupported: 0 },
    families: [{ ...assessment, taxonomyFamilies: [], evidence, unprobeable: contracts[family].unprobeable ?? null }],
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

test('eval:classify CLI substitutes a candidate build for redact-secret only, and names the measured product', async () => {
  const artifacts = await candidatePackages();
  const output = path.join(artifacts.root, 'support-status.json');
  const sourceCommit = 'a'.repeat(40);
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts',
      `--output=${output}`, `--candidate-package=${artifacts.core}`, `--candidate-node-package=${artifacts.node}`,
      `--candidate-wasm-package=${artifacts.wasm}`, `--candidate-source-commit=${sourceCommit}`],
      { cwd: repositoryRoot, timeout: 120_000 });
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(validate(report), JSON.stringify(validate.errors));
    // Peer scanners stay exactly the pinned set; only the redact-secret entry was substituted.
    assert.deepEqual(report.scanners, ['redact-secret', 'gitleaks', 'trufflehog']);
    assert.deepEqual(report.product, {
      sourceCommit, packageName: '@redact-secret/core', declaredVersion: '9.9.9-candidate.1',
      artifacts: [
        { role: 'package', sha256: await hashFile(artifacts.core) },
        { role: 'node', sha256: await hashFile(artifacts.node) },
        { role: 'wasm', sha256: await hashFile(artifacts.wasm) },
      ],
    });
  } finally { await rm(artifacts.root, { recursive: true, force: true }); }
});

test('eval:classify CLI with no arguments still measures the published package, product null', async () => {
  const output = path.join(await mkdtemp(path.join(tmpdir(), 'classify-default-')), 'support-status.json');
  try {
    await exec(process.execPath, ['--import', 'tsx', 'benchmarks/classify-support.ts', `--output=${output}`],
      { cwd: repositoryRoot, timeout: 120_000 });
    const report = JSON.parse(await readFile(output, 'utf8'));
    assert.ok(validate(report), JSON.stringify(validate.errors));
    assert.equal(report.product, null);
    assert.deepEqual(report.scanners, ['redact-secret', 'gitleaks', 'trufflehog']);
  } finally { await rm(path.dirname(output), { recursive: true, force: true }); }
});
