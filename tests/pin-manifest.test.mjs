import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildPinManifest } from '../benchmarks/lib/pin-manifest.ts';

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

  assert.deepEqual(manifest.fixtureIds, Object.keys(assignments).sort());
  for (const id of manifest.fixtureIds) assert.match(id, /^[a-z][a-z0-9-]*--[a-z][a-z0-9-]*$/);

  assert.deepEqual(Object.keys(manifest.corpusHashes).sort(), categories.map(c => c.id).sort());
  for (const category of categories) {
    const text = await readFile(new URL(`../${category.corpus}`, import.meta.url), 'utf8');
    assert.equal(manifest.corpusHashes[category.id], createHash('sha256').update(text).digest('hex'));
  }
  for (const hash of Object.values(manifest.corpusHashes)) assert.match(hash, /^[a-f0-9]{64}$/);
});
