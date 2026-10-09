import test from 'node:test';
import assert from 'node:assert/strict';
import { piiEvidencePublication } from '../scripts/pii-evidence-publication.mjs';
import { loadPiiCoverage, joinPiiCoverageInventory } from '../scripts/lib/pii-coverage-join.mjs';
const root = new URL('../', import.meta.url).pathname;
const load = async () => { const comparison = (await piiEvidencePublication(root)).view.comparison;
  return { comparison, view: await loadPiiCoverage(root, { comparison }) }; };
test('exact artifact catalogs independently declare baseline and candidate families without granting support', async () => {
  const { view } = await load();
  for (const side of ['baseline', 'candidate']) {
    const joined = view.matrices.active[side], rows = joined.matrix.rows;
    assert.ok(joined.binding); assert.equal(rows.length, view.inventories.active.rows.length);
    assert.equal(rows.find(row => row.kindKey === 'email/global/basic').capability.state, 'declared');
    assert.equal(rows.find(row => row.kindKey.startsWith('medical-record-number/')).capability.state, 'explicitly-absent');
    assert.equal(rows.find(row => row.kindKey.startsWith('national-id/')).capability.state, 'unknown');
    assert.ok(rows.every(row => row.observation.axes.length === 0));
    assert.ok(rows.every(row => row.state !== 'measured-supported'));
    assert.equal(joined.outcomes.reduce((sum, row) => sum + row.outcomes.length, 0), 139);
    assert.equal(joined.familyMetrics.state, 'unavailable');
    assert.equal(joined.perKindLossAccounting, 'unavailable');
  }
  assert.notEqual(view.matrices.active.baseline.matrix.identity.productCommitment, view.matrices.active.candidate.matrix.identity.productCommitment);
  for (const side of ['baseline', 'candidate']) {
    assert.equal(view.matrices.proposed[side].binding, null);
    assert.equal(view.matrices.proposed[side].outcomes.length, 0);
    assert.ok(view.matrices.proposed[side].matrix.rows.every(row => row.capability.state === 'unknown'));
  }
});
test('stale population, wrong snapshot and mixed run identities withhold all observations', async () => {
  const { comparison, view } = await load();
  for (const mutation of [value => { value.population.digest = '0'.repeat(64); }, value => { value.evidence.snapshot.id = 'another'; }, value => { delete value.importer; }, value => { delete value.engine; }, value => { delete value.scanner; }, value => { delete value.scanner.configurationDigest; }, value => { delete value.scanner.activationDigest; }, value => { delete value.provenance; }]) {
    const broken = structuredClone(comparison); mutation(broken);
    const joined = joinPiiCoverageInventory({ inventory: view.inventories.active, comparison: broken, side: 'baseline' });
    assert.equal(joined.binding, null); assert.equal(joined.outcomes.length, 0);
    assert.ok(joined.matrix.rows.every(row => row.observation.status === 'identity-mismatch'));
  }
  const proposal = joinPiiCoverageInventory({ inventory: view.inventories.proposed, comparison, side: 'candidate' });
  assert.equal(proposal.binding, null);
});
test('capability declarations must bind exact artifact and refuse ambiguous or unexposed kinds', async () => {
  const { comparison, view } = await load(), inventory = view.inventories.active;
  const commitment = view.matrices.active.baseline.matrix.identity.productCommitment;
  const declaration = { productCommitment: commitment, source: 'reviewed-product-catalog', rows: [{ kindKey: 'email/global/basic', state: 'declared' }] };
  assert.throws(() => joinPiiCoverageInventory({ inventory, comparison, side: 'candidate', capabilityDeclarations: declaration }), /declaration-product-mismatch/);
  assert.throws(() => joinPiiCoverageInventory({ inventory, comparison, side: 'baseline', capabilityDeclarations: { ...declaration, rows: [...declaration.rows, ...declaration.rows] } }), /declaration-kind-ambiguous/);
  assert.throws(() => joinPiiCoverageInventory({ inventory, comparison, side: 'baseline', capabilityDeclarations: { ...declaration, rows: [{ kindKey: 'hidden-kind', state: 'declared' }] } }), /declaration-kind-ambiguous/);
});
