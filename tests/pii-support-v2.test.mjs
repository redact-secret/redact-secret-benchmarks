import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, piiSupportRegistryCommitment,
  validatePiiSupportMatrixV2, validatePiiSupportRegistry, piiSupportRegistry,
} from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiBindingArtifactCommitment } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import { buildPiiPopulationReport, piiPopulationContract } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { buildEvaluationDomainsV2, domainDescriptorV2, evaluationDomainsV2Problem } from '../benchmarks/shared/evaluation-domains-v2.ts';
const credentialReference = { bundleId: 'a'.repeat(32), manifestSha256: 'b'.repeat(64) };
import { piiSupportMatrixProblem } from '../benchmarks/shared/pii-support-model.ts';
import { publishArtifactAndIndex } from '../scripts/atomic-publication.ts';
import { piiSupportRegistryProjection, piiSupportSemanticProblem } from '../benchmarks/evaluation/domains/pii/support-semantics.ts';

const execute = promisify(execFile);

const authority = [{ sourceKind: 'standard', sourceId: 'ietf-rfc-5322', locator: 'https://www.rfc-editor.org/rfc/rfc5322', revision: 'RFC5322', supports: ['lexical', 'validation'] }];
const registry = () => {
  const value = { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, contentCommitment: '',
    source: { repository: 'redact-secret/redact-secret', decision: 'decision-define-pii-v1-qualification-and-national-id-arrival-gates', mergeCommit: 'eb22bdf587e0079e101fc3ab5aeefada58ba438d' },
    families: [
      { family: 'pii:ca:sin', displayName: 'Canadian SIN', identityDomain: 'national-id', familyContractVersion: 1, scope: 'jurisdiction:CA', jurisdiction: 'CA', qualificationProfile: { id: 'pii-v1', version: 1 }, authority, contextObligation: 'required-for-sensitive-classification', validatorApplicable: true },
      { family: 'pii:global:email', displayName: 'Email address', identityDomain: 'email', familyContractVersion: 1, scope: 'global', jurisdiction: null, qualificationProfile: { id: 'pii-v1', version: 1 }, authority, contextObligation: 'reinforcing', validatorApplicable: false },
    ] };
  value.contentCommitment = piiSupportRegistryCommitment(value);
  return value;
};

test('absent product artifact publishes only explicit pending/not-measured family rows', () => {
  const matrix = buildPiiSupportMatrixV2({ registry: registry() });
  assert.deepEqual(matrix.families.map(row => [row.family, row.scope, row.status.state]), [
    ['pii:ca:sin', 'jurisdiction:CA', 'pending'], ['pii:global:email', 'global', 'pending'],
  ]);
  assert.equal(matrix.activationContract.productArtifact, 'not-measured');
  assert.deepEqual(matrix.distribution, { pending: 2, provisional: 0, stable: 0, unsupported: 0 });
  assert.ok(matrix.families.every(row => row.status.reasonCodes.includes('product-activation-not-measured') && row.activation.productArtifactCommitment === null));
  assert.equal(validatePiiSupportMatrixV2(matrix).artifactCommitment, matrix.artifactCommitment);
});

test('unbound support projects zero strata while explicitly bound canonical reports retain their authored strata', () => {
  const unbound = buildPiiSupportMatrixV2(), populations = ['diagnostic-balanced', 'benign-heavy-stress'].map(id => ({
    report: buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, [], id), rows: [],
  }));
  const bound = buildPiiSupportMatrixV2({ populations });
  const summaries = matrix => matrix.families.find(row => row.family === 'pii:us:ssn').populationEvidence;
  assert.ok(summaries(unbound).every(row => row.status === 'not-measured' && row.strata === 0));
  assert.ok(summaries(bound).every(row => row.status === 'not-measured' && row.strata > 0));
});

test('trusted product binding is artifact-derived and still fails closed without population and qualification gates', async () => {
  const value = piiSupportRegistry;
  const [candidateEvidence, activationArtifact, qualificationArtifact] = await Promise.all([
    readFile('evidence/875/candidate-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/875/pii-activation-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/875/pii-family-qualification-v1.json', 'utf8').then(JSON.parse),
  ]);
  const product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
  const matrix = buildPiiSupportMatrixV2({ registry: value, product });
  assert.equal(matrix.activationContract.productArtifact, 'trusted');
  assert.deepEqual(matrix.families.map(row => [row.family, row.activation.state, row.status.state]), [
    ['pii:global:email', 'unavailable', 'pending'], ['pii:global:iban', 'unavailable', 'pending'],
    ['pii:global:network-address', 'available', 'pending'], ['pii:global:payment-card', 'unavailable', 'pending'],
    ['pii:global:phone', 'unavailable', 'pending'],
    ['pii:us:ssn', 'unavailable', 'pending'],
  ]);
  assert.equal(matrix.activationContract.productSourceCommit, '941053baecdc4b99f98e085429ac26bf24fe0bee');
  assert.equal(matrix.activationContract.productArtifactCommitment, 'ff0e6f93a70158f34f9654eae22f12986da52454615230680073aa7d27c0d1b1');
  assert.deepEqual(activationArtifact.selectorChecks.map(check => check.selectors), [
    ['pii:global'], ['pii:family:global:network-address'],
  ]);
  assert.ok(activationArtifact.surfaces.every(surface =>
    JSON.stringify(surface.activationChecks) === JSON.stringify(activationArtifact.selectorChecks)));
  assert.deepEqual(activationArtifact.offSurfaces, [
    { id: 'node-addon', status: 'pass' }, { id: 'node-wasm', status: 'pass' },
  ]);
  const network = matrix.families.find(row => row.family === 'pii:global:network-address');
  assert.ok(network.status.reasonCodes.includes('protected-partition'));
  assert.ok(network.status.reasonCodes.includes('diagnostic-population-not-measured'));
  assert.equal(validatePiiSupportMatrixV2(matrix, { registry: value, product }).artifactCommitment, matrix.artifactCommitment);
  assert.equal(validatePiiSupportMatrixV2(matrix).artifactCommitment, matrix.artifactCommitment);

  for (const mutation of [
    candidate => { candidate.activationArtifact.availableFamilies.push('pii:global:unknown'); },
    candidate => { candidate.candidateEvidence.candidate.sourceState = 'dirty'; },
    candidate => { candidate.activationArtifact.product.sourceCommit = '9'.repeat(40); candidate.activationArtifact.artifactCommitment = piiBindingArtifactCommitment(candidate.activationArtifact); },
    candidate => { candidate.qualificationArtifacts[0].status = 'qualified'; candidate.qualificationArtifacts[0].artifactCommitment = piiBindingArtifactCommitment(candidate.qualificationArtifacts[0]); },
  ]) {
    const invalid = structuredClone(product); mutation(invalid);
    assert.throws(() => buildPiiSupportMatrixV2({ registry: value, product: invalid }), /trusted PII|activation evidence|qualification evidence/);
  }
});

test('email binding keeps installed offsets and exact-source conformance separately committed', async () => {
  const [candidateEvidence, activationArtifact, qualificationArtifact] = await Promise.all([
    readFile('evidence/876/candidate-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/876/pii-activation-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/876/pii-family-qualification-v1.json', 'utf8').then(JSON.parse),
  ]);
  const product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
  const matrix = buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product });
  assert.equal(matrix.activationContract.productSourceCommit, 'b73daade943f9dea5f86d90a91aa0332083f728a');
  assert.deepEqual(matrix.families.map(row => [row.family, row.activation.state, row.status.state]), [
    ['pii:global:email', 'available', 'pending'], ['pii:global:iban', 'unavailable', 'pending'],
    ['pii:global:network-address', 'available', 'pending'], ['pii:global:payment-card', 'unavailable', 'pending'],
    ['pii:global:phone', 'unavailable', 'pending'],
    ['pii:us:ssn', 'unavailable', 'pending'],
  ]);
  assert.deepEqual(qualificationArtifact.sourceConformance.lanes.map(row => row.id), [
    'rust-native-email-conformance', 'python-email-conformance', 'cli-email-conformance',
  ]);
  const unicode = qualificationArtifact.installedArtifactConformance.lanes[0].observations
    .find(row => row.id === 'smtputf8-local-sensitive-context');
  assert.deepEqual(unicode.nativeRange, { start: 5, end: 29 });
  assert.deepEqual(unicode.canonicalRange, { start: 11, end: 39 });
  assert.equal(qualificationArtifact.sourceConformance.sourceState, 'clean');
  assert.ok(matrix.families[0].status.reasonCodes.includes('identity-only-classification'));
  assert.equal(validatePiiSupportMatrixV2(matrix, { registry: piiSupportRegistry, product }).artifactCommitment, matrix.artifactCommitment);

  for (const mutation of [
    candidate => { candidate.qualificationArtifacts[0].sourceConformance.sourceState = 'dirty'; },
    candidate => { candidate.qualificationArtifacts[0].sourceConformance.lanes[0].id = 'plan-authored-command'; },
    candidate => { candidate.qualificationArtifacts[0].installedArtifactConformance.lanes[0].observations[1].canonicalRange.start = 5; },
  ]) {
    const invalid = structuredClone(product); mutation(invalid);
    invalid.qualificationArtifacts[0].sourceConformance.artifactCommitment =
      piiBindingArtifactCommitment(invalid.qualificationArtifacts[0].sourceConformance);
    invalid.qualificationArtifacts[0].installedArtifactConformance.artifactCommitment =
      piiBindingArtifactCommitment(invalid.qualificationArtifacts[0].installedArtifactConformance);
    invalid.qualificationArtifacts[0].artifactCommitment = piiBindingArtifactCommitment(invalid.qualificationArtifacts[0]);
    assert.throws(() => buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product: invalid }), /trusted PII|qualification evidence|product binding/);
  }
});

test('IBAN binding pins authority and validator provenance while unresolved evidence stays pending', async () => {
  const [candidateEvidence, activationArtifact, qualificationArtifact, plan] = await Promise.all([
    readFile('evidence/878/candidate-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/878/pii-activation-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/878/pii-family-qualification-v1.json', 'utf8').then(JSON.parse),
    readFile('benchmarks/evaluation/domains/pii/iban-qualification-v1.json', 'utf8').then(JSON.parse),
  ]);
  const product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
  const matrix = buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product });
  const iban = matrix.families.find(row => row.family === 'pii:global:iban');
  assert.equal(plan.familyContractVersion, 1);
  assert.deepEqual(plan.authorityBinding, {
    countryRegistry: { sourceKind: 'registration-authority', sourceId: 'swift-iso-13616-iban-registry',
      locator: 'https://www.swift.com/swift-resource/9606/download', revision: 'Release 103 (2026-09-17)', derivedCountryLengthRows: 89 },
    validator: { id: 'iban-mod97', version: 1, normativeSource: 'ISO 13616-1:2020', maxCandidateBytes: 34 },
  });
  assert.equal(iban.familyContractVersion, 1);
  assert.equal(iban.validatorApplicable, true);
  assert.ok(iban.authority.some(row => row.sourceId === 'swift-iban-registry' && row.revision === 'Release-103-2026-09-17'));
  assert.deepEqual(activationArtifact.availableFamilies,
    ['pii:global:email', 'pii:global:iban', 'pii:global:network-address']);
  assert.deepEqual(qualificationArtifact.sourceConformance.lanes.map(row => row.id),
    ['rust-native-iban-conformance', 'python-iban-conformance', 'cli-iban-conformance']);
  assert.equal(qualificationArtifact.status, 'not-qualified');
  assert.equal(iban.status.state, 'pending');
  for (const reason of ['identity-only-classification', 'diagnostic-population-not-measured',
    'benign-heavy-stress-not-measured', 'population-comparison-not-qualified', 'protected-partition'])
    assert.ok(iban.status.reasonCodes.includes(reason));
  assert.ok(iban.populationEvidence.every(row => row.status === 'not-measured' && row.strata === 0));
  assert.equal(validatePiiSupportMatrixV2(matrix, { registry: piiSupportRegistry, product }).artifactCommitment, matrix.artifactCommitment);

  const hostile = structuredClone(product);
  hostile.qualificationArtifacts[0].sourceConformance.lanes[0].fixture = 'conformance/fixtures/pii-email-v1.json';
  hostile.qualificationArtifacts[0].sourceConformance.artifactCommitment =
    piiBindingArtifactCommitment(hostile.qualificationArtifacts[0].sourceConformance);
  hostile.qualificationArtifacts[0].artifactCommitment = piiBindingArtifactCommitment(hostile.qualificationArtifacts[0]);
  assert.throws(() => buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product: hostile }), /trusted PII qualification evidence/);
});

test('payment-card binding separates Luhn controls from semantic collisions and stays pending without populations', async () => {
  const [candidateEvidence, activationArtifact, qualificationArtifact, plan] = await Promise.all([
    readFile('evidence/877/candidate-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/877/pii-activation-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/877/pii-family-qualification-v1.json', 'utf8').then(JSON.parse),
    readFile('benchmarks/evaluation/domains/pii/payment-card-qualification-v1.json', 'utf8').then(JSON.parse),
  ]);
  const product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
  const matrix = buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product });
  const paymentCard = matrix.families.find(row => row.family === 'pii:global:payment-card');
  assert.equal(plan.familyContractVersion, 1);
  assert.deepEqual(plan.authorityBinding.validator,
    { id: 'luhn', version: 1, normativeSource: 'PCI-SSC-FAQ-1137', maxCandidateBytes: 19 });
  assert.ok(paymentCard.authority.some(row => row.sourceId === 'iso-iec-7812-1'));
  assert.ok(paymentCard.authority.some(row => row.sourceId === 'visa-acceptance-card-type-identification'));
  const classes = new Map(qualificationArtifact.classAccounting.map(row => [row.id, row]));
  assert.equal(classes.get('validator-checksum-invalid').status, 'measured');
  for (const id of ['luhn-valid-order-reference-collision', 'luhn-valid-account-collision', 'luhn-valid-phone-collision',
    'luhn-valid-random-collision', 'luhn-valid-cooking-pan-collision'])
    assert.equal(classes.get(id).status, 'measured');
  assert.deepEqual(activationArtifact.availableFamilies,
    ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card']);
  assert.deepEqual(qualificationArtifact.sourceConformance.lanes.map(row => row.id),
    ['rust-native-payment-card-conformance', 'python-payment-card-conformance', 'cli-payment-card-conformance']);
  const astral = qualificationArtifact.installedArtifactConformance.lanes[0].observations
    .find(row => row.id === 'astral-prefix-sensitive-context');
  assert.deepEqual(astral.nativeRange, { start: 15, end: 31 });
  assert.deepEqual(astral.canonicalRange, { start: 17, end: 33 });
  assert.equal(qualificationArtifact.status, 'not-qualified');
  assert.equal(paymentCard.status.state, 'pending');
  for (const reason of ['identity-only-classification', 'diagnostic-population-not-measured',
    'benign-heavy-stress-not-measured', 'population-comparison-not-qualified', 'protected-partition'])
    assert.ok(paymentCard.status.reasonCodes.includes(reason));
  assert.ok(paymentCard.populationEvidence.every(row => row.status === 'not-measured' && row.strata === 0));
  assert.equal(validatePiiSupportMatrixV2(matrix, { registry: piiSupportRegistry, product }).artifactCommitment, matrix.artifactCommitment);

  const hostile = structuredClone(product);
  hostile.qualificationArtifacts[0].sourceConformance.lanes[0].fixture = 'conformance/fixtures/pii-iban-v1.json';
  hostile.qualificationArtifacts[0].sourceConformance.artifactCommitment =
    piiBindingArtifactCommitment(hostile.qualificationArtifacts[0].sourceConformance);
  hostile.qualificationArtifacts[0].artifactCommitment = piiBindingArtifactCommitment(hostile.qualificationArtifacts[0]);
  assert.throws(() => buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product: hostile }), /trusted PII qualification evidence/);
});

test('phone binding preserves narrow authority, context, and extension axes while staying pending', async () => {
  const [candidateEvidence, activationArtifact, qualificationArtifact, plan] = await Promise.all([
    readFile('evidence/880/candidate-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/880/pii-activation-evidence-v1.json', 'utf8').then(JSON.parse),
    readFile('evidence/880/pii-family-qualification-v1.json', 'utf8').then(JSON.parse),
    readFile('benchmarks/evaluation/domains/pii/phone-qualification-v1.json', 'utf8').then(JSON.parse),
  ]);
  const product = { candidateEvidence, activationArtifact, qualificationArtifacts: [qualificationArtifact] };
  const matrix = buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product });
  const phone = matrix.families.find(row => row.family === 'pii:global:phone');
  assert.equal(plan.familyContractVersion, 1);
  assert.equal(plan.authorityBinding.reservedControl.wholeCandidateRule,
    'normalized-exchange-and-line-only-555-0100-through-555-0199-extension-ignored');
  assert.ok(phone.authority.some(row => row.sourceId === 'itu-t-e164'));
  assert.ok(phone.authority.some(row => row.sourceId === 'nanpa-about'));
  assert.ok(phone.authority.some(row => row.sourceId === 'nanpa-co-codes-thousands-blocks'));
  assert.ok(phone.authority.some(row => row.sourceId === 'nanpa-555-line-numbers'));
  const classes = new Map(qualificationArtifact.classAccounting.map(row => [row.id, row]));
  for (const id of ['syntactically-valid-sensitive', 'korean-sensitive-context', 'supported-extension',
    'bare-identity-public-absence', 'authoritative-555-control', 'n11-exclusion', 'accepted-988',
    'extension-malformed', 'ordinary-prose-suffix', 'shared-context-association'])
    assert.equal(classes.get(id).status, 'measured');
  assert.deepEqual(activationArtifact.availableFamilies,
    ['pii:global:email', 'pii:global:iban', 'pii:global:network-address', 'pii:global:payment-card', 'pii:global:phone']);
  assert.deepEqual(qualificationArtifact.sourceConformance.lanes.map(row => row.id),
    ['rust-native-phone-conformance', 'python-phone-conformance', 'cli-phone-conformance']);
  const korean = qualificationArtifact.installedArtifactConformance.lanes[0].observations
    .find(row => row.id === 'korean-nfd-sensitive-context');
  assert.deepEqual(korean.canonicalRange, { start: 33, end: 45 });
  const astral = qualificationArtifact.installedArtifactConformance.lanes[0].observations
    .find(row => row.id === 'astral-prefix-offset');
  assert.deepEqual(astral.nativeRange, { start: 9, end: 21 });
  assert.deepEqual(astral.canonicalRange, { start: 11, end: 23 });
  assert.equal(qualificationArtifact.status, 'not-qualified');
  assert.equal(phone.status.state, 'pending');
  for (const reason of ['identity-only-classification', 'diagnostic-population-not-measured',
    'benign-heavy-stress-not-measured', 'population-comparison-not-qualified', 'protected-partition'])
    assert.ok(phone.status.reasonCodes.includes(reason));
  assert.ok(phone.populationEvidence.every(row => row.status === 'not-measured' && row.strata === 0));
  assert.equal(validatePiiSupportMatrixV2(matrix, { registry: piiSupportRegistry, product }).artifactCommitment, matrix.artifactCommitment);

  const hostile = structuredClone(product);
  hostile.qualificationArtifacts[0].sourceConformance.lanes[0].fixture = 'conformance/fixtures/pii-email-v1.json';
  hostile.qualificationArtifacts[0].sourceConformance.artifactCommitment =
    piiBindingArtifactCommitment(hostile.qualificationArtifacts[0].sourceConformance);
  hostile.qualificationArtifacts[0].artifactCommitment = piiBindingArtifactCommitment(hostile.qualificationArtifacts[0]);
  assert.throws(() => buildPiiSupportMatrixV2({ registry: piiSupportRegistry, product: hostile }), /trusted PII qualification evidence/);
});

test('trusted activation or qualification alone cannot forge provisional support', () => {
  const matrix = buildPiiSupportMatrixV2({ registry: registry() });
  matrix.activationContract.productArtifact = 'trusted';
  matrix.activationContract.productSourceCommit = '9'.repeat(40);
  matrix.activationContract.productArtifactCommitment = 'a'.repeat(64);
  matrix.activationContract.candidateEvidenceCommitment = 'b'.repeat(64);
  matrix.activationContract.activationArtifactCommitment = 'c'.repeat(64);
  const row = matrix.families[0];
  row.activation = { state: 'available', selector: row.activation.selector,
    activationIdentity: 'credentials=full;selectors=pii:global;families=pii:ca:sin;vocabulary=pii-context/v1', productArtifactCommitment: 'a'.repeat(64) };
  row.qualificationArtifactCommitment = 'b'.repeat(64);
  row.status.state = 'provisional'; row.status.reasonCodes = [];
  matrix.distribution.pending--; matrix.distribution.provisional++;
  matrix.artifactCommitment = piiSupportMatrixV2Commitment(matrix);
  assert.throws(() => validatePiiSupportMatrixV2(matrix), /semantics/);
});

test('a fully measured no-regression matrix cannot forge a repository-sanctioned product tuple', async () => {
  const forged = JSON.parse(await readFile('evidence/875/pii-support-matrix-v2.json', 'utf8'));
  forged.activationContract.productSourceCommit = '9'.repeat(40);
  forged.activationContract.productArtifactCommitment = 'a'.repeat(64);
  forged.activationContract.candidateEvidenceCommitment = 'b'.repeat(64);
  forged.activationContract.activationArtifactCommitment = 'c'.repeat(64);
  for (const report of forged.populationReports) {
    report.status = 'measured';
    report.familyEvidence[0] = { family: 'pii:global:network-address', status: 'measured', strata: 1 };
  }
  const benign = { family: 'pii:global:network-address', scope: 'global', contextClass: 'non-sensitive',
    evidenceClass: 'official-test', accountingAxis: 'test-value', validatorBacked: false, contextDependent: false,
    baselineRate: 0, candidateRate: 0, delta: 0, limit: 0, regressed: false };
  const diagnostic = axis => ({ axis, applicable: true, baselineRate: 1, candidateRate: 1, delta: 0,
    baselineFailed: 0, candidateFailed: 0, failedDelta: 0, regressed: false });
  for (const comparison of forged.populationComparisons) {
    const report = forged.populationReports.find(row => row.id === comparison.id);
    comparison.status = 'compared'; comparison.verdict = 'no-regression';
    comparison.baselineObservation = { reportCommitment: 'd'.repeat(64), candidateArtifactHash: 'e'.repeat(64) };
    comparison.candidateObservation = { reportCommitment: report.reportCommitment, candidateArtifactHash: 'f'.repeat(64) };
    comparison.benignFalseAlarmDeltas = [benign];
    comparison.diagnosticDeltas = comparison.id === 'diagnostic-balanced' ?
      ['type-identity', 'validator-correctness', 'context-discrimination'].map(diagnostic) : [];
  }
  const row = forged.families[0];
  row.activation.productArtifactCommitment = 'a'.repeat(64);
  row.populationEvidence.forEach(evidence => { evidence.reportStatus = 'measured'; evidence.status = 'measured'; evidence.strata = 1; });
  row.qualificationArtifactCommitment = 'd'.repeat(64); row.status = { state: 'provisional', profile: { id: 'pii-v1', version: 1 }, reasonCodes: [] };
  forged.distribution = { pending: 0, provisional: 1, stable: 0, unsupported: 0 };
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.match(piiSupportSemanticProblem(forged, { allowBoundPopulationEvidence: true }), /repository-sanctioned/);
  assert.throws(() => validatePiiSupportMatrixV2(forged), /semantics/);
});

test('support matrix rejects forged status, unknown identity, extras and raw channels', () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const mutations = [
    value => { value.families[0].status.state = 'stable'; value.distribution.pending--; value.distribution.stable++; },
    value => { value.families[0].identityDomain = 'passport'; },
    value => { value.families[0].raw = 'RAW-CANARY'; },
    value => { value.families[0].family = 'pii:global:sin'; },
    value => { value.populationReports[0].status = 'measured'; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value); value.artifactCommitment = piiSupportMatrixV2Commitment(value);
    assert.throws(() => validatePiiSupportMatrixV2(value));
  }
  const forged = structuredClone(original); forged.families[0].status.state = 'stable'; forged.distribution.pending--; forged.distribution.stable++;
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.throws(() => validatePiiSupportMatrixV2(forged));
});

test('coordinated population claims fail closed without bound #285 reports and rows', async () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const forged = structuredClone(original);
  for (const report of forged.populationReports) {
    report.status = 'measured';
    for (const summary of report.familyEvidence) { summary.status = 'measured'; summary.strata = 1; }
  }
  for (const family of forged.families) {
    for (const evidence of family.populationEvidence) {
      evidence.reportStatus = 'measured'; evidence.status = 'measured'; evidence.strata = 1;
    }
    family.status.reasonCodes = ['product-activation-not-measured'];
  }
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.throws(() => validatePiiSupportMatrixV2(forged), /bound source reports/);
  assert.ok(await piiSupportMatrixProblem(forged, forged.artifactCommitment));

  const provenanceForgery = structuredClone(original);
  provenanceForgery.populationReports.forEach((report, index) => {
    report.contractCommitment = 'a'.repeat(64); report.corpusCommitment = 'b'.repeat(64);
    report.reportCommitment = (index ? 'd' : 'c').repeat(64);
    for (const family of provenanceForgery.families)
      family.populationEvidence.find(evidence => evidence.id === report.id).reportCommitment = report.reportCommitment;
  });
  provenanceForgery.artifactCommitment = piiSupportMatrixV2Commitment(provenanceForgery);
  assert.throws(() => validatePiiSupportMatrixV2(provenanceForgery), /canonical empty projection|semantics/);
  assert.ok(await piiSupportMatrixProblem(provenanceForgery, provenanceForgery.artifactCommitment));
});

test('registry is commitment-bound and keeps global and jurisdiction identities distinct', () => {
  const value = registry();
  assert.equal(validatePiiSupportRegistry(value).families.length, 2);
  const crossed = structuredClone(value); crossed.families[0].jurisdiction = 'US'; crossed.contentCommitment = piiSupportRegistryCommitment(crossed);
  assert.throws(() => validatePiiSupportRegistry(crossed));
  const unknown = structuredClone(value); unknown.families[0].scope = 'jurisdiction:ZZ'; unknown.families[0].jurisdiction = 'ZZ'; unknown.families[0].family = 'pii:zz:sin'; unknown.contentCommitment = piiSupportRegistryCommitment(unknown);
  assert.throws(() => validatePiiSupportRegistry(unknown));
});

test('evaluation-domain v2 index keeps the credential support href, points the credential evaluation at its bundle and binds PII support', async () => {
  const matrix = buildPiiSupportMatrixV2();
  const index = buildEvaluationDomainsV2(matrix.artifactCommitment, credentialReference);
  assert.equal(evaluationDomainsV2Problem(index), null);
  assert.deepEqual(domainDescriptorV2(index, 'credential').support, { state: 'published', href: '/results/support-matrix-v1.json', artifactCommitment: null });
  assert.deepEqual(domainDescriptorV2(index, 'credential').evaluation, { state: 'published', href: `/results/evaluation-bundles/${credentialReference.bundleId}/manifest.json`, artifactCommitment: credentialReference.manifestSha256 });
  assert.equal(domainDescriptorV2(index, 'pii').support.artifactCommitment, matrix.artifactCommitment);
  assert.equal(domainDescriptorV2(index, 'pii').support.href, `/results/pii-support-matrix-v2-${matrix.artifactCommitment}.json`);
  assert.equal(await piiSupportMatrixProblem(matrix, matrix.artifactCommitment), null);
  assert.ok(await piiSupportMatrixProblem(matrix, 'f'.repeat(64)));
  const mutated = structuredClone(matrix); mutated.activationContract.productArtifact = 'trusted';
  assert.ok(await piiSupportMatrixProblem(mutated, matrix.artifactCommitment));
  mutated.artifactCommitment = piiSupportMatrixV2Commitment(mutated);
  assert.ok(await piiSupportMatrixProblem(mutated, mutated.artifactCommitment));
});

test('failed v2 publication preserves the credential evidence and the existing index bytes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-publish-'));
  const support = path.join(directory, 'support-matrix-v1.json'), pointer = path.join(directory, 'evaluation-bundle-v1.json');
  const index = path.join(directory, 'evaluation-domains-v2.json');
  const pointerBytes = Buffer.from('{"credential":"not-a-pointer"}\n'), supportBytes = Buffer.from('{"credential":"golden-support"}\n');
  const indexBytes = Buffer.from('{"existing":"index"}\n');
  await Promise.all([writeFile(pointer, pointerBytes), writeFile(support, supportBytes), writeFile(index, indexBytes)]);
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/publish-pii-support.ts', `--credential-results=${directory}`,
    `--credential-support=${support}`, `--pii-directory=${directory}`, `--output=${index}`], { cwd: path.resolve('.') }), /Credential evaluation bundle is incompatible/);
  assert.deepEqual(await readFile(pointer), pointerBytes); assert.deepEqual(await readFile(support), supportBytes);
  assert.deepEqual(await readFile(index), indexBytes);
  await assert.rejects(execute(process.execPath, ['--import', 'tsx', 'scripts/publish-pii-support.ts', `--evaluation=${directory}/evaluation-v1.json`], { cwd: path.resolve('.') }), /legacy credential contract/);
});

test('index rename failure leaves the old immutable set valid without rollback', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-rollback-'));
  const oldPii = path.join(directory, 'pii-old.json'), newPii = path.join(directory, 'pii-new.json'), index = path.join(directory, 'index.json');
  await writeFile(oldPii, 'old-pii\n'); await writeFile(index, 'old-index-points-to-pii-old\n');
  let calls = 0;
  const realRename = (await import('node:fs/promises')).rename;
  const validations = { artifact: () => {}, index: () => {}, beforeCommit: () => {} };
  await assert.rejects(publishArtifactAndIndex(newPii, 'new-pii\n', index, 'new-index\n', validations, { rename: async (...args) => {
    calls++; if (calls === 2) throw new Error('forced index rename failure'); return realRename(...args);
  }}), /forced index rename failure/);
  assert.equal(await readFile(oldPii, 'utf8'), 'old-pii\n'); assert.equal(await readFile(index, 'utf8'), 'old-index-points-to-pii-old\n');
  assert.equal(await readFile(newPii, 'utf8'), 'new-pii\n');
});

test('late verification failure cannot replace the index or invalidate its old artifact', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-support-late-failure-'));
  const oldPii = path.join(directory, 'pii-old.json'), newPii = path.join(directory, 'pii-new.json'), index = path.join(directory, 'index.json');
  await writeFile(oldPii, 'old-pii\n'); await writeFile(index, 'old-index-points-to-pii-old\n');
  await assert.rejects(publishArtifactAndIndex(newPii, 'new-pii\n', index, 'new-index\n', {
    artifact: () => {}, index: () => {}, beforeCommit: () => { throw new Error('credential bytes changed'); },
  }), /credential bytes changed/);
  assert.equal(await readFile(oldPii, 'utf8'), 'old-pii\n'); assert.equal(await readFile(index, 'utf8'), 'old-index-points-to-pii-old\n');
  assert.equal(await readFile(newPii, 'utf8'), 'new-pii\n');
});

test('deployment uploads immutable PII evidence before the index and excludes history from deletion', async () => {
  const workflow = await readFile('.github/workflows/publish-site.yml', 'utf8');
  const artifact = workflow.indexOf('aws s3 cp "dist/$pii_artifact"'), general = workflow.indexOf('aws s3 sync dist "s3://$bucket"'),
    index = workflow.indexOf('aws s3 cp dist/results/evaluation-domains-v2.json');
  assert.ok(artifact >= 0 && artifact < general && general < index);
  assert.match(workflow, /--exclude 'results\/pii-support-matrix-v2-\*\.json'/);
  assert.match(workflow, /--exclude 'results\/evaluation-domains-v2\.json'/);
  const clear = workflow.slice(workflow.indexOf('- name: Clear the transient PII comparison'), workflow.indexOf('- name: Measure the corpus'));
  const oracle = workflow.slice(workflow.indexOf('- name: Observe PII populations'), workflow.indexOf('- name: Produce the evaluation'));
  const classify = workflow.slice(workflow.indexOf('- name: Classify support'), workflow.indexOf('- name: Build the site'));
  assert.match(clear, /rm -f results-output\/pii\/population-release-v1\.json/);
  assert.doesNotMatch(clear, /\n\s+if:/);
  assert.match(oracle, /steps\.pii-authority\.outputs\.authority == 'legacy'/);
  assert.match(classify, /--bounded-population-oracle --population-bundle="\$population_bundle"/);
  assert.match(classify, /if \[ "\$PII_AUTHORITY" = legacy \] && \[ -s "\$population_bundle" \]/);
  assert.match(classify, /--population-mode=not-measured/);
});

test('browser and Node reject rehashed semantic forgeries alike', async () => {
  const original = buildPiiSupportMatrixV2({ registry: registry() });
  const mutations = [
    value => { value.families[0].jurisdiction = 'US'; },
    value => { value.families[0].activation.selector = 'pii:family:ca:other'; },
    value => { value.families.reverse(); },
    value => { value.populationReports[1] = structuredClone(value.populationReports[0]); },
    value => { value.populationComparisons[0].verdict = 'no-regression'; },
    value => { value.families[0].populationEvidence[0].reportCommitment = 'f'.repeat(64); },
    value => { value.families[0].populationEvidence[0].status = 'measured'; value.families[0].populationEvidence[0].strata = 999; },
    value => { value.families[0].status.reasonCodes = ['all-pii-v1-gates-met']; },
    value => { value.families[0].authority[0].locator = 'x'; },
  ];
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => [key, canonical(child)])) : value;
  for (const mutate of mutations) {
    const value = structuredClone(original); mutate(value);
    value.registryCommitment = createHash('sha256').update(JSON.stringify(canonical(piiSupportRegistryProjection(value)))).digest('hex');
    value.artifactCommitment = piiSupportMatrixV2Commitment(value);
    const index = buildEvaluationDomainsV2(value.artifactCommitment, credentialReference), expected = domainDescriptorV2(index, 'pii').support.artifactCommitment;
    assert.throws(() => validatePiiSupportMatrixV2(value));
    assert.ok(await piiSupportMatrixProblem(value, expected));
  }
});

// ---- #790: PII publication reads credential evidence as a verified bundle read set ----
import { readdir as readDirectory } from 'node:fs/promises';
import { credentialEvidenceChangeProblem, readCredentialEvidence } from '../benchmarks/shared/credential-evidence.ts';
import { publishSyntheticBundle, syntheticSupportMatrix, tempDirectory } from './support/evaluation-bundle-fixture.mjs';

const credentialNames = ['evaluation-bundle-v1.json', 'evaluation-bundles', 'support-matrix-v1.json'];
const treeDigest = async directory => {
  const hash = createHash('sha256');
  const walk = async (dir, top = true) => { for (const entry of (await readDirectory(dir, { withFileTypes: true })).filter(e => !top || credentialNames.includes(e.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, false); else hash.update(`${path.relative(directory, full)}\0`).update(await readFile(full));
  } };
  await walk(directory);
  return hash.digest('hex');
};

test('credential and PII publish together from a bundle: credential evidence untouched, index binds the bundle and the PII artifact', async () => {
  const results = await tempDirectory('pii-bundle-publish-'), supportFile = path.join(results, 'support-matrix-v1.json');
  await writeFile(supportFile, JSON.stringify(syntheticSupportMatrix()) + '\n');
  const { pointer } = await publishSyntheticBundle(results);
  const before = await treeDigest(results);
  const { stdout } = await execute(process.execPath, ['--import', 'tsx', 'scripts/publish-pii-support.ts', `--credential-results=${results}`, `--credential-support=${supportFile}`,
    `--pii-directory=${results}`, `--output=${path.join(results, 'evaluation-domains-v2.json')}`, '--population-mode=not-measured'], { cwd: path.resolve('.') });
  assert.match(stdout, new RegExp(`Credential evidence: bundle ${pointer.bundleId}`));
  const index = JSON.parse(await readFile(path.join(results, 'evaluation-domains-v2.json'), 'utf8'));
  assert.equal(evaluationDomainsV2Problem(index), null);
  assert.deepEqual(domainDescriptorV2(index, 'credential').evaluation,
    { state: 'published', href: `/results/evaluation-bundles/${pointer.bundleId}/manifest.json`, artifactCommitment: pointer.manifest.sha256 });
  const artifact = (await readDirectory(results)).find(name => name.startsWith('pii-support-matrix-v2-'));
  assert.equal(JSON.parse(await readFile(path.join(results, artifact), 'utf8')).artifactCommitment, domainDescriptorV2(index, 'pii').support.artifactCommitment);
  // Only the two PII outputs were added; every credential file (pointer, bundle, support matrix) is byte-identical.
  const added = (await readDirectory(results)).filter(name => !credentialNames.includes(name)).sort();
  assert.deepEqual(added, ['evaluation-domains-v2.json', artifact].sort());
  assert.equal(await treeDigest(results), before);
  assert.equal(await credentialEvidenceChangeProblem(await readCredentialEvidence(results, supportFile)), null);
});

test('a concurrent credential replacement between read and commit is refused and the existing index survives', async () => {
  const results = await tempDirectory('pii-bundle-concurrent-'), supportFile = path.join(results, 'support-matrix-v1.json');
  await writeFile(supportFile, JSON.stringify(syntheticSupportMatrix()) + '\n');
  await publishSyntheticBundle(results);
  const evidence = await readCredentialEvidence(results, supportFile);
  const oldIndex = path.join(results, 'index.json'), newPii = path.join(results, 'pii-new.json');
  await writeFile(oldIndex, 'old-index\n');
  const validations = { artifact: () => {}, index: () => {}, async beforeCommit() { const problem = await credentialEvidenceChangeProblem(evidence); if (problem) throw new Error(problem); } };
  // Replacement of the credential bundle after the read set was taken (a concurrent eval:publish moves the pointer).
  await publishSyntheticBundle(results, { runId: 'replacement-run' });
  await assert.rejects(publishArtifactAndIndex(newPii, 'new-pii\n', oldIndex, 'new-index\n', validations), /Credential evaluation pointer changed/);
  assert.equal(await readFile(oldIndex, 'utf8'), 'old-index\n');
  assert.equal(await readFile(newPii, 'utf8'), 'new-pii\n');
  // A support-matrix replacement is detected the same way.
  const fresh = await readCredentialEvidence(results, supportFile);
  await writeFile(supportFile, JSON.stringify({ ...syntheticSupportMatrix(), generatedNote: 'changed' }) + '\n');
  assert.match(await credentialEvidenceChangeProblem(fresh), /support artifact bytes changed/);
});

test('a manifest rewritten in place under the same pointer is detected', async () => {
  const results = await tempDirectory('pii-bundle-manifest-'), supportFile = path.join(results, 'support-matrix-v1.json');
  await writeFile(supportFile, JSON.stringify(syntheticSupportMatrix()) + '\n');
  const { directory } = await publishSyntheticBundle(results);
  const evidence = await readCredentialEvidence(results, supportFile);
  await writeFile(path.join(directory, 'manifest.json'), `${await readFile(path.join(directory, 'manifest.json'), 'utf8')} `);
  assert.match(await credentialEvidenceChangeProblem(evidence), /changed during publication|unreadable/);
});
