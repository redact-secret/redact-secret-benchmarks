import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { defineEvaluationDomains } from '../benchmarks/evaluation/domains/registry.ts';
import { runHoldout } from '../holdout/lifecycle.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

const scanner = {
  id: 'pii-test-scanner', mode: 'candidate', capabilities: { ranges: true, classification: true },
  configuration: { fixture: true }, async version() { return '1.0.0'; },
  async scan(_directory, inputs) { return inputs.map(input => ({ path: input.path, start: 11, end: 34,
    family: 'synthetic-person-id', sensitive: true, diagnostic: 'RAW-SENTINEL-MUST-DROP' })); },
};

test('schema-only PII runs through shared runtime with independent axes and no support claim', async () => {
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000000277', provenance: { sourceRevision: 'test-revision' } });
  assert.equal(artifact.domain, 'pii');
  assert.equal(artifact.evaluationProfile, 'pii-schema-v1');
  assert.equal(artifact.domainAccountingVersion, 'pii-observation-v1');
  assert.equal(artifact.supportClaims, false);
  assert.equal(artifact.caseCount, 1);
  assert.equal(artifact.variantCount, 1);
  assert.equal(artifact.assertionCount, 2);
  assert.equal(artifact.typeIdentity.pass, 1);
  assert.equal(artifact.sensitivityContext['review-required'], 1);
  assert.equal(artifact.results[0].outcomes[0].typeIdentity.state, 'correct');
  assert.equal(artifact.results[0].outcomes[0].sensitivityContext.state, 'unresolved');
  assert.equal(artifact.provenance.sourceRevision, 'test-revision');
  assert.equal(artifact.scanners[0].observation.source, 'fresh');
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /subject_id=|SYNTHETIC-PERSON-ID-001|RAW-SENTINEL-MUST-DROP/);
  assert.doesNotMatch(serialized, /\btier\b|\bgate\b/);
});

test('unavailable or unclassified scanner evidence cannot pass either axis', async () => {
  const unavailable = { ...scanner, id: 'unavailable', async version() { throw new Error('unavailable'); } };
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [unavailable] });
  assert.equal(artifact.typeIdentity['not-measured'], 1);
  assert.equal(artifact.sensitivityContext['not-measured'], 1);

  const unclassified = { ...scanner, id: 'unclassified', async scan(_directory, inputs) {
    return inputs.map(input => ({ path: input.path, start: 11, end: 34, sensitive: true }));
  } };
  const second = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [unclassified] });
  assert.equal(second.typeIdentity['not-measured'], 1);
});

test('PII contract rejects invalid scope, authority source, profile, and visibility enums', () => {
  const base = piiDomain.loadCases()[0];
  for (const invalid of [
    { ...base, visibility: 'public' },
    { ...base, contract: { ...base.contract, scope: { kind: 'regional' } } },
    { ...base, contract: { ...base.contract, authority: { ...base.contract.authority, kind: 'blog' } } },
    { ...base, contract: { ...base.contract, qualificationProfile: { id: 'credential-v1', version: 1 } } },
  ]) assert.throws(() => piiDomain.validateCase(invalid), /Invalid PII/);
});

test('generic registry preserves PII domain identity without credential casts', () => {
  const registry = defineEvaluationDomains({ pii: piiDomain });
  assert.equal(registry.pii.domain, 'pii');
  assert.equal(registry.pii.createMethods().get('schema-only').id, 'schema-only');
});

test('PII uses shared aggregate-only holdout lifecycle without exposing rows or values', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-holdout-test-'));
  const manifestFile = path.join(directory, 'manifest.json');
  const seed = 'public-pii-control-seed';
  const corpus = piiDomain.holdout.publicConformanceCorpus(seed);
  const corpusText = piiDomain.holdout.serializeCorpus(corpus);
  const manifest = { schemaVersion: 1, id: 'pii-public-control', revision: 1, purpose: 'public-conformance', review: 'conformance-only',
    corpusHash: hash(corpusText), seedHash: hash(seed), dataDirectory: `generated/${hash(corpusText)}`, maxRuns: 1, publicSeed: seed,
    evaluation: piiDomain.holdoutStorage.evaluation };
  await writeFile(manifestFile, JSON.stringify(manifest), { mode: 0o644 });
  const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
  const report = await runHoldout({ manifestFile, scanners: [scanner], candidate, verifyCandidate: async () => candidate,
    domain: piiDomain.holdout, runId: '00000000-0000-4000-8000-000000000278' });
  assert.equal(report.status, 'complete');
  assert.equal(report.caseCount, 1);
  assert.equal(report.scanners[0].assertions.pass, 1);
  assert.equal(report.scanners[0].assertions['review-required'], 1);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /pii-public-control\.txt|SYNTHETIC-PERSON-ID|"content"|"start"|"end"/);
});
