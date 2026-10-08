// The research projection (#590, #591): a synthetic evidence release in, the projection and its problems out. No ledger value and no
// value of the committed projection is asserted; the committed file is only checked for being valid and bound to the pin it names.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { bindingProblems, evidencePin, projectResearch, projectionProblems, releaseProblems, sourceOf } from '../benchmarks/support/research-projection.mjs';
import { checkProjection } from '../scripts/research-projection.mjs';

const sha = text => createHash('sha256').update(text).digest('hex');
const record = (path, value) => { const text = JSON.stringify(value); return { path, sha256: sha(text), bytes: Buffer.byteLength(text), text }; };

const family = (id, extra = {}) => ({
  schemaVersion: 1, kind: 'family', id, provider: id.split(':')[0], name: `Name of ${id}`, description: 'd', lifecycle: 'draft',
  currentContract: `${id}@1`, research: { state: 'researched', researchedAt: '2026-09-01', blockers: [], issues: ['acme/research#1'] }, ...extra,
});
const contract = (fam, revision, extra = {}) => ({
  schemaVersion: 1, kind: 'format-contract', id: `${fam}@${revision}`, family: fam, revision, period: 'current', validity: { from: null, until: null },
  supersedes: revision > 1 ? `${fam}@${revision - 1}` : null, structure: { prefixes: ['acme_'] }, lifecycle: 'draft',
  claims: [{ id: 'prefix', statement: 'The prefix is acme_.', evidenceClass: 'provider-documented', temporality: 'current', observedAt: '2026-09-02', sources: [{ sourceId: 'docs-acme', supports: 'prefix', locator: '#tokens' }] }],
  openQuestions: [{ id: 'length', question: 'How long is the body?', raisedAt: '2026-09-03' }], ...extra,
});
const source = { schemaVersion: 1, kind: 'evidence-source', id: 'docs-acme', sourceType: 'provider-documentation', title: 'Tokens', locator: { url: 'https://docs.acme.invalid/tokens', pin: { kind: 'live-unpinned' } }, observations: [{ observedAt: '2026-09-01', outcome: 'read', observer: 'x' }, { observedAt: '2026-09-05', outcome: 'unreachable', observer: 'x' }], lifecycle: 'draft' };
const review = { schemaVersion: 1, kind: 'evidence-review-history', id: 'review-acme-deploy-token', subject: { kind: 'family', id: 'acme:deploy-token' }, events: [
  { seq: 1, type: 'authored', at: '2026-09-01', actor: { id: 'a', role: 'author', affiliation: 'project-maintainer' }, note: 'n' },
  { seq: 2, type: 'decided', at: '2026-09-04T10:00:00Z', actor: { id: 'm', role: 'maintainer', affiliation: 'project-maintainer' }, note: 'ruled', dissent: 'd', reversingEvidence: 'r' },
] };

function release({ records } = {}) {
  const bundle = {
    format: 'credential-evidence/records-bundle', formatVersion: 1, sourceRevision: { commit: 'a'.repeat(40) }, schemaRevision: '1.8.0', schemas: [], compatibilityInputs: [],
    records: records ?? [
      record('records/families/acme/deploy-token.json', family('acme:deploy-token')),
      record('records/families/acme/legacy-key.json', family('acme:legacy-key', { currentContract: null, research: { state: 'unresearched', researchedAt: null } })),
      record('records/families/other/not-in-taxonomy.json', family('other:not-in-taxonomy')),
      record('records/contracts/acme/deploy-token@1.json', contract('acme:deploy-token', 1, { period: 'historical' })),
      record('records/contracts/acme/deploy-token@2.json', contract('acme:deploy-token', 2, { period: 'current' })),
      record('records/contracts/acme/legacy-key@1.json', contract('acme:legacy-key', 1, { period: 'proposed', claims: [], openQuestions: undefined })),
      record('records/sources/docs-acme.json', source),
      record('records/reviews/acme/deploy-token.json', review),
    ],
  };
  const bundleBytes = Buffer.from(JSON.stringify(bundle));
  const manifest = { format: 'credential-evidence/release-manifest', tag: 'snapshot-test', schemaRevision: '1.8.0', sourceRevision: { commit: 'a'.repeat(40), recordsTree: { kind: 'records-tree-sha256', digest: 'b'.repeat(64) } }, files: [{ asset: 'records-bundle.json', sha256: sha(bundleBytes) }] };
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const pin = { revision: `records-tree-sha256:${'b'.repeat(64)}`, evidenceSchema: 'credential-evidence/schema/1.8.0', release: { tag: 'snapshot-test', manifestDigest: `sha256:${sha(manifestBytes)}` } };
  return { bundle, bundleBytes, manifestBytes, pin };
}

const ids = ['acme:deploy-token', 'acme:legacy-key', 'acme:absent'];
// The current revision for acme:deploy-token is @2, and its family record still points at @1 in the fixture above: point it at @2.
function projected() {
  const r = release();
  r.bundle.records[0] = record('records/families/acme/deploy-token.json', family('acme:deploy-token', { currentContract: 'acme:deploy-token@2' }));
  return { ...r, projection: projectResearch({ bundle: r.bundle, familyIds: ids, source: sourceOf({ manifestBytes: r.manifestBytes, bundleBytes: r.bundleBytes }) }) };
}

test('the pinned release verifies, and any other manifest, bundle or schema is refused with the reason', () => {
  const { pin, manifestBytes, bundleBytes } = release();
  assert.deepEqual(releaseProblems({ pin, manifestBytes, bundleBytes }), []);
  assert.match(releaseProblems({ pin, manifestBytes, bundleBytes: Buffer.from(`${bundleBytes} `) }).join(), /records-bundle.json is sha256:/);
  assert.match(releaseProblems({ pin: { ...pin, release: { ...pin.release, manifestDigest: `sha256:${'0'.repeat(64)}` } }, manifestBytes, bundleBytes }).join(), /registry pins sha256:0/);
  assert.match(releaseProblems({ pin: { ...pin, evidenceSchema: 'credential-evidence/schema/1.9.0' }, manifestBytes, bundleBytes }).join(), /schema 1.8.0/);
  assert.match(releaseProblems({ pin: { ...pin, revision: 'records-tree-sha256:c' }, manifestBytes, bundleBytes }).join(), /records tree/);
});

test('a family is projected as recorded: every revision in order, the current one presented, rulings by reference, sources once', () => {
  const { projection } = projected();
  assert.deepEqual(Object.keys(projection.families), ['acme:deploy-token', 'acme:legacy-key'], 'only taxonomy families with a record; an absent one is not invented');
  const f = projection.families['acme:deploy-token'];
  assert.deepEqual(f.revisions.map(r => [r.id, r.period, r.current, r.supersedes]), [['acme:deploy-token@1', 'historical', false, null], ['acme:deploy-token@2', 'current', true, 'acme:deploy-token@1']]);
  assert.equal(f.contract.id, 'acme:deploy-token@2');
  assert.deepEqual(f.review.decided, [{ ref: 'review-acme-deploy-token#2', at: '2026-09-04', note: 'ruled' }]);
  assert.deepEqual(f.review.latest, { seq: 2, type: 'decided', at: '2026-09-04', role: 'maintainer', affiliation: 'project-maintainer' });
  assert.deepEqual(f.contract.openQuestions, [{ id: 'length', question: 'How long is the body?', raisedAt: '2026-09-03' }]);
  assert.deepEqual(projection.sources['docs-acme'], { title: 'Tokens', sourceType: 'provider-documentation', url: 'https://docs.acme.invalid/tokens', pin: 'live-unpinned', lastReadAt: '2026-09-01', lastOutcome: 'unreachable' }, 'an unreachable re-read does not advance the read date');
  const legacy = projection.families['acme:legacy-key'];
  assert.equal(legacy.currentContract, null);
  assert.equal(legacy.contract.id, 'acme:legacy-key@1', 'with no current revision the latest one is presented, with its own period');
  assert.deepEqual(legacy.contract.openQuestions, []);
  assert.equal(legacy.review.history, null);
  assert.deepEqual(projectionProblems(projection, { familyIds: ids }), []);
});

test('the validator refuses a family outside the taxonomy, an unlisted source, a broken revision chain and a schema break', () => {
  const { projection } = projected();
  const copy = () => structuredClone(projection);
  assert.match(projectionProblems(projection, { familyIds: ['acme:legacy-key'] }).join(), /acme:deploy-token is not a taxonomy family/);
  const unlisted = copy(); delete unlisted.sources['docs-acme'];
  assert.match(projectionProblems(unlisted, { familyIds: ids }).join(), /cites docs-acme, which is not listed/);
  const chain = copy(); chain.families['acme:deploy-token'].revisions[1].supersedes = 'acme:deploy-token@9';
  assert.match(projectionProblems(chain, { familyIds: ids }).join(), /supersedes acme:deploy-token@9/);
  const flag = copy(); flag.families['acme:deploy-token'].revisions[0].current = true;
  assert.match(projectionProblems(flag, { familyIds: ids }).join(), /current flag disagrees/);
  const selected = copy(); selected.families['acme:deploy-token'].contract.id = 'acme:deploy-token@1';
  assert.match(projectionProblems(selected, { familyIds: ids }).join(), /presented contract must be acme:deploy-token@2/);
  const status = copy(); status.families['acme:deploy-token'].supportStatus = 'stable';
  assert.match(projectionProblems(status, { familyIds: ids }).join(), /must NOT have additional properties/, 'a support status has no field');
  const tampered = release();
  tampered.bundle.records[0].text = tampered.bundle.records[0].text.replace('Name of', 'Renamed');
  assert.throws(() => projectResearch({ bundle: tampered.bundle, familyIds: ids, source: projection.source }), /does not match the bundle's sha256/);
});

test('a projection from another release than the pin is not bound', () => {
  const { projection, pin } = projected();
  assert.deepEqual(bindingProblems(projection, pin), []);
  assert.match(bindingProblems(projection, { ...pin, release: { tag: 'snapshot-next', manifestDigest: pin.release.manifestDigest } }).join(), /registry pins snapshot-next/);
});

test('the committed projection is valid and bound to the evidence release the registry pins', () => {
  assert.deepEqual(checkProjection(), []);
  assert.throws(() => evidencePin({ populations: [] }), /no public-evidence-snapshot/);
});
