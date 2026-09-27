import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { defineEvaluationDomains, evaluationDomainIds, resolveEvaluationDomain } from '../benchmarks/evaluation/domains/registry.ts';
import { runHoldout } from '../holdout/lifecycle.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { rangeOutcome } from '../benchmarks/evaluation/domains/pii/contract-model.ts';
import { validatePiiAssessment } from '../benchmarks/evaluation/domains/pii/assessment.ts';
import { validatePiiSupportMatrix } from '../benchmarks/evaluation/domains/pii/support.ts';

const scanner = {
  id: 'pii-test-scanner', mode: 'candidate', capabilities: { ranges: true, classification: true },
  configuration: { fixture: true }, async version() { return '1.0.0'; },
  async scan(_directory, inputs) { return inputs.flatMap(input => input.id === 'pii-jurisdiction-probe' ? [] : [{ path: input.path, start: 8, end: 30,
    family: 'pii:global:email', sensitive: false, diagnostic: 'RAW-SENTINEL-MUST-DROP' }]); },
};

test('schema-only PII runs through shared runtime with independent axes and no support claim', async () => {
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000000277', provenance: { sourceRevision: 'd'.repeat(64) } });
  assert.equal(artifact.domain, 'pii');
  assert.equal(artifact.evaluationProfile, 'pii-schema-v1');
  assert.equal(artifact.domainAccountingVersion, 'pii-observation-v1');
  assert.equal(artifact.supportClaims, false);
  assert.equal(artifact.caseCount, 2);
  assert.equal(artifact.variantCount, 2);
  assert.equal(artifact.assertionCount, 4);
  assert.equal(artifact.typeIdentity.pass, 2);
  assert.equal(artifact.sensitivityContext.pass, 2);
  assert.equal(artifact.results[0].outcomes[0].typeIdentity.state, 'correct');
  assert.equal(artifact.results[0].outcomes[0].sensitivityContext.state, 'correct');
  assert.equal(artifact.provenance.sourceRevision, 'd'.repeat(64));
  assert.equal(artifact.scanners[0].observation.source, 'fresh');
  const serialized = JSON.stringify(artifact);
  assert.doesNotMatch(serialized, /person@example\.invalid|000-00-0000|RAW-SENTINEL-MUST-DROP|fixtureHash|contentHash|sourceHash|"seed":|"candidate":/);
  assert.doesNotMatch(serialized, /\btier\b|\bgate\b/);
  await assert.rejects(() => piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
    provenance: { arbitrary: 'raw provenance' } }), /Invalid PII run provenance/);
});

test('unavailable or unclassified scanner evidence cannot pass either axis', async () => {
  const unavailable = { ...scanner, id: 'unavailable', async version() { throw new Error('unavailable'); } };
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [unavailable] });
  assert.equal(artifact.typeIdentity['not-measured'], 2);
  assert.equal(artifact.sensitivityContext['not-measured'], 2);

  const unclassified = { ...scanner, id: 'unclassified', async scan(_directory, inputs) {
    return inputs.map(input => ({ path: input.path, start: 11, end: 34, sensitive: true }));
  } };
  const second = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [unclassified] });
  assert.equal(second.typeIdentity['not-measured'], 2);
});

test('PII contract rejects invalid scope, authority source, profile, and visibility enums', () => {
  const base = piiDomain.loadCases()[0];
  for (const invalid of [
    { ...base, visibility: 'public' },
    { ...base, contract: { ...base.contract, scope: 'jurisdiction:ZZ' } },
    { ...base, contract: { ...base.contract, family: 'synthetic-person-id' } },
    { ...base, contract: { ...base.contract, authority: [{ ...base.contract.authority[0], sourceKind: 'blog' }] } },
    { ...base, contract: { ...base.contract, authority: [{ ...base.contract.authority[0], locator: 'free text with a claim' }] } },
    { ...base, contract: { ...base.contract, authority: [{ ...base.contract.authority[0], supports: ['opinion'] }] } },
    { ...base, contract: { ...base.contract, identityDomain: 'passport' } },
    { ...base, contract: { ...base.contract, context: { ...base.contract.context, obligation: 'maybe' } } },
    { ...base, contract: { ...base.contract, sensitivityExpectation: 'unknown' } },
    { ...base, contract: { ...base.contract, qualificationProfile: { id: 'credential-v1', version: 1 } } },
  ]) assert.throws(() => piiDomain.validateCase(invalid), /Invalid PII/);
});

test('global and jurisdictional assessments flow through evaluation into a safe support projection', async () => {
  const cases = piiDomain.loadCases();
  const artifact = await piiDomain.execute({ cases, methods: piiDomain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000000268' });
  const matrix = piiDomain.support.projectPiiSupportMatrix(artifact, cases);
  assert.equal(matrix.supportClaims, false);
  assert.deepEqual(matrix.entries.map(entry => [entry.assessment.family, entry.assessment.scope]), [
    ['pii:global:email', 'global'], ['pii:us:ssn', 'jurisdiction:US'],
  ]);
  assert.deepEqual(matrix.entries.map(entry => entry.assessment.identityDomain), ['email', 'national-id']);
  assert.ok(matrix.entries.every(entry => entry.assessment.qualificationProfile.id === 'pii-v1'));
  assert.ok(matrix.entries.every(entry => entry.assessment.authority.every(source => source.supports.length > 0)));
  const serialized = JSON.stringify(matrix);
  assert.doesNotMatch(serialized, /person@example\.invalid|000-00-0000|contact=|national_id=|\.txt|"content"|"candidate"|"seed"/);
  assert.throws(() => validatePiiAssessment({ ...structuredClone(matrix.entries[0].assessment), scope: 'jurisdiction:ZZ' }), /Invalid/);
  assert.throws(() => validatePiiAssessment({ ...structuredClone(matrix.entries[0].assessment), family: 'synthetic-person-id' }), /Invalid/);
  assert.throws(() => validatePiiSupportMatrix({ ...structuredClone(matrix), extra: true }), /Invalid/);
  const inconsistent = structuredClone(matrix); inconsistent.entries[0].observations[0].typeIdentity.pass--;
  assert.throws(() => validatePiiSupportMatrix(inconsistent), /Inconsistent/);
  const stale = structuredClone(artifact); stale.results[0].assessment.scope = 'jurisdiction:US';
  assert.throws(() => piiDomain.support.projectPiiSupportMatrix(stale, cases), /stale/);
});

test('generic registry preserves PII domain identity without credential casts', () => {
  const registry = defineEvaluationDomains({ pii: piiDomain });
  assert.equal(registry.pii.domain, 'pii');
  assert.equal(registry.pii.createMethods().get('schema-only').id, 'schema-only');
  assert.deepEqual(evaluationDomainIds(), ['credential', 'pii']);
  assert.equal(resolveEvaluationDomain('pii'), piiDomain);
});

test('PII range outcomes distinguish exact, strict supersets, partial overlaps, and misses', () => {
  const candidate = { start: 10, end: 20 };
  assert.equal(rangeOutcome(candidate, { path: 'x', start: 10, end: 20 }), 'exact');
  assert.equal(rangeOutcome(candidate, { path: 'x', start: 9, end: 21 }), 'overbroad');
  assert.equal(rangeOutcome(candidate, { path: 'x', start: 12, end: 18 }), 'partial');
  assert.equal(rangeOutcome(candidate, { path: 'x', start: 5, end: 12 }), 'partial');
  assert.equal(rangeOutcome(candidate, { path: 'x', start: 20, end: 25 }), 'miss');
  assert.equal(rangeOutcome(candidate), 'miss');
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
  assert.equal(report.domain, 'pii');
  assert.equal(report.supportClaims, false);
  assert.equal(report.scanners[0].axes.typeIdentity.pass, 1);
  assert.equal(report.scanners[0].axes.sensitivityContext.pass, 1);
  const serialized = JSON.stringify(report);
  assert.doesNotMatch(serialized, /pii-public-control\.txt|person@example\.invalid|"content"|"start"|"end"/);
  assert.throws(() => piiDomain.holdout.validateReport({ ...structuredClone(report), extra: true }), /Invalid PII holdout aggregate/);
  assert.throws(() => piiDomain.holdout.validateReport({ ...structuredClone(report), status: 'incomplete' }), /Invalid PII holdout aggregate/);
});

test('PII holdout requires an explicit matching manifest identity', () => {
  assert.throws(() => piiDomain.holdout.resolveManifestEvaluation({}), /manifest-evaluation-missing/);
});
