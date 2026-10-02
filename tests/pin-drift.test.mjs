import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { checkPinConsistency, checkPinAncestry, collectKnownGapCommits, extractRegistryIds } from '../benchmarks/lib/pin-drift.ts';

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

const ids = ['private-key', 'aws-access-key', 'github-token'];
const baseFacts = {
  registrySourceRevision: 'a'.repeat(40), inventoryRedactSecretRevision: 'a'.repeat(40),
  inventoryRedactSecretVersion: '1', packageVersion: '1', performanceCriteriaVerifiedCommit: 'a'.repeat(40),
};

test('ancestry check flags a registry revision that is not an ancestor of product main', () => {
  const failures = checkPinAncestry(baseFacts, { issues: [] }, {
    registrySourceRevisionIsAncestor: false, pinnedRegistryIds: ids, currentRegistryIds: ids, knownGapCommitIsAncestor: {},
  });
  assert.equal(failures.length, 1);
  assert.match(failures[0], /is not an ancestor/);
});

const ancestry = (over = {}) => ({
  registrySourceRevisionIsAncestor: true, pinnedRegistryIds: ids, currentRegistryIds: ids, knownGapCommitIsAncestor: {}, ...over,
});

// Synthetic product registry source: only the shape of the built_in_detectors() table matters.
const modRs = rows => `use x;
pub(crate) fn built_in_detectors() -> &'static [BuiltInRow] {
    #[rustfmt::skip]
    static DETECTORS: &[BuiltInRow] = &[
${rows.join('\n')}
    ];
    DETECTORS
}
fn required_literals() { "private-key" => 1, }
`;
const rows = list => list.map(id => `        row("${id}", &${id.replace(/-/g, '_')}::Detector),`);

test('extractRegistryIds reads the ids of the registration table in order, ignoring comments and other mentions', () => {
  const source = modRs(['        // a comment', ...rows(ids), '']);
  assert.deepEqual(extractRegistryIds(source), ids);
});

test('extractRegistryIds fails closed on a missing, empty or unrecognised table', () => {
  assert.throws(() => extractRegistryIds('fn main() {}'), /not found/);
  assert.throws(() => extractRegistryIds(modRs([])), /empty/);
  assert.throws(() => extractRegistryIds(modRs(['        build_row("x"),'])), /unrecognised/);
});

test('(a) an implementation-only change does not fire: the registry ids are the same', () => {
  const pinned = extractRegistryIds(modRs(rows(ids)));
  const current = extractRegistryIds(modRs(rows(ids)).replace('    DETECTORS\n', '    // perf: faster dispatch\n    DETECTORS\n'));
  assert.deepEqual(checkPinAncestry(baseFacts, { issues: [] }, ancestry({ pinnedRegistryIds: pinned, currentRegistryIds: current }), ids), []);
});

test('(b) a registry change fires: an added, removed or renamed id, or a reorder', () => {
  const fire = current => checkPinAncestry(baseFacts, { issues: [] }, ancestry({ currentRegistryIds: extractRegistryIds(modRs(rows(current))) }));
  const added = fire([...ids, 'slack-token']);
  assert.equal(added.length, 1);
  assert.match(added[0], /registry changed.*added slack-token.*refresh the detector registry snapshot/);
  assert.match(fire(ids.slice(1))[0], /removed private-key/);
  const renamed = fire(['private-keys', ...ids.slice(1)])[0];
  assert.match(renamed, /removed private-key; added private-keys/);
  assert.match(fire([ids[1], ids[0], ids[2]])[0], /registration order changed/);
});

test('(b) the committed snapshot must match the registry at the pinned revision', () => {
  const failures = checkPinAncestry(baseFacts, { issues: [] }, ancestry(), [...ids, 'stale-detector']);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /detectors\.json does not match.*removed|added/);
});

test('(c) the other conditions still fire beside an unchanged registry', () => {
  const fixCommit = 'c'.repeat(40);
  const failures = checkPinAncestry(baseFacts, { issues: [{ id: 'product-292', fix: { commit: fixCommit }, candidate: {} }] },
    ancestry({ registrySourceRevisionIsAncestor: false }), ids);
  assert.equal(failures.length, 2);
  assert.ok(failures.some(f => /is not an ancestor/.test(f)));
  assert.ok(failures.some(f => f.includes('product-292')));
  assert.equal(checkPinConsistency({ ...baseFacts, packageVersion: '2' }).length, 1);
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
    registrySourceRevisionIsAncestor: true, pinnedRegistryIds: ids, currentRegistryIds: ids,
    knownGapCommitIsAncestor: { [fixCommit]: false, [sourceCommit]: false },
  });
  assert.equal(failures.length, 2);
  assert.ok(failures.some(f => f.includes('product-292') && f.includes('fix.commit')));
  assert.ok(failures.some(f => f.includes('product-404') && f.includes('candidate.sourceCommit')));
});

test('ancestry check treats an unrecorded commit as failing (fail closed)', () => {
  const fixCommit = 'e'.repeat(40);
  const failures = checkPinAncestry(baseFacts, { issues: [{ id: 'product-x', fix: { commit: fixCommit }, candidate: {} }] }, {
    registrySourceRevisionIsAncestor: true, pinnedRegistryIds: ids, currentRegistryIds: ids, knownGapCommitIsAncestor: {},
  });
  assert.equal(failures.length, 1);
});

test('ancestry check passes when every pin and commit resolves to an ancestor', () => {
  const fixCommit = 'c'.repeat(40);
  const failures = checkPinAncestry(baseFacts, { issues: [{ id: 'product-292', fix: { commit: fixCommit }, candidate: {} }] }, {
    registrySourceRevisionIsAncestor: true, pinnedRegistryIds: ids, currentRegistryIds: ids, knownGapCommitIsAncestor: { [fixCommit]: true },
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

test('pin consistency check flags runtime-comparison snapshots that do not follow the pin (#562)', () => {
  const pinned = {
    registrySourceRevision: 'a'.repeat(40),
    inventoryRedactSecretRevision: 'a'.repeat(40),
    inventoryRedactSecretVersion: '0.1.0-beta.12',
    packageVersion: '0.1.0-beta.12',
    performanceCriteriaVerifiedCommit: 'a'.repeat(40),
  };
  const snapshot = { file: 'evidence/562/runtime-comparison-default.json', version: '0.1.0-beta.12', kind: 'published-npm-package', commit: 'a'.repeat(40) };
  assert.deepEqual(checkPinConsistency({ ...pinned, runtimeComparisonSnapshots: [snapshot] }), []);
  assert.deepEqual(checkPinConsistency(pinned), [], 'no snapshots supplied means nothing to compare');
  const stale = checkPinConsistency({ ...pinned, runtimeComparisonSnapshots: [{ ...snapshot, version: '0.1.0-beta.11', kind: 'local-source-build', commit: 'c'.repeat(40) }] });
  assert.equal(stale.length, 3);
  assert.match(stale.join('\n'), /measured redact-secret 0\.1\.0-beta\.11, but package\.json pins @redact-secret\/core 0\.1\.0-beta\.12/);
  assert.match(stale.join('\n'), /local-source-build, not the published package/);
  assert.match(stale.join('\n'), /records product commit c+/);
});
