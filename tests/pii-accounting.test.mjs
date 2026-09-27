import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiV1Profile, validatePiiQualificationProfile } from '../benchmarks/evaluation/domains/pii/profile.ts';
import { accountPiiRows, assertPiiAccountingIdentities, piiAccountingRowsFromEvaluation, validatePiiAccountingReport } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { qualifyPii, validatePiiQualificationReport } from '../benchmarks/evaluation/domains/pii/qualification.ts';
import { credentialAccountingIdentity } from '../benchmarks/evaluation/domains/credential/accounting.ts';

const digest = character => character.repeat(64);
const candidateHash = digest('c');
const authority = { kind: 'official-test-source', locator: 'benchmark:pii-accounting', version: '1', claim: 'format', observedAt: '2026-09-26' };
const source = (overrides = {}) => ({ schemaVersion: 1, engineVersion: '1.0.0', domain: 'pii',
  reportProfile: { id: 'pii-evaluation', version: 1 }, evaluationProfile: 'pii-schema-v1', domainAccountingVersion: 'pii-observation-v1',
  runId: '11111111-1111-1111-1111-111111111111', startedAt: '2026-09-26T00:00:00.000Z', finishedAt: '2026-09-26T00:01:00.000Z',
  provenance: { sourceRevision: digest('a'), candidateArtifactHash: candidateHash, planHash: digest('b') },
  scanner: { id: 'pii-scanner', version: '1.0.0', mode: 'candidate', configurationHash: digest('d'), status: 'complete' }, ...overrides });

function row(id, overrides = {}) {
  const base = { source: source(), caseId: id, method: 'type-validation', family: 'synthetic-id', scope: { kind: 'global' }, variant: 'authored',
    strategy: 'authored', scanner: 'pii-scanner', qualificationProfile: { id: 'pii-v1', version: 1 }, authority,
    expectation: { type: 'valid', sensitivity: 'sensitive', contextObligation: 'optional', contextClass: 'sensitive', validatorApplicable: true, referenceApplicable: false },
    methodEvidence: { controlClass: null, validatorState: 'valid', collision: null, referenceState: null },
    outcome: { scanner: 'pii-scanner', variant: 'authored', typeIdentity: { axis: 'type-identity', status: 'pass', state: 'correct', reason: 'correct' },
      sensitivityContext: { axis: 'sensitivity-context', status: 'pass', state: 'correct', reason: 'correct' }, range: 'exact',
      observed: { findingCount: 1, families: ['synthetic-id'], jurisdictions: [] } } };
  const nextSource = { ...base.source, ...overrides.source, provenance: { ...base.source.provenance, ...overrides.source?.provenance },
    scanner: { ...base.source.scanner, ...overrides.source?.scanner } };
  const scanner = overrides.scanner ?? nextSource.scanner.id;
  return { ...base, ...overrides, source: nextSource, scanner, scope: { ...base.scope, ...overrides.scope }, authority: { ...base.authority, ...overrides.authority },
    expectation: { ...base.expectation, ...overrides.expectation }, methodEvidence: { ...base.methodEvidence, ...overrides.methodEvidence },
    outcome: { ...base.outcome, scanner, variant: overrides.variant ?? base.outcome.variant, ...overrides.outcome,
      typeIdentity: { ...base.outcome.typeIdentity, ...overrides.outcome?.typeIdentity }, sensitivityContext: { ...base.outcome.sensitivityContext, ...overrides.outcome?.sensitivityContext },
      observed: { ...base.outcome.observed, ...overrides.outcome?.observed } } };
}
const repeat = (prefix, count, build) => Array.from({ length: count }, (_, index) => build(`${prefix}-${index}`, index));
function stableRows() {
  const classes = ['reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'];
  return [
    ...repeat('type-case', 4, id => row(id)),
    ...repeat('context-case', 4, id => [
      row(id, { method: 'context-discrimination', variant: 'sensitive', strategy: 'derived', authority: { claim: 'context' },
        expectation: { validatorApplicable: false, contextObligation: 'required', contextClass: 'sensitive', sensitivity: 'sensitive' }, methodEvidence: { validatorState: null } }),
      row(id, { method: 'context-discrimination', variant: 'neutral', strategy: 'derived', authority: { claim: 'context' },
        expectation: { validatorApplicable: false, contextObligation: 'required', contextClass: 'neutral', sensitivity: 'unresolved' }, methodEvidence: { validatorState: null },
        outcome: { sensitivityContext: { status: 'review-required', state: 'unresolved', reason: 'neutral context unresolved' } } }),
      row(id, { method: 'context-discrimination', variant: 'non-sensitive', strategy: 'derived', authority: { claim: 'context' },
        expectation: { validatorApplicable: false, contextObligation: 'required', contextClass: 'non-sensitive', sensitivity: 'non-sensitive' }, methodEvidence: { validatorState: null } }),
    ]).flat(),
    ...repeat('benign-case', 6, (id, index) => row(id, { method: 'pii-benign', variant: classes[index], strategy: 'authored',
      expectation: { sensitivity: 'non-sensitive', contextClass: 'non-sensitive', validatorApplicable: false }, methodEvidence: { controlClass: classes[index], validatorState: null } })),
    ...repeat('collision-case', 4, id => row(id, { method: 'jurisdiction-collision', variant: 'collision', authority: { claim: 'allocation' },
      scope: { kind: 'jurisdictional', jurisdiction: 'us' }, expectation: { validatorApplicable: false },
      methodEvidence: { validatorState: null, collision: { targetFamily: 'synthetic-id', competingFamilies: ['synthetic-id-alt'] } },
      outcome: { observed: { jurisdictions: ['us'] } } })),
    ...repeat('reference-case', 4, id => row(id, { method: 'reference-differential', variant: 'reference', expectation: { validatorApplicable: false, referenceApplicable: true },
      methodEvidence: { validatorState: null, referenceState: 'valid' } })),
  ];
}

function holdout({ run = '2', corpus = 'e', plan = 'f', purpose = 'protected', independence = 'custodian-declared', candidate = candidateHash, fail = 0 } = {}) {
  const pass = 4 - fail, axes = { typeIdentity: { pass, fail, 'review-required': 0, 'not-measured': 0 }, sensitivityContext: { pass, fail, 'review-required': 0, 'not-measured': 0 } };
  return { schemaVersion: 1, reportType: 'pii-holdout', domain: 'pii', evaluationProfile: 'pii-schema-v1', domainAccountingVersion: 'pii-observation-v1',
    reportProfile: { id: 'pii-holdout', version: 1 }, supportClaims: false, runId: `${run.repeat(8)}-${run.repeat(4)}-${run.repeat(4)}-${run.repeat(4)}-${run.repeat(12)}`,
    planHash: digest(plan), startedAt: '2026-09-26T00:00:00.000Z', finishedAt: '2026-09-26T00:01:00.000Z', status: 'complete',
    methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence,
    corpus: { id: `corpus-${corpus}`, revision: 1, purpose, corpusHash: digest(corpus), seedHash: digest(corpus === 'e' ? '1' : '3'), lifecycle: 'sealed-at-execution' },
    candidate: { sourceHash: digest('4'), lockHash: digest('5'), candidateArtifactHash: candidate }, caseCount: 4, variantCount: 4, generationErrors: 0,
    scanners: [{ id: 'pii-scanner', version: '1.0.0', configurationHash: digest('d'), configuration: { mode: 'candidate' }, status: 'complete', axes, byStratum: { all: axes } }] };
}
const completeEvidence = { protected: holdout(), independent: holdout({ run: '6', corpus: '7', plan: '8' }) };

test('PII accounting keeps axes independent, splits identity failures, and publishes benign class rates', () => {
  const mixed = row('mixed-axis', { scope: { kind: 'jurisdictional', jurisdiction: 'us' }, outcome: { typeIdentity: { status: 'fail', state: 'wrong-jurisdiction' },
    sensitivityContext: { status: 'fail', state: 'miss' } } });
  const report = accountPiiRows([mixed]);
  assert.equal(report.metrics['wrong-family-rate'].counts.numerator, 0);
  assert.equal(report.metrics['wrong-jurisdiction-rate'].counts.numerator, 1);
  assert.equal(report.metrics['sensitive-miss-rate'].counts.numerator, 1);
  assert.deepEqual(Object.keys(report.benignByControlClass).sort(), ['context-negative', 'documentation', 'placeholder', 'public-operational', 'reserved', 'test-value']);
  assert.equal(Object.hasOwn(report, 'overallScore'), false);
});

test('unresolved, not-measured, and not-applicable remain explicit', () => {
  const unresolved = row('unresolved-row', { expectation: { sensitivity: 'unresolved', validatorApplicable: false }, methodEvidence: { validatorState: null },
    outcome: { typeIdentity: { status: 'not-measured', state: 'not-measured', reason: 'scanner unavailable' },
      sensitivityContext: { status: 'review-required', state: 'unresolved', reason: 'authored unresolved' }, range: 'not-applicable', observed: { findingCount: 0, families: [], jurisdictions: [] } } });
  const report = accountPiiRows([unresolved]);
  assert.equal(report.metrics['type-miss-rate'].status, 'not-measured');
  assert.equal(report.metrics['sensitive-miss-rate'].status, 'not-applicable');
  assert.equal(report.metrics['measurable-share'].counts.unresolved, 1);
  assert.equal(report.metrics['measurable-share'].counts.notMeasured, 1);
  assert.equal(report.metrics['measurable-share'].effectiveN, 2);
  assert.equal(report.metrics['measurable-share'].rate, 'insufficient-evidence');
});

test('validated holdout projections remain provisional until a trusted resolver exists', () => {
  const accounting = accountPiiRows(stableRows()), qualified = qualifyPii(accounting, completeEvidence);
  assert.equal(qualified.status, 'provisional');
  assert.equal(qualified.evidence.protected.trust, 'unresolved');
  assert.equal(Object.hasOwn(qualified.evidence.protected, 'scanners'), false);
  assert.equal(qualifyPii(accountPiiRows([]), { protected: null, independent: null }).status, 'not-applicable');
  assert.throws(() => qualifyPii(accounting, { protected: completeEvidence.protected, independent: completeEvidence.protected }), /distinct/);
  assert.throws(() => qualifyPii(accounting, { protected: holdout({ purpose: 'public-conformance' }), independent: completeEvidence.independent }), /purpose and independence/);
  assert.throws(() => qualifyPii(accounting, { protected: completeEvidence.protected, independent: holdout({ run: '6', corpus: '7', plan: '8', candidate: digest('9') }) }), /does not match/);
  assert.throws(() => qualifyPii(accounting, { protected: holdout({ candidate: digest('9') }), independent: null }), /does not match/);
  assert.notEqual(qualifyPii(accounting, { protected: holdout({ fail: 1 }), independent: completeEvidence.independent }).status, 'stable');
  assert.notEqual(qualifyPii(accounting, { protected: null, independent: null }).status, 'stable');
});

test('duplicate, mixed-run, mixed-profile, and mixed-scanner samples fail closed', () => {
  const original = row('identity-row');
  assert.throws(() => accountPiiRows([original, structuredClone(original)]), /Duplicate/);
  assert.throws(() => accountPiiRows([original, row('other-run', { source: { runId: '99999999-9999-9999-9999-999999999999' } })]), /Mixed/);
  assert.throws(() => accountPiiRows([original, row('other-profile', { source: { evaluationProfile: 'pii-v1' } })]), /Invalid/);
  assert.throws(() => accountPiiRows([original, row('other-scanner', { source: { scanner: { version: '2.0.0' } } })]), /Mixed PII scanner/);
  assert.throws(() => accountPiiRows([original, row('second-scanner', { source: { scanner: { id: 'second-scanner' } } })]), /Mixed PII scanner population/);
});

test('context discrimination counts complete correlated trios rather than endpoints', () => {
  const trio = stableRows().filter(item => item.caseId === 'context-case-0');
  const report = accountPiiRows(trio);
  assert.equal(report.metrics['context-discrimination-rate'].counts.total, 1);
  assert.equal(report.metrics['context-discrimination-rate'].counts.numerator, 1);
  assert.equal(report.metrics['type-miss-rate'].counts.total, 1);
  assert.equal(report.metrics['measurable-share'].counts.total, 2);
  assert.throws(() => accountPiiRows(trio.slice(0, 2)), /Incomplete PII context/);
});

test('metric labels and evidence tallies are canonical and recomputed from safe rows', () => {
  const report = accountPiiRows(stableRows());
  const label = structuredClone(report); label.metrics['type-miss-rate'].population = 'SYNTHETIC-PERSON-ID-SECRET';
  assert.throws(() => validatePiiAccountingReport(label), /Inconsistent/);
  const evidence = structuredClone(report); evidence.evidence.semanticControls++;
  assert.throws(() => validatePiiAccountingReport(evidence), /Inconsistent/);
  const noSource = structuredClone(report); noSource.sources = [];
  assert.throws(() => validatePiiAccountingReport(noSource), /Inconsistent/);
  const trustedCommitment = structuredClone(report); trustedCommitment.commitmentTrust = 'trusted';
  assert.throws(() => validatePiiAccountingReport(trustedCommitment), /schema|Inconsistent/);
  const badBenign = structuredClone(report); badBenign.benignByControlClass.reserved.direction = 'upper';
  assert.throws(() => validatePiiAccountingReport(badBenign), /Inconsistent/);
  assert.equal(report.commitmentTrust, 'unresolved');
  assert.doesNotMatch(JSON.stringify(report.metrics), /SYNTHETIC-PERSON-ID/);
  assert.equal(Object.hasOwn(report, 'rows'), false);
  assert.doesNotMatch(JSON.stringify(report), /type-case-0|benchmark:pii-accounting|4111-1111-1111-1111/);
  const rawReason = accountPiiRows([row('raw-reason', { outcome: { typeIdentity: { reason: '4111-1111-1111-1111' } } })]);
  assert.doesNotMatch(JSON.stringify(rawReason), /4111-1111-1111-1111/);
  assert.throws(() => accountPiiRows([row('raw-mode', { source: { scanner: { mode: '4111-1111-1111-1111' } } })]), /Invalid/);
  assert.throws(() => accountPiiRows([row('raw-version', { source: { scanner: { version: 'secret@example.com' } } })]), /Invalid/);
});

test('actual PII execution artifacts preserve their source envelope without raw values', async () => {
  const scanner = { id: 'pii-accounting-scanner', mode: 'candidate', capabilities: { ranges: true, classification: true }, async version() { return '1.0.0'; },
    async scan(_directory, inputs) { return inputs.map(input => ({ path: input.path, start: 11, end: 34, family: 'synthetic-person-id', sensitive: true })); } };
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
    provenance: { candidateArtifactHash: candidateHash } });
  const rows = piiAccountingRowsFromEvaluation(artifact), accounting = accountPiiRows(rows);
  assert.equal(rows[0].source.runId, artifact.runId);
  assert.equal(rows[0].source.scanner.version, '1.0.0');
  assert.equal(accounting.sources[0].provenance.candidateArtifactHash, candidateHash);
  assert.doesNotMatch(JSON.stringify(accounting), /SYNTHETIC-PERSON-ID|"content"|fixtureHash|contentHash/);
  assert.throws(() => piiAccountingRowsFromEvaluation({ ...structuredClone(artifact), evaluationProfile: 'pii-v1' }), /Invalid/);
  const duplicate = structuredClone(artifact); duplicate.results[0].outcomes.push(structuredClone(duplicate.results[0].outcomes[0]));
  assert.throws(() => piiAccountingRowsFromEvaluation(duplicate), /outcome matrix/);
  const omitted = structuredClone(artifact); omitted.results[0].outcomes = [];
  assert.throws(() => piiAccountingRowsFromEvaluation(omitted), /outcome matrix/);
  const second = { ...scanner, id: 'second-accounting-scanner' };
  const multi = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner, second],
    provenance: { candidateArtifactHash: candidateHash } });
  assert.throws(() => piiAccountingRowsFromEvaluation(multi), /explicit scanner selector/);
  assert.equal(piiAccountingRowsFromEvaluation(multi, second.id).length, 1);
});

test('profiles and reports are strict and cross-domain aggregation remains forbidden', () => {
  assert.throws(() => validatePiiQualificationProfile({ ...structuredClone(piiV1Profile), extra: true }), /Invalid PII qualification profile/);
  const accounting = accountPiiRows(stableRows()), qualification = qualifyPii(accounting, completeEvidence);
  assert.doesNotMatch(JSON.stringify(qualification.evidence), /"configuration"/);
  assert.throws(() => validatePiiAccountingReport({ ...structuredClone(accounting), overallScore: 1 }), /schema/);
  assert.throws(() => validatePiiQualificationReport({ ...structuredClone(qualification), overallScore: 1 }), /schema/);
  const forged = structuredClone(qualification); forged.status = 'stable';
  assert.throws(() => validatePiiQualificationReport(forged), /Inconsistent/);
  assert.throws(() => assertPiiAccountingIdentities([accounting, credentialAccountingIdentity('evaluation-v1')]), /Cross-domain/);
  assert.deepEqual(credentialAccountingIdentity('evaluation-v1'), { domain: 'credential', evaluationProfile: 'evaluation-v1', domainAccountingVersion: 'credential-v4' });
});
