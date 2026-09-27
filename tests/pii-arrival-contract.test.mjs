import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import registry from '../benchmarks/evaluation/domains/pii/support-registry-v1.json' with { type: 'json' };
import qualification from '../benchmarks/evaluation/domains/pii/us-ssn-qualification-v1.json' with { type: 'json' };
import { piiArrivalContract, piiArrivalContractCommitment, piiArrivalCommitment, validatePiiArrivalOperational,
  validatePiiArrivalPopulationRoster, validatePiiArrivalQualificationReadiness, piiArrivalPopulationScannerConfiguration,
  parsePiiArrivalRuntimeSampleProcess, piiArrivalOperationalSampleProtocol, piiArrivalSelectionEvidence, validatePiiArrivalRuntimeSample,
  validatePiiArrivalWasmPayloadRoster, validatePiiArrivalProtectedEvidence,
  piiArrivalFamilyContractCommitment, piiArrivalGateStatuses } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import { piiPopulationContract } from '../benchmarks/evaluation/domains/pii/populations.ts';
import { piiBindingArtifactCommitment, piiQualificationSanctionedProjection,
  validatePiiQualificationArrivalBinding } from '../benchmarks/evaluation/domains/pii/product-binding.ts';
import { PII_VALIDATOR_REGISTRATIONS, benchmarkReferenceValidator } from '../benchmarks/evaluation/domains/pii/validator-qualification.ts';

const execFile = promisify(execFileCallback);

test('US SSN arrival freezes five distinct SSA authorities and one family contract', () => {
  const family = registry.families.find(row => row.family === 'pii:us:ssn');
  assert.ok(family);
  assert.deepEqual(family.authority.map(row => row.sourceId), [
    'ssa-poms-rm-10201-030', 'ssa-poms-rm-10201-035', 'ssa-ssn-randomization',
    'ssa-poms-rm-10201-020', 'ssa-poms-gn-03325-002',
  ]);
  assert.equal(qualification.familyContractVersion, 1);
  assert.deepEqual(Object.keys(qualification.authorityBinding), [
    'structure', 'randomization', 'allocation', 'reservedControl', 'sensitivity', 'validator',
  ]);
});

test('canonical arrival populations are disjoint, nonempty, and each declares exactly 10k mass', () => {
  const rosters = piiPopulationContract.populations.map(row => row.denominator.evidenceIds);
  assert.ok(rosters.every(roster => roster.length >= 4));
  assert.equal(rosters[0].some(id => rosters[1].includes(id)), false);
  assert.deepEqual(piiPopulationContract.populations.map(row => row.baseRate.totalMass), [10_000, 10_000]);
  const evidenceIds = new Set(piiBenignCollisionEvidence.entries.map(row => row.id));
  assert.ok(rosters.flat().every(id => evidenceIds.has(id)));
});

test('arrival roster requires exactly one report and comparison for each canonical population', () => {
  const rows = [{ population: 'diagnostic-balanced' }, { population: 'benign-heavy-stress' }];
  assert.equal(validatePiiArrivalPopulationRoster(rows, structuredClone(rows), structuredClone(rows)), true);
  for (const position of [0, 1, 2]) {
    const sets = [structuredClone(rows), structuredClone(rows), structuredClone(rows)];
    sets[position][1].population = 'diagnostic-balanced';
    assert.throws(() => validatePiiArrivalPopulationRoster(...sets), /roster mismatch/);
  }
});

test('arrival mechanics and operational thresholds are frozen before protected execution', () => {
  assert.deepEqual(piiArrivalContract.population.mechanics, { minDenominator: 4, interval: 'wilson', z: 1.96 });
  assert.equal(piiArrivalContract.protected.attempts, 1);
  assert.equal(piiArrivalContract.protected.independence, 'custodian-declared');
  assert.equal(piiArrivalContract.protected.allowedUnresolved, 0);
  assert.deepEqual([...piiArrivalContract.identity.requiredLanes].sort(), [
    'cli', 'python', 'rust-native', 'rust-private-identity', 'rust-validator',
  ]);
  assert.equal(piiArrivalContract.operational.minimumPairedSamples, 10);
  assert.deepEqual(piiArrivalContract.operational.surfaces, ['node-addon', 'node-wasm']);
  assert.deepEqual(piiArrivalContract.operational.wasmPayloadPolicy, { accounting: 'aggregate-named-payloads', members: {
    full: { fileName: 'redact_secret_wasm_bg.wasm', maximumIncrease: { raw: 65536, gzip: 32768, brotli: 32768 } },
    common: { fileName: 'redact_secret_wasm_common_bg.wasm', maximumIncrease: { raw: 0, gzip: 0, brotli: 0 } },
  }, aggregateMaximumIncrease: { raw: 65536, gzip: 32768, brotli: 32768 } });
  assert.deepEqual(piiArrivalContract.population.selectionComparison.baseline.effectiveSelectors, ['pii:global']);
  assert.deepEqual(piiArrivalContract.population.selectionComparison.candidate.effectiveSelectors, ['pii:us']);
  assert.deepEqual(piiArrivalContract.operational.profileSelections['pii-us'], {
    logicalRequestedAddition: true,
    baseline: { effectiveSelectors: ['pii:global'], selectionState: 'baseline-global-reference' },
    candidate: { effectiveSelectors: ['pii:us'], selectionState: 'candidate-family-added' },
  });
  assert.equal(piiArrivalContractCommitment, piiArrivalCommitment(piiArrivalContract));
});

test('operational Wasm accounting requires exactly the frozen full and common payloads', () => {
  const names = ['redact_secret_wasm_bg.wasm', 'redact_secret_wasm_common_bg.wasm'];
  assert.deepEqual(validatePiiArrivalWasmPayloadRoster(names), piiArrivalContract.operational.wasmPayloadPolicy.members);
  for (const hostile of [names.slice(0, 1), [...names, 'extra.wasm'], [names[0], names[0]]])
    assert.throws(() => validatePiiArrivalWasmPayloadRoster(hostile), /payload roster/);
});

test('operational child protocol freezes helper, argv, environment, order, and strict result schema', async () => {
  const protocol = piiArrivalContract.operational.sampleProtocol;
  assert.equal(createHash('sha256').update(await readFile(protocol.helper)).digest('hex'), protocol.helperSha256);
  const expected = piiArrivalOperationalSampleProtocol('4'.repeat(64));
  assert.equal(expected.successfulSamplesPerPair, 10);
  assert.match(expected.executionOrderCommitment, /^[a-f0-9]{64}$/);
  assert.deepEqual(validatePiiArrivalRuntimeSample({ initialize: 1, wholeInput: 2, incrementalLineCalls: 3 }),
    { initialize: 1, wholeInput: 2, incrementalLineCalls: 3 });
  for (const hostile of [
    { initialize: 1, wholeInput: 2 },
    { initialize: 1, wholeInput: 2, incrementalLineCalls: 3, extra: 4 },
    { initialize: -1, wholeInput: 2, incrementalLineCalls: 3 },
    { initialize: 1, wholeInput: Number.NaN, incrementalLineCalls: 3 },
  ]) assert.throws(() => validatePiiArrivalRuntimeSample(hostile), /runtime sample/);
  assert.deepEqual(parsePiiArrivalRuntimeSampleProcess('{"initialize":1,"wholeInput":2,"incrementalLineCalls":3}\n', ''),
    { initialize: 1, wholeInput: 2, incrementalLineCalls: 3 });
  for (const [stdout, stderr] of [['{}\n', 'warning'], ['{}\n{}\n', ''], ['not-json\n', '']])
    assert.throws(() => parsePiiArrivalRuntimeSampleProcess(stdout, stderr), /process output/);
  const directory = await mkdtemp(path.join(tmpdir(), 'pii-arrival-helper-test-'));
  try {
    const stub = path.join(directory, 'stub.mjs');
    await writeFile(stub, 'export async function initialize() {}\nexport function scan() { return []; }\n');
    const argv = [protocol.helper, `--module=${stub}`, `--selectors-base64=${Buffer.from('[]').toString('base64url')}`,
      `--workload-base64=${Buffer.from('x').toString('base64url')}`];
    const valid = await execFile(process.execPath, argv, { timeout: 10_000 });
    assert.deepEqual(Object.keys(JSON.parse(valid.stdout)).sort(), [...protocol.stdout.keys].sort());
    for (const hostile of [argv.slice(0, -1), [...argv, argv[2]], [...argv, '--unknown=x']])
      await assert.rejects(execFile(process.execPath, hostile, { timeout: 10_000 }), error => /invalid sample argument/.test(error.stderr));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('population comparison freezes one shared scanner policy and proves global-to-US selector closure', () => {
  assert.deepEqual(piiArrivalPopulationScannerConfiguration.selectionComparison, piiArrivalContract.population.selectionComparison);
  const baseline = piiArrivalSelectionEvidence('baseline',
    'credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card;vocabulary=pii-context/v1', 'unavailable');
  const candidate = piiArrivalSelectionEvidence('candidate',
    'credentials=full;selectors=pii:us;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1', 'available');
  assert.equal(baseline.familyAvailability, 'unavailable');
  assert.equal(candidate.familyAvailability, 'available');
  const invalidIdentities = [
    'credentials=common;selectors=pii:us;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v2',
    'credentials=full;selectors=pii:us,pii:us;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us,pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us;families=pii:global:email,pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us;extra=x;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'selectors=pii:us;credentials=full;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card,pii:us:ssn;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:us;families=pii:us:ssn,pii:global:payment-card,pii:global:network-address,pii:global:iban,pii:global:email;vocabulary=pii-context/v1',
    'credentials=full;selectors=pii:global;families=pii:global:email,pii:global:iban,pii:global:network-address,pii:global:payment-card;vocabulary=pii-context/v1',
  ];
  for (const identity of invalidIdentities)
    assert.throws(() => piiArrivalSelectionEvidence('candidate', identity, 'available'), /activation identity|closure mismatch/);
  assert.throws(() => piiArrivalSelectionEvidence('baseline', baseline.activationIdentity, 'available'), /closure mismatch/);
});

test('bounded SSN reference validator implements only the frozen structural exclusions', () => {
  const validator = PII_VALIDATOR_REGISTRATIONS.find(row => row.id === 'us-ssn-allocation');
  assert.deepEqual([validator.version, validator.maxCandidateBytes, validator.primitiveClass], [1, 9, 'bounded-parser-classifier']);
  const observe = candidate => benchmarkReferenceValidator({ validator: { id: validator.id, version: validator.version },
    vector: { id: 'test', class: 'boundary', candidate, expected: 'valid' } }).outcome;
  assert.equal(observe('890626879'), 'valid');
  for (const value of ['000626879', '666626879', '900626879', '890006879', '890620000']) assert.equal(observe(value), 'malformed');
  assert.equal(observe('8906268790'), 'candidate-too-long');
});

function operationalFixture() {
  const baselineComponents = structuredClone(piiArrivalContract.baselineEvidence.components);
  const candidateComponents = { core: '1'.repeat(64), node: '2'.repeat(64), wasm: '3'.repeat(64) };
  const workloadCommitment = '4'.repeat(64), metricNames = ['initialize', 'wholeInput', 'incrementalLineCalls'];
  const observations = ['baseline', 'candidate'].flatMap(side => piiArrivalContract.operational.surfaces.flatMap(surface =>
    piiArrivalContract.operational.profiles.map(profile => ({ side, surface, profile,
      effectiveSelectors: piiArrivalContract.operational.profileSelections[profile][side].effectiveSelectors,
      selectionState: piiArrivalContract.operational.profileSelections[profile][side].selectionState, samples: 10, workloadCommitment,
      milliseconds: Object.fromEntries(metricNames.map(metric => [metric, Array(10).fill(side === 'baseline' ? 2 : 2.5)])) }))));
  const runtimeComparisons = piiArrivalContract.operational.surfaces.flatMap(surface => piiArrivalContract.operational.profiles.map(profile => ({
    surface, profile, metrics: Object.fromEntries(metricNames.map(metric => [metric,
      { baselineMedian: 2, candidateMedian: 2.5, delta: 0.5, relative: 0.25, pass: true }])) })));
  const sizes = [
    { side: 'baseline', packed: { core: 100, node: 200, wasm: 300 }, unpacked: { core: 150, node: 250, wasm: 350 },
      wasmPayloads: {
        full: { fileName: 'redact_secret_wasm_bg.wasm', raw: 120, gzip: 100, brotli: 90, sha256: '5'.repeat(64) },
        common: { fileName: 'redact_secret_wasm_common_bg.wasm', raw: 100, gzip: 80, brotli: 70, sha256: '6'.repeat(64) },
      }, wasmPayloadTotals: { raw: 220, gzip: 180, brotli: 160 } },
    { side: 'candidate', packed: { core: 110, node: 210, wasm: 310 }, unpacked: { core: 160, node: 260, wasm: 360 },
      wasmPayloads: {
        full: { fileName: 'redact_secret_wasm_bg.wasm', raw: 125, gzip: 105, brotli: 95, sha256: '7'.repeat(64) },
        common: { fileName: 'redact_secret_wasm_common_bg.wasm', raw: 100, gzip: 80, brotli: 70, sha256: '8'.repeat(64) },
      }, wasmPayloadTotals: { raw: 225, gzip: 185, brotli: 165 } },
  ];
  const comparisonInputs = {
    corePacked: [100, 110, piiArrivalContract.operational.packageBytes.corePackedMaximumIncrease],
    nodePacked: [200, 210, piiArrivalContract.operational.packageBytes.nodePackedMaximumIncrease],
    wasmPacked: [300, 310, piiArrivalContract.operational.packageBytes.wasmPackedMaximumIncrease],
  };
  for (const [role, member] of Object.entries(piiArrivalContract.operational.wasmPayloadPolicy.members))
    for (const metric of ['raw', 'gzip', 'brotli']) comparisonInputs[`wasm${role[0].toUpperCase()}${role.slice(1)}${metric[0].toUpperCase()}${metric.slice(1)}`] =
      [sizes[0].wasmPayloads[role][metric], sizes[1].wasmPayloads[role][metric], member.maximumIncrease[metric]];
  for (const metric of ['raw', 'gzip', 'brotli']) comparisonInputs[`wasmAggregate${metric[0].toUpperCase()}${metric.slice(1)}`] =
    [sizes[0].wasmPayloadTotals[metric], sizes[1].wasmPayloadTotals[metric], piiArrivalContract.operational.wasmPayloadPolicy.aggregateMaximumIncrease[metric]];
  const byteComparisons = Object.fromEntries(Object.entries(comparisonInputs).map(([id, [baseline, candidate, maximumIncrease]]) =>
    [id, { baseline, candidate, delta: candidate - baseline, maximumIncrease, pass: candidate - baseline <= maximumIncrease }]));
  const projection = { schemaVersion: 1, reportType: 'pii-arrival-operational', supportClaims: false,
    contractCommitment: piiArrivalContractCommitment, runtime: { node: 'v22.0.0', platform: 'test', arch: 'test' }, workloadCommitment,
    sampleProtocol: piiArrivalOperationalSampleProtocol(workloadCommitment),
    baseline: { sourceCommit: piiArrivalContract.baselineEvidence.sourceCommit,
      artifactSetCommitment: piiArrivalContract.baselineEvidence.artifactSetCommitment, components: baselineComponents },
    candidate: { sourceCommit: 'a0709d2a41b70217874da9afeffb40fb2a1a2596',
      artifactSetCommitment: piiArrivalCommitment(candidateComponents), components: candidateComponents },
    observations, sizes, runtimeComparisons, byteComparisons, status: 'complete' };
  return { report: { ...projection, artifactCommitment: piiArrivalCommitment(projection) }, expected: {
    baseline: projection.baseline, candidate: projection.candidate,
  } };
}

test('operational evidence recomputes exact paired metrics, sizes, budgets, and workload binding', () => {
  const { report, expected } = operationalFixture();
  assert.equal(validatePiiArrivalOperational(report, expected).status, 'complete');
  const mutations = [
    value => { value.runtimeComparisons[0].metrics = {}; },
    value => { value.runtimeComparisons[0].metrics.initialize.delta = 0; },
    value => { value.runtimeComparisons[0].metrics.initialize.relative = 0; },
    value => { value.runtimeComparisons[0].metrics.initialize.pass = false; },
    value => { value.byteComparisons.corePacked.maximumIncrease++; },
    value => { value.sizes[1].packed.core++; },
    value => { value.observations[0].workloadCommitment = '7'.repeat(64); },
    value => { value.observations[0].milliseconds.initialize.pop(); },
    value => { value.sampleProtocol.executionOrderCommitment = '9'.repeat(64); },
    value => { value.sampleProtocol.successfulSamplesPerPair++; },
    value => { value.observations.find(row => row.side === 'candidate' && row.profile === 'pii-us').effectiveSelectors = ['pii:global']; },
    value => { value.observations.find(row => row.side === 'candidate' && row.profile === 'pii-family-us-ssn').selectionState = 'fallback'; },
    value => { delete value.sizes[1].wasmPayloads.common; },
    value => { value.sizes[1].wasmPayloads.extra = structuredClone(value.sizes[1].wasmPayloads.full); },
    value => { [value.sizes[1].wasmPayloads.full, value.sizes[1].wasmPayloads.common] =
      [value.sizes[1].wasmPayloads.common, value.sizes[1].wasmPayloads.full]; },
    value => { value.sizes[1].wasmPayloads.common.fileName = value.sizes[1].wasmPayloads.full.fileName; },
    value => { value.sizes[1].wasmPayloads.common.sha256 = value.sizes[1].wasmPayloads.full.sha256; },
    value => { value.sizes[1].wasmPayloads.full.sha256 = 'tampered'; },
    value => { value.sizes[1].wasmPayloadTotals.raw++; },
  ];
  for (const mutate of mutations) {
    const hostile = structuredClone(report); mutate(hostile);
    hostile.artifactCommitment = piiArrivalCommitment(Object.fromEntries(Object.entries(hostile).filter(([key]) => key !== 'artifactCommitment')));
    assert.throws(() => validatePiiArrivalOperational(hostile, expected), /operational evidence|payload roster/);
  }
});

test('per-role Wasm budgets reject offsetting common growth even when aggregate bytes do not change', () => {
  const { report, expected } = operationalFixture(), hostile = structuredClone(report);
  hostile.sizes[1].wasmPayloads.common.raw += 10;
  hostile.sizes[1].wasmPayloads.full.raw -= 10;
  const common = hostile.byteComparisons.wasmCommonRaw;
  common.candidate += 10; common.delta += 10; common.pass = false;
  const full = hostile.byteComparisons.wasmFullRaw;
  full.candidate -= 10; full.delta -= 10;
  hostile.status = 'regression';
  hostile.artifactCommitment = piiArrivalCommitment(Object.fromEntries(Object.entries(hostile).filter(([key]) => key !== 'artifactCommitment')));
  assert.equal(validatePiiArrivalOperational(hostile, expected).status, 'regression');
});

test('qualification readiness fails closed on status, exact artifact set, candidate evidence, and packed sizes', () => {
  const { report, expected } = operationalFixture();
  const population = { status: 'complete', candidate: { ...expected.candidate, candidateEvidenceSha256: '8'.repeat(64) } };
  const sizes = report.sizes.find(row => row.side === 'candidate').packed;
  assert.equal(validatePiiArrivalQualificationReadiness(population, report, expected.candidate.sourceCommit,
    expected.candidate.components, sizes, population.candidate.candidateEvidenceSha256), true);
  for (const mutate of [
    (p, o, c, s, e) => { p.status = 'incomplete'; },
    (p, o, c, s, e) => { o.status = 'regression'; },
    (p, o, c, s, e) => { c.node = '9'.repeat(64); },
    (p, o, c, s, e) => { s.core++; },
    (p, o, c, s, e) => { e.value = '0'.repeat(64); },
  ]) {
    const p = structuredClone(population), o = structuredClone(report), c = structuredClone(expected.candidate.components), s = structuredClone(sizes),
      evidence = { value: population.candidate.candidateEvidenceSha256 };
    mutate(p, o, c, s, evidence);
    assert.throws(() => validatePiiArrivalQualificationReadiness(p, o, expected.candidate.sourceCommit, c, s, evidence.value), /incomplete/);
  }
});

function unspentFixture() {
  const expected = {
    familyContractCommitment: piiArrivalFamilyContractCommitment, productSourceCommit: '2'.repeat(40), candidateEvidenceCommitment: '3'.repeat(64),
    candidateArtifactSetCommitment: '4'.repeat(64), identitySourceCommitment: '5'.repeat(64),
    populationBundleCommitment: '6'.repeat(64), operationalCommitment: '7'.repeat(64),
    populationStatus: 'incomplete', operationalStatus: 'regression',
  };
  const projection = {
    schemaVersion: 1, reportType: 'pii-protected-unspent-attestation', state: 'unspent', supportClaims: false,
    family: 'pii:us:ssn', familyContractCommitment: expected.familyContractCommitment,
    arrivalContractCommitment: piiArrivalContractCommitment, productSourceCommit: expected.productSourceCommit,
    candidateEvidenceCommitment: expected.candidateEvidenceCommitment,
    candidateArtifactSetCommitment: expected.candidateArtifactSetCommitment,
    identitySourceCommitment: expected.identitySourceCommitment, populationBundleCommitment: expected.populationBundleCommitment,
    operationalCommitment: expected.operationalCommitment, epochCommitment: '8'.repeat(64), manifestCommitment: '9'.repeat(64),
    sealed: true, maxRuns: 1, runs: 0, decision: 'not-run', reason: 'public-gates-failed',
    implementationAuthor: 'implementation-agent', custodian: 'holdout-custodian', reviewer: 'independent-reviewer',
    reviewedAt: '2026-09-27T12:00:00Z',
  };
  return { expected, attestation: { ...projection, artifactCommitment: piiArrivalCommitment(projection) } };
}

test('redacted unspent protected evidence binds failed public evidence without spending the holdout', () => {
  const { expected, attestation } = unspentFixture();
  assert.deepEqual(validatePiiArrivalProtectedEvidence(attestation, expected), attestation);
  assert.equal(JSON.stringify(attestation).includes('path'), false);
  assert.equal(JSON.stringify(attestation).includes('raw'), false);
  for (const key of Object.keys(attestation)) {
    const missing = structuredClone(attestation); delete missing[key];
    assert.throws(() => validatePiiArrivalProtectedEvidence(missing, expected), /unspent protected evidence/, `missing ${key}`);
  }
  for (const [name, mutate] of Object.entries({
    missing: value => { delete value.manifestCommitment; }, extra: value => { value.path = '/protected/manifest.json'; },
    schema: value => { value.schemaVersion = 2; }, reportType: value => { value.reportType = 'pii-holdout'; },
    state: value => { value.state = 'completed'; },
    supportClaims: value => { value.supportClaims = true; }, family: value => { value.family = 'pii:ca:sin'; },
    familyContract: value => { value.familyContractCommitment = 'a'.repeat(64); },
    arrivalContract: value => { value.arrivalContractCommitment = 'a'.repeat(64); },
    source: value => { value.productSourceCommit = 'a'.repeat(40); }, candidateEvidence: value => { value.candidateEvidenceCommitment = 'a'.repeat(64); },
    artifactSet: value => { value.candidateArtifactSetCommitment = 'a'.repeat(64); }, identity: value => { value.identitySourceCommitment = 'a'.repeat(64); },
    population: value => { value.populationBundleCommitment = 'a'.repeat(64); }, operational: value => { value.operationalCommitment = 'a'.repeat(64); },
    epoch: value => { value.epochCommitment = 'opaque'; }, manifest: value => { value.manifestCommitment = 'opaque'; },
    sealed: value => { value.sealed = false; }, maxRuns: value => { value.maxRuns = 2; }, runs: value => { value.runs = 1; },
    decision: value => { value.decision = 'accepted'; }, reason: value => { value.reason = 'operator-choice'; },
    author: value => { value.implementationAuthor = ''; }, custodian: value => { value.custodian = ''; },
    authorCustodian: value => { value.custodian = value.implementationAuthor; }, reviewer: value => { value.reviewer = ''; },
    timestamp: value => { value.reviewedAt = 'not-a-time'; }, selfCommitment: value => { value.artifactCommitment = 'a'.repeat(64); },
  })) {
    const hostile = structuredClone(attestation); mutate(hostile);
    if (!['missing', 'extra', 'epoch', 'manifest', 'selfCommitment'].includes(name)) {
      const { artifactCommitment: _commitment, ...projection } = hostile;
      hostile.artifactCommitment = piiArrivalCommitment(projection);
    }
    assert.throws(() => validatePiiArrivalProtectedEvidence(hostile, expected), /protected evidence/, name);
  }
});

test('unspent protected evidence is forbidden after both public gates pass', () => {
  const { expected, attestation } = unspentFixture();
  assert.throws(() => validatePiiArrivalProtectedEvidence(attestation,
    { ...expected, populationStatus: 'complete', operationalStatus: 'complete' }), /unspent protected evidence/);
  assert.equal(validatePiiArrivalProtectedEvidence(attestation,
    { ...expected, populationStatus: 'complete', operationalStatus: 'regression' }).state, 'unspent');
  assert.equal(validatePiiArrivalProtectedEvidence(attestation,
    { ...expected, populationStatus: 'incomplete', operationalStatus: 'complete' }).state, 'unspent');
});

test('unspent gate derivation keeps measured populations while naming both failed public gates', () => {
  const population = { status: 'incomplete', candidate: { reports: [
    { status: 'measured' }, { status: 'measured' },
  ] } };
  assert.deepEqual(piiArrivalGateStatuses(population, { status: 'regression' }, 'unspent'), {
    identity: 'met', population: 'not-met', protected: 'unresolved', operational: 'not-met',
  });
  assert.deepEqual(piiArrivalGateStatuses({ ...population, status: 'complete' }, { status: 'complete' }, 'completed'), {
    identity: 'met', population: 'met', protected: 'met', operational: 'met',
  });
});

function unspentQualificationFixture() {
  const protectedProjection = { state: 'unspent', attestationCommitment: 'a'.repeat(64) };
  const protectedEvidence = { ...protectedProjection, artifactCommitment: piiBindingArtifactCommitment(protectedProjection) };
  const arrivalProjection = { contractCommitment: '1'.repeat(64), identitySourceCommitment: '2'.repeat(64),
    populationBundleCommitment: '3'.repeat(64), operationalCommitment: '4'.repeat(64), artifactSetCommitment: '5'.repeat(64),
    publicGateStatus: { populationNoRegression: 'not-met', runtimeAndPackageCost: 'not-met' }, protectedEvidence };
  const arrivalEvidence = { ...arrivalProjection, artifactCommitment: piiBindingArtifactCommitment(arrivalProjection) };
  return { family: 'pii:us:ssn', arrivalEvidence, gates: [
    { id: 'population-no-regression', status: 'not-met' }, { id: 'protected-partition', status: 'unresolved' },
    { id: 'runtime-and-package-cost', status: 'not-met' },
  ], status: 'not-qualified', reasonCodes: ['population-no-regression', 'protected-partition', 'runtime-and-package-cost'],
    planCommitment: '6'.repeat(64), artifactCommitment: '7'.repeat(64) };
}

test('unspent qualification binds exact public failures through the sanctioned tuple', () => {
  const row = unspentQualificationFixture();
  assert.equal(validatePiiQualificationArrivalBinding(row), true);
  assert.deepEqual(piiQualificationSanctionedProjection(row), {
    family: 'pii:us:ssn', planCommitment: '6'.repeat(64), artifactCommitment: '7'.repeat(64),
    reasonCodes: ['population-no-regression', 'protected-partition', 'runtime-and-package-cost'],
    arrivalEvidenceCommitment: row.arrivalEvidence.artifactCommitment,
    protectedEvidenceCommitment: row.arrivalEvidence.protectedEvidence.artifactCommitment,
  });
  const mutations = [
    value => { value.gates.find(gate => gate.id === 'population-no-regression').status = 'met'; },
    value => { value.gates.find(gate => gate.id === 'runtime-and-package-cost').status = 'met'; },
    value => { value.gates.find(gate => gate.id === 'protected-partition').status = 'met'; },
    value => { value.arrivalEvidence.publicGateStatus.populationNoRegression = 'met'; },
    value => { value.arrivalEvidence.publicGateStatus.runtimeAndPackageCost = 'met'; },
    value => { value.arrivalEvidence.publicGateStatus.populationNoRegression = 'met';
      value.arrivalEvidence.publicGateStatus.runtimeAndPackageCost = 'met'; },
    value => { value.arrivalEvidence.protectedEvidence.attestationCommitment = 'b'.repeat(64); },
    value => { value.arrivalEvidence.raw = 'forbidden'; },
    value => { value.reasonCodes = ['protected-partition']; },
    value => { value.status = 'qualified'; },
  ];
  for (const mutate of mutations) {
    const hostile = structuredClone(row); mutate(hostile);
    const { artifactCommitment: _arrival, ...arrivalProjection } = hostile.arrivalEvidence;
    hostile.arrivalEvidence.artifactCommitment = piiBindingArtifactCommitment(arrivalProjection);
    assert.equal(validatePiiQualificationArrivalBinding(hostile), false);
  }
});
