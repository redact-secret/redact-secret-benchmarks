import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PII_ORACLE_PLANS, PII_ORACLE_UNAVAILABLE_REASON, PII_PRODUCT_IDENTITY_FORMAT, assertPiiSensitivityClaim, evaluatePiiIdentityOracle,
  piiIdentityOracle, piiOraclePlanCommitment, validatePiiIdentityOracle, validatePiiIdentityOracleProjection, validatePiiOracleFamily,
  validatePiiOracleLabel,
} from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';
import { piiArrivalCommitment, piiArrivalGateStatuses, piiArrivalViewGateStatuses } from '../benchmarks/evaluation/domains/pii/arrival-evidence.ts';
import { piiBindingArtifactCommitment, validQualificationIdentityOracle } from '../benchmarks/evaluation/domains/pii/product-binding.ts';

const FAMILIES = Object.keys(PII_ORACLE_PLANS);
const EVIDENCE = { 'pii:global:network-address': 875, 'pii:global:email': 876, 'pii:global:payment-card': 877, 'pii:global:iban': 878,
  'pii:us:ssn': 879, 'pii:global:phone': 880 };
const SOURCE = 'a'.repeat(40), ARTIFACT = 'b'.repeat(64);
const COMPONENTS = { core: 'c'.repeat(64), node: 'd'.repeat(64), wasm: 'e'.repeat(64) };
const clone = value => structuredClone(value);
const familyOf = (oracle, family) => oracle.families.find(row => row.family === family);
const label = (family, caseId) => familyOf(piiIdentityOracle, family).labels.find(row => row.caseId === caseId);
const publicLane = plan => plan.cases.map(row => ({ id: row.id, publicFinding: row.expected.publicFinding }));
const productEvidence = (plan, mutate = rows => rows) => {
  const oracle = familyOf(piiIdentityOracle, plan.family);
  const observations = mutate(oracle.labels.map(row => ({ id: row.caseId, family: plan.family,
    identity: row.identity === 'valid' ? 'established' : 'unmatched', sensitivity: row.sensitivity })));
  const evidence = { format: PII_PRODUCT_IDENTITY_FORMAT, family: plan.family, contextVocabulary: 'pii-context/v1',
    activationIdentity: `credentials=full;selectors=pii:global;families=${plan.family};vocabulary=pii-context/v1`,
    sourceCommit: SOURCE, artifactSetCommitment: piiArrivalCommitment(COMPONENTS), observations, artifactCommitment: '' };
  evidence.artifactCommitment = piiBindingArtifactCommitment(evidence);
  return evidence;
};
const evaluate = (family, extra = {}) => {
  const plan = PII_ORACLE_PLANS[family];
  return evaluatePiiIdentityOracle({ plan, productSourceCommit: SOURCE, candidateArtifactCommitment: ARTIFACT,
    artifactSetCommitment: piiArrivalCommitment(COMPONENTS), publicObservations: [publicLane(plan), publicLane(plan)], ...extra });
};

test('the committed oracle binds every family 1:1 to the exact plan the frozen qualification evidence used', async () => {
  const oracle = validatePiiIdentityOracle(piiIdentityOracle);
  assert.deepEqual(oracle.families.map(row => row.family).sort(), [...FAMILIES].sort());
  for (const family of FAMILIES) {
    const plan = PII_ORACLE_PLANS[family], entry = familyOf(oracle, family);
    const frozen = JSON.parse(await readFile(`evidence/${EVIDENCE[family]}/pii-family-qualification-v1.json`, 'utf8'));
    assert.equal(entry.planCommitment, frozen.planCommitment, family);
    assert.equal(entry.planCommitment, piiOraclePlanCommitment(plan));
    assert.deepEqual(entry.labels.map(row => row.caseId), plan.cases.map(row => row.id));
  }
});

test('every family has supported sensitive, invalid lookalike and identity-only rows; non-sensitive rows only where an authority exists', () => {
  const cells = Object.fromEntries(FAMILIES.map(family => [family, familyOf(piiIdentityOracle, family).labels.reduce((out, row) => {
    const key = `${row.identity}/${row.sensitivity}`; out[key] = (out[key] ?? 0) + 1; return out;
  }, {})]));
  for (const family of FAMILIES) {
    assert.ok(cells[family]['valid/sensitive'] > 0, `${family} sensitive`);
    assert.ok(cells[family]['invalid/not-established'] > 0, `${family} invalid lookalike`);
    assert.ok(cells[family]['valid/not-established'] > 0 || family === 'pii:global:network-address', `${family} identity-only`);
  }
  // Authority-reserved non-sensitive values: RFC 2606/6761 domains, IANA special-purpose ranges, the Visa test-card
  // suite, NANPA 555-01xx. IBAN and US SSN have no authority-reserved value in pii-v1, so their count is 0 by contract.
  assert.deepEqual(Object.fromEntries(FAMILIES.map(family => [family, cells[family]['valid/non-sensitive'] ?? 0])), {
    'pii:global:network-address': 11, 'pii:global:email': 3, 'pii:global:payment-card': 1, 'pii:global:iban': 0, 'pii:us:ssn': 0,
    'pii:global:phone': 2,
  });
  // Credential/PII overlap: credential URI userinfo never becomes an email identity. PII/PII overlap: a card-shaped
  // value in an SSN field and a phone-shaped card value stay identity-valid but sensitivity-unestablished.
  assert.deepEqual([label('pii:global:email', 'credential-userinfo-collision').identity, label('pii:global:email', 'credential-userinfo-collision').sensitivity],
    ['not-established', 'not-established']);
  assert.equal(label('pii:us:ssn', 'payment-card-field').sensitivity, 'not-established');
  assert.equal(label('pii:global:payment-card', 'phone-like-collision').sensitivity, 'not-established');
});

test('the plan sensitive:false label is now checked and disambiguated into non-sensitive vs not-established', () => {
  const split = Object.fromEntries(['pii:global:payment-card', 'pii:us:ssn', 'pii:global:phone'].map(family =>
    [family, validatePiiOracleFamily(familyOf(piiIdentityOracle, family), PII_ORACLE_PLANS[family]).legacy]));
  assert.deepEqual(split['pii:global:payment-card'], { sensitiveTrue: 5, sensitiveFalseNonSensitive: 1, sensitiveFalseNotEstablished: 13, unlabeled: 0 });
  assert.deepEqual(split['pii:us:ssn'], { sensitiveTrue: 3, sensitiveFalseNonSensitive: 0, sensitiveFalseNotEstablished: 17, unlabeled: 0 });
  assert.deepEqual(split['pii:global:phone'], { sensitiveTrue: 14, sensitiveFalseNonSensitive: 2, sensitiveFalseNotEstablished: 25, unlabeled: 0 });
  const rebind = (family, mutatePlan, mutateOracle = () => {}) => {
    const plan = clone(PII_ORACLE_PLANS[family]); mutatePlan(plan);
    const entry = clone(familyOf(piiIdentityOracle, family)); entry.planCommitment = piiOraclePlanCommitment(plan); mutateOracle(entry, plan);
    return () => validatePiiOracleFamily(entry, plan);
  };
  // sensitive:true on an absence case
  assert.throws(rebind('pii:us:ssn', plan => { plan.cases.find(row => row.id === 'identity-without-context').expected.sensitive = true; }), /sensitive:true/);
  // sensitive:false on a public-finding case
  assert.throws(rebind('pii:global:phone', plan => { plan.cases.find(row => row.id === 'bare-identity').expected.sensitive = false;
    plan.cases[0].expected.sensitive = false; }), /disagrees|contradicts/);
  // oracle says sensitive but the plan expects absence
  assert.throws(rebind('pii:global:payment-card', () => {}, entry => {
    Object.assign(entry.labels.find(row => row.caseId === 'order-reference-collision'), { sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule'] });
  }), /expects absence/);
  // a non-boolean legacy label
  assert.throws(rebind('pii:global:payment-card', plan => { plan.cases[6].expected.sensitive = 'no'; }), /Invalid PII plan sensitive label/);
  // unchanged plan with a stale commitment is not bound
  const stale = clone(familyOf(piiIdentityOracle, 'pii:global:iban')); stale.planCommitment = 'f'.repeat(64);
  assert.throws(() => validatePiiOracleFamily(stale, PII_ORACLE_PLANS['pii:global:iban']), /exact plan/);
});

test('a sensitivity claim resting solely on a validator hit, a context keyword or public absence is rejected', () => {
  const valid = { identity: 'valid' };
  for (const basis of [['validator-hit'], ['context-keyword'], ['public-absence'], ['public-finding'], ['validator-hit', 'context-keyword']])
    for (const sensitivity of ['sensitive', 'non-sensitive'])
      assert.throws(() => assertPiiSensitivityClaim({ ...valid, sensitivity, sensitivityBasis: basis }), undefined, `${sensitivity} ${basis}`);
  assert.throws(() => assertPiiSensitivityClaim({ ...valid, sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule', 'public-absence'] }), /Public absence/);
  assert.throws(() => assertPiiSensitivityClaim({ ...valid, sensitivity: 'non-sensitive', sensitivityBasis: ['authority-reserved-value', 'contract-context-rule'] }), /context rule/);
  assert.throws(() => assertPiiSensitivityClaim({ ...valid, sensitivity: 'not-established', sensitivityBasis: ['context-keyword'] }), /no basis/);
  assert.throws(() => assertPiiSensitivityClaim({ ...valid, sensitivity: 'sensitive', sensitivityBasis: ['vibes'] }), /Invalid PII sensitivity basis/);
  assert.equal(assertPiiSensitivityClaim({ ...valid, sensitivity: 'sensitive', sensitivityBasis: ['contract-context-rule', 'validator-hit', 'context-keyword'] }), true);
  assert.equal(assertPiiSensitivityClaim({ ...valid, sensitivity: 'non-sensitive', sensitivityBasis: ['authority-reserved-value'] }), true);
});

test('impossible identity/sensitivity combinations and unbacked identity labels are rejected', () => {
  const base = { caseId: 'synthetic-case', candidate: { start: 0, end: 4 }, identityBasis: ['contract-grammar'], sensitivityBasis: [] };
  for (const [identity, sensitivity, sensitivityBasis] of [['invalid', 'sensitive', ['contract-context-rule']],
    ['invalid', 'non-sensitive', ['authority-reserved-value']], ['not-established', 'sensitive', ['contract-context-rule']],
    ['not-established', 'non-sensitive', ['authority-reserved-value']]])
    assert.throws(() => validatePiiOracleLabel({ ...base, identity, sensitivity, sensitivityBasis }, null), /Impossible/, `${identity}/${sensitivity}`);
  assert.throws(() => validatePiiOracleLabel({ ...base, identity: 'not-established', sensitivity: 'not-established' }, null), /no candidate or basis/);
  assert.throws(() => validatePiiOracleLabel({ ...base, identity: 'valid', sensitivity: 'not-established', candidate: null }, null), /authored candidate/);
  assert.throws(() => validatePiiOracleLabel({ ...base, identity: 'valid', sensitivity: 'not-established', identityBasis: [] }, null), /authored candidate/);
  assert.throws(() => validatePiiOracleLabel({ ...base, identity: 'valid', sensitivity: 'not-established', score: 0.9 }, null), /Invalid PII oracle label/);
});

test('reference validators are applied to the authored candidate and must agree with the identity label', () => {
  const rebound = (family, caseId, patch) => {
    const entry = clone(familyOf(piiIdentityOracle, family)); Object.assign(entry.labels.find(row => row.caseId === caseId), patch);
    return () => validatePiiOracleFamily(entry, PII_ORACLE_PLANS[family]);
  };
  // Luhn failure relabelled valid
  assert.throws(rebound('pii:global:payment-card', 'luhn-failure-neighbor', { identity: 'valid' }), /reference validator/);
  // SSA-excluded area relabelled valid
  assert.throws(rebound('pii:us:ssn', 'area-666', { identity: 'valid' }), /reference validator/);
  // mod-97 failure without citing the validator
  assert.throws(rebound('pii:global:iban', 'checksum-mismatch', { identityBasis: ['contract-grammar'] }), /reference validator/);
  // N11 exchange relabelled valid; leading-zero IPv4 relabelled valid
  assert.throws(rebound('pii:global:phone', 'n11-central-office', { identity: 'valid' }), /reference validator/);
  assert.throws(rebound('pii:global:network-address', 'ipv4-leading-zero', { identity: 'valid' }), /reference validator/);
  // a candidate shifted off the authored value no longer validates
  assert.throws(rebound('pii:global:payment-card', 'order-reference-collision', { candidate: { start: 17, end: 32 } }), /reference validator/);
  // an identity-valid label must cite the validator, not only the contract
  assert.throws(rebound('pii:us:ssn', 'order-reference', { identityBasis: ['contract-grammar'] }), /reference validator/);
  // a positive's candidate must equal the plan's authored range
  assert.throws(rebound('pii:global:email', 'ascii-sensitive-context', { candidate: { start: 7, end: 40 } }), /public-finding expectation/);
});

test('without the #910 seam every family reports identity-only as typed not-measured and its gate unresolved', () => {
  for (const family of FAMILIES) {
    const projection = evaluate(family);
    assert.equal(projection.gateStatus, 'unresolved', family);
    assert.equal(projection.identityOnly.status, 'not-measured');
    assert.deepEqual(projection.identityOnly.reason, { ...PII_ORACLE_UNAVAILABLE_REASON });
    assert.equal(projection.identityOnly.reason.issue, 'redact-secret/redact-secret#910');
    const plan = PII_ORACLE_PLANS[family];
    assert.equal(projection.identityOnly.eligibleCases, plan.cases.filter(row => !row.expected.publicFinding).length);
    const cell = (sensitivity, outcome) => projection.publicStream.find(row => row.sensitivity === sensitivity && row.outcome === outcome).cases;
    assert.equal(cell('sensitive', 'missed'), 0);
    assert.equal(cell('non-sensitive', 'false-alarm') + cell('not-established', 'false-alarm'), 0);
    assert.equal(projection.binding.productIdentityCommitment, null);
    // public projection: no case id, value or span leaks
    const text = JSON.stringify(projection);
    for (const row of plan.cases) {
      assert.ok(!text.includes(`"${row.id}"`), `${family} leaks case id`);
      assert.ok(!text.includes(row.input), `${family} leaks input`);
    }
    assert.ok(!/"(?:start|end|caseId|candidate|input|score|confidence|threshold)"/.test(text));
  }
});

test('public absence alone never moves a case out of identity-only not-measured', () => {
  const projection = evaluate('pii:global:email');
  const truth = projection.authoredTruth.cells.find(row => row.identity === 'valid' && row.sensitivity === 'non-sensitive').cases;
  assert.equal(truth, 3);
  assert.equal(projection.identityOnly.status, 'not-measured');
  assert.ok(!('outcomes' in projection.identityOnly));
});

test('a public finding on an authored non-sensitive case counts as a false alarm, and lanes must agree', () => {
  const plan = PII_ORACLE_PLANS['pii:global:payment-card'];
  const lane = publicLane(plan).map(row => row.id === 'official-test-whole-value-negative' ? { ...row, publicFinding: true } : row);
  const projection = evaluatePiiIdentityOracle({ plan, productSourceCommit: SOURCE, candidateArtifactCommitment: ARTIFACT, publicObservations: [lane, lane] });
  assert.equal(projection.publicStream.find(row => row.sensitivity === 'non-sensitive' && row.outcome === 'false-alarm').cases, 1);
  assert.throws(() => evaluatePiiIdentityOracle({ plan, productSourceCommit: SOURCE, candidateArtifactCommitment: ARTIFACT,
    publicObservations: [lane, publicLane(plan)] }), /disagree across installed lanes/);
  assert.throws(() => evaluatePiiIdentityOracle({ plan, productSourceCommit: SOURCE, candidateArtifactCommitment: ARTIFACT,
    publicObservations: [lane.slice(1)] }), /one-to-one/);
});

test('seam evidence, once it exists, is admitted only in exact bound form and drives the gate', () => {
  const family = 'pii:global:phone', plan = PII_ORACLE_PLANS[family];
  const met = evaluate(family, { productIdentity: productEvidence(plan) });
  assert.equal(met.gateStatus, 'met');
  assert.equal(met.identityOnly.status, 'measured');
  assert.equal(met.identityOnly.outcomes.find(row => row.outcome === 'correct').cases, met.identityOnly.eligibleCases);
  // a recognized non-sensitive 555-01xx control reported as unmatched is an identity miss
  const missed = evaluate(family, { productIdentity: productEvidence(plan, rows => rows.map(row =>
    row.id === 'reserved-555-control-lower' ? { ...row, identity: 'unmatched', sensitivity: 'not-established' } : row)) });
  assert.equal(missed.gateStatus, 'not-met');
  assert.equal(missed.identityOnly.outcomes.find(row => row.outcome === 'identity-missed').cases, 1);
  // an N11 lookalike reported as established is over-acceptance
  const over = evaluate(family, { productIdentity: productEvidence(plan, rows => rows.map(row =>
    row.id === 'n11-area-code' ? { ...row, identity: 'established' } : row)) });
  assert.equal(over.identityOnly.outcomes.find(row => row.outcome === 'identity-over-accepted').cases, 1);
  // recognized but with the wrong sensitivity
  const mismatch = evaluate(family, { productIdentity: productEvidence(plan, rows => rows.map(row =>
    row.id === 'bare-identity' ? { ...row, sensitivity: 'non-sensitive' } : row)) });
  assert.equal(mismatch.identityOnly.outcomes.find(row => row.outcome === 'sensitivity-mismatch').cases, 1);
  // source/artifact equivalence: seam says sensitive where the installed artifact emitted nothing
  assert.throws(() => evaluate(family, { productIdentity: productEvidence(plan, rows => rows.map(row =>
    row.id === 'bare-identity' ? { ...row, sensitivity: 'sensitive' } : row)) }), /disagrees with the installed artifact/);
  // raw score surface, impossible state, wrong candidate, stale commitment
  const scored = productEvidence(plan, rows => rows.map(row => ({ ...row, confidence: 'high' })));
  assert.throws(() => evaluate(family, { productIdentity: scored }), /Invalid PII product identity observation/);
  const impossible = productEvidence(plan, rows => rows.map(row => row.id === 'n11-area-code' ? { ...row, sensitivity: 'non-sensitive' } : row));
  assert.throws(() => evaluate(family, { productIdentity: impossible }), /Impossible/);
  const other = { ...productEvidence(plan), sourceCommit: 'f'.repeat(40) }; other.artifactCommitment = piiBindingArtifactCommitment(other);
  assert.throws(() => evaluate(family, { productIdentity: other }), /not bound/);
  const stale = { ...productEvidence(plan), activationIdentity: 'credentials=full;vocabulary=pii-context/v1;x' };
  assert.throws(() => evaluate(family, { productIdentity: stale }), /not bound/);
});

test('the public projection validator rejects extra fields, free-text reasons and inconsistent gates', () => {
  const projection = evaluate('pii:us:ssn');
  const recommit = value => { value.artifactCommitment = piiBindingArtifactCommitment(value); return value; };
  assert.throws(() => validatePiiIdentityOracleProjection(recommit({ ...clone(projection), cases: [] })));
  const reason = clone(projection); reason.identityOnly.reason.code = 'we did not look'; recommit(reason);
  assert.throws(() => validatePiiIdentityOracleProjection(reason));
  const gate = clone(projection); gate.gateStatus = 'met'; recommit(gate);
  assert.throws(() => validatePiiIdentityOracleProjection(gate));
  const span = clone(projection); span.authoredTruth.cells[0].start = 4; recommit(span);
  assert.throws(() => validatePiiIdentityOracleProjection(span));
  const tampered = clone(projection); tampered.publicStream[0].cases += 1;
  assert.throws(() => validatePiiIdentityOracleProjection(tampered));
});

test('US SSN population gates are independent signals, unlike the frozen v1 derivation', async () => {
  const bundle = JSON.parse(await readFile('evidence/879/pii-population-arrival-v1.json', 'utf8'));
  // Frozen v1 derivation: identity-only, diagnostic and benign-heavy all read one "every report measured" signal.
  assert.equal(piiArrivalGateStatuses(bundle, { status: 'regression' }, 'unspent').identity, 'met');
  const v2 = piiArrivalViewGateStatuses(bundle, { status: 'regression' }, 'unspent');
  assert.deepEqual(v2, { diagnostic: 'met', benignHeavy: 'not-met', population: 'not-met', protected: 'unresolved', operational: 'not-met' });
  assert.ok(!('identity' in v2));
  const missing = { ...bundle, comparisons: bundle.comparisons.filter(row => row.population !== 'diagnostic-balanced') };
  assert.equal(piiArrivalViewGateStatuses(missing, { status: 'complete' }, 'unspent').diagnostic, 'unresolved');
  const partial = clone(bundle); partial.candidate.reports.find(row => row.population === 'benign-heavy-stress').status = 'partial';
  assert.equal(piiArrivalViewGateStatuses(partial, { status: 'complete' }, 'unspent').benignHeavy, 'unresolved');
  // The US SSN identity-only gate now comes from the oracle and stays unresolved without the #910 seam.
  assert.equal(evaluate('pii:us:ssn').gateStatus, 'unresolved');
});

test('a schemaVersion 2 qualification must bind its oracle projection and take its identity gate from it', () => {
  const projection = evaluate('pii:global:iban');
  const row = { family: 'pii:global:iban', planCommitment: projection.binding.planCommitment,
    product: { sourceCommit: SOURCE, artifactCommitment: ARTIFACT }, gates: [{ id: 'identity-only-classification', status: 'unresolved' }],
    identityOracle: projection };
  assert.equal(validQualificationIdentityOracle(row), true);
  assert.equal(validQualificationIdentityOracle({ ...row, gates: [{ id: 'identity-only-classification', status: 'met' }] }), false);
  assert.equal(validQualificationIdentityOracle({ ...row, planCommitment: 'f'.repeat(64) }), false);
  assert.equal(validQualificationIdentityOracle({ ...row, family: 'pii:us:ssn' }), false);
  assert.equal(validQualificationIdentityOracle({ ...row, product: { ...row.product, artifactCommitment: 'f'.repeat(64) } }), false);
  assert.equal(validQualificationIdentityOracle({ ...row, identityOracle: undefined }), false);
});
