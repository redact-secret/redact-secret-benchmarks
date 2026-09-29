import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import {
  loadPiiBenignCollisionCases, materializePiiEvidenceCandidate, piiBenignCollisionCommitment, piiBenignCollisionEvidence,
  validatePiiBenignCollisionEvidence,
} from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiAccountingRowsFromEvaluation } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import {
  buildPiiPopulationReport, comparePiiPopulationReports, piiPopulationCommitment, piiPopulationContract,
  selectPiiPopulationRows, validatePiiPopulationContract, validatePiiPopulationReport,
} from '../benchmarks/evaluation/domains/pii/populations.ts';
import {
  buildPiiSupportMatrixV2, piiSupportMatrixV2Commitment, piiSupportRegistryCommitment, validatePiiSupportMatrixV2,
} from '../benchmarks/evaluation/domains/pii/support-v2.ts';
import { piiSupportMatrixProblem } from '../src/pii-support-model.ts';
import { buildEvaluationDomainsV2, domainDescriptorV2 } from '../src/evaluation-domains-v2.ts';
import { piiSupportPage, piiSupportQueryOf } from '../src/pages/pii-support.ts';
import { PII_VALIDATOR_CONSUMERS } from '../benchmarks/evaluation/domains/pii/validator-qualification.ts';
import { createPiiValidators } from '../benchmarks/evaluation/domains/pii/validators.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { DEFAULT_GENERATED_SHARE_CAP, SCORING_CONTRACT_DECISION, loadRepositoryState, scoringIdentity } from '../benchmarks/lib/tuning-manifest.ts';

const consumerMap = { schemaVersion: 1, mappings: PII_VALIDATOR_CONSUMERS.mappings.map(row => ({ validator: row.validator,
  families: row.validator.id === 'luhn' ? ['pii:us:synthetic-national-id'] : [] })) };
const validationOptions = { canonical: false, consumerMap };
const generator = seed => ({ kind: 'deterministic-synthetic', sources: [],
  generator: { id: 'sha256-pattern', version: 1, seedCommitment: hash(seed) } });
const authority = (jurisdiction = false) => [{ sourceKind: jurisdiction ? 'public-authority' : 'standard', sourceId: jurisdiction ? 'synthetic-ca-authority' : 'ietf-rfc-2606',
  locator: jurisdiction ? 'https://example.invalid/ca-authority' : 'https://www.rfc-editor.org/rfc/rfc2606', revision: '1',
  supports: jurisdiction ? ['lexical', 'allocation', 'reserved-control', 'sensitivity'] : ['lexical', 'validation', 'reserved-control', 'sensitivity'] }];
function tuningFixture(repo, category = 'accuracy', corpusHash = repo.corpusHashes[category], selected = []) {
  const scoring = { contractDecision: SCORING_CONTRACT_DECISION, featureSchemaVersion: '1', featureSetHash: 'a'.repeat(64),
    aggregationContractVersion: '1', weightSetHash: 'b'.repeat(64), thresholdSetHash: 'c'.repeat(64) };
  const families = Object.fromEntries([...new Set(selected.map(row => row.family))].sort().map(family =>
    [family, { generated: 0, authored: selected.filter(row => row.family === family).length }]));
  const contexts = Object.fromEntries([...new Set(selected.map(row => row.expectation.contextClass))].sort().map(context =>
    [context, selected.filter(row => row.expectation.contextClass === context).length]));
  return { schemaVersion: 1, id: 'pii-population-tuning-v1', status: 'active', createdAt: '2026-09-26',
    product: { sourceRevision: '1'.repeat(40), sourceHash: '2'.repeat(64), lockHash: '3'.repeat(64), candidateArtifactHash: '4'.repeat(64) },
    benchmark: { commit: '5'.repeat(40), dirty: false },
    featureDataset: { schemaVersion: 1, extractorVersion: '1', extractorSourceHash: '6'.repeat(64), datasetHash: '7'.repeat(64) },
    selection: { method: 'grouped-threshold-sweep', sourceHash: '8'.repeat(64), seed: 'none' },
    scoring: { ...scoring, identity: scoringIdentity(scoring) }, corpora: { tuning: [{ category, corpusHash,
      rows: { generated: 0, authored: selected.length }, families, contexts }],
      evaluation: [{ source: 'sendgrid-regressions', role: 'regression', corpusHash: repo.corpusHashes['sendgrid-regressions'] }] },
    holdoutAccess: 'none', generatedShare: { cap: DEFAULT_GENERATED_SHARE_CAP }, strata: { dimensions: ['family', 'context'] } };
}

function evidenceEntry(id, evidenceClass, accountingClass, options = {}) {
  const seed = `population-${id}`;
  const entry = { id, caseId: id, evidenceClass, accountingClass, family: options.family ?? 'pii:global:email',
    scope: options.scope ?? 'global', identityDomain: options.identityDomain ?? 'email', language: 'en', candidateCommitment: '',
    fixture: { prefix: 'value=', suffix: '', candidate: { kind: 'deterministic-pattern', generator: 'sha256-pattern', seed, pattern: 'AAAA.DDDD' } },
    typeExpectation: options.typeExpectation ?? 'valid', sensitivityExpectation: options.sensitivity ?? 'non-sensitive', validator: options.validator ?? null, contextGroup: options.contextGroup ?? null,
    context: options.context ?? { obligation: 'none', class: options.sensitivity === 'sensitive' ? 'sensitive' : 'non-sensitive' }, collision: null, provenance: generator(seed) };
  entry.candidateCommitment = hash(materializePiiEvidenceCandidate(entry));
  return entry;
}

function fixture() {
  const evidence = structuredClone(piiBenignCollisionEvidence);
  evidence.families = [];
  evidence.entries = [];
  evidence.families.push(
    { family: 'pii:global:email', displayName: 'Synthetic email evidence', identityDomain: 'email', scope: 'global', validator: null, authority: authority() },
    { family: 'pii:ca:synthetic-id', displayName: 'Synthetic Canadian identifier', identityDomain: 'national-id', scope: 'jurisdiction:CA', validator: null, authority: authority(true) },
    { family: 'pii:us:synthetic-national-id', displayName: 'Synthetic US national identifier', identityDomain: 'national-id', scope: 'jurisdiction:US',
      validator: { id: 'luhn', version: 1 }, authority: authority(true).map(row => ({ ...row, supports: [...row.supports, 'validation'] })) },
  );
  evidence.entries.push(
    evidenceEntry('diagnostic-official-one', 'official-test', 'test-value'),
    evidenceEntry('diagnostic-official-benign', 'official-test', 'test-value'),
    evidenceEntry('diagnostic-placeholder-one', 'placeholder', 'placeholder'),
    evidenceEntry('diagnostic-placeholder-benign', 'placeholder', 'placeholder'),
    evidenceEntry('diagnostic-context', 'context-negative', 'context-negative', { contextGroup: 'en-email-core',
      context: { obligation: 'required-for-sensitive-classification', class: 'non-sensitive' } }),
    evidenceEntry('diagnostic-near-miss', 'near-miss', null, { family: 'pii:us:synthetic-national-id', scope: 'jurisdiction:US', identityDomain: 'national-id',
      typeExpectation: 'invalid', sensitivity: 'not-established', validator: { id: 'luhn', version: 1, expected: 'invalid' },
      context: { obligation: 'none', class: 'neutral' } }),
    evidenceEntry('stress-context', 'context-negative', 'context-negative', { contextGroup: 'en-email-core',
      context: { obligation: 'required-for-sensitive-classification', class: 'non-sensitive' } }),
    evidenceEntry('stress-test-a', 'official-test', 'test-value'),
    evidenceEntry('stress-public', 'public-identifier', 'public-operational'),
    evidenceEntry('stress-reference', 'ordinary-reference-account', 'public-operational'),
    evidenceEntry('stress-ca', 'official-test', 'test-value', { family: 'pii:ca:synthetic-id', scope: 'jurisdiction:CA', identityDomain: 'national-id' }),
  );
  evidence.contentCommitment = piiBenignCollisionCommitment(evidence);
  const corpus = validatePiiBenignCollisionEvidence(evidence, validationOptions);
  const cases = loadPiiBenignCollisionCases(corpus, validationOptions);
  const contract = structuredClone(piiPopulationContract);
  contract.source.corpus.contentCommitment = corpus.contentCommitment;
  const dimension = (entry, mass = {}) => ({ family: entry.family, scope: entry.scope, contextClass: entry.context.class,
    evidenceClass: entry.evidenceClass, accountingAxis: entry.accountingClass, sensitivity: entry.sensitivityExpectation,
    validatorBacked: entry.validator !== null, contextDependent: entry.context.obligation === 'required-for-sensitive-classification', ...mass });
  const dimensionKey = entry => JSON.stringify(dimension(entry));
  const diagnostic = contract.populations.find(row => row.id === 'diagnostic-balanced');
  const stress = contract.populations.find(row => row.id === 'benign-heavy-stress');
  const diagnosticEntries = corpus.entries.filter(row => row.id.startsWith('diagnostic-'));
  const stressEntries = corpus.entries.filter(row => row.id.startsWith('stress-'));
  diagnostic.denominator.evidenceIds = diagnosticEntries.map(row => row.id);
  diagnostic.denominator.caseIds = diagnosticEntries.map(row => row.caseId);
  const diagnosticGroups = [...new Map(diagnosticEntries.map(entry => [dimensionKey(entry), entry])).values()];
  diagnostic.baseRate.sensitiveMass = 0; diagnostic.baseRate.nonSensitiveMass = 7500; diagnostic.baseRate.notEstablishedMass = 2500;
  diagnostic.baseRate.strata = diagnosticGroups.map(entry => dimension(entry, { totalMass: 2500,
    sensitiveMass: entry.sensitivityExpectation === 'sensitive' ? 2500 : 0,
    nonSensitiveMass: entry.sensitivityExpectation === 'non-sensitive' ? 2500 : 0,
    notEstablishedMass: entry.sensitivityExpectation === 'not-established' ? 2500 : 0 }));
  const stressGroups = [...new Map(stressEntries.map(entry => [dimensionKey(entry), entry])).values()];
  const benignGroups = stressGroups.filter(entry => entry.sensitivityExpectation !== 'sensitive');
  stress.denominator.evidenceIds = stressEntries.map(row => row.id);
  stress.denominator.caseIds = stressEntries.map(row => row.caseId);
  stress.baseRate.sensitiveMass = 0; stress.baseRate.nonSensitiveMass = 10000; stress.baseRate.notEstablishedMass = 0;
  stress.baseRate.strata = stressGroups.map(entry => dimension(entry,
    { totalMass: 10000 / benignGroups.length, sensitiveMass: 0, nonSensitiveMass: 10000 / benignGroups.length, notEstablishedMass: 0 }));
  contract.contentCommitment = piiPopulationCommitment(contract);
  return { corpus, cases, contract: validatePiiPopulationContract(contract, corpus, { canonical: false, cases }) };
}

async function observedRows(source, flagged, artifactHash, runId, sensitive = true, version = '1.0.0') {
  const values = new Map(source.corpus.entries.map(entry => [materializePiiEvidenceCandidate(entry), entry.validator?.expected]));
  const validators = createPiiValidators([{ id: 'luhn', version: 1, validate(value) { return { state: values.get(value) ?? 'invalid' }; } }]);
  const domain = piiDomain.configure({ evidence: source.corpus, evidenceValidation: validationOptions, validators });
  const byPath = new Map(source.cases.map(row => [row.input.path, row]));
  const scanner = { id: `population-${runId.at(-1)}`, mode: 'candidate', capabilities: { ranges: true, classification: true }, configuration: { fixture: true },
    async version() { return version; }, async scan(_directory, inputs) { return inputs.flatMap(input => {
      const row = byPath.get(input.path); return row && flagged.has(row.id) ? [{ path: input.path, ...row.candidate, family: row.contract.family,
        ...(row.contract.scope === 'global' ? {} : { jurisdiction: row.contract.scope.slice('jurisdiction:'.length) }), sensitive }] : [];
    }); } };
  const artifact = await domain.execute({ cases: source.cases, methods: domain.createMethods(), scanners: [scanner],
    provenance: { candidateArtifactHash: artifactHash }, runId });
  return piiAccountingRowsFromEvaluation(artifact);
}

test('canonical contract keeps exactly two committed populations separate and reports absent observations honestly', () => {
  assert.deepEqual(piiPopulationContract.populations.map(row => [row.id, row.role]), [
    ['diagnostic-balanced', 'development-tuning'], ['benign-heavy-stress', 'evaluation-only'],
  ]);
  assert.equal(piiPopulationContract.partitionPolicy.holdoutAccess, 'none');
  assert.deepEqual(piiPopulationContract.evidenceClasses, [
    'reserved-documentation', 'official-test', 'public-identifier', 'ordinary-reference-account', 'near-miss', 'placeholder',
    'context-negative', 'cross-family-collision',
  ]);
  assert.equal(piiPopulationContract.populations.every(row =>
    row.baseRate.sensitiveMass + row.baseRate.nonSensitiveMass + row.baseRate.notEstablishedMass === row.baseRate.totalMass), true);
  assert.notEqual(piiPopulationContract.populations[0].baseRate.notEstablishedMass, piiPopulationContract.populations[1].baseRate.notEstablishedMass);
  const report = buildPiiPopulationReport(piiPopulationContract, piiBenignCollisionEvidence, [], 'benign-heavy-stress');
  assert.equal(report.status, 'not-measured');
  assert.equal(report.calibration.status, 'not-used');
  assert.deepEqual(report.denominator, { unit: 'authored-evidence-case', declared: 10, observed: 0 });
  assert.ok(report.strata.length > 0);
  assert.equal(Object.hasOwn(report, 'overallScore'), false);
});

test('authored population roster produces aggregate-only family, jurisdiction, context, class, axis, sensitivity, and basis strata', async () => {
  const source = fixture();
  const rows = await observedRows(source, new Set(['stress-test-a']), 'a'.repeat(64), '00000000-0000-4000-8000-000000000285');
  const report = buildPiiPopulationReport(source.contract, source.corpus, rows, 'benign-heavy-stress', { canonical: false, cases: source.cases });
  const diagnostic = buildPiiPopulationReport(source.contract, source.corpus, rows, 'diagnostic-balanced', { canonical: false, cases: source.cases });
  assert.equal(report.status, 'measured');
  assert.equal(diagnostic.status, 'measured');
  assert.equal(diagnostic.diagnostics.typeIdentity.status, 'measured');
  assert.equal(diagnostic.diagnostics.validatorCorrectness.status, 'measured');
  assert.equal(diagnostic.diagnostics.contextDiscrimination.status, 'measured');
  assert.ok(report.strata.some(row => row.scope === 'jurisdiction:CA'));
  assert.ok(report.strata.some(row => row.contextClass === 'non-sensitive' && row.contextDependent && !row.validatorBacked));
  assert.ok(report.strata.some(row => row.evidenceClass === 'public-identifier' && row.accountingAxis === 'public-operational'));
  assert.ok(report.strata.some(row => row.evidenceClass === 'ordinary-reference-account' && row.accountingAxis === 'public-operational'));
  assert.doesNotMatch(JSON.stringify(report), /value=|\.txt|"caseId"|"variant"|"path"|"raw"/i);
  assert.equal(Object.hasOwn(report, 'overallScore'), false);

  const registry = { schemaVersion: 1, id: 'pii-support-registry-v1', version: 1, contentCommitment: '',
    source: { repository: 'redact-secret/redact-secret', decision: 'decision-define-pii-v1-qualification-and-national-id-arrival-gates', mergeCommit: 'eb22bdf587e0079e101fc3ab5aeefada58ba438d' },
    families: [{ family: 'pii:global:email', displayName: 'Email address', identityDomain: 'email', familyContractVersion: 1,
      scope: 'global', jurisdiction: null, qualificationProfile: { id: 'pii-v1', version: 1 }, authority: authority(),
      contextObligation: 'reinforcing', validatorApplicable: false }] };
  registry.contentCommitment = piiSupportRegistryCommitment(registry);
  const populationBinding = { contract: source.contract, evidence: source.corpus, validation: { canonical: false, cases: source.cases }, rows };
  const measuredBindings = { registry, populations: [
    { ...populationBinding, report }, { ...populationBinding, report: diagnostic },
  ] };
  const matrix = buildPiiSupportMatrixV2(measuredBindings);
  assert.deepEqual(matrix.populationReports.map(row => [row.id, row.status]), [
    ['benign-heavy-stress', 'measured'], ['diagnostic-balanced', 'measured'],
  ]);
  assert.equal(matrix.families[0].status.state, 'pending');
  assert.deepEqual(matrix.families[0].status.reasonCodes, [
    'population-comparison-not-qualified',
    'product-activation-not-measured',
    'qualification-not-measured',
  ]);
  assert.ok(matrix.families[0].populationEvidence.every(row => row.status === 'measured' && row.strata > 0));
  assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(matrix)), measuredBindings).artifactCommitment, matrix.artifactCommitment);
  assert.ok(await piiSupportMatrixProblem(matrix, matrix.artifactCommitment));

  const forged = structuredClone(matrix);
  forged.populationReports[0].familyEvidence[0].strata++;
  forged.artifactCommitment = piiSupportMatrixV2Commitment(forged);
  assert.ok(await piiSupportMatrixProblem(forged, forged.artifactCommitment));

  const partialRows = rows.filter(row => row.caseId !== 'diagnostic-official-one');
  const partialBinding = { ...populationBinding, rows: partialRows };
  const partialBindings = { registry, populations: [
    { ...partialBinding, report: buildPiiPopulationReport(source.contract, source.corpus, partialRows, 'benign-heavy-stress', populationBinding.validation) },
    { ...partialBinding, report: buildPiiPopulationReport(source.contract, source.corpus, partialRows, 'diagnostic-balanced', populationBinding.validation) },
  ] };
  const partialMatrix = buildPiiSupportMatrixV2(partialBindings);
  const partialDiagnostic = partialMatrix.families[0].populationEvidence.find(row => row.id === 'diagnostic-balanced');
  assert.deepEqual([partialDiagnostic.reportStatus, partialDiagnostic.status], ['partial', 'partial']);
  assert.ok(partialMatrix.families[0].status.reasonCodes.includes('diagnostic-population-not-measured'));
  assert.equal(partialMatrix.families[0].status.state, 'pending');
  assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(partialMatrix)), partialBindings).artifactCommitment, partialMatrix.artifactCommitment);
  assert.ok(await piiSupportMatrixProblem(partialMatrix, partialMatrix.artifactCommitment));
  const partialForgery = structuredClone(partialMatrix);
  partialForgery.populationReports.find(row => row.id === 'diagnostic-balanced').status = 'not-measured';
  partialForgery.artifactCommitment = piiSupportMatrixV2Commitment(partialForgery);
  assert.ok(await piiSupportMatrixProblem(partialForgery, partialForgery.artifactCommitment));
});

test('comparison tolerates a baseline and candidate that declare different scanner versions, as a real release comparison always does', async () => {
  const source = fixture();
  const flagged = new Set(source.corpus.entries.filter(row => row.id.startsWith('diagnostic-') && row.typeExpectation === 'valid').map(row => row.id));
  const baselineRows = await observedRows(source, flagged, '8'.repeat(64), '00000000-0000-4000-8000-000000008285', false, '0.1.0-beta.9');
  const candidateRows = await observedRows(source, flagged, '9'.repeat(64), '00000000-0000-4000-8000-000000009285', false, '0.1.0-beta.10');
  const options = { canonical: false, cases: source.cases };
  const baseline = buildPiiPopulationReport(source.contract, source.corpus, baselineRows, 'diagnostic-balanced', options);
  const candidate = buildPiiPopulationReport(source.contract, source.corpus, candidateRows, 'diagnostic-balanced', options);
  assert.equal(baseline.observation.scanner.version, '0.1.0-beta.9');
  assert.equal(candidate.observation.scanner.version, '0.1.0-beta.10');
  const comparison = comparePiiPopulationReports(baseline, candidate, { contract: source.contract, evidence: source.corpus, baselineRows, candidateRows, options });
  assert.equal(comparison.verdict, 'no-regression');
});

test('diagnostic type, validator, and context regressions remain separate while benign-heavy false alarms stay unchanged', async () => {
  const source = fixture();
  const validDiagnosticIds = new Set(source.corpus.entries.filter(row => row.id.startsWith('diagnostic-') && row.typeExpectation === 'valid').map(row => row.id));
  const baselineRows = await observedRows(source, validDiagnosticIds, '6'.repeat(64), '00000000-0000-4000-8000-000000006285', false);
  const candidateRows = await observedRows(source, validDiagnosticIds, '7'.repeat(64), '00000000-0000-4000-8000-000000007285', false);
  const typeRow = candidateRows.find(row => row.caseId === 'diagnostic-official-one');
  typeRow.outcome.typeIdentity = { axis: 'type-identity', status: 'fail', state: 'miss', reason: 'diagnostic mutation' };
  const validatorRow = candidateRows.find(row => row.caseId === 'diagnostic-near-miss');
  validatorRow.methodEvidence.validatorState = 'valid';
  validatorRow.methodEvidence.validatorEvidence.forEach(row => { row.observed = 'valid'; });
  const contextRow = candidateRows.find(row => row.caseId === 'diagnostic-context');
  contextRow.outcome.sensitivityContext = { axis: 'sensitivity-context', status: 'fail', state: 'false-positive', reason: 'diagnostic mutation' };
  const options = { canonical: false, cases: source.cases };
  const baseline = buildPiiPopulationReport(source.contract, source.corpus, baselineRows, 'diagnostic-balanced', options);
  const candidate = buildPiiPopulationReport(source.contract, source.corpus, candidateRows, 'diagnostic-balanced', options);
  assert.equal(candidate.diagnostics.typeIdentity.failed > baseline.diagnostics.typeIdentity.failed, true);
  assert.equal(candidate.diagnostics.validatorCorrectness.failed > baseline.diagnostics.validatorCorrectness.failed, true);
  assert.equal(candidate.diagnostics.contextDiscrimination.failed > baseline.diagnostics.contextDiscrimination.failed, true);
  const comparison = comparePiiPopulationReports(baseline, candidate,
    { contract: source.contract, evidence: source.corpus, baselineRows, candidateRows, options });
  assert.equal(comparison.verdict, 'regression');
  assert.deepEqual(comparison.diagnosticDeltas.map(row => row.axis), ['type-identity', 'validator-correctness', 'context-discrimination']);
  assert.equal(comparison.diagnosticDeltas.every(row => row.failedDelta > 0), true);
  const baselineStress = buildPiiPopulationReport(source.contract, source.corpus, baselineRows, 'benign-heavy-stress', options);
  const candidateStress = buildPiiPopulationReport(source.contract, source.corpus, candidateRows, 'benign-heavy-stress', options);
  assert.deepEqual(candidateStress.strata.map(row => row.falseAlarms), baselineStress.strata.map(row => row.falseAlarms));
});

test('per-stratum comparator exposes a local regression even when aggregate benign false alarms improve', async () => {
  const source = fixture();
  const baselineRows = await observedRows(source, new Set(['stress-test-a', 'stress-public']), 'b'.repeat(64), '00000000-0000-4000-8000-000000001285');
  const candidateRows = await observedRows(source, new Set(['stress-context']), 'c'.repeat(64), '00000000-0000-4000-8000-000000002285');
  const baseline = buildPiiPopulationReport(source.contract, source.corpus, baselineRows, 'benign-heavy-stress', { canonical: false, cases: source.cases });
  const candidate = buildPiiPopulationReport(source.contract, source.corpus, candidateRows, 'benign-heavy-stress', { canonical: false, cases: source.cases });
  assert.ok(baseline.strata.reduce((sum, row) => sum + row.falseAlarms, 0) > candidate.strata.reduce((sum, row) => sum + row.falseAlarms, 0));
  const bindings = { contract: source.contract, evidence: source.corpus, baselineRows, candidateRows,
    options: { canonical: false, cases: source.cases } };
  const comparison = comparePiiPopulationReports(baseline, candidate, bindings);
  assert.equal(comparison.verdict, 'regression');
  assert.ok(comparison.deltas.some(row => row.evidenceClass === 'context-negative' && row.delta > 0));
  const baselineDiagnostic = buildPiiPopulationReport(source.contract, source.corpus, baselineRows, 'diagnostic-balanced', bindings.options);
  const candidateDiagnostic = buildPiiPopulationReport(source.contract, source.corpus, candidateRows, 'diagnostic-balanced', bindings.options);
  const matrixBindings = { populations: [
    { report: candidate, rows: candidateRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
    { report: candidateDiagnostic, rows: candidateRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
  ], comparisons: [
    { baseline, candidate, baselineRows, candidateRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
    { baseline: baselineDiagnostic, candidate: candidateDiagnostic, baselineRows, candidateRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
  ] };
  const published = buildPiiSupportMatrixV2(matrixBindings);
  assert.equal(published.populationComparisons.find(row => row.id === 'benign-heavy-stress').verdict, 'regression');
  assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(published))).artifactCommitment, published.artifactCommitment,
    'the content-addressed public projection validates without raw accounting rows');
  assert.equal(await piiSupportMatrixProblem(published, published.artifactCommitment), null);
  for (const mutate of [
    value => { const row = value.populationComparisons.find(row => row.id === 'benign-heavy-stress').benignFalseAlarmDeltas[0]; row.delta = row.delta === 0 ? 0.125 : 0; },
    value => { value.populationComparisons.find(row => row.id === 'diagnostic-balanced').diagnosticDeltas[0].failedDelta++; },
    value => { value.populationComparisons.find(row => row.id === 'diagnostic-balanced').diagnosticDeltas.pop(); },
  ]) {
    const forgery = structuredClone(published); mutate(forgery); forgery.artifactCommitment = piiSupportMatrixV2Commitment(forgery);
    assert.throws(() => validatePiiSupportMatrixV2(forgery));
    assert.ok(await piiSupportMatrixProblem(forgery, forgery.artifactCommitment));
  }
  const index = buildEvaluationDomainsV2(published.artifactCommitment);
  const html = piiSupportPage(domainDescriptorV2(index, 'pii'), published, piiSupportQueryOf('?domain=pii'));
  assert.match(html, /data-population="benign-heavy-stress" data-population-verdict="regression"/);
  assert.match(html, /context-negative/);
  assert.doesNotMatch(JSON.stringify(published), /"(?:content|candidate|seed|fixture|path|raw|caseId|variant)"/i);
  const mismatched = structuredClone(candidate); mismatched.corpusCommitment = 'd'.repeat(64);
  assert.throws(() => comparePiiPopulationReports(baseline, mismatched, bindings), /commitment|reconcile|Inconsistent/);
  const noProduct = structuredClone(candidate); noProduct.status = 'not-measured'; noProduct.observation = { ...noProduct.observation, kind: 'none', candidateArtifactHash: null, runId: null };
  assert.throws(() => comparePiiPopulationReports(baseline, noProduct, bindings), /schema|reconcile|Inconsistent/);
  const partialRows = candidateRows.filter(row => row.caseId !== 'stress-context');
  const partial = buildPiiPopulationReport(source.contract, source.corpus, partialRows, 'benign-heavy-stress', { canonical: false, cases: source.cases });
  assert.equal(partial.status, 'partial');
  assert.equal(comparePiiPopulationReports(baseline, partial, { ...bindings, candidateRows: partialRows }).verdict, 'not-measured');
  const partialDiagnostic = buildPiiPopulationReport(source.contract, source.corpus, partialRows, 'diagnostic-balanced', bindings.options);
  const partialMatrix = buildPiiSupportMatrixV2({ populations: [
    { report: partial, rows: partialRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
    { report: partialDiagnostic, rows: partialRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
  ], comparisons: [
    { baseline, candidate: partial, baselineRows, candidateRows: partialRows, contract: source.contract, evidence: source.corpus, validation: bindings.options },
    { baseline: baselineDiagnostic, candidate: partialDiagnostic, baselineRows, candidateRows: partialRows,
      contract: source.contract, evidence: source.corpus, validation: bindings.options },
  ] });
  assert.equal(partialMatrix.populationComparisons.find(row => row.id === 'benign-heavy-stress').status, 'compared');
  assert.equal(partialMatrix.populationComparisons.find(row => row.id === 'benign-heavy-stress').verdict, 'not-measured');
  assert.equal(validatePiiSupportMatrixV2(JSON.parse(JSON.stringify(partialMatrix))).artifactCommitment, partialMatrix.artifactCommitment);
  assert.equal(await piiSupportMatrixProblem(partialMatrix, partialMatrix.artifactCommitment), null);
  const partialHtml = piiSupportPage(domainDescriptorV2(buildEvaluationDomainsV2(partialMatrix.artifactCommitment), 'pii'), partialMatrix,
    piiSupportQueryOf('?domain=pii'));
  assert.match(partialHtml, /data-population="benign-heavy-stress" data-population-verdict="not-measured"/);
  assert.throws(() => comparePiiPopulationReports(baseline, baseline,
    { ...bindings, candidateRows: baselineRows }), /source identity/);
});

test('tuning and population validation reject evaluation-only, holdout, protected, omitted, and renormalized inputs', async () => {
  const source = fixture();
  const repositoryState = structuredClone(loadRepositoryState(process.cwd()));
  repositoryState.developmentCategories.push('pii-population');
  repositoryState.corpusHashes['pii-population'] = source.corpus.contentCommitment;
  const rows = await observedRows(source, new Set(), '8'.repeat(64), '00000000-0000-4000-8000-000000008285');
  const diagnosticIds = new Set(source.contract.populations.find(row => row.id === 'diagnostic-balanced').denominator.caseIds);
  const selected = rows.filter(row => diagnosticIds.has(row.caseId));
  const tuningManifest = tuningFixture(repositoryState, 'pii-population', source.corpus.contentCommitment, selected);
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, rows, 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest, repositoryState }),
  /unavailable until a dedicated population source is commitment-bound/);
  const unrelated = tuningFixture(loadRepositoryState(process.cwd()), 'accuracy', loadRepositoryState(process.cwd()).corpusHashes.accuracy, selected);
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, rows, 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest: unrelated, repositoryState }),
  /unavailable until a dedicated population source is commitment-bound/);
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, rows, 'benign-heavy-stress',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest, repositoryState }), /validated manifest/);
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, rows, 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest: { ...tuningManifest, holdoutAccess: 'aggregate-only' }, repositoryState }), /Invalid PII tuning manifest/);
  const nestedHoldout = structuredClone(tuningManifest); nestedHoldout.selection.seed = repositoryState.holdoutIdentifiers[0];
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, [], 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest: nestedHoldout, repositoryState }), /holdout/);
  const nestedPath = structuredClone(tuningManifest); nestedPath.selection.seed = 'nested/holdout/private.json';
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, [], 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: repositoryState.holdoutIdentifiers, purpose: 'tuning', tuningManifest: nestedPath, repositoryState }), /holdout/);
  const protectedRows = await observedRows(source, new Set(), '9'.repeat(64), '00000000-0000-4000-8000-000000009285');
  protectedRows.forEach(row => { row.source.provenance.planHash = 'f'.repeat(64); });
  assert.throws(() => selectPiiPopulationRows(source.contract, source.corpus, protectedRows, 'diagnostic-balanced',
    { canonical: false, cases: source.cases, protectedIdentities: ['f'.repeat(64)], purpose: 'evaluation' }), /authored evidence identity/);
  const holdoutCases = structuredClone(source.cases); holdoutCases[0].visibility = 'holdout';
  assert.throws(() => validatePiiPopulationContract(source.contract, source.corpus, { canonical: false, cases: holdoutCases }), /Protected|non-development/);
  assert.throws(() => validatePiiPopulationContract(source.contract, source.corpus,
    { canonical: false, cases: source.cases, protectedIdentities: [source.cases[0].provenance.sourceHash] }), /Protected/);
  const omitted = structuredClone(source.contract); omitted.populations[1].denominator.evidenceIds.pop(); omitted.populations[1].denominator.caseIds.pop();
  omitted.contentCommitment = piiPopulationCommitment(omitted);
  assert.throws(() => validatePiiPopulationContract(omitted, source.corpus, { canonical: false, cases: source.cases }), /omits committed evidence|committed roster/);
  const mass = structuredClone(source.contract); mass.populations[0].baseRate.nonSensitiveMass--;
  mass.contentCommitment = piiPopulationCommitment(mass);
  assert.throws(() => validatePiiPopulationContract(mass, source.corpus, { canonical: false, cases: source.cases }), /base-rate mass/);
  const childMass = structuredClone(source.contract); childMass.populations[0].baseRate.strata[0].nonSensitiveMass--;
  childMass.contentCommitment = piiPopulationCommitment(childMass);
  assert.throws(() => validatePiiPopulationContract(childMass, source.corpus, { canonical: false, cases: source.cases }), /child mass/);
  const nearMissMass = source.contract.populations[0].baseRate.strata.find(row => row.evidenceClass === 'near-miss');
  assert.deepEqual([nearMissMass.sensitivity, nearMissMass.sensitiveMass, nearMissMass.nonSensitiveMass, nearMissMass.notEstablishedMass],
    ['not-established', 0, 0, nearMissMass.totalMass]);
  const oppositeState = structuredClone(source.contract), oppositeDefinition = oppositeState.populations[0];
  const oppositeCell = oppositeDefinition.baseRate.strata.find(row => row.evidenceClass === 'near-miss');
  oppositeDefinition.baseRate.nonSensitiveMass += oppositeCell.totalMass;
  oppositeDefinition.baseRate.notEstablishedMass -= oppositeCell.totalMass;
  oppositeCell.nonSensitiveMass = oppositeCell.totalMass; oppositeCell.notEstablishedMass = 0;
  oppositeState.contentCommitment = piiPopulationCommitment(oppositeState);
  assert.throws(() => validatePiiPopulationContract(oppositeState, source.corpus, { canonical: false, cases: source.cases }), /child mass/);
  const frequency = structuredClone(source.contract); frequency.populations[1].baseRate.strata[0].totalMass++;
  frequency.populations[1].baseRate.strata[0].nonSensitiveMass++; frequency.populations[1].baseRate.strata[1].totalMass--;
  frequency.populations[1].baseRate.strata[1].nonSensitiveMass--; frequency.contentCommitment = piiPopulationCommitment(frequency);
  assert.throws(() => validatePiiPopulationContract(frequency, source.corpus, { canonical: false, cases: source.cases }), /authored case frequency/);
  const missingView = structuredClone(source.contract); missingView.populations[0].denominator.evidenceIds = [];
  missingView.populations[0].denominator.caseIds = []; missingView.populations[0].baseRate.strata = [];
  missingView.contentCommitment = piiPopulationCommitment(missingView);
  assert.throws(() => validatePiiPopulationContract(missingView, source.corpus, { canonical: false, cases: source.cases }), /Both PII population views|omits committed evidence/);
  const unknown = structuredClone(source.corpus); unknown.families[1].scope = 'jurisdiction:ZZ'; unknown.entries.at(-1).scope = 'jurisdiction:ZZ';
  unknown.contentCommitment = piiBenignCollisionCommitment(unknown);
  assert.throws(() => validatePiiBenignCollisionEvidence(unknown, validationOptions), /scope mismatch/);
});

test('strict aggregate report validation rejects omitted strata and raw canaries', async () => {
  const source = fixture(), rows = await observedRows(source, new Set(), 'e'.repeat(64), '00000000-0000-4000-8000-000000003285');
  const report = buildPiiPopulationReport(source.contract, source.corpus, rows, 'benign-heavy-stress', { canonical: false, cases: source.cases });
  assert.throws(() => validatePiiPopulationReport(report, source.contract, source.corpus, { canonical: false, cases: source.cases }), /bound accounting rows/);
  const omitted = structuredClone(report); omitted.strata.pop();
  assert.throws(() => validatePiiPopulationReport(omitted, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /roster|reconcile|Inconsistent/);
  const raw = structuredClone(report); raw.raw = 'RAW-CANARY@example.invalid';
  assert.throws(() => validatePiiPopulationReport(raw, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /schema/);
  const nested = structuredClone(report); nested.strata[0].candidate = 'RAW-CANARY@example.invalid';
  assert.throws(() => validatePiiPopulationReport(nested, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /schema/);
  const forged = structuredClone(report); forged.strata[0].falseAlarms += 1;
  assert.throws(() => validatePiiPopulationReport(forged, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /Inconsistent|reconcile/);
  const forgedDiagnostic = structuredClone(report); forgedDiagnostic.diagnostics.typeIdentity.failed++;
  assert.throws(() => validatePiiPopulationReport(forgedDiagnostic, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /Inconsistent|diagnostic|reconcile/);
  const allowedStringCanary = structuredClone(report); allowedStringCanary.calibration.reasonCode = 'RAW-CANARY@example.invalid';
  assert.throws(() => validatePiiPopulationReport(allowedStringCanary, source.contract, source.corpus, { canonical: false, cases: source.cases }, rows), /schema/);
});
