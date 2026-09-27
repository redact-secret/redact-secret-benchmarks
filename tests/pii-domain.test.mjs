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
import { PII_JURISDICTION_STANDARD } from '../benchmarks/evaluation/domains/pii/jurisdictions.ts';
import { piiBenignCollisionEvidence } from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';

const scanner = {
  id: 'pii-test-scanner', mode: 'candidate', capabilities: { ranges: true, classification: true },
  configuration: { fixture: true }, async version() { return '1.0.0'; },
  async scan(_directory, inputs) { return inputs.flatMap(input => {
    const value = ['person@example.invalid', 'subject@example.invalid'].find(candidate => input.content.includes(candidate));
    if (!value) return [];
    const characterStart = input.content.indexOf(value), start = Buffer.byteLength(input.content.slice(0, characterStart));
    return [{ path: input.path, start, end: start + Buffer.byteLength(value),
      family: 'pii:global:email', sensitive: false, diagnostic: 'RAW-SENTINEL-MUST-DROP' }];
  }); },
};

test('standard PII domain corpus runs through shared runtime with independent axes and no support claim', async () => {
  const cases = piiDomain.loadCases();
  const artifact = await piiDomain.execute({ cases, methods: piiDomain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000000277', provenance: { sourceRevision: 'd'.repeat(64) } });
  assert.equal(artifact.domain, 'pii');
  assert.equal(artifact.evaluationProfile, 'pii-schema-v1');
  assert.equal(artifact.domainAccountingVersion, 'pii-observation-v1');
  assert.equal(artifact.supportClaims, false);
  assert.equal(artifact.caseCount, cases.length);
  assert.equal(artifact.variantCount, 2 + piiDomain.contextEvidence.piiContextEvidence.groups.reduce((sum, group) => sum + group.frames.length, 0) +
    piiBenignCollisionEvidence.entries.length);
  assert.equal(artifact.assertionCount, artifact.variantCount * 2);
  const statuses = ['pass', 'fail', 'review-required', 'not-measured'];
  assert.equal(statuses.reduce((sum, status) => sum + artifact.typeIdentity[status], 0), artifact.variantCount);
  assert.equal(statuses.reduce((sum, status) => sum + artifact.sensitivityContext[status], 0), artifact.variantCount);
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
  assert.equal(artifact.typeIdentity['not-measured'], artifact.variantCount);
  assert.equal(artifact.sensitivityContext['not-measured'], artifact.variantCount);

  const unclassified = { ...scanner, id: 'unclassified', async scan(_directory, inputs) {
    return inputs.map(input => ({ path: input.path, start: 11, end: 34, sensitive: true }));
  } };
  const second = await piiDomain.execute({ cases: piiDomain.loadCases(), methods: piiDomain.createMethods(), scanners: [unclassified] });
  assert.equal(second.typeIdentity['not-measured'], second.variantCount);
});

test('PII contract rejects invalid scope, authority source, profile, and visibility enums', () => {
  assert.deepEqual(PII_JURISDICTION_STANDARD, {
    id: 'ISO-3166-1-alpha-2', revision: 'ISO/TC-46-N1127-2024-02-29', codeCount: 249,
  });
  const base = piiDomain.loadCases()[0];
  const future = structuredClone(piiDomain.loadCases()[1]);
  future.contract.scope = 'jurisdiction:CA';
  future.contract.family = 'pii:ca:sin';
  future.contract.displayName = 'Canadian national identifier';
  assert.doesNotThrow(() => piiDomain.validateCase(future));
  const unknown = structuredClone(future);
  unknown.contract.scope = 'jurisdiction:ZZ';
  unknown.contract.family = 'pii:zz:sin';
  assert.throws(() => piiDomain.validateCase(unknown), /Invalid PII scope/);
  for (const invalid of [
    { ...base, visibility: 'public' },
    { ...base, contract: { ...base.contract, scope: 'jurisdiction:ca' } },
    { ...base, contract: { ...base.contract, scope: 'jurisdiction:USA' } },
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

test('PII finding identity couples family and jurisdiction while missing jurisdiction stays not measured', async () => {
  const [globalCase, jurisdictionCase] = piiDomain.loadCases();
  const findingScanner = (id, finding) => ({ ...scanner, id, async scan() { return [finding]; } });
  const globalMismatch = await piiDomain.execute({ cases: [globalCase], methods: piiDomain.createMethods(), scanners: [findingScanner('global-with-country', {
    path: globalCase.input.path, ...globalCase.candidate, family: 'pii:global:email', jurisdiction: 'BR', sensitive: false,
  })] });
  assert.equal(globalMismatch.scanners[0].status, 'error');
  assert.equal(globalMismatch.results[0].outcomes[0].typeIdentity.state, 'not-measured');
  const countryMismatch = await piiDomain.execute({ cases: [jurisdictionCase], methods: piiDomain.createMethods(), scanners: [findingScanner('country-mismatch', {
    path: jurisdictionCase.input.path, ...jurisdictionCase.candidate, family: 'pii:us:ssn', jurisdiction: 'BR', sensitive: false,
  })] });
  assert.equal(countryMismatch.scanners[0].status, 'error');
  assert.equal(countryMismatch.results[0].outcomes[0].typeIdentity.state, 'not-measured');
  const unknownCountry = await piiDomain.execute({ cases: [jurisdictionCase], methods: piiDomain.createMethods(), scanners: [findingScanner('unknown-country', {
    path: jurisdictionCase.input.path, ...jurisdictionCase.candidate, family: 'pii:zz:ssn', sensitive: false,
  })] });
  assert.equal(unknownCountry.scanners[0].status, 'error');

  const canadianCase = structuredClone(jurisdictionCase);
  canadianCase.contract.family = 'pii:ca:sin';
  canadianCase.contract.scope = 'jurisdiction:CA';
  canadianCase.contract.displayName = 'Canadian national identifier';
  canadianCase.contract.typeExpectation.state = 'valid';
  const canadian = await piiDomain.execute({ cases: [canadianCase], methods: piiDomain.createMethods(), scanners: [findingScanner('canadian-family', {
    path: canadianCase.input.path, ...canadianCase.candidate, family: 'pii:ca:sin', jurisdiction: 'CA', sensitive: false,
  })] });
  assert.equal(canadian.scanners[0].status, 'complete');
  assert.equal(canadian.results[0].outcomes[0].typeIdentity.state, 'correct');

  const validJurisdictionCase = structuredClone(jurisdictionCase);
  validJurisdictionCase.contract.typeExpectation.state = 'valid';
  const absent = await piiDomain.execute({ cases: [validJurisdictionCase], methods: piiDomain.createMethods(), scanners: [findingScanner('country-absent', {
    path: validJurisdictionCase.input.path, ...validJurisdictionCase.candidate, family: 'pii:us:ssn', sensitive: false,
  })] });
  assert.deepEqual(absent.results[0].outcomes[0].typeIdentity, {
    axis: 'type-identity', status: 'not-measured', state: 'not-measured', reason: 'The scanner did not provide jurisdiction identity.',
  });
});

test('global and jurisdictional assessments flow through evaluation into a safe support projection', async () => {
  const cases = piiDomain.loadCases();
  const artifact = await piiDomain.execute({ cases, methods: piiDomain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000000268' });
  const matrix = piiDomain.support.projectPiiSupportMatrix(artifact, cases);
  assert.equal(matrix.supportClaims, false);
  assert.deepEqual(matrix.entries.map(entry => [entry.assessment.family, entry.assessment.scope]),
    cases.map(source => [source.contract.family, source.contract.scope]));
  assert.deepEqual(matrix.entries.map(entry => entry.assessment.identityDomain), cases.map(source => source.contract.identityDomain));
  assert.ok(matrix.entries.every(entry => entry.assessment.qualificationProfile.id === 'pii-v1'));
  assert.ok(matrix.entries.every(entry => entry.assessment.authority.every(source => source.supports.length > 0)));
  const serialized = JSON.stringify(matrix);
  assert.doesNotMatch(serialized, /person@example\.invalid|000-00-0000|contact=|national_id=|\.txt|"content"|"candidate"|"seed"/);
  assert.throws(() => validatePiiAssessment({ ...structuredClone(matrix.entries[1].assessment), scope: 'jurisdiction:ZZ', family: 'pii:zz:ssn' }), /Invalid/);
  assert.throws(() => validatePiiAssessment({ ...structuredClone(matrix.entries[0].assessment), family: 'synthetic-person-id' }), /Invalid/);
  assert.throws(() => validatePiiSupportMatrix({ ...structuredClone(matrix), extra: true }), /Invalid/);
  const inconsistent = structuredClone(matrix); inconsistent.entries[0].observations[0].typeIdentity.pass--;
  assert.throws(() => validatePiiSupportMatrix(inconsistent), /Inconsistent/);
  const stale = structuredClone(artifact); stale.results[0].assessment.scope = 'jurisdiction:US';
  assert.throws(() => piiDomain.support.projectPiiSupportMatrix(stale, cases), /stale/);

  const hostileMutations = [
    value => { value.results[0].outcomes[0].raw = 'RAW-SENTINEL-MUST-DROP'; },
    value => { value.results[0].outcomes[0].typeIdentity.axis = 'sensitivity-context'; },
    value => { value.results[0].outcomes[0].typeIdentity.status = 'fail'; },
    value => { value.results[0].outcomes[0].scanner = 'injected-scanner'; },
    value => { value.results[0].outcomes[0].variant = 'injected-variant'; },
    value => { value.results[0].variants[0].expectation.type = 'maybe'; },
    value => { value.results[0].variants[0].expectation.raw = 'RAW-SENTINEL-MUST-DROP'; },
  ];
  for (const mutate of hostileMutations) {
    const hostile = structuredClone(artifact); mutate(hostile);
    assert.throws(() => piiDomain.support.projectPiiSupportMatrix(hostile, cases), /PII/);
  }
});

test('generic registry preserves PII domain identity without credential casts', () => {
  const registry = defineEvaluationDomains({ pii: piiDomain });
  assert.equal(registry.pii.domain, 'pii');
  assert.equal(registry.pii.createMethods().get('schema-only').id, 'schema-only');
  assert.deepEqual(evaluationDomainIds(), ['credential', 'credential-policy', 'pii']);
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
