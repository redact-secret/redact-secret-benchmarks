import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPinConsistency, checkPinAncestry, collectKnownGapCommits } from '../benchmarks/lib/pin-drift.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const registry = await read('benchmarks/detectors.json');
const inventory = await read('benchmarks/detector-inventory.json');
const packageJson = await read('package.json');
const knownGaps = await read('benchmarks/known-gaps.json');
const performanceCriteria = await read('benchmarks/performance-criteria.json');

test('pin consistency check passes against the real, refreshed tree', () => {
  const facts = {
    registrySourceRevision: registry.sourceRevision,
    inventoryRedactSecretRevision: inventory.redactSecretRevision,
    inventoryRedactSecretVersion: inventory.redactSecretVersion,
    packageVersion: packageJson.dependencies['@redact-secret/core'],
    performanceCriteriaVerifiedCommit: performanceCriteria.baseline.verifiedCommit,
  };
  assert.deepEqual(checkPinConsistency(facts), []);
});

test('pin consistency check passes when every pin aligns', () => {
  const failures = checkPinConsistency({
    registrySourceRevision: 'a'.repeat(40),
    inventoryRedactSecretRevision: 'a'.repeat(40),
    inventoryRedactSecretVersion: '0.1.0-beta.5',
    packageVersion: '0.1.0-beta.5',
    performanceCriteriaVerifiedCommit: 'a'.repeat(40),
  });
  assert.deepEqual(failures, []);
});

test('pin consistency check flags a registry/inventory revision mismatch', () => {
  const failures = checkPinConsistency({
    registrySourceRevision: 'a'.repeat(40),
    inventoryRedactSecretRevision: 'b'.repeat(40),
    inventoryRedactSecretVersion: '0.1.0-beta.5',
    packageVersion: '0.1.0-beta.5',
    performanceCriteriaVerifiedCommit: 'b'.repeat(40),
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /sourceRevision/);
});

test('pin consistency check flags a performance-criteria verified commit that does not match the pinned revision', () => {
  const failures = checkPinConsistency({
    registrySourceRevision: 'a'.repeat(40),
    inventoryRedactSecretRevision: 'a'.repeat(40),
    inventoryRedactSecretVersion: '0.1.0-beta.5',
    packageVersion: '0.1.0-beta.5',
    performanceCriteriaVerifiedCommit: 'c'.repeat(40),
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /performance-criteria\.json/);
});

const baseFacts = {
  registrySourceRevision: 'a'.repeat(40), inventoryRedactSecretRevision: 'a'.repeat(40),
  inventoryRedactSecretVersion: '1', packageVersion: '1', performanceCriteriaVerifiedCommit: 'a'.repeat(40),
};

test('ancestry check flags a registry revision that is not an ancestor of product main', () => {
  const failures = checkPinAncestry(baseFacts, { issues: [] }, {
    registrySourceRevisionIsAncestor: false, detectorsPathChangedSinceRegistry: false, knownGapCommitIsAncestor: {},
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /is not an ancestor/);
});

test('ancestry check flags a detector-source change in the product repo after the pinned revision', () => {
  const failures = checkPinAncestry(baseFacts, { issues: [] }, {
    registrySourceRevisionIsAncestor: true, detectorsPathChangedSinceRegistry: true, knownGapCommitIsAncestor: {},
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /crates\/secret-scan-core\/src\/detectors/);
});

test('ancestry check flags known-gap fix and candidate commits missing from product main', () => {
  const fixCommit = 'c'.repeat(40), sourceCommit = 'd'.repeat(40);
  const gaps = {
    issues: [
      { id: 'product-292', fix: { commit: fixCommit }, candidate: {} },
      { id: 'product-404', candidate: { sourceCommit } },
    ],
  };
  const failures = checkPinAncestry(baseFacts, gaps, {
    registrySourceRevisionIsAncestor: true, detectorsPathChangedSinceRegistry: false,
    knownGapCommitIsAncestor: { [fixCommit]: false, [sourceCommit]: false },
  });
  assert.equal(failures.length, 2);
  assert.ok(failures.some(f => f.includes('product-292') && f.includes('fix.commit')));
  assert.ok(failures.some(f => f.includes('product-404') && f.includes('candidate.sourceCommit')));
});

test('ancestry check treats an unrecorded commit as failing (fail closed)', () => {
  const fixCommit = 'e'.repeat(40);
  const failures = checkPinAncestry(baseFacts, { issues: [{ id: 'product-x', fix: { commit: fixCommit }, candidate: {} }] }, {
    registrySourceRevisionIsAncestor: true, detectorsPathChangedSinceRegistry: false, knownGapCommitIsAncestor: {},
  });
  assert.equal(failures.length, 1);
});

test('ancestry check passes when every pin and commit resolves to an ancestor', () => {
  const fixCommit = 'c'.repeat(40);
  const failures = checkPinAncestry(baseFacts, { issues: [{ id: 'product-292', fix: { commit: fixCommit }, candidate: {} }] }, {
    registrySourceRevisionIsAncestor: true, detectorsPathChangedSinceRegistry: false, knownGapCommitIsAncestor: { [fixCommit]: true },
  });
  assert.deepEqual(failures, []);
});

test('collectKnownGapCommits gathers every unique fix and candidate commit from the real ledger', () => {
  const commits = collectKnownGapCommits(knownGaps);
  assert.ok(commits.length > 0);
  assert.equal(new Set(commits).size, commits.length);
  for (const issue of knownGaps.issues) {
    if (issue.fix?.commit) assert.ok(commits.includes(issue.fix.commit));
    if (issue.candidate.sourceCommit) assert.ok(commits.includes(issue.candidate.sourceCommit));
  }
});
