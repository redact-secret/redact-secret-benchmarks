import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CustodianConsumer, canonicalize, conformanceReport, decodeCanonical, requestDigest,
} from '../benchmarks/evaluation/domains/pii/custodian-consumer.mjs';
import { buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, validatePiiSupportMatrixV2 } from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { custodianConformanceFrom } from '../scripts/pii-publication-inputs.ts';

const bundle = JSON.parse(await readFile('tests/fixtures/custodian/synthetic-pii-bundle.json', 'utf8'));
const wire = value => canonicalize(value);
const response = part => ({ manifest: wire(part.manifest), projections: part.projections.map(wire), revocations: part.revocations.map(wire) });
const start = (pins = bundle.pins) => new CustodianConsumer(structuredClone(pins));

test('canonical encoder reproduces current custodian golden payloads', async () => {
  for (const name of ['public-projection-v2', 'revocation-envelope']) {
    const golden = (await readFile(`tests/fixtures/custodian/golden/${name}.canonical.json`, 'utf8')).trimEnd();
    assert.equal(canonicalize(JSON.parse(golden)), golden);
    assert.equal(canonicalize(decodeCanonical(golden)), golden);
  }
});

test('signed v2 projection is destination-bound, preserves suppressed cells, and never qualifies live support', () => {
  const report = conformanceReport(bundle.pins, wire(bundle.initial.request), response(bundle.initial), bundle.initial.now);
  assert.equal(report.syntheticConformance, true);
  assert.equal(report.supportClaims, false);
  assert.equal(report.qualification, 'not-live-support-evidence');
  assert.equal(report.configurationBinding, 'bridge-request-only-not-signed-projection');
  assert.equal(report.projections[0].destinationBinding, 'destination-bound');
  assert.equal(report.projections[0].attestation.ground_truth, 'not_established');
  assert.ok(report.projections[0].cells.some(cell => cell.value.state === 'suppressed'));
});

test('feed update revokes accepted evidence and re-evaluation reports the loss', () => {
  const consumer = start();
  const first = consumer.acceptResponse(wire(bundle.initial.request), response(bundle.initial), bundle.initial.now);
  assert.equal(first.accepted.length, 1);
  const update = consumer.acceptResponse(wire(bundle.revocationUpdate.request), response(bundle.revocationUpdate), bundle.revocationUpdate.now);
  assert.equal(update.feedApplied, 1);
  assert.equal(update.feedError, null);
  assert.deepEqual(consumer.reevaluate(bundle.revocationUpdate.now), [{
    digest: first.accepted[0].digest, from: 'valid', to: 'revoked',
  }]);
  assert.deepEqual(consumer.reevaluate(bundle.revocationUpdate.now + 1), []);
});

test('tamper, key authorization, candidate, destination, configuration and manifest bindings fail closed', () => {
  const badSignature = structuredClone(bundle.initial);
  badSignature.projections[0].signature.value = `${badSignature.projections[0].signature.value.slice(0, -1)}A`;
  assert.throws(() => conformanceReport(bundle.pins, wire(badSignature.request), response(badSignature), badSignature.now), /bad_signature/);

  const wrongPurpose = structuredClone(bundle.pins);
  wrongPurpose.keys[0].purposes = ['revocation-feed'];
  assert.throws(() => conformanceReport(wrongPurpose, wire(bundle.initial.request), response(bundle.initial), bundle.initial.now), /key_not_acceptable/);
  const revokedKey = structuredClone(bundle.pins);
  revokedKey.keys[0].revokedAt = bundle.initial.projections[0].payload.issued_at;
  assert.throws(() => conformanceReport(revokedKey, wire(bundle.initial.request), response(bundle.initial), bundle.initial.now), /key_not_acceptable/);

  const wrongCandidatePins = structuredClone(bundle.pins), wrongCandidate = structuredClone(bundle.initial);
  wrongCandidatePins.candidate = `sha256:${'a'.repeat(64)}`;
  wrongCandidate.request.candidate = wrongCandidatePins.candidate;
  wrongCandidate.manifest.request_digest = requestDigest(wrongCandidate.request);
  assert.throws(() => conformanceReport(wrongCandidatePins, wire(wrongCandidate.request), response(wrongCandidate), wrongCandidate.now), /wrong_candidate/);

  const wrongDestinationPins = structuredClone(bundle.pins), wrongDestination = structuredClone(bundle.initial);
  wrongDestinationPins.destination = 'another-benchmark';
  wrongDestination.manifest.destination = wrongDestinationPins.destination;
  assert.throws(() => conformanceReport(wrongDestinationPins, wire(wrongDestination.request), response(wrongDestination), wrongDestination.now), /destination_mismatch/);

  const wrongDomainPins = structuredClone(bundle.pins), wrongDomain = structuredClone(bundle.initial);
  wrongDomainPins.domain = 'credential';
  wrongDomainPins.acceptedPolicies[0].domain = 'credential';
  wrongDomain.request.domain = 'credential';
  wrongDomain.manifest.request_digest = requestDigest(wrongDomain.request);
  assert.throws(() => conformanceReport(wrongDomainPins, wire(wrongDomain.request), response(wrongDomain), wrongDomain.now), /wrong_domain/);

  const wrongPopulationPins = structuredClone(bundle.pins), wrongPopulation = structuredClone(bundle.initial);
  const otherPopulation = { kind: 'opaque', id: 'ppr_otherpopulation000001' };
  wrongPopulationPins.acceptedPopulations = [otherPopulation];
  wrongPopulation.request.populations = [otherPopulation];
  wrongPopulation.manifest.request_digest = requestDigest(wrongPopulation.request);
  assert.throws(() => conformanceReport(wrongPopulationPins, wire(wrongPopulation.request), response(wrongPopulation), wrongPopulation.now), /wrong_population/);

  const wrongPolicyPins = structuredClone(bundle.pins);
  wrongPolicyPins.acceptedPolicies[0].name = 'another-policy';
  assert.throws(() => conformanceReport(wrongPolicyPins, wire(bundle.initial.request), response(bundle.initial), bundle.initial.now), /policy_not_accepted/);

  const wrongConfig = structuredClone(bundle.initial);
  wrongConfig.request.config = `sha256:${'b'.repeat(64)}`;
  wrongConfig.manifest.request_digest = requestDigest(wrongConfig.request);
  assert.throws(() => conformanceReport(bundle.pins, wire(wrongConfig.request), response(wrongConfig), wrongConfig.now), /wrong_request/);

  const manifestMismatch = structuredClone(bundle.initial);
  manifestMismatch.manifest.projections[0] = `sha256:${'c'.repeat(64)}`;
  assert.throws(() => conformanceReport(bundle.pins, wire(manifestMismatch.request), response(manifestMismatch), manifestMismatch.now), /manifest_mismatch/);

  const missing = structuredClone(bundle.initial);
  missing.projections = [];
  missing.manifest.projections = [];
  assert.throws(() => conformanceReport(bundle.pins, wire(missing.request), response(missing), missing.now), /missing/);
});

test('bounded canonical parsing, feed gap, chain, fork, freshness and expiry all fail closed', () => {
  assert.throws(() => decodeCanonical(` ${wire(bundle.initial.request)}`), /malformed/);
  assert.throws(() => decodeCanonical('x'.repeat(65_537)), /malformed/);

  const gap = start();
  assert.throws(() => gap.observeFeed(wire(bundle.revocationUpdate.revocations[0])), /feed_gap/);

  const chain = start();
  chain.observeFeed(wire(bundle.initial.revocations[0]));
  chain.head = `sha256:${'f'.repeat(64)}`;
  assert.throws(() => chain.observeFeed(wire(bundle.revocationUpdate.revocations[0])), /feed_chain/);

  const fork = start();
  fork.observeFeed(wire(bundle.initial.revocations[0]));
  fork.feedDocuments.set(1, 'different-correctly-signed-document-was-previously-accepted');
  assert.throws(() => fork.observeFeed(wire(bundle.initial.revocations[0])), /feed_fork/);

  const consumer = start();
  const first = consumer.acceptResponse(wire(bundle.initial.request), response(bundle.initial), bundle.initial.now);
  assert.equal(consumer.standing(first.accepted[0].payload, 1900004000), 'stale');
  const expiresBeforeFeed = structuredClone(first.accepted[0].payload);
  expiresBeforeFeed.fresh_until = 1900001000;
  assert.equal(consumer.standing(expiresBeforeFeed, 1900002000), 'expired');

  consumer.feedIssuedAt = bundle.initial.now + 1;
  assert.equal(consumer.standing(first.accepted[0].payload, bundle.initial.now), 'stale');
  consumer.feedIssuedAt = bundle.initial.revocations[0].payload.issued_at;

  consumer.entries.push({
    target: { target: 'projection', projection_id: first.accepted[0].payload.projection_id },
    action: { action: 'superseded', superseded_by: 'prj_superseding00000001' },
    reason: 'newer_evidence', effective_at: bundle.initial.now,
  });
  assert.equal(consumer.standing(first.accepted[0].payload, bundle.initial.now), 'superseded');
});

test('a response bound to the wrong revocation feed cannot produce accepted evidence', () => {
  const pins = structuredClone(bundle.pins);
  pins.feedId = 'fed_otherintegration000001';
  const initial = structuredClone(bundle.initial);
  initial.request.feed_id = pins.feedId;
  initial.manifest.feed_id = pins.feedId;
  initial.manifest.request_digest = requestDigest(initial.request);
  assert.throws(() => conformanceReport(pins, wire(initial.request), response(initial), initial.now), /wrong_feed/);
});

test('synthetic conformance is commitment-bound in publication but cannot change a qualification verdict', async () => {
  const conformance = await custodianConformanceFrom('tests/fixtures/custodian/synthetic-pii-bundle.json');
  const baseline = buildPiiSupportMatrixV2();
  const matrix = buildPiiSupportMatrixV2({ custodianConformance: conformance });
  assert.deepEqual(matrix.distribution, baseline.distribution);
  assert.deepEqual(matrix.families, baseline.families);
  assert.equal(matrix.custodianConformance?.qualification, 'not-live-support-evidence');
  assert.equal(validatePiiSupportMatrixV2(matrix).custodianConformance?.bundleSha256, conformance.bundleSha256);

  const forged = structuredClone(matrix);
  forged.custodianConformance.projections[0].standing = 'revoked';
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.throws(() => validatePiiSupportMatrixV2(forged), /schema|conformance evidence/);
});
