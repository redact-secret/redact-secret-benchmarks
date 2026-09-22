import test from 'node:test';
import assert from 'node:assert/strict';
import knownGaps from '../benchmarks/known-gaps.json' with {type: 'json'};
import {validateKnownGaps} from '../benchmarks/lib/promotion.ts';

const clone = () => structuredClone(knownGaps);

test('checked-in known gaps satisfy the promotion lifecycle contract', () => {
  assert.equal(validateKnownGaps(knownGaps), knownGaps);
});

test('fixed records require every transition and fixing identity', () => {
  const candidate = clone();
  delete candidate.issues[0].history.reviewed;
  assert.throws(() => validateKnownGaps(candidate), /invalid-reviewed-transition/);
});

test('verified records require both product and benchmark evidence gates', () => {
  const candidate = clone();
  candidate.issues[0].status = 'verified';
  candidate.issues[0].candidate.sourceCommit = 'b4a9ae83d737d367ebc1d6d1732e634b44b2452a';
  candidate.issues[0].history.verified = {
    at: '2026-09-18',
    evidence: ['https://example.invalid/verification'],
  };
  candidate.issues[0].verification = {
    canonicalProductRegression: {
      manifestRecordId: 'benchmark-gap-292',
      fixtureIds: ['future-fixture'],
    },
    fixingCommitOrVersion: candidate.issues[0].fix.commit,
    productConformanceEvidence: [],
    benchmarkRerunEvidence: ['https://example.invalid/benchmark'],
  };
  assert.throws(() => validateKnownGaps(candidate), /invalid-verification-evidence/);
});

test('candidate.sourceCommit rejects a non-40-hex value', () => {
  const candidate = clone();
  candidate.issues[0].candidate.sourceCommit = 'not-a-commit-sha';
  assert.throws(() => validateKnownGaps(candidate), /invalid-metadata/);
});

test('candidate.sourceCommit rejects an unknown sibling key', () => {
  const candidate = clone();
  candidate.issues[0].candidate.sourceRef = 'main';
  assert.throws(() => validateKnownGaps(candidate), /invalid-metadata/);
});

test('verified records require candidate.sourceCommit', () => {
  const candidate = clone();
  delete candidate.issues[0].candidate.sourceCommit;
  candidate.issues[0].status = 'verified';
  candidate.issues[0].history.verified = {
    at: '2026-09-18',
    evidence: ['https://example.invalid/verification'],
  };
  candidate.issues[0].verification = {
    canonicalProductRegression: {
      manifestRecordId: candidate.issues[0].promotion.productManifestRecordId,
      fixtureIds: [],
    },
    fixingCommitOrVersion: candidate.issues[0].fix.commit,
    productConformanceEvidence: ['https://example.invalid/conformance'],
    benchmarkRerunEvidence: ['https://example.invalid/benchmark'],
  };
  assert.throws(() => validateKnownGaps(candidate), /invalid-candidate-source-commit/);
});

test('duplicate product issue numbers are rejected (#106, closes #66\'s no-duplicate-issue criterion)', () => {
  const candidate = clone();
  candidate.issues[1].number = candidate.issues[0].number;
  candidate.issues[1].url = candidate.issues[0].url;
  candidate.issues[1].promotion.productManifestRecordId = candidate.issues[0].promotion.productManifestRecordId;
  assert.throws(() => validateKnownGaps(candidate), /duplicate-product-issue/);
});

test('one product issue may back several records only when each hands off to a different product manifest record', () => {
  const candidate = clone();
  candidate.issues[1].number = candidate.issues[0].number;
  candidate.issues[1].url = candidate.issues[0].url;
  candidate.issues[1].promotion.productIssue = candidate.issues[0].url;
  assert.notEqual(candidate.issues[1].promotion.productManifestRecordId, candidate.issues[0].promotion.productManifestRecordId);
  assert.equal(validateKnownGaps(candidate), candidate);
  const split = knownGaps.issues.filter(issue => issue.number === 428);
  assert.equal(split.length, 2);
  assert.equal(new Set(split.map(issue => issue.promotion.productManifestRecordId)).size, 2);
  delete candidate.issues[1].promotion;
  candidate.issues[1].status = 'reviewed';
  delete candidate.issues[1].history.promoted;
  delete candidate.issues[1].history.fixed;
  delete candidate.issues[1].fix;
  assert.throws(() => validateKnownGaps(candidate), /duplicate-product-issue/);
});

test('alternate dispositions require reviewed evidence and a reason', () => {
  const candidate = clone();
  candidate.issues[0].status = 'rejected';
  delete candidate.issues[0].history.promoted;
  delete candidate.issues[0].history.fixed;
  delete candidate.issues[0].promotion;
  delete candidate.issues[0].fix;
  assert.throws(() => validateKnownGaps(candidate), /invalid-disposition/);
});
