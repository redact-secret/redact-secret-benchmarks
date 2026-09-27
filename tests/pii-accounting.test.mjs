import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import { piiV1Profile, validatePiiQualificationProfile } from '../benchmarks/evaluation/domains/pii/profile.ts';
import { accountPiiRows, assertPiiAccountingIdentities, piiAccountingRowsFromEvaluation, validatePiiAccountingReport } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { qualifyPii, validatePiiQualificationReport } from '../benchmarks/evaluation/domains/pii/qualification.ts';
import { credentialAccountingIdentity } from '../benchmarks/evaluation/domains/credential/accounting.ts';
import { proportion } from '../benchmarks/accounting/shared/primitives.ts';
import { piiContextEvidence } from '../benchmarks/evaluation/domains/pii/context-evidence.ts';

const digest = character => character.repeat(64);
const candidateHash = digest('c');
const authority = [{ sourceKind: 'standard', sourceId: 'benchmark-pii-contract', locator: 'section:accounting-tests', revision: '1',
  supports: ['lexical', 'validation', 'allocation', 'reserved-control', 'sensitivity'] }];
const source = (overrides = {}) => ({ schemaVersion: 1, engineVersion: '1.0.0', domain: 'pii',
  reportProfile: { id: 'pii-evaluation', version: 1 }, evaluationProfile: 'pii-schema-v1', domainAccountingVersion: 'pii-observation-v1',
  runId: '11111111-1111-1111-1111-111111111111', startedAt: '2026-09-26T00:00:00.000Z', finishedAt: '2026-09-26T00:01:00.000Z',
  provenance: { sourceRevision: digest('a'), candidateArtifactHash: candidateHash, planHash: digest('b') },
  scanner: { id: 'pii-scanner', version: '1.0.0', mode: 'candidate', configurationHash: digest('d'), status: 'complete' }, ...overrides });

function row(id, overrides = {}) {
  const base = { source: source(), caseId: id, method: 'type-validation', family: 'pii:global:synthetic-id', scope: 'global', variant: 'authored',
    strategy: 'authored', scanner: 'pii-scanner', qualificationProfile: { id: 'pii-v1', version: 1 }, authority,
    expectation: { type: 'valid', sensitivity: 'sensitive', contextObligation: 'reinforcing', contextClass: 'sensitive', language: 'en', validatorApplicable: true, referenceApplicable: false },
    methodEvidence: { controlClass: null, validatorState: 'valid', collision: null, referenceState: null },
    outcome: { scanner: 'pii-scanner', variant: 'authored', typeIdentity: { axis: 'type-identity', status: 'pass', state: 'correct', reason: 'correct' },
      sensitivityContext: { axis: 'sensitivity-context', status: 'pass', state: 'correct', reason: 'correct' }, range: 'exact',
      observed: { findingCount: 1, families: ['pii:global:synthetic-id'], jurisdictions: [] } } };
  const nextSource = { ...base.source, ...overrides.source, provenance: { ...base.source.provenance, ...overrides.source?.provenance },
    scanner: { ...base.source.scanner, ...overrides.source?.scanner } };
  const scanner = overrides.scanner ?? nextSource.scanner.id;
  return { ...base, ...overrides, source: nextSource, scanner, scope: overrides.scope ?? base.scope, authority: overrides.authority ?? base.authority,
    expectation: { ...base.expectation, ...overrides.expectation }, methodEvidence: { ...base.methodEvidence, ...overrides.methodEvidence },
    outcome: { ...base.outcome, scanner, variant: overrides.variant ?? base.outcome.variant, ...overrides.outcome,
      typeIdentity: { ...base.outcome.typeIdentity, ...overrides.outcome?.typeIdentity }, sensitivityContext: { ...base.outcome.sensitivityContext, ...overrides.outcome?.sensitivityContext },
      observed: { ...base.outcome.observed, ...overrides.outcome?.observed } } };
}
const repeat = (prefix, count, build) => Array.from({ length: count }, (_, index) => build(`${prefix}-${index}`, index));
function contextRows(groupId) {
  const group = piiContextEvidence.groups.find(candidate => candidate.id === groupId);
  return group.frames.map(frame => row(group.id, { method: 'context-discrimination', variant: frame.id, strategy: 'derived',
    family: 'pii:global:email', expectation: { validatorApplicable: false, contextObligation: 'required-for-sensitive-classification',
      contextClass: frame.contextClass, sensitivity: frame.sensitivity, language: group.language }, methodEvidence: { validatorState: null },
    outcome: frame.contextClass === 'neutral' ? { sensitivityContext: { status: 'review-required', state: 'unresolved', reason: 'neutral context unresolved' } } : {} }));
}
function stableRows() {
  const classes = ['reserved', 'documentation', 'test-value', 'public-operational', 'placeholder', 'context-negative'];
  return [
    ...repeat('type-case', 4, id => row(id)),
    ...contextRows('en-email-core'),
    ...contextRows('ko-email-core'),
    ...repeat('benign-case', 6, (id, index) => row(id, { method: 'pii-benign', variant: classes[index], strategy: 'authored',
      expectation: { sensitivity: 'non-sensitive', contextClass: 'non-sensitive', validatorApplicable: false }, methodEvidence: { controlClass: classes[index], validatorState: null } })),
    ...repeat('collision-case', 4, id => row(id, { method: 'jurisdiction-collision', variant: 'collision',
      scope: 'jurisdiction:US', family: 'pii:us:synthetic-id', expectation: { validatorApplicable: false },
      methodEvidence: { validatorState: null, collision: { targetFamily: 'pii:us:synthetic-id', competingFamilies: ['pii:br:synthetic-id'] } },
      outcome: { observed: { families: ['pii:us:synthetic-id'], jurisdictions: ['US'] } } })),
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
  const mixed = row('mixed-axis', { scope: 'jurisdiction:US', family: 'pii:us:synthetic-id', outcome: { typeIdentity: { status: 'fail', state: 'wrong-jurisdiction' },
    sensitivityContext: { status: 'fail', state: 'miss' } } });
  const report = accountPiiRows([mixed]);
  assert.equal(report.metrics['wrong-family-rate'].counts.numerator, 0);
  assert.equal(report.metrics['wrong-jurisdiction-rate'].counts.numerator, 1);
  assert.equal(report.metrics['sensitive-miss-rate'].counts.numerator, 1);
  assert.deepEqual(Object.keys(report.benignByControlClass).sort(), ['context-negative', 'documentation', 'placeholder', 'public-operational', 'reserved', 'test-value']);
  assert.equal(Object.hasOwn(report, 'overallScore'), false);
});

test('unresolved, not-measured, and not-applicable remain explicit', () => {
  const unresolved = row('unresolved-row', { expectation: { sensitivity: 'not-established', validatorApplicable: false }, methodEvidence: { validatorState: null },
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
  assert.equal(qualified.gates.find(item => item.id === 'accounting-source-trust').status, 'unresolved');
  assert.equal(qualified.gates.find(item => item.id === 'measurable-share').status, 'unresolved');
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

test('only measurable-share evaluates a partial denominator and uses its lower bound', () => {
  const unresolvedSensitivity = repeat('partial-share', 4, id => row(id, {
    expectation: { sensitivity: 'not-established', validatorApplicable: false }, methodEvidence: { validatorState: null },
    outcome: { sensitivityContext: { status: 'review-required', state: 'unresolved', reason: 'authored unresolved' } },
  }));
  const belowFloor = qualifyPii(accountPiiRows(unresolvedSensitivity), { protected: null, independent: null });
  const share = belowFloor.accounting.metrics['measurable-share'];
  assert.equal(share.status, 'partial');
  assert.equal(share.effectiveN, 8);
  assert.ok(share.rate.bound < piiV1Profile.metrics['measurable-share'].threshold);
  assert.equal(belowFloor.gates.find(item => item.id === 'measurable-share').status, 'not-met');

  const partlyMeasuredType = repeat('partial-type', 5, (id, index) => row(id, index === 0 ? {
    outcome: { typeIdentity: { status: 'not-measured', state: 'not-measured', reason: 'scanner unavailable' } },
  } : {}));
  const otherPartial = qualifyPii(accountPiiRows(partlyMeasuredType), { protected: null, independent: null });
  assert.equal(otherPartial.accounting.metrics['type-miss-rate'].status, 'partial');
  assert.notEqual(otherPartial.accounting.metrics['type-miss-rate'].rate, 'insufficient-evidence');
  assert.equal(otherPartial.gates.find(item => item.id === 'type-miss-rate').status, 'unresolved');
});

test('opaque commitment substitution and coordinated aggregate forgery remain untrusted', () => {
  const forged = structuredClone(accountPiiRows(stableRows())), metric = forged.metrics['measurable-share'];
  forged.inputCommitment = digest('f');
  metric.counts.numerator--;
  metric.rate = proportion(metric.counts.numerator, metric.effectiveN, metric.direction, piiV1Profile.mechanics);
  validatePiiAccountingReport(forged);
  const qualification = qualifyPii(forged, completeEvidence);
  assert.equal(qualification.accounting.commitmentTrust, 'unresolved');
  assert.equal(qualification.gates.find(item => item.id === 'accounting-source-trust').status, 'unresolved');
  assert.equal(qualification.status, 'provisional');
});

test('duplicate, mixed-run, mixed-profile, and mixed-scanner samples fail closed', () => {
  const original = row('identity-row');
  assert.throws(() => accountPiiRows([original, structuredClone(original)]), /Duplicate/);
  assert.throws(() => accountPiiRows([original, row('other-run', { source: { runId: '99999999-9999-9999-9999-999999999999' } })]), /Mixed/);
  assert.throws(() => accountPiiRows([original, row('other-profile', { source: { evaluationProfile: 'pii-v1' } })]), /Invalid/);
  assert.throws(() => accountPiiRows([original, row('other-scanner', { source: { scanner: { version: '2.0.0' } } })]), /Mixed PII scanner/);
  assert.throws(() => accountPiiRows([original, row('second-scanner', { source: { scanner: { id: 'second-scanner' } } })]), /Mixed PII scanner population/);
});

test('context discrimination counts exact committed frame rosters rather than endpoints', () => {
  const roster = contextRows('en-email-core');
  const report = accountPiiRows(roster);
  assert.equal(report.metrics['context-discrimination-rate'].counts.total, 1);
  assert.equal(report.metrics['context-discrimination-rate'].counts.numerator, 1);
  assert.equal(report.metrics['type-miss-rate'].counts.total, 1);
  assert.equal(report.metrics['measurable-share'].counts.total, 2);
  assert.equal(report.contextByLanguage.en.sensitive.pass, 4);
  assert.equal(report.contextByLanguage.en.neutral['review-required'], 3);
  assert.throws(() => accountPiiRows(roster.slice(0, -1)), /context evidence roster/);
  assert.throws(() => accountPiiRows([...roster, row('en-email-core', { method: 'context-discrimination', variant: 'extra-frame', strategy: 'derived',
    family: 'pii:global:email', expectation: { validatorApplicable: false, contextObligation: 'required-for-sensitive-classification' }, methodEvidence: { validatorState: null } })]), /context evidence roster/);
});

test('context accounting separates language from jurisdiction and reconciles English and Korean strata', () => {
  const english = contextRows('en-email-core');
  const korean = contextRows('ko-email-core');
  const report = accountPiiRows([...english, ...korean]);
  assert.deepEqual(Object.keys(report.contextByLanguage), ['en', 'ko']);
  assert.equal(report.contextByLanguage.ko.sensitive.pass, 7);
  assert.equal(report.contextByLanguage.ko.neutral['review-required'], 3);
  assert.equal(report.contextByLanguage.ko['non-sensitive'].pass, 1);
  assert.equal(Object.hasOwn(report, 'jurisdiction'), false);
  const forged = structuredClone(report); forged.contextByLanguage.ko.sensitive.pass++;
  assert.throws(() => validatePiiAccountingReport(forged), /context language strata/);
  const reassigned = structuredClone(report); reassigned.contextRoster[0].frames[0].status = 'fail';
  assert.throws(() => validatePiiAccountingReport(reassigned), /context language strata/);
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
    async scan(_directory, inputs) { return inputs.flatMap(input => input.id === 'pii-jurisdiction-probe' ? [] :
      [{ path: input.path, start: 8, end: 30, family: 'pii:global:email', sensitive: false }]); } };
  const artifact = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner],
    provenance: { candidateArtifactHash: candidateHash } });
  const rows = piiAccountingRowsFromEvaluation(artifact), accounting = accountPiiRows(rows);
  assert.equal(rows[0].source.runId, artifact.runId);
  assert.equal(rows[0].source.scanner.version, '1.0.0');
  assert.equal(accounting.sources[0].provenance.candidateArtifactHash, candidateHash);
  assert.doesNotMatch(JSON.stringify(accounting), /person@example\.invalid|000-00-0000|"content"|fixtureHash|contentHash/);
  assert.throws(() => piiAccountingRowsFromEvaluation({ ...structuredClone(artifact), evaluationProfile: 'pii-v1' }), /Invalid/);
  const duplicate = structuredClone(artifact); duplicate.results[0].outcomes.push(structuredClone(duplicate.results[0].outcomes[0]));
  assert.throws(() => piiAccountingRowsFromEvaluation(duplicate), /outcome matrix/);
  const omitted = structuredClone(artifact); omitted.results[0].outcomes = [];
  assert.throws(() => piiAccountingRowsFromEvaluation(omitted), /outcome matrix/);
  const second = { ...scanner, id: 'second-accounting-scanner' };
  const multi = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [scanner, second],
    provenance: { candidateArtifactHash: candidateHash } });
  assert.throws(() => piiAccountingRowsFromEvaluation(multi), /explicit scanner selector/);
  assert.equal(piiAccountingRowsFromEvaluation(multi, second.id).length, 2);
});

test('profiles and reports are strict and cross-domain aggregation remains forbidden', () => {
  assert.throws(() => validatePiiQualificationProfile({ ...structuredClone(piiV1Profile), extra: true }), /Invalid PII qualification profile/);
  const withoutTrustGate = structuredClone(piiV1Profile); delete withoutTrustGate.gates.requireTrustedAccountingSource;
  assert.throws(() => validatePiiQualificationProfile(withoutTrustGate), /Invalid PII qualification profile/);
  const accounting = accountPiiRows(stableRows()), qualification = qualifyPii(accounting, completeEvidence);
  assert.doesNotMatch(JSON.stringify(qualification.evidence), /"configuration"/);
  assert.throws(() => validatePiiAccountingReport({ ...structuredClone(accounting), overallScore: 1 }), /schema/);
  assert.throws(() => validatePiiQualificationReport({ ...structuredClone(qualification), overallScore: 1 }), /schema/);
  const forged = structuredClone(qualification); forged.status = 'stable';
  assert.throws(() => validatePiiQualificationReport(forged), /Inconsistent/);
  assert.throws(() => assertPiiAccountingIdentities([accounting, credentialAccountingIdentity('evaluation-v1')]), /Cross-domain/);
  assert.deepEqual(credentialAccountingIdentity('evaluation-v1'), { domain: 'credential', evaluationProfile: 'evaluation-v1', domainAccountingVersion: 'credential-v4' });
});
