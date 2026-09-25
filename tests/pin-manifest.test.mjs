import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildPinManifest, mergePinSources, packPinEntries } from '../benchmarks/lib/pin-manifest.ts';
import { loadPacks } from '../benchmarks/lib/adversarial-packs.ts';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));

test('manifest is generated fresh with the given revision when nothing existed before', () => {
  const manifest = buildPinManifest({ pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['b--1', 'a--1'] }, null, 'rev1');
  assert.deepEqual(manifest, { schemaVersion: 1, revision: 'rev1', pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1', 'b--1'] });
});

test('manifest keeps the committed revision when nothing meaningful changed', () => {
  const current = { schemaVersion: 1, revision: 'old-rev', pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1', 'b--1'] };
  const manifest = buildPinManifest({ pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['b--1', 'a--1'] }, current, 'new-rev');
  assert.equal(manifest.revision, 'old-rev');
});

test('manifest bumps the revision when a pin value drifts', () => {
  const current = { schemaVersion: 1, revision: 'old-rev', pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1'] };
  const manifest = buildPinManifest({ pins: { a: 2 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1'] }, current, 'new-rev');
  assert.equal(manifest.revision, 'new-rev');
  assert.deepEqual(manifest.pins, { a: 2 });
});

test('manifest bumps the revision when a corpus hash drifts', () => {
  const current = { schemaVersion: 1, revision: 'old-rev', pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1'] };
  const manifest = buildPinManifest({ pins: { a: 1 }, corpusHashes: { x: 'h2' }, fixtureIds: ['a--1'] }, current, 'new-rev');
  assert.equal(manifest.revision, 'new-rev');
});

test('manifest bumps the revision when the fixture id list drifts', () => {
  const current = { schemaVersion: 1, revision: 'old-rev', pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1'] };
  const manifest = buildPinManifest({ pins: { a: 1 }, corpusHashes: { x: 'h1' }, fixtureIds: ['a--1', 'a--2'] }, current, 'new-rev');
  assert.equal(manifest.revision, 'new-rev');
  assert.deepEqual(manifest.fixtureIds, ['a--1', 'a--2']);
});

test('committed pin manifest is schema-correct, matches live pin sources, and carries no fixture content', async () => {
  const manifest = await read('benchmarks/pin-manifest.json');
  const categories = await read('benchmarks/categories.json');
  const registry = await read('benchmarks/detectors.json');
  const inventory = await read('benchmarks/detector-inventory.json');
  const packageJson = await read('package.json');
  const assignments = await read('benchmarks/fixture-detectors.json');

  assert.deepEqual(Object.keys(manifest).sort(), ['corpusHashes', 'fixtureIds', 'pins', 'revision', 'schemaVersion']);
  assert.deepEqual(Object.keys(manifest.pins).sort(), ['packageVersion', 'redactSecretRevision', 'redactSecretVersion', 'sourceRevision']);
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.revision, /^[a-f0-9]{40}$/);

  assert.equal(manifest.pins.sourceRevision, registry.sourceRevision);
  assert.equal(manifest.pins.redactSecretRevision, inventory.redactSecretRevision);
  assert.equal(manifest.pins.redactSecretVersion, inventory.redactSecretVersion);
  assert.equal(manifest.pins.packageVersion, packageJson.dependencies['@redact-secret/core']);

  const packs = packPinEntries(loadPacks(new URL('..', import.meta.url).pathname).map(pack => pack.record));
  assert.deepEqual(manifest.fixtureIds, [...Object.keys(assignments), ...packs.fixtureIds].sort());
  for (const id of manifest.fixtureIds) assert.match(id, /^[a-z][a-z0-9-]*--[a-z][a-z0-9-]*$/);

  assert.deepEqual(Object.keys(manifest.corpusHashes).sort(), [...categories.map(c => c.id), ...Object.keys(packs.corpusHashes)].sort());
  for (const [id, digest] of Object.entries(packs.corpusHashes)) assert.equal(manifest.corpusHashes[id], digest);
  for (const category of categories) {
    const text = await readFile(new URL(`../${category.corpus}`, import.meta.url), 'utf8');
    assert.equal(manifest.corpusHashes[category.id], createHash('sha256').update(text).digest('hex'));
  }
  for (const hash of Object.values(manifest.corpusHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
});

const pack = (id, status, extra = {}) => ({ id, sample: false, status, fixtures: [{ id: 'f-one' }, { id: 'f-two' }], expectations: { digest: `d-${id}` }, ...extra });

test('pack pin entries list only non-sample packs with frozen expectations (#310)', () => {
  const entries = packPinEntries([
    pack('frozen', 'frozen-first-run'),
    pack('accepted', 'accepted'),
    pack('converted', 'converted-to-maintainer-regression'),
    pack('in-review', 'safety-review'),
    pack('submitted', 'submitted'),
    pack('rejected', 'rejected'),
    pack('sample', 'frozen-first-run', { sample: true }),
  ]);
  assert.deepEqual(Object.keys(entries.corpusHashes).sort(), ['accepted', 'converted', 'frozen']);
  assert.equal(entries.corpusHashes.frozen, 'd-frozen');
  assert.deepEqual(entries.fixtureIds.filter(id => id.startsWith('frozen--')), ['frozen--f-one', 'frozen--f-two']);
  assert.equal(entries.fixtureIds.length, 6);
});

test('merging pack entries rejects a pack id or fixture id that collides with a category', () => {
  const categories = { corpusHashes: { alpha: 'h1' }, fixtureIds: ['alpha--f-one'] };
  assert.throws(() => mergePinSources(categories, packPinEntries([pack('alpha', 'accepted')])), /collides with a corpus category id/);
  const merged = mergePinSources(categories, packPinEntries([pack('beta', 'accepted')]));
  assert.deepEqual(merged.corpusHashes, { alpha: 'h1', beta: 'd-beta' });
  assert.deepEqual(merged.fixtureIds, ['alpha--f-one', 'beta--f-one', 'beta--f-two']);
});

test('the frozen beta9 pack is pinned with its committed expectations digest', async () => {
  const intake = await read('adversarial/packs/beta9-external-inputs/intake.json');
  const manifest = await read('benchmarks/pin-manifest.json');
  assert.equal(manifest.corpusHashes['beta9-external-inputs'], intake.expectations.digest);
  for (const fixture of intake.fixtures) assert.ok(manifest.fixtureIds.includes(`beta9-external-inputs--${fixture.id}`), fixture.id);
});
