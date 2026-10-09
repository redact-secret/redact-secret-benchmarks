import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { b11Commitment, B11_EXPECTED_ACTIVATION } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { b11ProtectedEpochs, b11FreezeFiles, B11_BASELINE_879 } from '../benchmarks/evaluation/domains/pii/beta11-disposition.ts';
import { validatePreparedPiiFreeze, publishPreparedPiiFreeze, requireReviewedPreparedPiiFreeze, PREPARED_PII_FREEZE_PATH, PREPARED_PII_FREEZE_ROLE } from '../scripts/lib/prepared-pii-freeze.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const schema = JSON.parse(readFileSync(new URL('../schemas/prepared-pii-freeze-v1.json', import.meta.url)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function authored(shape) {
  if ('const' in shape) return shape.const;
  if (shape.enum) return shape.enum[0];
  if (shape.oneOf || shape.anyOf) return authored((shape.oneOf ?? shape.anyOf)[0]);
  if (shape.type === 'object') return Object.fromEntries(Object.entries(shape.properties ?? {}).map(([key, value]) => [key, authored(value)]));
  if (shape.type === 'array') return shape.items ? [authored(shape.items)] : [];
  if (shape.type === 'boolean') return false;
  if (shape.type === 'integer') return 0;
  if (Array.isArray(shape.type)) return null;
  if (shape.pattern?.includes('{64}')) return 'a'.repeat(64);
  if (shape.pattern?.includes('{40}')) return 'a'.repeat(40);
  if (shape.pattern?.includes('tgz')) return 'synthetic.tgz';
  return 'synthetic';
}
function candidate() {
  const value = authored(schema);
  value.role = 'final'; value.populationPlanSet = 'b11-population-v2';
  value.activation = structuredClone(B11_EXPECTED_ACTIVATION);
  value.protectedEpochs = b11ProtectedEpochs(value);
  value.freezeCommitment = b11Commitment({ ...value, freezeCommitment: undefined });
  return value;
}
test('bounded candidate publishes exclusively and cannot authorise current use or owner acceptance', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'prepared-freeze-'));
  try {
    const value = candidate();
    const target = publishPreparedPiiFreeze(directory, value);
    assert.equal(target, path.join(directory, PREPARED_PII_FREEZE_PATH));
    const bytes = readFileSync(target);
    assert.throws(() => publishPreparedPiiFreeze(directory, value), /exist|overwrite/i);
    assert.throws(() => requireReviewedPreparedPiiFreeze(directory, bytes, { canonicalInputs: [] }), /independent reviewed registration/);
    const registration = { canonicalInputs: [{ path: PREPARED_PII_FREEZE_PATH, role: PREPARED_PII_FREEZE_ROLE, reviewIssue: 879, bytes: bytes.length, sha256: sha(bytes) }] };
    requireReviewedPreparedPiiFreeze(directory, bytes, registration);
    assert.throws(() => requireReviewedPreparedPiiFreeze(directory, Buffer.concat([bytes, Buffer.from(' ')]), registration), /registration/);
    assert.equal(existsSync(path.join(directory, 'benchmarks/accepted-pii-profile-cost.json')), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
test('schema and commitment reject rehashed acceptance claims, traversal and spent epochs', () => {
  for (const mutate of [v => { v.ownerAcceptance = { owner: 'invented' }; }, v => { v.candidate.artifacts.core.file = '../../old.tgz'; }, v => { v.protectedEpochs[0].runs = 1; }, v => { v.activation.off = 'invented'; }]) {
    const value = candidate(); mutate(value); value.freezeCommitment = b11Commitment({ ...value, freezeCommitment: undefined });
    assert.throws(() => validatePreparedPiiFreeze(value), /schema rejected|epoch differs/);
  }
});
test('real promotion CLI prepares an absent bounded role, refuses existing target and tampered source without scans', () => {
  const target = path.join(root, PREPARED_PII_FREEZE_PATH);
  assert.equal(existsSync(target), false, 'No accepted candidate is introduced by this test');
  const stage = mkdtempSync(path.join(root, 'results-output/prepared-freeze-test-'));
  const acceptedLedger = readFileSync(path.join(root, 'benchmarks/accepted-pii-profile-cost.json'));
  try {
    const value = candidate(); value.benchmark.baseRevision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    value.operationalBaseline.sourceCommit = B11_BASELINE_879.sourceCommit;
    const historical = b11FreezeFiles('b11-population-v2');
    const mapping = { 'evidence/901/426/pii-c3-reviewed-corrections-v1.json': 'benchmarks/inputs/pii/fixture-corrections.json', 'evidence/901/pii-gap-ledger-v1.json': 'benchmarks/inputs/pii/gap-policy.json', 'evidence/879/pii-operational-evidence-v1.json': 'benchmarks/inputs/pii/operational-byte-budget.json' };
    const extras = ['benchmarks/evaluation/domains/pii/current-inputs.ts', 'benchmarks/evaluation/domains/pii/operational-byte-baseline.ts', 'benchmarks/inputs/pii/current-inputs-index.json', 'schemas/pii-gap-policy-v1.json', 'schemas/pii-fixture-corrections-v1.json', 'schemas/prepared-pii-freeze-v1.json', 'scripts/lib/prepared-pii-freeze.mjs'];
    value.frozenInputs = historical.benchmarkInputs.map(file => ({ path: mapping[file] ?? file, sha256: sha(readFileSync(path.join(root, mapping[file] ?? file))) }));
    value.evaluationSchema = [...historical.evaluationSchema, ...extras].map(file => ({ path: file, sha256: sha(readFileSync(path.join(root, file))) }));
    for (const [folder, artifacts] of [[`core-${value.candidate.sourceCommit.slice(0, 12)}`, value.candidate.artifacts], [`baseline-${B11_BASELINE_879.sourceCommit.slice(0, 12)}`, value.operationalBaseline.artifacts]]) {
      const out = path.join(stage, folder, 'npm'); mkdirSync(out, { recursive: true });
      writeFileSync(path.join(out, 'synthetic.tgz'), 'synthetic artifact, never installed');
      for (const role of ['core', 'node', 'wasm']) artifacts[role] = { file: 'synthetic.tgz', sha256: sha('synthetic artifact, never installed'), bytes: Buffer.byteLength('synthetic artifact, never installed') };
    }
    const bin = path.join(stage, `core-${value.candidate.sourceCommit.slice(0, 12)}`, 'bin'); mkdirSync(bin, { recursive: true }); writeFileSync(path.join(bin, 'pii_identity_evaluation'), 'not executable');
    value.candidate.identityExample.binarySha256 = sha('not executable'); value.protectedEpochs = b11ProtectedEpochs(value); value.freezeCommitment = b11Commitment({ ...value, freezeCommitment: undefined });
    const prepared = path.join(stage, 'freeze.json'); writeFileSync(prepared, JSON.stringify(value));
    const argv = ['--import', 'tsx', 'scripts/pii-beta11.mjs', `--core-commit=${value.candidate.sourceCommit}`, `--core-repo=${root}`, '--role=final', `--work=${stage}`, `--promote-freeze=${prepared}`];
    const run = () => spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8', timeout: 30000 });
    const success = run(); assert.equal(success.status, 0, success.stderr);
    assert.deepEqual(JSON.parse(readFileSync(target)), value);
    const existing = run(); assert.notEqual(existing.status, 0); assert.match(existing.stderr, /already exists/);
    rmSync(target); value.frozenInputs[0].sha256 = 'b'.repeat(64); value.protectedEpochs = b11ProtectedEpochs(value); value.freezeCommitment = b11Commitment({ ...value, freezeCommitment: undefined }); writeFileSync(prepared, JSON.stringify(value));
    const tampered = run(); assert.notEqual(tampered.status, 0); assert.match(tampered.stderr, /frozen file changed/); assert.equal(existsSync(target), false);
    assert.deepEqual(readFileSync(path.join(root, 'benchmarks/accepted-pii-profile-cost.json')), acceptedLedger);
  } finally { rmSync(target, { force: true }); rmSync(stage, { recursive: true, force: true }); }
});
