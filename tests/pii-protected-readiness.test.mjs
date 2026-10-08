import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReadiness, checkReadiness } from '../scripts/check-pii-protected-readiness.mjs';

test('protected readiness is deterministic preparation generated from public contracts', async () => {
  await checkReadiness();
  assert.deepEqual(await buildReadiness(), await buildReadiness());
});

test('preparation cannot be mistaken for execution or a protected receipt', async () => {
  const record = await buildReadiness();
  assert.equal(record.execution, 'none');
  assert.equal(record.epochCreated, false);
  assert.equal(record.attemptSpent, false);
  assert.equal(record.supportClaims, false);
  assert.equal(record.pii.protectedPath, 'pending-not-operational');
  assert.equal(record.credentialPolicy.receiptDraft.state, 'not-a-receipt');
  assert.equal(record.credentialPolicy.receiptDraft.report, null);
  assert.equal(record.custody.publicSyntheticMeasurementBlocked, false);
});

test('inventory keeps taxonomy membership separate from contract slices and pending intake', async () => {
  const record = await buildReadiness();
  assert.deepEqual(record.credentialPolicy.membership.map(row => row.detector).sort(),
    ['bearer-token', 'connection-string', 'generic-token', 'otpauth-uri']);
  assert.equal(record.credentialPolicy.sliceMeaning, 'contract-review-slices-not-new-taxonomy-families-or-measured-cells');
  assert.equal(record.credentialPolicy.candidate, 'not-frozen');
  assert.equal(record.pii.profileCost.requiresReviewedTargetRefreeze, true);
  assert.equal(record.custody.historicalLocal.newPiiEvalReadiness, false);
});
