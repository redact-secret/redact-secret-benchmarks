import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadPiiCoverageInventories, consumePiiCoverageInventory } from '../scripts/lib/pii-coverage-inventory.mjs';
const root = new URL('../', import.meta.url).pathname;
const read = async file => JSON.parse(await readFile(`${root}${file}`, 'utf8'));
const input = async role => {
  const pins = role === 'active' ? 'benchmarks/pii-evidence' : 'benchmarks/inputs/pii-evidence-snapshot-v2-candidate';
  return { role, policy: await read('benchmarks/pii-population-policy.json'), snapshotPin: await read(`${pins}/snapshot-pin.json`),
    consumerPin: await read(`${pins}/consumer-pin.json`), preflight: await read(`${pins}/preflight.json`),
    manifestBytes: await readFile(`${root}benchmarks/inputs/pii-coverage/${role}/manifest.json`),
    taxonomyBytes: await readFile(`${root}benchmarks/inputs/pii-coverage/${role}/privacy-kinds.json`) };
};
test('full source inventory retains zero-case and unmapped identities before evaluator filtering', async () => {
  const { active, proposed } = await loadPiiCoverageInventories(root);
  assert.equal(active.rows.length, 10); assert.equal(proposed.rows.length, 12);
  for (const role of [active, proposed]) {
    const empty = role.rows.filter(row => row.evidence.authoredCases === 0);
    assert.deepEqual(empty.map(row => row.kindKey), ['iban/global/basic', 'national-id/unresolved/placeholder', 'payment-card/global/basic']);
    assert.equal(empty.find(row => row.kindKey.startsWith('national-id')).evidence.importedCases, null);
    assert.equal(role.rows.every(row => row.source.snapshotId === role.source.snapshot.id), true);
  }
  assert.equal(proposed.rows.some(row => row.kindKey === 'uk-nino/uk/structured'), true);
  assert.equal(active.rows.some(row => row.kindKey === 'uk-nino/uk/structured'), false);
});
test('source and import grains reconcile separately, including explicit one-kind-to-many-family mapping', async () => {
  const { active, proposed } = await loadPiiCoverageInventories(root);
  assert.deepEqual(active.totals, { kinds: 10, authoredCases: 49, fixtures: 139, importedCases: 55, variants: 139, occurrences: 139 });
  assert.deepEqual(proposed.totals, { kinds: 12, authoredCases: 118, fixtures: 285, importedCases: 123, variants: 285, occurrences: 285 });
  const dob = proposed.rows.find(row => row.kindKey.startsWith('date-of-birth/'));
  assert.deepEqual(dob.mapping.families, ['pii:global:date-of-birth', 'pii:us:date-of-birth', 'pii:gb:date-of-birth']);
  assert.equal(dob.evidence.occurrences, null);
  assert.ok(proposed.limitations.includes('source-deferred-counts-unavailable'));
});
test('tampered source metadata, mismatched pin and stale preflight refuse rather than suppress rows', async () => {
  for (const role of ['active', 'proposed']) {
    const original = await input(role);
    assert.throws(() => consumePiiCoverageInventory({ ...original, taxonomyBytes: Buffer.from('{}') }), /taxonomy-bytes-mismatch/);
    assert.throws(() => consumePiiCoverageInventory({ ...original, manifestBytes: Buffer.from('{}') }), /manifest-bytes-mismatch/);
    const stale = structuredClone(original.preflight); stale.counts.evidenceCases++;
    assert.throws(() => consumePiiCoverageInventory({ ...original, preflight: stale }), /preflight-report-mismatch|mapping-accounting-invalid/);
  }
});
