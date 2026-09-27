import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiV1Profile, validatePiiQualificationProfile } from '../benchmarks/evaluation/domains/pii/profile.ts';
import { accountPiiRows, assertPiiAccountingIdentities, piiAccountingRowsFromEvaluation, validatePiiAccountingReport } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { qualifyPii, validatePiiQualificationReport } from '../benchmarks/evaluation/domains/pii/qualification.ts';
import { credentialAccountingIdentity } from '../benchmarks/evaluation/domains/credential/accounting.ts';

const authority = { kind: 'official-test-source', locator: 'benchmark:pii-accounting', version: '1', claim: 'test-vector', observedAt: '2026-09-26' };
function row(id, overrides = {}) {
  const base = {
    caseId: id, method: 'type-validation', family: 'synthetic-id', scope: { kind: 'global' }, variant: 'authored', scanner: 'pii-scanner',
    qualificationProfile: { id: 'pii-v1', version: 1 }, authority,
    expectation: { type: 'valid', sensitivity: 'sensitive', contextObligation: 'optional', contextClass: 'sensitive',
      validatorApplicable: true, referenceApplicable: false },
    methodEvidence: { controlClass: null, validatorState: 'valid', collisionEvaluated: false, referenceState: null },
    outcome: { scanner: 'pii-scanner', variant: 'authored',
      typeIdentity: { axis: 'type-identity', status: 'pass', state: 'correct', reason: 'correct' },
      sensitivityContext: { axis: 'sensitivity-context', status: 'pass', state: 'correct', reason: 'correct' },
      range: 'exact', observed: { findingCount: 1, families: ['synthetic-id'], jurisdictions: [] } },
  };
  return { ...base, ...overrides, scope: { ...base.scope, ...overrides.scope }, authority: { ...base.authority, ...overrides.authority },
    expectation: { ...base.expectation, ...overrides.expectation }, methodEvidence: { ...base.methodEvidence, ...overrides.methodEvidence },
    outcome: { ...base.outcome, variant: overrides.variant ?? base.outcome.variant, ...overrides.outcome,
      typeIdentity: { ...base.outcome.typeIdentity, ...overrides.outcome?.typeIdentity },
      sensitivityContext: { ...base.outcome.sensitivityContext, ...overrides.outcome?.sensitivityContext },
      observed: { ...base.outcome.observed, ...overrides.outcome?.observed } } };
}

const repeat = (prefix, count, build) => Array.from({ length: count }, (_, index) => build(`${prefix}-${index}`, index));
function stableRows() {
  const axes = ['reserved', 'documentation', 'test-value'];
  return [
    ...repeat('type-case', 4, id => row(id)),
    ...repeat('context-sensitive', 4, id => row(id, { method: 'context-discrimination', variant: 'sensitive',
      expectation: { validatorApplicable: false, contextObligation: 'required' }, methodEvidence: { validatorState: null } })),
    ...repeat('context-public', 4, id => row(id, { method: 'context-discrimination', variant: 'non-sensitive',
      expectation: { sensitivity: 'non-sensitive', contextClass: 'non-sensitive', validatorApplicable: false, contextObligation: 'required' },
      methodEvidence: { validatorState: null } })),
    ...repeat('benign-case', 6, (id, index) => row(id, { method: 'pii-benign', variant: axes[index % axes.length],
      expectation: { sensitivity: 'non-sensitive', contextClass: 'non-sensitive', validatorApplicable: false },
      methodEvidence: { controlClass: axes[index % axes.length], validatorState: null } })),
    ...repeat('collision-case', 4, id => row(id, { method: 'jurisdiction-collision', variant: 'collision',
      scope: { kind: 'jurisdictional', jurisdiction: 'us' }, expectation: { validatorApplicable: false },
      methodEvidence: { validatorState: null, collisionEvaluated: true },
      outcome: { observed: { jurisdictions: ['us'] } } })),
    ...repeat('reference-case', 4, id => row(id, { method: 'reference-differential', variant: 'reference',
      expectation: { validatorApplicable: false, referenceApplicable: true }, methodEvidence: { validatorState: null, referenceState: 'valid' } })),
  ];
}

const completeEvidence = { protected: { status: 'complete', artifactHash: 'a'.repeat(64) },
  independent: { status: 'complete', artifactHash: 'b'.repeat(64) } };

test('PII accounting keeps type and sensitivity populations independent and names every denominator', () => {
  const mixed = row('mixed-axis', { outcome: { sensitivityContext: { status: 'fail', state: 'miss', reason: 'miss' } } });
  const report = accountPiiRows([mixed]);
  assert.equal(report.metrics['type-miss-rate'].counts.numerator, 0);
  assert.equal(report.metrics['sensitive-miss-rate'].counts.numerator, 1);
  assert.equal(report.metrics['measurable-share'].counts.numerator, 2);
  for (const metric of Object.values(report.metrics)) {
    assert.ok(metric.population);
    assert.ok(metric.numerator);
    assert.ok(metric.denominator);
    assert.equal(metric.counts.eligible + metric.counts.notApplicable, metric.counts.total);
  }
  assert.equal(Object.hasOwn(report, 'overallScore'), false);
});

test('unresolved, not-measured, and not-applicable stay explicit', () => {
  const unresolved = row('unresolved-row', { expectation: { sensitivity: 'unresolved', validatorApplicable: false }, methodEvidence: { validatorState: null },
    outcome: { typeIdentity: { status: 'not-measured', state: 'not-measured', reason: 'scanner unavailable' },
      sensitivityContext: { status: 'review-required', state: 'unresolved', reason: 'authored unresolved' }, range: 'not-applicable',
      observed: { findingCount: 0, families: [], jurisdictions: [] } } });
  const report = accountPiiRows([unresolved]);
  assert.equal(report.metrics['type-miss-rate'].status, 'not-measured');
  assert.equal(report.metrics['sensitive-miss-rate'].status, 'not-applicable');
  assert.equal(report.metrics['measurable-share'].status, 'unresolved');
  assert.equal(report.metrics['measurable-share'].counts.unresolved, 1);
  assert.equal(report.metrics['measurable-share'].counts.notMeasured, 1);
});

test('pii-v1 alone can emit stable, while empty and schema-only evidence cannot', () => {
  const accounting = accountPiiRows(stableRows());
  const qualified = qualifyPii(accounting, completeEvidence);
  assert.equal(qualified.status, 'stable');
  assert.ok(qualified.gates.every(gate => gate.status === 'met' || gate.status === 'not-applicable'));
  assert.equal(Object.hasOwn(qualified, 'overallScore'), false);

  const empty = qualifyPii(accountPiiRows([]), completeEvidence);
  assert.equal(empty.status, 'not-applicable');
  const schemaOnly = accountPiiRows([row('schema-only-row', { method: 'schema-only', expectation: { sensitivity: 'unresolved', validatorApplicable: false },
    methodEvidence: { validatorState: null }, outcome: { sensitivityContext: { status: 'review-required', state: 'unresolved' } } })]);
  assert.equal(qualifyPii(schemaOnly, completeEvidence).status, 'provisional');
  assert.notEqual(qualifyPii(accounting, { ...completeEvidence, protected: { status: 'not-measured', artifactHash: null } }).status, 'stable');
});

test('conditional validator, jurisdiction, and reference gates are explicit rather than vacuous', () => {
  const accounting = accountPiiRows(stableRows());
  const report = qualifyPii(accounting, completeEvidence);
  assert.equal(report.gates.find(gate => gate.id === 'validator-qualification').status, 'met');
  assert.equal(report.gates.find(gate => gate.id === 'jurisdiction-collisions').status, 'met');
  assert.equal(report.gates.find(gate => gate.id === 'reference-differential').status, 'met');
  const noConditional = accountPiiRows(stableRows().filter(item => !['jurisdiction-collision', 'reference-differential'].includes(item.method))
    .map(item => ({ ...item, expectation: { ...item.expectation, referenceApplicable: false }, scope: { kind: 'global' } })));
  const conditional = qualifyPii(noConditional, completeEvidence);
  assert.equal(conditional.gates.find(gate => gate.id === 'jurisdiction-collisions').status, 'not-applicable');
  assert.equal(conditional.gates.find(gate => gate.id === 'reference-differential').status, 'not-applicable');
});

test('actual PII execution artifacts adapt downstream without raw values', async () => {
  const scanner = { id: 'pii-accounting-scanner', mode: 'candidate', capabilities: { ranges: true, classification: true },
    async version() { return '1.0.0'; }, async scan(_directory, inputs) { return inputs.map(input => ({ path: input.path, start: 11, end: 34,
      family: 'synthetic-person-id', sensitive: true })); } };
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner] });
  const rows = piiAccountingRowsFromEvaluation(artifact), accounting = accountPiiRows(rows);
  assert.equal(rows.length, 1);
  assert.equal(accounting.rowCount, 1);
  assert.equal(rows[0].expectation.sensitivity, 'unresolved');
  assert.doesNotMatch(JSON.stringify(accounting), /SYNTHETIC-PERSON-ID|"content"|fixtureHash|contentHash/);
});

test('profiles and reports are strict, reject overall scores, and forbid cross-domain aggregation', () => {
  assert.throws(() => validatePiiQualificationProfile({ ...structuredClone(piiV1Profile), extra: true }), /Invalid PII qualification profile/);
  const renamedThreshold = structuredClone(piiV1Profile);
  renamedThreshold.metrics['type-miss-rate'].threshold = 0.9;
  assert.throws(() => validatePiiQualificationProfile(renamedThreshold), /Invalid PII qualification profile/);
  const accounting = accountPiiRows(stableRows()), qualification = qualifyPii(accounting, completeEvidence);
  assert.throws(() => validatePiiAccountingReport({ ...structuredClone(accounting), overallScore: 1 }), /schema/);
  assert.throws(() => validatePiiQualificationReport({ ...structuredClone(qualification), overallScore: 1 }), /schema/);
  const forgedAccounting = structuredClone(accounting);
  forgedAccounting.metrics['type-miss-rate'].counts.numerator++;
  assert.throws(() => validatePiiAccountingReport(forgedAccounting), /Inconsistent/);
  const forgedQualification = structuredClone(qualification);
  forgedQualification.gates.find(gate => gate.id === 'type-miss-rate').status = 'not-met';
  assert.throws(() => validatePiiQualificationReport(forgedQualification), /Inconsistent/);
  assert.throws(() => accountPiiRows([row('contradictory-row', { outcome: { typeIdentity: { status: 'pass', state: 'miss' } } })]),
    /contradicts/);
  assert.throws(() => assertPiiAccountingIdentities([accounting, credentialAccountingIdentity('evaluation-v1')]), /Cross-domain/);
  assert.deepEqual(credentialAccountingIdentity('evaluation-v1'),
    { domain: 'credential', evaluationProfile: 'evaluation-v1', domainAccountingVersion: 'credential-v4' });
});
