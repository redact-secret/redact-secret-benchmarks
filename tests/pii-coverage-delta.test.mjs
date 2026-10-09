import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPiiCoverageDelta, buildPiiCoverageDeltas } from '../scripts/lib/pii-coverage-delta.mjs';
import { createCoverageRow } from '../scripts/lib/pii-coverage-model.mjs';

const commitment = digit => digit.repeat(64);
const identity = (id, role, extras = {}) => ({ snapshotId: id, snapshotCommitment: commitment(id === 'old' ? '1' : '2'), productCommitment: commitment('3'),
  mappingRevision: 1, mappingCommitment: commitment('4'), protocol: 'protocol-1', population: commitment(id === 'old' ? '7' : '8'), visibility: 'public', role,
  bindingCommitment: null, ...extras });
function matrix(id, role, kinds, extras = {}) {
  const bound = identity(id, role, extras);
  return { schemaVersion: 1, identity: bound, rows: kinds.map(({ key, ...overrides }) => {
    const base = { kindKey: key, label: key, domains: ['PII'], jurisdictions: ['US'],
      evidence: { availability: 'accepted', authoredCases: 1, importedCases: 1, fixtures: 1, variants: 1, occurrences: null, acceptedCases: 1 },
      capability: { state: 'unknown', source: null, productCommitment: null },
      mapping: { state: 'faithful', losses: [], requiredAxes: ['detection'], representableAxes: ['detection'] },
      observation: { status: 'absent', identity: null, axes: [], source: null }, applicability: { state: 'applicable', source: 'synthetic-applicability-contract' } };
    return createCoverageRow({ ...base, ...overrides }, bound);
  }) };
}
const pair = () => ({ previous: matrix('old', 'active', [{ key: 'email' }]), next: matrix('new', 'proposed', [{ key: 'email' }, { key: 'dob',
  evidence: { availability: 'deferred', authoredCases: 0, importedCases: 0, fixtures: 0, variants: 0, occurrences: null, acceptedCases: 0 },
  mapping: { state: 'not-representable', losses: ['context-loss'], requiredAxes: ['context'], representableAxes: [] } }]), mode: 'active-vs-proposed' });

test('snapshot expansion preserves a zero-case unmapped kind without observations or adoption', () => {
  const inputs = pair();
  const original = structuredClone(inputs);
  const delta = buildPiiCoverageDelta(inputs);
  assert.deepEqual(inputs, original);
  assert.equal(delta.rows.find(row => row.nextKindKey === 'dob').classification, 'added');
  assert.equal(delta.rows.find(row => row.nextKindKey === 'dob').counts.acceptedCases.next, 0);
  assert.deepEqual(delta.totals.kinds, { previous: 1, next: 2, delta: 1 });
  assert.equal(delta.totals.counts.occurrences.delta, null);
  assert.equal(delta.denominator.solelyDenominatorExpansion, true);
  assert.equal(delta.attribution.productRegressionComparison.state, 'unavailable');
  assert.equal(delta.attribution.productRegressionComparison.oldObservationReused, false);
  assert.equal(delta.activePinsChanged, false);
  assert.equal(delta.adoption.applied, false);
  assert.equal(delta.ownerAcceptance, null);
  assert.equal(delta.rows[0].deferredCounts.cases.next, null);
});

test('reviewed renames are explicit reclassifications and count/domain/mapping deltas stay distinct', () => {
  const inputs = { previous: matrix('old', 'active', [{ key: 'health-record' }, { key: 'removed' }]),
    next: matrix('new', 'proposed', [{ key: 'medical-record', domains: ['PII', 'PHI'], jurisdictions: ['UK'],
      evidence: { availability: 'accepted', authoredCases: 3, acceptedCases: 2, importedCases: 4, fixtures: 5, variants: 5, occurrences: 6 },
      mapping: { state: 'partial', losses: ['phi-loss'], requiredAxes: ['detection', 'context'], representableAxes: ['detection'] } }]),
    mode: 'active-vs-proposed', renames: [{ previousKindKey: 'health-record', nextKindKey: 'medical-record', source: 'reviewed-owner-record' }] };
  const delta = buildPiiCoverageDelta(inputs);
  const renamed = delta.rows.find(row => row.nextKindKey === 'medical-record');
  assert.equal(renamed.classification, 'reclassified');
  assert.equal(renamed.review, 'reviewed-owner-record');
  assert.deepEqual(renamed.domains, { added: ['PHI'], removed: [] });
  assert.deepEqual(renamed.jurisdictions, { added: ['UK'], removed: ['US'] });
  assert.equal(renamed.counts.authoredCases.delta, 2);
  assert.equal(renamed.counts.acceptedCases.delta, 1);
  assert.equal(renamed.counts.importedCases.delta, 3);
  assert.deepEqual(renamed.mapping.losses, { added: ['phi-loss'], removed: [] });
  assert.equal(delta.rows.find(row => row.previousKindKey === 'removed').classification, 'removed');
  assert.equal(delta.denominator.solelyDenominatorExpansion, false);
  const noRename = buildPiiCoverageDelta({ ...inputs, renames: [] });
  assert.equal(noRename.rows.filter(row => row.classification === 'added').length, 1);
  assert.equal(noRename.rows.filter(row => row.classification === 'removed').length, 2);
  const sameId = buildPiiCoverageDelta({ previous: matrix('old', 'active', [{ key: 'medical-record' }]),
    next: matrix('new', 'proposed', [{ key: 'medical-record', domains: ['PII', 'PHI'] }]), mode: 'active-vs-proposed',
    renames: [{ previousKindKey: 'medical-record', nextKindKey: 'medical-record', source: 'reviewed-domain-reclassification' }] });
  assert.equal(sameId.rows[0].classification, 'reclassified');
  assert.deepEqual(sameId.rows[0].domains.added, ['PHI']);
});

test('evidence, evaluator, and product changes have separate attribution', () => {
  const delta = buildPiiCoverageDelta({ ...pair(), next: matrix('new', 'proposed', [{ key: 'email' }],
    { productCommitment: commitment('5'), mappingRevision: 2, mappingCommitment: commitment('6'), protocol: 'protocol-2' }) });
  assert.equal(delta.attribution.evidence.changed, true);
  assert.equal(delta.attribution.evaluator.changed, true);
  assert.equal(delta.attribution.product.changed, true);
  assert.equal(delta.attribution.productRegressionComparison.state, 'unavailable');
  assert.equal(delta.denominator.solelyDenominatorExpansion, false);
  const unknown = buildPiiCoverageDelta({ ...pair(), next: matrix('new', 'proposed', [{ key: 'email' }], { productCommitment: null }) });
  assert.equal(unknown.attribution.product.changed, null);
  assert.equal(unknown.attribution.product.reason, 'product-binding-unavailable-cannot-attribute-change');
  assert.equal(unknown.denominator.solelyDenominatorExpansion, false);
});

test('wrong snapshot observations, duplicate kinds and ambiguous renames refuse', () => {
  const inputs = pair();
  inputs.next.rows[0].observation = { status: 'valid', identity: inputs.previous.identity, axes: [], source: 'old-run' };
  assert.throws(() => buildPiiCoverageDelta(inputs), /observation exact identity binding/);
  const duplicates = pair(); duplicates.next.rows.push(duplicates.next.rows[0]);
  assert.throws(() => buildPiiCoverageDelta(duplicates), /duplicate kind key/);
  assert.throws(() => buildPiiCoverageDelta({ ...pair(), renames: [{ previousKindKey: 'email', nextKindKey: 'dob', source: 'review' }] }), /rename-ambiguous/);
  const mismatch = pair(); mismatch.next.identity.snapshotId = 'old';
  assert.throws(() => buildPiiCoverageDelta(mismatch), /snapshot-id-content-mismatch/);
});

test('proposed and adopted views are distinct and immutable archives do not promise missing reproduction', () => {
  assert.throws(() => buildPiiCoverageDelta({ ...pair(), mode: 'accepted-before-after' }), /accepted-role-mismatch/);
  const input = pair(); input.next.identity.role = 'active';
  const source = { manifestUrl: 'https://example.test/immutable/manifest.json', archiveUrl: 'https://example.test/immutable/source.tar', sha256: 'a'.repeat(64), reproduction: 'unavailable' };
  const delta = buildPiiCoverageDelta({ ...input, mode: 'accepted-before-after', previousSource: source });
  assert.equal(delta.mode, 'accepted-before-after');
  assert.equal(delta.previous.source.sha256, source.sha256);
  assert.equal(delta.previous.source.fullReproduction, false);
  assert.equal(delta.next.source.state, 'unavailable');
  assert.throws(() => buildPiiCoverageDelta({ ...input, mode: 'accepted-before-after', previousSource: { ...source, archiveUrl: 'file:///tmp/archive' } }), /source-reference-invalid/);
});

test('same input and sorted stable keys produce recomputable inventory commitments', () => {
  assert.deepEqual(buildPiiCoverageDelta(pair()), buildPiiCoverageDelta(pair()));
  assert.match(buildPiiCoverageDelta(pair()).previous.inventoryCommitment, /^[a-f0-9]{64}$/);
});

test('publication integration preserves independent active scanner sides and archive identity without a reproduction claim', () => {
  const pin = id => ({ release: { repository: 'redact-secret/pii-evidence', commit: 'a'.repeat(40), tag: `snapshot-${id}`,
    archive: { name: `${id}.tar.gz`, tarGzSha256: 'b'.repeat(64) } }, snapshot: { id, contentDigest: commitment(id === 'old' ? '1' : '2'), manifestSha256: 'c'.repeat(64) } });
  const coverage = { schema: 'pii-coverage-view/1', inventories: { active: { source: pin('old') }, proposed: { source: pin('new') } },
    matrices: { active: { baseline: { matrix: matrix('old', 'baseline', [{ key: 'email' }]) }, candidate: { matrix: matrix('old', 'candidate', [{ key: 'email' }]) } },
      proposed: { baseline: { matrix: matrix('new', 'proposed', [{ key: 'email' }, { key: 'dob' }]) }, candidate: { matrix: matrix('new', 'proposed', [{ key: 'email' }, { key: 'dob' }]) } } } };
  const deltas = buildPiiCoverageDeltas(coverage);
  assert.equal(deltas.baseline.previous.identity.role, 'baseline');
  assert.equal(deltas.candidate.previous.identity.role, 'candidate');
  assert.equal(deltas.baseline.next.identity.role, 'proposed');
  assert.equal(deltas.baseline.previous.source.archiveSha256, 'b'.repeat(64));
  assert.equal(deltas.baseline.previous.source.manifestSha256, 'c'.repeat(64));
  assert.equal(deltas.baseline.previous.source.fullReproduction, false);
  assert.match(deltas.baseline.previous.source.sourceTreeUrl, /a{40}$/);
  assert.ok(deltas.baseline.limitations.includes('deferred-case-and-fixture-counts-not-exposed-by-source'));
  coverage.inventories.proposed.source.snapshot.id = 'other';
  assert.throws(() => buildPiiCoverageDeltas(coverage), /inventory-matrix-source-mismatch/);
});
