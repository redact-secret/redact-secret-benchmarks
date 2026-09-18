import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { hash } from '../benchmarks/engine/model.ts';
import { validateEvidence } from '../benchmarks/engine/evidence.ts';

const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url)));
const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
function report() {
  const runId = randomUUID(), time = new Date().toISOString();
  const scanners = Object.entries(suite.scanners).map(([id, version]) => ({ id, version, configuration: {}, configurationHash: hash({}),
    status: 'complete', assertions: { pass: 2, fail: 0, 'review-required': 0 }, byStratum: { 'must-redact:T1': { pass: 2, fail: 0, 'review-required': 0 } } }));
  return {
    schemaVersion: 1, reportType: 'qualification', engineVersion: '1.0.0', suiteId: 'engine-v1', suiteHash: hash(suite), runId,
    startedAt: time, finishedAt: time, scope: 'engine-conformance', status: 'execution-qualified', supportClaims: false,
    provenance: { ...candidate, revision: 'test', dirty: false, runtime: { node: 'test', platform: 'test', arch: 'test' } },
    development: { seed: 'engine-v1', casesHash: 'd'.repeat(64), corpusHashes: { control: 'e'.repeat(64) }, failures: 0, reviewEntries: 0, byDetector: {} },
    methods: suite.methods.map(method => ({ method, cases: 2, variants: 2, generationErrors: 0,
      scanners: scanners.map(({ id, status, assertions }) => ({ id, status, assertions: method === 'differential' ? { pass: 0, fail: 0, 'review-required': 0 } : structuredClone(assertions) })) })),
    holdout: { schemaVersion: 1, reportType: 'holdout', runId, planHash: 'f'.repeat(64), startedAt: time, finishedAt: time,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence: 'public-control', status: 'complete',
      corpus: { id: 'public-controls', revision: 1, purpose: 'public-conformance', corpusHash: 'd'.repeat(64), seedHash: 'e'.repeat(64), lifecycle: 'sealed-at-execution' },
      candidate, caseCount: 2, variantCount: 2, generationErrors: 0, scanners },
    milestone: { checkedAt: time, repository: 'redact-secret/redact-secret-benchmarks', number: 1, status: 'open', openPrerequisites: [8], outOfScope: [] },
  };
}

test('six-method evidence validates without pretending public controls establish independent support', () => {
  const r = report();
  assert.doesNotThrow(() => validateEvidence(r, 'qualification'));
  assert.equal(r.supportClaims, false);
  assert.equal(r.milestone.status, 'open');
});

test('qualification validation rejects incomplete coverage, mixed provenance, disclosure and forged success', () => {
  const corruptions = [
    r => r.methods.pop(),
    r => r.methods[1].method = r.methods[0].method,
    r => r.methods[0].scanners.pop(),
    r => r.methods[0].scanners[0].status = 'unavailable',
    r => r.methods[0].generationErrors++,
    r => r.methods[0].scanners[0].assertions.pass = 0,
    r => r.methods.find(m => m.method === 'differential').scanners[0].assertions.pass++,
    r => r.holdout.runId = randomUUID(),
    r => r.holdout.candidate = { ...r.holdout.candidate, sourceHash: '0'.repeat(64) },
    r => r.methods.find(m => m.method === 'holdout').cases++,
    r => r.holdout.scanners[0].version = '9.9.9',
    r => r.holdout.results = [{ content: 'protected' }],
    r => r.supportClaims = true,
    r => r.milestone.status = 'closed',
    r => r.development.failures++,
    r => r.scope = 'engine-with-protected-holdout',
    r => r.suiteHash = '0'.repeat(64),
  ];
  for (const corrupt of corruptions) {
    const r = report(); corrupt(r);
    assert.throws(() => validateEvidence(r, 'qualification'));
  }
});
