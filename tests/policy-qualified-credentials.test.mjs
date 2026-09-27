import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import profile from '../benchmarks/support/policy-qualified-credentials.json' with { type: 'json' };
import { policyBehaviorAggregate, validatePolicyHoldoutReceipt } from '../benchmarks/support/policy-qualified.ts';
import { validateCredentialPolicyHoldoutReport } from '../benchmarks/evaluation/domains/credential-policy/holdout.ts';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { resolveEvaluationDomain } from '../benchmarks/evaluation/domains/registry.ts';

test('the policy-qualified profile is schema-backed, bounded, T3, and project-policy only', () => {
  const schema = JSON.parse(readFileSync(new URL('../schemas/policy-qualified-credential-v1.json', import.meta.url)));
  assert.equal(new Ajv({ strict: true }).compile(schema)(profile), true);
  assert.equal(profile.evidenceTier, 'T3');
  assert.equal(profile.evidenceBasis, 'project-policy');
  assert.deepEqual(Object.keys(profile.families).sort(), ['bearer-token', 'connection-string', 'generic-token', 'otpauth-uri']);
  for (const contract of Object.values(profile.families)) {
    assert.ok(contract.trigger && contract.candidate && contract.exactSpan);
    assert.ok(contract.exclusions.length && contract.blindSpots.length && contract.projectPolicy.length);
  }
});

const c = (id, expected, actual, extra = {}) => ({
  id, method: 'differential', targets: ['bearer-token'], source: { category: 'policy-public-conformance', fixtureId: id, path: 'fixture.json' },
  seed: { id, path: `${id}.txt`, content: '', expected, group: extra.group ?? id, policyConformance: true,
    ...(expected.length ? { expectedAction: 'redact' } : {}), assessment: { kind: expected.length ? 'policy' : 'must-not-flag', tier: 'T3', reason: 'synthetic', sources: [] }, ...extra },
});
const result = (source, actual) => ({ id: source.id, method: 'differential', scanners: [],
  observations: [{ scanner: 'redact-secret', status: 'complete', variants: [{ id: `${source.id}-v`, actual }] }],
  variants: [], generation: [], queue: [] });

test('public conformance is counted separately and protected holdout not-run remains a typed blocker', () => {
  const positives = Array.from({ length: 6 }, (_, i) => c(`p${i}`, [{ start: 2, end: 8 }], [], { contextAxis: `axis-${i % 4}` }));
  const benign = Array.from({ length: 8 }, (_, i) => c(`b${i}`, [], [], { contextAxis: `benign-${i % 4}` }));
  const twins = Array.from({ length: 5 }, (_, i) => c(`t${i}`, [], [], { twinOf: `p${i}`, mutationKind: 'context' }));
  const cases = [...positives, ...benign, ...twins];
  const results = cases.map(source => result(source, source.seed.expected.length ? [{ start: 2, end: 8, family: 'bearer-token', action: 'redact' }] : []));
  const aggregate = policyBehaviorAggregate('bearer-token', cases, results, 0);
  assert.equal(aggregate.publicConformance, 'pass');
  assert.equal(aggregate.exactSpanMisses, 0);
  assert.deepEqual(aggregate.controlFalseAlarms, { warn: 0, redact: 0, block: 0, allow: 0 });
  assert.deepEqual(aggregate.failedGates.map(g => g.code), ['protected-holdout']);
});

test('an arbitrary self-asserted pass receipt is rejected', () => {
  assert.throws(() => validatePolicyHoldoutReceipt({ schemaVersion: 2, profileId: 'credential-policy-v1', productRevision: 'a'.repeat(40),
    benchmarkRevision: 'b'.repeat(40), report: { status: 'complete', families: {} } }), /Invalid policy-qualified/);
});

test('credential-policy is a separate lifecycle domain and its report schema rejects case data', () => {
  const domain = resolveEvaluationDomain('credential-policy');
  assert.equal(domain.domain, 'credential-policy');
  const publicCorpus = domain.holdout.publicConformanceCorpus('public-policy-test-seed');
  assert.ok(publicCorpus.fixtures.length > 0);
  for (const family of ['bearer-token', 'connection-string', 'generic-token', 'otpauth-uri']) {
    const selected = publicCorpus.fixtures.filter(fixture => fixture.policyFamily === family);
    assert.ok(selected.some(fixture => fixture.expected.length && fixture.expectedAction));
    assert.ok(selected.some(fixture => !fixture.expected.length && fixture.twinOf));
    assert.ok(selected.some(fixture => !fixture.expected.length && !fixture.twinOf));
  }
  const schema = JSON.parse(readFileSync(new URL('../schemas/credential-policy-holdout-report-v1.json', import.meta.url)));
  assert.ok(new Ajv({ strict: true }).compile(schema));
  assert.throws(() => validateCredentialPolicyHoldoutReport({ reportType: 'credential-policy-holdout', content: 'forbidden' }), /Invalid credential-policy/);
});

test('OTP public policy fixtures independently cover four positive and benign axes', () => {
  const corpora = buildCorpora();
  const fixtures = [...corpora['detector-coverage'].fixtures, ...corpora['policy-qualified-credentials'].fixtures]
    .filter(fixture => fixture.detectors?.includes('otpauth-uri'));
  const positives = fixtures.filter(fixture => fixture.expected.length && fixture.assessment.tier === 'T3');
  const benign = fixtures.filter(fixture => !fixture.expected.length && !fixture.twinOf && fixture.assessment.tier !== 'T0');
  assert.ok(new Set(positives.map(fixture => fixture.contextAxis ?? fixture.group)).size >= 4);
  assert.ok(benign.length >= 8);
  assert.ok(new Set(benign.map(fixture => fixture.contextAxis ?? fixture.group)).size >= 4);
  assert.ok(fixtures.filter(fixture => fixture.twinOf).length >= 5);
});
