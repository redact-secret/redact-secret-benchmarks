import { historicalArchive, historicalReplayOptions, historicalBytes } from './helpers/historical-evidence-archive.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  IBAN_REGISTRY_103_LENGTHS, VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS, VISA_ACCEPTANCE_UNSUPPORTED_BRAND_TEST_PANS, ibanCheckDigits, ibanIdentity,
  ibanMod97Remainder, luhnValid, paymentBrand, paymentCardIdentity,
} from '../benchmarks/evaluation/domains/pii/card-iban-stress/contract-model.ts';
import { STRESS_PLAN_FILES, buildStressPlan } from '../benchmarks/evaluation/domains/pii/card-iban-stress/authoring.ts';
import {
  STRESS_FAMILIES, scoreLane, stressIndependence, stressOracle, stressPlans, validateStressPlan, validateStressPlans,
} from '../benchmarks/evaluation/domains/pii/card-iban-stress/stress.ts';
import { PII_ORACLE_PLANS, piiIdentityOracle, validatePiiIdentityOracle } from '../benchmarks/evaluation/domains/pii/identity-oracle.ts';

const clone = value => structuredClone(value);
const card = () => clone(stressPlans['pii:global:payment-card']), iban = () => clone(stressPlans['pii:global:iban']);

test('#425 stress plans regenerate byte for byte from their authored truth', async () => {
  for (const family of STRESS_FAMILIES)
    assert.equal(await readFile(STRESS_PLAN_FILES[family], 'utf8'), `${JSON.stringify(buildStressPlan(family), null, 2)}\n`);
});

test('#425 stress plans validate, and the shared #423 oracle validator accepts their labels', () => {
  const { results, oracle } = validateStressPlans();
  assert.deepEqual(results.map(row => row.plan.family), STRESS_FAMILIES);
  assert.deepEqual(oracle.families.map(row => row.family), STRESS_FAMILIES);
  // The frozen #423 oracle and v1 plans are untouched by this addition.
  assert.equal(validatePiiIdentityOracle(piiIdentityOracle, PII_ORACLE_PLANS).families.length, 6);
  for (const plan of Object.values(stressPlans)) {
    assert.equal(plan.parentLedger.contentCommitment, '7fcbba702d93849ce1452ee5a9adf3d20e493179107ec0c6bbda36cb9e5fd116');
    assert.deepEqual(plan.axes.map(axis => axis.order), plan.family === 'pii:global:payment-card' ? [12, 13, 14, 15, 16, 17, 18] : [19, 20, 21, 22]);
  }
});

test('the contract model follows the frozen payment-card-v1 grammar at every range edge', () => {
  for (const value of VISA_ACCEPTANCE_SUPPORTED_BRAND_TEST_PANS) {
    assert.ok(luhnValid(value));
    assert.equal(paymentCardIdentity(value).identity, 'valid');
    assert.equal(paymentCardIdentity(value).authorityTestValue, true);
  }
  // The published Discover test value is admitted only as an exact whole value: 601111 is outside the positive table.
  assert.equal(paymentBrand('6011111111111117'), null);
  for (const value of VISA_ACCEPTANCE_UNSUPPORTED_BRAND_TEST_PANS) {
    assert.ok(luhnValid(value));
    assert.equal(paymentCardIdentity(value).identity, 'invalid');
  }
  assert.equal(paymentBrand('6011090000000000'), 'discover');
  assert.equal(paymentBrand('6011100000000000'), null);
  assert.equal(paymentBrand('2720990000000000'), 'mastercard');
  assert.equal(paymentBrand('2721000000000000'), null);
  assert.equal(paymentBrand('3589000000000000000'), 'jcb');
  assert.equal(paymentBrand('35890000000000000000'), null);
  assert.equal(paymentBrand('340000000000000'), 'amex');
  assert.equal(paymentBrand('3400000000000000'), null);
  assert.equal(paymentCardIdentity('4000 0000-0042 5019').identity, 'not-established');
  assert.equal(paymentCardIdentity('4000 000000 425019').identity, 'not-established');
  assert.equal(paymentCardIdentity('3400 000004 25024').identity, 'valid');
});

test('the contract model follows the frozen iban-v1 table, print grammar and generator', () => {
  assert.equal(Object.keys(IBAN_REGISTRY_103_LENGTHS).length, 89);
  const bban = 'SYNX00000000000000';
  const value = `GB${ibanCheckDigits('GB', bban)}${bban}`;
  assert.equal(ibanMod97Remainder(value), 1);
  assert.equal(ibanIdentity(value).identity, 'valid');
  assert.equal(ibanIdentity(value.match(/.{1,4}/g).join(' ')).identity, 'valid');
  assert.equal(ibanIdentity(value.match(/.{1,4}/g).join('  ')).identity, 'not-established');
  assert.equal(ibanIdentity(value.toLowerCase()).identity, 'not-established');
  assert.equal(ibanIdentity(`${value}0`).reason, 'country-length');
  assert.equal(ibanIdentity(`ZZ${value.slice(2)}`).reason, 'country');
});

test('plan validation rejects authoring slips instead of reaching a scan', () => {
  const mutate = (factory, change, pattern) => { const plan = factory(); change(plan); assert.throws(() => validateStressPlan(plan), pattern); };
  const id = (plan, caseId) => plan.cases.find(row => row.id === caseId);
  // Expectation that does not follow identity and sensitivity.
  mutate(card, plan => { id(plan, 'card-collision-order-id-twin').expected = { publicFinding: true, start: 9, end: 25, sensitive: true }; }, /public-finding expectation/);
  // Authored identity that disagrees with the frozen contract.
  mutate(card, plan => { const row = id(plan, 'card-edge-mastercard-272099-vs-272100-out'); row.identity = 'valid'; row.oracle.identity = 'valid'; }, /contract model/);
  // Non-sensitive claimed for a value that is not an authority-reserved test PAN.
  mutate(card, plan => { const row = id(plan, 'card-collision-invoice'); row.sensitivity = 'non-sensitive'; row.oracle.sensitivity = 'non-sensitive'; }, /authority-reserved/);
  // Sensitive claimed without a reviewed field form.
  mutate(iban, plan => { const row = id(plan, 'iban-collision-sku-twin'); Object.assign(row, { sensitivity: 'sensitive' }); row.oracle.sensitivity = 'sensitive';
    Object.assign(row.expected, { publicFinding: true, start: 5, end: 27, sensitive: true }); }, /field form/);
  // A twin that differs in more than its declared property.
  mutate(card, plan => { const row = id(plan, 'card-near-miss-visa16-last-digit'); row.prefix = 'card number: '; row.input = `${row.prefix}${row.display}`; }, /(twin|expectation|candidate)/);
  // A denominator that no longer lists its members.
  mutate(iban, plan => { plan.populations[1].denominator.caseIds.pop(); }, /denominator/);
  // Independence requirement.
  mutate(card, plan => { plan.independenceRequirements.minDistinctPositiveValues = 1000; }, /independence/);
});

test('the shared oracle rejects a stress label whose validator citation is wrong', () => {
  const plans = { 'pii:global:payment-card': card(), 'pii:global:iban': iban() };
  plans['pii:global:payment-card'].cases.find(row => row.id === 'card-near-miss-visa16-last-digit').oracle.identityBasis = ['contract-grammar'];
  assert.throws(() => stressOracle(plans), /reference validator/);
});

test('independence metrics are recomputed mechanically from the plan', () => {
  const metrics = stressIndependence(stressPlans['pii:global:iban']);
  assert.ok(metrics.distinctPositiveValues >= 25 && metrics.koreanPositives >= 5 && metrics.positiveConstructions >= 2);
  assert.equal(metrics.cases, stressPlans['pii:global:iban'].cases.length);
});

test('scoring keeps validator correctness, semantic collision, leakage, collateral and cross-family separate', () => {
  const plan = stressPlans['pii:global:payment-card'];
  const perfect = plan.cases.map(row => ({ id: row.id, findings: row.expected.publicFinding ? [{ type: plan.findingType, detector: 'pii-domain', action: 'redact',
    start: row.expected.start, end: row.expected.end }] : [], redaction: { targetValueRemoved: row.expected.publicFinding ? true : null, outsidePreserved: true, findingsAgree: true } }));
  const clean = scoreLane(plan, { lane: 'node-addon', selection: 'pii-global-and-us', activationIdentity: null, cases: perfect });
  assert.equal(clean.groups.sensitive.detected, clean.groups.sensitive.cases);
  assert.equal(clean.groups['validator-correctness'].absent, clean.groups['validator-correctness'].cases);
  assert.equal(clean.outputLeakage.valueLeakedAfterRedaction, 0);
  const noisy = clone(perfect);
  const index = plan.cases.findIndex(row => row.id === 'card-collision-order-id-twin');
  noisy[index].findings.push({ type: plan.findingType, detector: 'pii-domain', action: 'redact', start: 9, end: 25 }, { type: 'pii_global_phone', detector: 'pii-domain', action: 'redact', start: 9, end: 25 });
  const near = plan.cases.findIndex(row => row.id === 'card-near-miss-visa16-last-digit');
  noisy[near].findings.push({ type: plan.findingType, detector: 'pii-domain', action: 'redact', start: 12, end: 28 });
  const positive = plan.cases.findIndex(row => row.id === 'card-pos-visa16-card-number-kv');
  noisy[positive].redaction.targetValueRemoved = false;
  const scored = scoreLane(plan, { lane: 'node-addon', selection: 'pii-global-and-us', activationIdentity: null, cases: noisy });
  assert.equal(scored.groups['semantic-collision']['false-alarm'], 1);
  assert.equal(scored.groups['validator-correctness']['false-alarm'], 1);
  assert.equal(scored.outputLeakage.valueLeakedAfterRedaction, 1);
  assert.equal(scored.crossFamily.noneExpectedViolations, 1);
  assert.deepEqual(scored.crossFamily.findingsByType, { pii_global_phone: 1 });
  assert.throws(() => scoreLane(plan, { lane: 'node-addon', selection: 'pii-global-and-us', activationIdentity: null, cases: perfect.slice(1) }), /one-to-one/);
});

test('#425 evidence re-scores byte for byte from its observation and carries no case value', historicalReplayOptions, async () => {
  const { buildStressReport } = await import('../benchmarks/evaluation/domains/pii/card-iban-stress/report.ts');
  const observationText = historicalBytes('evidence/901/425/card-iban-stress-observation-v1.json').toString('utf8');
  const reportText = historicalBytes('evidence/901/425/card-iban-stress-report-v1.json').toString('utf8');
  assert.equal(`${JSON.stringify(buildStressReport(JSON.parse(observationText)), null, 2)}\n`, reportText);
  const report = JSON.parse(reportText);
  assert.equal(report.supportClaims, false);
  assert.equal(report.statusPromotion, false);
  const candidate = report.sides.find(side => side.side === 'candidate');
  assert.equal(candidate.identity.sourceCommit, 'af7f863f29f9fe482dd233c8b7bc5b77dc427314');
  for (const family of candidate.families) assert.equal(family.identityOracle.identityOnly.status, 'not-measured');
  for (const plan of Object.values(stressPlans)) for (const row of plan.cases) {
    const value = row.display.replace(/[^0-9A-Za-z]/g, '');
    if (value.length < 10) continue;
    for (const text of [observationText, reportText]) {
      assert.ok(!text.includes(row.display), `${row.id} display leaked into evidence`);
      assert.ok(!text.includes(value), `${row.id} value leaked into evidence`);
    }
  }
});
