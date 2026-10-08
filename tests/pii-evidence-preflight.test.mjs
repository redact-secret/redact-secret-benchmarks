import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { SNAPSHOT_PIN, CONSUMER_PIN, validateEvidencePins, validateProposedSnapshotPin,
  validateProposedConsumerPin, validatePreflightReport, expectedPreflightReport, verifyConsumerRuntime,
  preflightReport, verifyImportDigests, validateSourceBuiltConsumerReceipt, COUNTS, LOSSES, IMPORT_OUTPUTS } from '../scripts/lib/pii-evidence-contract.mjs';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const read = file => JSON.parse(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'));
const policy = read('benchmarks/pii-population-policy.json');
const report = read('benchmarks/pii-evidence/preflight.json');

test('released snapshot and consumer source/build pins are exact and preserve the four populations', () => {
  const snapshot = read('benchmarks/pii-evidence/snapshot-pin.json'), consumer = read('benchmarks/pii-evidence/consumer-pin.json');
  assert.deepEqual(validateEvidencePins(snapshot, consumer), { snapshotPin: SNAPSHOT_PIN, consumerPin: CONSUMER_PIN });
  assert.deepEqual(validatePreflightReport(report, policy), expectedPreflightReport(policy));
  assert.equal(report.verification.scannersLaunched, 0);
  assert.equal(report.runnable, false);
  assert.equal(report.consumer.evidenceConsumer.canonicalLinux.binarySha256, null);
  assert.equal(report.mappedFamilies['pii:us:ssn'].variants, 9);
  assert.doesNotThrow(() => execFileSync(process.execPath, ['scripts/preflight-pii-evidence.mjs', '--check'], { stdio: 'pipe' }));
});

test('tampered snapshot, release, contract, source, Linux binary and mapping pins refuse', () => {
  for (const mutate of [
    pin => { pin.snapshot.id = 'public-pii-phi/2026-10-07/ffffffffffff'; },
    pin => { pin.snapshot.contentDigest = '0'.repeat(64); },
    pin => { pin.snapshot.manifestSha256 = '0'.repeat(64); },
    pin => { pin.snapshot.sourceManifestDigest = '0'.repeat(64); },
    pin => { pin.release.commit = '0'.repeat(40); },
    pin => { pin.release.tag = 'latest'; },
    pin => { pin.release.archive.tarGzSha256 = '0'.repeat(64); },
    pin => { pin.release.archive.tarSha256 = '0'.repeat(64); },
    pin => { pin.contract.version = '2'; },
    pin => { pin.contract.digestSpec = 'files-v2'; },
    pin => { pin.raw = 'unexpected'; },
  ]) {
    const pin = structuredClone(SNAPSHOT_PIN); mutate(pin);
    assert.throws(() => validateEvidencePins(pin, CONSUMER_PIN), /snapshot-pin-mismatch/);
  }
  for (const mutate of [
    pin => { pin.source.commit = '0'.repeat(40); },
    pin => { pin.source.cargoLockSha256 = '0'.repeat(64); },
    pin => { pin.source.sourceArchiveSha256 = '0'.repeat(64); },
    pin => { pin.source.fetchHelperSha256 = '0'.repeat(64); },
    pin => { pin.source.shimSha256 = '0'.repeat(64); },
    pin => { pin.executionEngine.binarySha256 = '0'.repeat(64); },
    pin => { pin.executionEngine.workflow.runAttempt = 2; },
    pin => { pin.executionEngine.archive.sha256 = '0'.repeat(64); },
    pin => { pin.evidenceConsumer.canonicalLinux.binarySha256 = pin.evidenceConsumer.localVerification.binarySha256; },
    pin => { pin.evidenceConsumer.localVerification.canonical = true; },
    pin => { pin.importedPopulation.digest = '0'.repeat(64); },
    pin => { pin.contract.artifactSchema = '1.2'; },
    pin => { pin.contract.mapping.revision = 2; },
    pin => { pin.supportClaims = true; },
    pin => { pin.ownerAcceptance = {}; },
  ]) {
    const pin = structuredClone(CONSUMER_PIN); mutate(pin);
    assert.throws(() => validateEvidencePins(SNAPSHOT_PIN, pin), /consumer-pin-mismatch/);
  }
});

test('candidate reports retain counts, all losses, exact units and pending claims without approvals', () => {
  for (const mutate of [
    value => { value.runnable = true; }, value => { value.supportClaims = true; },
    value => { value.authorityChanged = true; }, value => { value.activePinsChanged = true; },
    value => { value.verification.canonical = true; }, value => { value.verification.platform = 'linux-x64'; },
    value => { value.verification.scannersLaunched = 1; }, value => { value.counts.corpusVariants--; },
    value => { value.counts.rangeLessOccurrences = 0; }, value => { delete value.losses['contexts-not-carried']; },
    value => { value.losses['identity-weakened-no-span'] = 0; },
    value => { value.mappedKinds.push('national-id/unresolved/placeholder'); },
    value => { value.mappedFamilies['pii:us:ssn'].variants = 0; },
    value => { value.outputs['snapshot.json'].sha256 = '0'.repeat(64); },
    value => { value.adoption.lostAxisClaims = 'support-met'; },
    value => { value.adoption.active = true; }, value => { value.blockers = []; },
    value => { value.ownerAcceptance = { acceptedBy: 'invented' }; },
  ]) {
    const value = structuredClone(report); mutate(value);
    assert.throws(() => validatePreflightReport(value, policy), /PII evidence refusal/);
  }
});

test('future released snapshot proposals vary evidence identity while preserving the reviewed consumer', () => {
  const snapshotPin = structuredClone(SNAPSHOT_PIN);
  snapshotPin.snapshot.id = 'public-pii-phi/2026-10-08/aaaaaaaaaaaa';
  snapshotPin.snapshot.contentDigest = 'a'.repeat(64);
  snapshotPin.release.tag = 'snapshot-public-pii-phi-2026-10-08-aaaaaaaaaaaa';
  snapshotPin.release.archive.name = 'pii-evidence-public-pii-phi-2026-10-08-aaaaaaaaaaaa.tar.gz';
  const consumerPin = structuredClone(CONSUMER_PIN);
  consumerPin.importedPopulation.id = 'pii-evidence-public-pii-phi-2026-10-08-aaaaaaaaaaaa';
  consumerPin.importedPopulation.digest = 'b'.repeat(64);
  consumerPin.importedPopulation.bindingDigest = 'c'.repeat(64);
  assert.doesNotThrow(() => validateProposedSnapshotPin(snapshotPin));
  assert.doesNotThrow(() => validateProposedConsumerPin(consumerPin, snapshotPin));
  const future = expectedPreflightReport(policy, { snapshotPin, consumerPin });
  assert.doesNotThrow(() => validatePreflightReport(future, policy, { snapshotPin, consumerPin }));
  assert.throws(() => validatePreflightReport(future, policy), /preflight-report-mismatch/);
  for (const change of [
    value => { value.source.commit = '0'.repeat(40); },
    value => { value.contract.mapping.revision = 2; },
    value => { value.executionEngine.binarySha256 = '0'.repeat(64); },
  ]) {
    const bad = structuredClone(consumerPin); change(bad);
    assert.throws(() => validateProposedConsumerPin(bad, snapshotPin), /proposed-consumer-pin-invalid/);
  }
  const unbalanced = structuredClone(future); unbalanced.counts.locatedOccurrences++;
  assert.throws(() => validatePreflightReport(unbalanced, policy, { snapshotPin, consumerPin }), /mapping-accounting-invalid/);
});

test('invalid summaries and unknown runtime binaries fail before a candidate report can be written', () => {
  const args = { policy, snapshotPin: SNAPSHOT_PIN, consumerPin: CONSUMER_PIN, verified: {}, imported: {}, outputs: {},
    populationPins: readFileSync(new URL('../benchmarks/pii-eval-population-pins.json', import.meta.url)) };
  assert.throws(() => preflightReport(args), /verification-mismatch/);
  assert.throws(() => preflightReport({ ...args, populationPins: Buffer.from('changed') }), /existing-population-pins-changed/);
  assert.throws(() => verifyConsumerRuntime({ sourceCommit: CONSUMER_PIN.source.commit, cargoLock: Buffer.from('wrong'),
    fetchHelper: Buffer.from('wrong'), binary: Buffer.from('wrong'), platform: 'linux-x64' }, CONSUMER_PIN), /consumer-source-mismatch/);
  assert.equal(Object.keys(LOSSES).length, 5);
  assert.equal(COUNTS.locatedOccurrences + COUNTS.rangeLessOccurrences, COUNTS.corpusVariants);
  assert.deepEqual(Object.keys(IMPORT_OUTPUTS).sort(), ['binding.json', 'snapshot.json']);
});

test('import documents must recompute their own declared digests, including the custom binding domain', () => {
  const snapshot = { schema: 'pii-eval.corpus-snapshot', schemaVersion: '1.4', semantic: { synthetic: 1 } };
  snapshot.semanticDigest = semanticDigest(snapshot);
  const binding = { schema: 'pii-eval-evidence-binding/1', semantic: { synthetic: 2 } };
  binding.semanticDigest = semanticDigest({ schema: 'pii-eval.evidence-binding', schemaVersion: '1', semantic: binding.semantic });
  const population = { digest: snapshot.semanticDigest, bindingDigest: binding.semanticDigest };
  const buffers = () => Object.fromEntries([['snapshot.json', snapshot], ['binding.json', binding]].map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]));
  assert.doesNotThrow(() => verifyImportDigests(buffers(), population));
  binding.semantic.synthetic++;
  assert.throws(() => verifyImportDigests(buffers(), population), /import-output-mismatch/);
  binding.semantic.synthetic--;
  snapshot.semantic.synthetic++;
  assert.throws(() => verifyImportDigests(buffers(), population), /import-output-mismatch/);
  snapshot.semantic.synthetic--;
  snapshot.semanticDigest = '0'.repeat(64);
  assert.throws(() => verifyImportDigests(buffers(), population), /import-output-mismatch/);
});

test('an auxiliary Linux build receipt binds reviewed source, toolchain and command independently of Darwin', () => {
  const source = CONSUMER_PIN.source, build = CONSUMER_PIN.evidenceConsumer.canonicalLinux;
  const receipt = { schema: 'pii-evidence-consumer-build-receipt/1', sourceCommit: source.commit,
    sourceArchiveSha256: source.sourceArchiveSha256, cargoLockSha256: source.cargoLockSha256,
    rustToolchainFileSha256: source.rustToolchainFileSha256, rustc: build.rustc, command: build.command,
    platform: 'linux-x64', binarySha256: 'a'.repeat(64) };
  assert.deepEqual(validateSourceBuiltConsumerReceipt(receipt), receipt);
  for (const mutate of [
    value => { value.sourceCommit = '0'.repeat(40); }, value => { value.cargoLockSha256 = '0'.repeat(64); },
    value => { value.rustc = 'latest'; }, value => { value.command += ' --unlocked'; },
    value => { value.platform = 'darwin-arm64'; }, value => { value.binarySha256 = null; },
    value => { value.canonical = true; },
  ]) {
    const bad = structuredClone(receipt); mutate(bad);
    assert.throws(() => validateSourceBuiltConsumerReceipt(bad), /consumer-build-receipt-invalid/);
  }
});
