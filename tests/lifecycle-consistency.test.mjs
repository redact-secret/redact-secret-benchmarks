import test from 'node:test';
import assert from 'node:assert/strict';
import knownGaps from '../benchmarks/known-gaps.json' with {type: 'json'};
import {
  checkProductIssuesReachable, checkManifestCrossReference, checkPromotionConsistency,
} from '../benchmarks/lib/lifecycle-consistency.ts';

const clone = () => structuredClone(knownGaps);
const beta5Ids = ['product-551', 'product-552', 'product-553'];
const beta5Issues = knownGaps.issues.filter(issue => beta5Ids.includes(issue.id));

/** A product manifest record that agrees with a known-gaps.json record's promotion field. */
const manifestRecordFor = issue => ({
  id: issue.promotion.productManifestRecordId,
  benchmarkRecordId: issue.id,
  productIssue: issue.promotion.productIssue,
});

test('product issue reachability passes when gh confirms every issue', () => {
  const reachable = Object.fromEntries(knownGaps.issues.map(issue => [issue.number, true]));
  assert.deepEqual(checkProductIssuesReachable(knownGaps, { reachable }), []);
});

test('product issue reachability fails closed on an unconfirmed issue', () => {
  const reachable = Object.fromEntries(knownGaps.issues.map(issue => [issue.number, true]));
  reachable[knownGaps.issues[0].number] = false;
  const failures = checkProductIssuesReachable(knownGaps, { reachable });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /could not be confirmed reachable/);
});

test('product issue reachability fails closed when gh never reported on an issue', () => {
  const failures = checkProductIssuesReachable(knownGaps, { reachable: {} });
  assert.equal(failures.length, knownGaps.issues.length);
});

test('manifest cross-reference passes for the three real beta.5 findings that reached "promoted" or later (#106 AC3)', () => {
  const promotedBeta5 = beta5Issues.filter(issue => issue.promotion);
  assert.ok(promotedBeta5.length > 0, 'expected at least one promoted beta.5 record to exercise the check against');
  const productManifest = { records: promotedBeta5.map(manifestRecordFor) };
  assert.deepEqual(checkManifestCrossReference(knownGaps, productManifest), []);
});

test('manifest cross-reference fails closed on a product record with no known-gaps.json record behind it (the real #428 shape)', () => {
  const productManifest = {
    records: [{
      id: 'sendgrid-generic-key-full-span-promotion',
      benchmarkRecordId: 'product-428-sendgrid',
      productIssue: 'https://github.com/redact-secret/redact-secret/issues/428',
    }],
  };
  const failures = checkManifestCrossReference(knownGaps, productManifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /no benchmarks\/known-gaps\.json record/);
});

test('manifest cross-reference fails when the product record names the wrong manifest id', () => {
  const issue = knownGaps.issues.find(i => i.promotion);
  const productManifest = { records: [{ id: 'not-the-real-id', benchmarkRecordId: issue.id, productIssue: issue.promotion.productIssue }] };
  const failures = checkManifestCrossReference(knownGaps, productManifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /promotion\.productManifestRecordId/);
});

test('manifest cross-reference fails when the two ledgers disagree on the product issue', () => {
  const issue = knownGaps.issues.find(i => i.promotion);
  const productManifest = {
    records: [{
      id: issue.promotion.productManifestRecordId,
      benchmarkRecordId: issue.id,
      productIssue: 'https://github.com/redact-secret/redact-secret/issues/1',
    }],
  };
  const failures = checkManifestCrossReference(knownGaps, productManifest);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /disagree on the product issue/);
});

test('full guard passes against the checked-in ledger and the matching beta.5 manifest records', () => {
  const promotedBeta5 = beta5Issues.filter(issue => issue.promotion);
  const productManifest = { records: promotedBeta5.map(manifestRecordFor) };
  const reachable = Object.fromEntries(knownGaps.issues.map(issue => [issue.number, true]));
  assert.deepEqual(checkPromotionConsistency(knownGaps, productManifest, { reachable }), []);
});

test('full guard fails a synthetic record with a skipped lifecycle stage (#106 AC3)', () => {
  const candidate = clone();
  delete candidate.issues[0].history.reviewed;
  const reachable = Object.fromEntries(candidate.issues.map(issue => [issue.number, true]));
  const failures = checkPromotionConsistency(candidate, { records: [] }, { reachable });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /invalid-reviewed-transition/);
});
