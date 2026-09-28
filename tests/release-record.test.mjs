import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { hash } from '../benchmarks/engine/model.ts';
import registry from '../benchmarks/evaluation/domains/pii/support-registry-v1.json' with { type: 'json' };
import { assembleReleaseRecord, assertNoCrossDomainAggregate, validateReleaseRecord } from '../benchmarks/evaluation/release-record.ts';
import { candidateConfiguration } from '../scanners/candidate.mjs';
import { accountPiiRows } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { qualifyPii } from '../benchmarks/evaluation/domains/pii/qualification.ts';

const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url)));
const registryFamilies = registry.families.map(row => row.family);

function credentialCandidateEvidence(overrides = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, reportType: 'candidate', runId: randomUUID(), startedAt: now, finishedAt: now, status: 'complete', supportClaims: false,
    candidate: { sourceCommit: 'a'.repeat(40), sourceState: 'clean', packageName: '@redact-secret/core', declaredVersion: '1.0.0',
      artifactSha256: 'b'.repeat(64), expectedArtifactSha256: 'b'.repeat(64), artifacts: ['package', 'node', 'wasm'].map(role => ({ role, sha256: 'c'.repeat(64) })) },
    benchmark: { sourceCommit: 'd'.repeat(40), dirty: false, lockfileSha256: 'e'.repeat(64) },
    corpus: { protocol: 'measurement-v4', hash: 'f'.repeat(64), categories: [{ id: 'common-formats', sha256: '0'.repeat(64) }] },
    scanner: { id: 'redact-secret-candidate', configuration: candidateConfiguration, configurationHash: '1'.repeat(64) },
    runtime: { node: process.version, os: process.platform, arch: process.arch }, command: ['node', 'candidate'],
    selection: { scope: 'filtered-development', filter: 'openai-token' }, completeness: { selectedFixtures: 1, scannedFixtures: 1, writtenFixtures: 1 }, failures: [],
    results: [{ fixtureId: 'common-formats--openai-token-legacy-plain', corpusSection: 'fixed-corpus', kind: 'must-redact', tier: 'T2', expectedSpans: 1, actualFindings: 1, outcome: 'EXACT', baseline: { version: '0.1.0-beta.4', outcome: 'EXACT' } }],
    ...overrides,
  };
}

function credentialQualification(overrides = {}) {
  const runId = randomUUID(), time = new Date().toISOString();
  const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
  const scanners = Object.entries(suite.scanners).map(([id, version]) => ({ id, version, configuration: {}, configurationHash: hash({}),
    status: 'complete', assertions: { pass: 2, fail: 0, 'review-required': 0 }, byStratum: { 'must-redact:T1': { pass: 2, fail: 0, 'review-required': 0 } } }));
  return {
    schemaVersion: 2, reportType: 'qualification', engineVersion: '1.1.0', accountingVersion: '1.1', suiteId: 'engine-v1', suiteHash: hash(suite), runId,
    startedAt: time, finishedAt: time, scope: 'engine-conformance', status: 'execution-qualified', supportClaims: false,
    provenance: { ...candidate, revision: 'test', dirty: false, runtime: { node: 'test', platform: 'test', arch: 'test' } },
    development: { seed: 'engine-v1', casesHash: 'd'.repeat(64), corpusHashes: { control: 'e'.repeat(64) }, failures: 0, reviewEntries: 0, byDetector: {} },
    methods: suite.methods.map(method => ({ method, cases: 2, variants: 2, generationErrors: 0,
      scanners: scanners.map(({ id, status, assertions }) => ({ id, status, assertions: method === 'differential' ? { pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 } : method === 'holdout' ? structuredClone(assertions) : { ...assertions, 'not-measured': 0 } })) })),
    accounting: { reasons: [], unresolvedGroups: [], review: { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null } },
    holdout: { schemaVersion: 1, reportType: 'holdout', runId, planHash: 'f'.repeat(64), startedAt: time, finishedAt: time,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence: 'public-control', status: 'complete',
      corpus: { id: 'public-controls', revision: 1, purpose: 'public-conformance', corpusHash: 'd'.repeat(64), seedHash: 'e'.repeat(64), lifecycle: 'sealed-at-execution' },
      candidate, caseCount: 2, variantCount: 2, generationErrors: 0, scanners },
    milestone: { checkedAt: time, repository: 'redact-secret/redact-secret-benchmarks', number: 1, status: 'open', openPrerequisites: [8], outOfScope: [] },
    ...overrides,
  };
}

function performanceBudget(sourceCommit = 'a'.repeat(40)) {
  return { schemaVersion: '1', budgetsId: 'budgets-v1-test', baselineId: 'baseline-1', candidate: { sourceCommit, sources: [] },
    status: 'accepted', dimensions: {}, triggers: [], detection: { baseline: null, candidate: null } };
}

function piiQualification() {
  return qualifyPii(accountPiiRows([]), { protected: null, independent: null });
}

const unsanctionedBinding = { candidateEvidence: {}, activationArtifact: {}, qualificationArtifacts: [] };

test('assertNoCrossDomainAggregate rejects a forbidden key at any depth and accepts a clean record', () => {
  assert.throws(() => assertNoCrossDomainAggregate({ credential: { status: 'stable' }, pii: { overallScore: 0.9 } }), /forbidden cross-domain aggregate/);
  assert.throws(() => assertNoCrossDomainAggregate({ nested: [{ deep: { f1: 0.5 } }] }), /forbidden cross-domain aggregate/);
  assert.doesNotThrow(() => assertNoCrossDomainAggregate({ credential: { status: 'stable' }, pii: { status: 'provisional' } }));
});

test('assembleReleaseRecord rejects incomplete credential candidate evidence before touching PII', () => {
  const input = {
    benchmarkRevision: '2'.repeat(40), performanceBudget: performanceBudget(), credentialProfile: 'evaluation-v1',
    credentialCandidateEvidence: credentialCandidateEvidence({ completeness: { selectedFixtures: 1, scannedFixtures: 0, writtenFixtures: 1 } }),
    credentialQualification: credentialQualification(), piiQualification: piiQualification(), piiBinding: unsanctionedBinding, registryFamilies,
  };
  assert.throws(() => assembleReleaseRecord(input));
});

test('assembleReleaseRecord rejects a corrupted credential qualification report', () => {
  const input = {
    benchmarkRevision: '2'.repeat(40), performanceBudget: performanceBudget(), credentialProfile: 'evaluation-v1',
    credentialCandidateEvidence: credentialCandidateEvidence(), credentialQualification: credentialQualification({ suiteHash: '0'.repeat(64) }),
    piiQualification: piiQualification(), piiBinding: unsanctionedBinding, registryFamilies,
  };
  assert.throws(() => assembleReleaseRecord(input));
});

test('assembleReleaseRecord rejects an unresolved PII qualification report shape', () => {
  const badQualification = piiQualification(); badQualification.overallScore = 0.5;
  const input = {
    benchmarkRevision: '2'.repeat(40), performanceBudget: performanceBudget(), credentialProfile: 'evaluation-v1',
    credentialCandidateEvidence: credentialCandidateEvidence(), credentialQualification: credentialQualification(),
    piiQualification: badQualification, piiBinding: unsanctionedBinding, registryFamilies,
  };
  assert.throws(() => assembleReleaseRecord(input));
});

test('assembleReleaseRecord delegates PII binding validation rather than trusting an unvalidated shape', () => {
  const input = {
    benchmarkRevision: '2'.repeat(40), performanceBudget: performanceBudget(), credentialProfile: 'evaluation-v1',
    credentialCandidateEvidence: credentialCandidateEvidence(), credentialQualification: credentialQualification(),
    piiQualification: piiQualification(), piiBinding: unsanctionedBinding, registryFamilies,
  };
  // A binding that is not even well-shaped fails inside validatePiiProductBinding, exactly like any other malformed
  // domain artifact -- proving assembleReleaseRecord never skips this delegation.
  assert.throws(() => assembleReleaseRecord(input));
});

test('validateReleaseRecord rejects a record with an unlisted top-level key', () => {
  assert.throws(() => validateReleaseRecord({ schemaVersion: 1, reportType: 'beta10-release-record', supportClaims: false,
    identity: {}, performanceBudget: {}, credential: {}, pii: {}, artifactCommitment: '', overallScore: 1 }, registryFamilies), /Invalid release record shape/);
});

test('validateReleaseRecord rejects a record with an unlisted identity key', () => {
  assert.throws(() => validateReleaseRecord({ schemaVersion: 1, reportType: 'beta10-release-record', supportClaims: false,
    identity: { productSourceCommit: 'a'.repeat(40), extraField: 1 }, performanceBudget: performanceBudget(), credential: {}, pii: {}, artifactCommitment: '' },
    registryFamilies), /Invalid release record identity shape/);
});

test('validateReleaseRecord rejects an unsupported schema version or report type', () => {
  const base = { schemaVersion: 1, reportType: 'beta10-release-record', supportClaims: false,
    identity: { productSourceCommit: 'a'.repeat(40), benchmarkRevision: 'b'.repeat(40), performanceBudgetVersion: 'v', corpusCommitments: { credential: 'c'.repeat(64), pii: 'd'.repeat(64) }, profileVersions: { credential: 'evaluation-v1', pii: 'pii-v1' }, holdoutState: { credential: 'complete', pii: 'complete' } },
    performanceBudget: performanceBudget(), credential: { accountingIdentity: {}, candidateEvidence: {}, qualification: {}, reportCommitment: '' },
    pii: { accountingIdentity: {}, qualification: {}, binding: {}, reportCommitment: '' }, artifactCommitment: '' };
  assert.throws(() => validateReleaseRecord({ ...base, schemaVersion: 2 }, registryFamilies), /Unsupported release record identity/);
  assert.throws(() => validateReleaseRecord({ ...base, reportType: 'something-else' }, registryFamilies), /Unsupported release record identity/);
  assert.throws(() => validateReleaseRecord({ ...base, supportClaims: true }, registryFamilies), /Unsupported release record identity/);
});
