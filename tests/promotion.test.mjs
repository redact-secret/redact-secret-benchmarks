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

test('alternate dispositions require reviewed evidence and a reason', () => {
  const candidate = clone();
  candidate.issues[0].status = 'rejected';
  delete candidate.issues[0].history.promoted;
  delete candidate.issues[0].history.fixed;
  delete candidate.issues[0].promotion;
  delete candidate.issues[0].fix;
  assert.throws(() => validateKnownGaps(candidate), /invalid-disposition/);
});
