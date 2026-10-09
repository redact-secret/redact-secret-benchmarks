import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateProposedConsumerPin, validatePreflightReport, verifyImportDigests } from '../scripts/lib/pii-evidence-contract.mjs';
import { preparePiiEvidenceAdoption } from '../scripts/lib/pii-evidence-adoption.mjs';
import { semanticDigest } from '../benchmarks/evaluation/domains/pii/pii-eval-artifact-consumer.mjs';

const read = name => JSON.parse(readFileSync(new URL(`../${name}`, import.meta.url)));
const base = 'benchmarks/inputs/pii-evidence-snapshot-v2-post37-candidate';
const preflight = read(`${base}/preflight.json`), policy = read('benchmarks/pii-population-policy.json');

test('successor proposal recomputes separately and retains the original v1 predecessor', () => {
  assert.deepEqual(validatePreflightReport(preflight, policy, {
    snapshotPin: preflight.evidence, consumerPin: preflight.consumer,
  }), preflight);
  const previousPreflight = read('benchmarks/pii-evidence/preflight.json');
  const candidate = read(`${base}/candidate.json`);
  assert.deepEqual(preparePiiEvidenceAdoption({ preflight, policy, previousPreflight, scanner: read(`${base}/scanner.json`) }), candidate);
  assert.deepEqual(candidate.historical.identity.evidence, previousPreflight.evidence);
  assert.equal(candidate.ownerAcceptance, null);
  assert.equal(candidate.adoption.canApply, false);
  assert.equal(candidate.measurement.scannerExecutions, 0);
  assert.notEqual(candidate.candidateDigest, read('benchmarks/inputs/pii-evidence-snapshot-v2-candidate/candidate.json').candidateDigest);
});

test('schema, protocol, mapping and engine must opt in as one registered identity', () => {
  for (const mutate of [
    pin => { pin.contract.corpusSchema = '1.4'; },
    pin => { pin.contract.artifactSchema = '1.4'; },
    pin => { pin.contract.protocol.revision = 2; },
    pin => { pin.contract.mapping.revision = 2; },
    pin => { pin.source.commit = '0'.repeat(40); },
    pin => { pin.executionEngine.binarySha256 = '0'.repeat(64); },
    pin => { pin.executionEngine.workflow.runId++; },
    pin => { pin.evidenceConsumer.localVerification.canonical = true; },
  ]) {
    const pin = structuredClone(preflight.consumer); mutate(pin);
    assert.throws(() => validateProposedConsumerPin(pin, preflight.evidence), /proposed-consumer-pin-invalid/);
  }
});

test('schema 1.5 import is refused under default old pins and recomputes both semantic digests', () => {
  const snapshot = { schema: 'pii-eval.corpus-snapshot', schemaVersion: '1.5', semantic: { synthetic: true } };
  snapshot.semanticDigest = semanticDigest(snapshot);
  const binding = { schema: 'pii-eval-evidence-binding/1', semantic: { synthetic: true } };
  binding.semanticDigest = semanticDigest({ schema: 'pii-eval.evidence-binding', schemaVersion: '1', semantic: binding.semantic });
  const population = { digest: snapshot.semanticDigest, bindingDigest: binding.semanticDigest };
  const outputs = () => Object.fromEntries([['snapshot.json', snapshot], ['binding.json', binding]].map(([name, value]) => [name, Buffer.from(JSON.stringify(value))]));
  assert.throws(() => verifyImportDigests(outputs(), population), /import-output-mismatch/);
  assert.doesNotThrow(() => verifyImportDigests(outputs(), population, '1.5'));
  snapshot.semantic.synthetic = false;
  assert.throws(() => verifyImportDigests(outputs(), population, '1.5'), /import-output-mismatch/);
});
