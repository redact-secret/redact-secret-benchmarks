import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv';
import { validatePiiPopulationPolicy } from '../scripts/lib/pii-population-policy.mjs';

const policy = JSON.parse(readFileSync(new URL('../benchmarks/pii-population-policy.json', import.meta.url), 'utf8'));
const schema = JSON.parse(readFileSync(new URL('../schemas/pii-population-policy-v1.json', import.meta.url), 'utf8'));
const validateSchema = new Ajv({ strict: true }).compile(schema);

test('the proposed policy preserves independent evidence roles without an execution or owner acceptance', () => {
  const result = validatePiiPopulationPolicy(policy);
  assert.equal(validateSchema(policy), true);
  assert.notEqual(result, policy);
  assert.equal(result.populations.length, 6);
  assert.equal(new Set(result.populations.map(row => row.id)).size, result.populations.length);
  assert.equal(result.composition.ownerCriteria.acceptedBy, null);
  assert.equal(result.execution.measurementTarget, 'not-selected');
});

test('pooling, ownership swaps, support claims, lost-axis promotion and invented approvals refuse', () => {
  for (const mutate of [
    value => { value.accounting.crossPopulationPooling = 'allowed'; },
    value => { value.accounting.crossScannerPooling = 'allowed'; },
    value => { value.accounting.protectedInPublicDenominator = 'allowed'; },
    value => { value.accounting.replayAddsSamples = true; },
    value => { value.accounting.authoredCaseEqualsImportedCase = true; },
    value => { value.accounting.withheld = 'zero'; },
    value => { value.accounting.notApplicable = 'scanner-output-derived'; },
    value => { value.accounting.partial = 'renormalise'; },
    value => { value.populations[0].evidenceOwner = value.owners.qualification; },
    value => { value.populations[4].tuning = 'existing-contract-only'; },
    value => { value.populations[5].visibility = 'public-synthetic'; },
    value => { value.populations[1] = value.populations[0]; },
    value => { value.populations.pop(); },
    value => { value.supportClaims = true; },
    value => { value.composition.output = 'pooled-score'; },
    value => { value.composition.automaticSupportPromotion = true; },
    value => { value.composition.numericalCriteria = { minimumCases: 1 }; },
    value => { value.composition.requirements.pop(); },
    value => { value.composition.ownerCriteria.state = 'accepted'; },
    value => { value.composition.ownerCriteria.acceptedBy = 'owner'; },
    value => { value.composition.ownerCriteria.acceptanceSource = 'inferred'; },
    value => { value.mapping.lostAxisClaims = 'measured-support'; },
    value => { value.mapping.lossClasses.pop(); },
    value => { value.mapping.publicAdoptionBlocked = true; },
    value => { value.mapping.lossClasses = 'not-applicable'; },
    value => { value.mapping.unknownKindOrJurisdiction = 'guess'; },
    value => { value.execution.measurementTarget = 'latest-main'; },
    value => { value.execution.authorityRepin = 'authorised'; },
    value => { value.execution.freshOfficialCostDecision = 'reuse-spent-allowance'; },
    value => { value.execution.protectedExecution = 'authorised'; },
    value => { value.raw = 'unreviewed'; },
    value => { value.populations[0].measurement = { pooled: true }; },
    value => { value.composition.ownerCriteria.acceptedAt = '2026-10-08'; },
    value => { value.populations[5].evidenceOwner = 'redact-secret/private-custodian'; },
  ]) {
    const bad = structuredClone(policy); mutate(bad);
    assert.throws(() => validatePiiPopulationPolicy(bad), /Invalid proposed PII population policy/);
    assert.equal(validateSchema(bad), false);
  }
});
