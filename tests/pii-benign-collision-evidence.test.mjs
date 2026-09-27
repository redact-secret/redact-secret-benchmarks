import test from 'node:test';
import assert from 'node:assert/strict';
import { piiDomain } from '../benchmarks/evaluation/domains/pii/contract.ts';
import {
  loadPiiBenignCollisionCases, materializePiiEvidenceCandidate, piiBenignCollisionCommitment,
  piiBenignCollisionEvidence, validatePiiBenignCollisionEvidence,
} from '../benchmarks/evaluation/domains/pii/benign-collision-evidence.ts';
import {
  PII_BENIGN_COLLISION_EVIDENCE_CLASSES, PII_EVIDENCE_ACCOUNTING_CLASSES,
} from '../benchmarks/evaluation/domains/pii/benign-collision-classes.ts';
import { PII_CONTROL_CLASSES, accountPiiRows, piiAccountingRowsFromEvaluation } from '../benchmarks/evaluation/domains/pii/accounting.ts';
import { PII_VALIDATOR_CONSUMERS } from '../benchmarks/evaluation/domains/pii/validator-qualification.ts';
import { createPiiValidators } from '../benchmarks/evaluation/domains/pii/validators.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

const recommit = corpus => { corpus.contentCommitment = piiBenignCollisionCommitment(corpus); return corpus; };
const authority = supports => [{ sourceKind: 'public-authority', sourceId: 'synthetic-public-authority',
  locator: 'https://example.invalid/pii-evidence', revision: '1', supports }];
const generator = seed => ({ kind: 'deterministic-synthetic', sources: [],
  generator: { id: 'sha256-pattern', version: 1, seedCommitment: hash(seed) } });
const fixture = (seed, pattern = 'DDDD') => ({ prefix: 'value=', suffix: '',
  candidate: { kind: 'deterministic-pattern', generator: 'sha256-pattern', seed, pattern } });
const descriptor = (family, displayName, identityDomain, scope, validator, supports) =>
  ({ family, displayName, identityDomain, scope, validator, authority: authority(supports) });

function addEntry(corpus, entry) {
  entry.candidateCommitment = hash(materializePiiEvidenceCandidate(entry));
  corpus.entries.push(entry);
}

function extension() {
  const corpus = structuredClone(piiBenignCollisionEvidence);
  corpus.families.push(
    descriptor('pii:global:email', 'Synthetic email evidence', 'email', 'global', null,
      ['lexical', 'validation', 'reserved-control', 'sensitivity']),
    descriptor('pii:us:synthetic-national-id', 'Synthetic US national identifier', 'national-id', 'jurisdiction:US',
      { id: 'luhn', version: 1 }, ['lexical', 'validation', 'allocation', 'reserved-control', 'sensitivity']),
    descriptor('pii:global:synthetic-national-id', 'Synthetic global national identifier', 'national-id', 'global',
      { id: 'luhn', version: 1 }, ['lexical', 'validation', 'reserved-control', 'sensitivity']),
  );
  addEntry(corpus, {
    id: 'future-context-negative', caseId: 'future-context-negative', evidenceClass: 'context-negative', accountingClass: 'context-negative',
    family: 'pii:global:email', scope: 'global', identityDomain: 'email', language: 'en', candidateCommitment: '',
    fixture: fixture('future-context-negative', 'AAAA.DDDD'), typeExpectation: 'valid', sensitivityExpectation: 'non-sensitive', validator: null,
    contextGroup: 'en-email-core', context: { obligation: 'required-for-sensitive-classification', class: 'non-sensitive' },
    collision: null, provenance: generator('future-context-negative'),
  });
  addEntry(corpus, {
    id: 'future-near-miss', caseId: 'future-near-miss', evidenceClass: 'near-miss', accountingClass: null,
    family: 'pii:us:synthetic-national-id', scope: 'jurisdiction:US', identityDomain: 'national-id', language: 'en', candidateCommitment: '',
    fixture: fixture('future-near-miss'), typeExpectation: 'invalid', sensitivityExpectation: 'not-established',
    validator: { id: 'luhn', version: 1, expected: 'invalid' }, contextGroup: null, context: { obligation: 'none', class: 'neutral' },
    collision: null, provenance: generator('future-near-miss'),
  });
  addEntry(corpus, {
    id: 'future-family-collision', caseId: 'future-family-collision', evidenceClass: 'cross-family-collision', accountingClass: null,
    family: 'pii:us:synthetic-national-id', scope: 'jurisdiction:US', identityDomain: 'national-id', language: 'en', candidateCommitment: '',
    fixture: fixture('future-family-collision'), typeExpectation: 'valid', sensitivityExpectation: 'non-sensitive',
    validator: { id: 'luhn', version: 1, expected: 'valid' }, contextGroup: null, context: { obligation: 'none', class: 'non-sensitive' },
    collision: {
      target: { family: 'pii:us:synthetic-national-id', scope: 'jurisdiction:US', validator: { id: 'luhn', version: 1, expected: 'valid' } },
      competitors: [{ family: 'pii:global:synthetic-national-id', scope: 'global', validator: { id: 'luhn', version: 1, expected: 'valid' } }],
      expectedOutcomes: { family: 'wrong-family', jurisdiction: 'wrong-jurisdiction', sensitivity: 'non-sensitive' },
    }, provenance: generator('future-family-collision'),
  });
  return recommit(corpus);
}

const consumerMap = { schemaVersion: 1, mappings: [
  { validator: { id: 'luhn', version: 1 }, families: ['pii:global:synthetic-national-id', 'pii:us:synthetic-national-id'] },
  PII_VALIDATOR_CONSUMERS.mappings.find(row => row.validator.id === 'iban-mod97'),
] };
const validationOptions = { canonical: false, consumerMap };

test('authored eight-class vocabulary remains distinct from the explicit lossy pii-v1 accounting mapping', () => {
  assert.equal(piiBenignCollisionEvidence.entries.length, 0, 'no fake production collision or country rows');
  assert.deepEqual(piiBenignCollisionEvidence.classes.map(row => row.id), [...PII_BENIGN_COLLISION_EVIDENCE_CLASSES]);
  assert.deepEqual(piiBenignCollisionEvidence.classes.map(row => row.accountingClasses),
    PII_BENIGN_COLLISION_EVIDENCE_CLASSES.map(id => [...PII_EVIDENCE_ACCOUNTING_CLASSES[id]]));
  assert.deepEqual([...new Set(piiBenignCollisionEvidence.classes.flatMap(row => row.accountingClasses))], [...PII_CONTROL_CLASSES]);
  assert.deepEqual(PII_EVIDENCE_ACCOUNTING_CLASSES['public-identifier'], ['public-operational']);
  assert.deepEqual(PII_EVIDENCE_ACCOUNTING_CLASSES['ordinary-reference-account'], ['public-operational']);
  assert.deepEqual(PII_EVIDENCE_ACCOUNTING_CLASSES['near-miss'], []);
  assert.equal(piiBenignCollisionEvidence.reporting.evidenceClasses, 'evidenceByClass');
  assert.equal(piiBenignCollisionEvidence.contentCommitment, piiBenignCollisionCommitment(piiBenignCollisionEvidence));
});

test('data rows deterministically compose validated executable cases and preserve safe identities through accounting', async () => {
  const corpus = validatePiiBenignCollisionEvidence(extension(), validationOptions);
  const cases = loadPiiBenignCollisionCases(corpus, validationOptions);
  assert.equal(cases.length, corpus.entries.length, 'no inert evidence rows');
  assert.deepEqual(cases.map(row => row.method), ['pii-benign', 'type-validation', 'jurisdiction-collision']);
  const values = new Map(corpus.entries.map(entry => [materializePiiEvidenceCandidate(entry), entry.validator?.expected]));
  const validators = createPiiValidators([{ id: 'luhn', version: 1, validate(value) { return { state: values.get(value) ?? 'invalid' }; } }]);
  const methods = piiDomain.configure({ evidence: corpus, evidenceValidation: validationOptions, validators }).createMethods();
  for (const source of cases) {
    const method = methods.get(source.method), variants = method.generate(source);
    assert.ok(variants.every(variant => variant.transformation.methodVersion === method.version));
    assert.equal(variants[0].evidence.evidenceId, source.metadata.evidenceId);
    assert.equal(variants[0].evidence.evidenceClass, source.metadata.evidenceClass);
    assert.equal(variants[0].evidence.accountingClass, source.metadata.accountingClass);
  }
  const byId = new Map(cases.map(row => [row.id, row]));
  const scanner = { id: 'evidence-scanner', mode: 'test', capabilities: { ranges: true, classification: true }, configuration: { fixture: true },
    async version() { return '1.0.0'; }, async scan(_directory, inputs) { return inputs.flatMap(input => {
      const source = byId.get(input.id); return source?.method === 'jurisdiction-collision' ? [{ path: input.path, ...source.candidate,
        family: source.contract.family, jurisdiction: 'US', sensitive: false }] : [];
    }); } };
  const artifact = await piiDomain.execute({ cases, methods, scanners: [scanner], runId: '00000000-0000-4000-8000-000000000269' });
  const rows = piiAccountingRowsFromEvaluation(artifact), report = accountPiiRows(rows);
  assert.deepEqual(rows.map(row => row.methodEvidence.evidenceClass).sort(), ['context-negative', 'cross-family-collision', 'near-miss']);
  const nearMissRow = rows.find(row => row.methodEvidence.evidenceClass === 'near-miss');
  assert.deepEqual(nearMissRow.methodEvidence.validatorEvidence,
    [{ family: 'pii:us:synthetic-national-id', id: 'luhn', version: 1, expected: 'invalid', observed: 'invalid' }]);
  const collisionRow = rows.find(row => row.methodEvidence.evidenceClass === 'cross-family-collision');
  assert.deepEqual(collisionRow.methodEvidence.validatorEvidence.map(row => [row.family, row.id, row.version, row.expected, row.observed]), [
    ['pii:us:synthetic-national-id', 'luhn', 1, 'valid', 'valid'],
    ['pii:global:synthetic-national-id', 'luhn', 1, 'valid', 'valid'],
  ]);
  assert.equal(report.evidenceByClass['context-negative'].cases, 1);
  assert.equal(report.evidenceByClass['near-miss'].cases, 1);
  assert.equal(report.evidenceByClass['cross-family-collision'].cases, 1);
  assert.deepEqual(report.evidenceByClass['public-identifier'].accountingClasses, ['public-operational']);
  const safe = JSON.stringify({ artifact, rows, report });
  for (const entry of corpus.entries) assert.doesNotMatch(safe, new RegExp(materializePiiEvidenceCandidate(entry)));
  assert.doesNotMatch(safe, /"content"|"candidate"|"seed"|"pattern"/);
});

test('standard domain configuration executes data-only evidence additions with cases and methods bound to one corpus', async () => {
  const corpus = validatePiiBenignCollisionEvidence(extension(), validationOptions);
  const values = new Map(corpus.entries.map(entry => [materializePiiEvidenceCandidate(entry), entry.validator?.expected]));
  const validators = createPiiValidators([{ id: 'luhn', version: 1, validate(value) { return { state: values.get(value) ?? 'invalid' }; } }]);
  const domain = piiDomain.configure({ evidence: corpus, evidenceValidation: validationOptions, validators });
  const cases = domain.loadCases();
  for (const entry of corpus.entries) assert.ok(cases.some(source => source.id === entry.caseId), `missing executable case for ${entry.id}`);
  assert.ok(cases.some(source => source.method === 'schema-only'));
  assert.ok(cases.some(source => source.method === 'context-discrimination'));

  const byId = new Map(cases.map(source => [source.id, source]));
  const scanner = { id: 'configured-domain-scanner', mode: 'test', capabilities: { ranges: true, classification: true }, configuration: { fixture: true },
    async version() { return '1.0.0'; }, async scan(_directory, inputs) { return inputs.flatMap(input => {
      const source = byId.get(input.id); return source?.method === 'jurisdiction-collision' ? [{ path: input.path, ...source.candidate,
        family: source.contract.family, jurisdiction: 'US', sensitive: false }] : [];
    }); } };
  const artifact = await domain.execute({ cases, methods: domain.createMethods(), scanners: [scanner],
    runId: '00000000-0000-4000-8000-000000002269' });
  for (const entry of corpus.entries) assert.ok(artifact.results.some(result => result.id === entry.caseId), `evidence row was not executed: ${entry.id}`);
  const safe = JSON.stringify(artifact);
  for (const entry of corpus.entries) assert.doesNotMatch(safe, new RegExp(materializePiiEvidenceCandidate(entry)));
});

test('collision descriptors stay in one identity domain and require an independently valid competitor', () => {
  const crossDomain = extension(), competitor = crossDomain.entries.find(row => row.evidenceClass === 'cross-family-collision').collision.competitors[0];
  crossDomain.families.find(row => row.family === competitor.family).identityDomain = 'email';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(crossDomain), validationOptions), /one identity domain/);
  const allInvalid = extension();
  allInvalid.entries.find(row => row.evidenceClass === 'cross-family-collision').collision.competitors[0].validator.expected = 'invalid';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(allInvalid), validationOptions), /collision target identity/);
});

test('hostile case, validator, context, fixture, and class mutations fail closed', () => {
  const committed = extension();
  const remapped = structuredClone(committed); remapped.classes.find(row => row.id === 'public-identifier').accountingClasses = ['reserved'];
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(remapped), validationOptions), /class or accounting-class mapping/);
  const raw = structuredClone(committed); raw.entries[0].rawCandidate = 'forbidden';
  assert.throws(() => validatePiiBenignCollisionEvidence(raw, validationOptions), /schema/);
  const candidate = structuredClone(committed); candidate.entries[0].fixture.candidate.seed = 'changed-seed';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(candidate), validationOptions), /candidate commitment|generator provenance/);
  const context = structuredClone(committed); context.entries[0].language = 'ko';
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(context), validationOptions), /context identity/);
  const version = structuredClone(committed); version.entries.find(row => row.evidenceClass === 'near-miss').validator.version = 2;
  assert.throws(() => validatePiiBenignCollisionEvidence(recommit(version), validationOptions), /unregistered validator/);

  const corpus = validatePiiBenignCollisionEvidence(committed, validationOptions), cases = loadPiiBenignCollisionCases(corpus, validationOptions);
  const nullValidator = structuredClone(cases.find(row => row.method === 'type-validation'));
  nullValidator.contract.typeExpectation.validator = null;
  const validators = createPiiValidators([{ id: 'luhn', version: 1, validate() { return { state: 'invalid' }; } }]);
  const methods = piiDomain.configure({ evidence: corpus, evidenceValidation: validationOptions, validators }).createMethods();
  assert.throws(() => methods.get('type-validation').generate(nullValidator), /requires a validator|case identity/);
  const wrongScope = structuredClone(cases.find(row => row.method === 'jurisdiction-collision'));
  wrongScope.contract.scope = 'global'; wrongScope.contract.family = 'pii:global:synthetic-national-id';
  assert.throws(() => methods.get('jurisdiction-collision').generate(wrongScope), /evidence case identity|collision/);
});
