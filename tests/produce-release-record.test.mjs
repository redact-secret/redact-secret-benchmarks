import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import registry from '../benchmarks/evaluation/domains/pii/support-registry-v1.json' with { type: 'json' };
import { assembleReleaseRecordV2, assertNoCrossDomainAggregate, reviewedReleaseSourceEquivalence, validateReleaseRecord,
  validateReleaseRecordV2 } from '../benchmarks/evaluation/release-record.ts';
import { verifyReleaseRecordEvidence, verifySourceEquivalenceParity } from '../benchmarks/evaluation/release-record-evidence.ts';
import { validateEvidence } from '../benchmarks/evaluation/evidence.ts';
import liveSuite from '../qualification/suite-v1.json' with { type: 'json' };
import { piiReviewedProtectedRoute } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';

const execFile = promisify(execFileCallback);
const root = fileURLToPath(new URL('../', import.meta.url));
const registryFamilies = registry.families.map(row => row.family);
const json = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const RELEASE = '94fc18a974f659ea882c89120dbf1adb3acf2f28', PII_COMMIT = '8b6a5fde52ecb4dfce13f09c7a947062d21483c7';
// The frozen Beta.11 record is validated against the suite it was produced with, not the live pin that every re-pin bumps.
const SUITE_PATH = 'evidence/449/suite-v1.json';
const suite = JSON.parse(await readFile(path.join(root, SUITE_PATH), 'utf8'));
const binding = piiReviewedProtectedRoute('beta11-8b6a5fd-pii-protected');

async function beta11Input(overrides = {}) {
  return {
    releaseVersion: '0.1.0-beta.11', sourceCommit: RELEASE, benchmarkRevision: 'c82a15ab797452fe200fc74674604ae9cd03cac3',
    performanceBudget: await json('evidence/860/94fc18a-release/regression-budgets.json'), credentialProfile: 'measurement-v4',
    credentialCandidateEvidence: await json('evidence/449/credential-candidate-94fc18a-v1.json'),
    credentialQualification: await json('evidence/449/credential-qualification-engine-v1.json'),
    sourceEquivalenceId: 'beta11-8b6a5fd-to-94fc18a', piiRoute: 'pii-b11-protected-v1', piiProtectedBinding: binding,
    piiProtectedDisposition: await json(`${binding.evidenceDirectory}/pii-beta11-protected-disposition-v2.json`),
    suite, ...overrides,
  };
}

test('assembles a Beta.11 schema 2 record from committed evidence and verifies it against the repository', async () => {
  const record = assembleReleaseRecordV2(await beta11Input());
  assert.equal(record.reportType, 'release-record');
  assert.deepEqual(record.release, { version: '0.1.0-beta.11', sourceCommit: RELEASE });
  assert.equal(record.identity.productSourceCommit, RELEASE);
  assert.equal(record.pii.evidenceSourceCommit, PII_COMMIT);
  assert.equal(record.sourceEquivalence.id, 'beta11-8b6a5fd-to-94fc18a');
  assert.equal(record.identity.holdoutState.pii, 'complete');
  assert.doesNotThrow(() => assertNoCrossDomainAggregate(record));
  assert.equal(validateReleaseRecord(structuredClone(record), registryFamilies, suite).artifactCommitment, record.artifactCommitment);
  await verifyReleaseRecordEvidence(structuredClone(record), registryFamilies, root, suite);
});

test('the frozen Beta.11 record reproduces from its embedded artifacts and the committed evidence', async () => {
  const record = await json('evidence/449/release-record-v2.json');
  validateReleaseRecordV2(record, registryFamilies, suite);
  await verifyReleaseRecordEvidence(record, registryFamilies, root, suite);
  assert.equal(record.release.sourceCommit, RELEASE);
});

test('a PII evidence commit different from the release commit needs a reviewed source equivalence', async () => {
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ sourceEquivalenceId: null })), /no reviewed source equivalence/);
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ sourceEquivalenceId: 'not-reviewed' })), /no reviewed source equivalence/);
});

test('rejects a release commit or version the credential run does not name', async () => {
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ sourceCommit: PII_COMMIT })), /release source commit/);
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ releaseVersion: '0.1.0-beta.12' })), /release version/);
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ releaseVersion: 'beta11' })), /Invalid release version/);
});

test('rejects an unreviewed protected route or a disposition that differs from it', async () => {
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ piiProtectedBinding: { ...binding, maximumStatus: 'stable' } })), /not a reviewed binding/);
  const input = await beta11Input();
  input.piiProtectedDisposition.families[0].status = 'stable';
  assert.throws(() => assembleReleaseRecordV2(input), /does not match its reviewed route|never projects stable/);
});

test('a tampered frozen record fails validation', async () => {
  const record = assembleReleaseRecordV2(await beta11Input());
  const tampered = structuredClone(record); tampered.pii.protectedDisposition.distribution.provisional = 6;
  assert.throws(() => validateReleaseRecordV2(tampered, registryFamilies));
  const extra = structuredClone(record); extra.overallScore = 1;
  assert.throws(() => validateReleaseRecordV2(extra, registryFamilies), /Invalid release record shape/);
});

test('source equivalence parity re-derives from the two committed runs and rejects a wrong count', async () => {
  const entry = reviewedReleaseSourceEquivalence('beta11-8b6a5fd-to-94fc18a');
  assert.deepEqual(await verifySourceEquivalenceParity(root, entry), { fixtures: 4827, differingFixtures: 0 });
  await assert.rejects(verifySourceEquivalenceParity(root, { ...entry, credentialParity: { ...entry.credentialParity, fixtures: 1 } }), /does not re-derive/);
  await assert.rejects(verifySourceEquivalenceParity(root, { ...entry, fromCommit: RELEASE }), /not a clean full-suite run/);
});

test('the CLI rejects an unknown PII route, missing flags and flags of the other route', async () => {
  const cli = args => execFile(process.execPath, ['--import', 'tsx', 'scripts/produce-release-record.mjs', ...args], { cwd: root, timeout: 20_000 });
  const base = ['--release-version=0.1.0-beta.11', `--source-commit=${RELEASE}`, `--benchmark-revision=${'2'.repeat(40)}`,
    '--credential-profile=measurement-v4', '--performance-budget=x', '--credential-candidate=x', '--credential-qualification=x', '--output=x'];
  await assert.rejects(cli([...base, '--pii-route=bogus']), error => /--pii-route must be/.test(error.stderr));
  await assert.rejects(cli(base.slice(1)), error => /Missing required/.test(error.stderr));
  await assert.rejects(cli([...base, '--pii-route=pii-b11-protected-v1', '--pii-protected-binding=beta11-8b6a5fd-pii-protected', '--pii-binding=x']),
    error => /Unknown --<flag>: pii-binding/.test(error.stderr));
});

test('the CLI writes a verified Beta.11 record', async () => {
  await mkdir(path.join(root, 'results-output'), {recursive: true});
  const directory = await mkdtemp(path.join(root, 'results-output/release-record-v2-'));
  try {
    const output = path.join(directory, 'record.json');
    const args = ['--import', 'tsx', 'scripts/produce-release-record.mjs', '--release-version=0.1.0-beta.11',
      `--source-commit=${RELEASE}`, '--benchmark-revision=c82a15ab797452fe200fc74674604ae9cd03cac3', '--credential-profile=measurement-v4',
      '--performance-budget=evidence/860/94fc18a-release/regression-budgets.json', '--credential-candidate=evidence/449/credential-candidate-94fc18a-v1.json',
      '--credential-qualification=evidence/449/credential-qualification-engine-v1.json', '--pii-route=pii-b11-protected-v1',
      `--suite=${SUITE_PATH}`, '--pii-protected-binding=beta11-8b6a5fd-pii-protected', '--source-equivalence=beta11-8b6a5fd-to-94fc18a', `--output=${output}`];
    await execFile(process.execPath, args, { cwd: root, timeout: 60_000 });
    const record = JSON.parse(await readFile(output, 'utf8'));
    assert.deepEqual(record, assembleReleaseRecordV2(await beta11Input()));
    const outside = path.join(root, 'evidence/876-unaccepted-record.json');
    await assert.rejects(execFile(process.execPath, [...args.slice(0, -1), `--output=${outside}`], {cwd: root}), error => /ignored results-output/.test(error.stderr));
    await assert.rejects(readFile(outside), error => error.code === 'ENOENT');
    await symlink(path.join(root, 'evidence'), path.join(directory, 'escape'));
    await assert.rejects(execFile(process.execPath, [...args.slice(0, -1), `--output=${path.join(directory, 'escape/876-unaccepted-record.json')}`], {cwd: root}), error => /ignored results-output/.test(error.stderr));
    await assert.rejects(readFile(outside), error => error.code === 'ENOENT');
    await assert.rejects(execFile(process.execPath, args, {cwd: root}), error => /already exists/.test(error.stderr));
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), record);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a record produced against a stale suite snapshot is still rejected against the live suite', async () => {
  const qualification = await json('evidence/449/credential-qualification-engine-v1.json');
  validateEvidence(qualification, 'qualification', suite);
  const stale = { ...suite, scanners: { ...suite.scanners, 'redact-secret': '0.0.0-stale' } };
  assert.throws(() => validateEvidence(qualification, 'qualification', stale), /suite or tool version drift/);
  assert.throws(() => validateEvidence({ ...qualification, suiteHash: '0'.repeat(64) }, 'qualification', suite), /suite or tool version drift/);
  // Without a snapshot the live suite decides: a Beta.11 record no longer matches the current pin, and the check has no bypass.
  assert.throws(() => validateEvidence(qualification, 'qualification', liveSuite), /suite or tool version drift/);
  await assert.rejects(async () => assembleReleaseRecordV2(await beta11Input({ suite: undefined })), /suite or tool version drift/);
});
