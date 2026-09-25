import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { taxonomy, familiesForDetector, undetectedFamilies, familyById, familiesForProvider } from '../benchmarks/support/taxonomy.ts';
import { scoredArrivalFamilies } from '../scanners/families.mjs';

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const schema = await read('schemas/taxonomy-v1.json');
const registry = await read('benchmarks/detectors.json');

const ajv = new Ajv({ strict: true });
const validate = ajv.compile(schema);

test('taxonomy.json satisfies its schema', () => {
  const valid = validate(taxonomy);
  assert.ok(valid, JSON.stringify(validate.errors));
});

test('every registered detector maps to at least one family', () => {
  const mapped = new Set(taxonomy.families.flatMap(f => f.detectors));
  for (const d of registry.detectors) assert.ok(mapped.has(d.id), `${d.id} has no family`);
});

test('every family references a real detector or a scored arrival family and, when scoped to a provider, a registered provider', () => {
  // #730: an arrival family the product types inside a shared detector is scored under its own id.
  const detectorIds = new Set([...registry.detectors.map(d => d.id), ...scoredArrivalFamilies]);
  const providerIds = new Set(taxonomy.providers.map(p => p.id));
  for (const f of taxonomy.families) {
    for (const d of f.detectors) assert.ok(detectorIds.has(d), `${f.id} references unknown detector ${d}`);
    if (f.provider !== null) assert.ok(providerIds.has(f.provider), `${f.id} references unknown provider ${f.provider}`);
  }
});

test('family ids are unique and provider-prefixed, or "generic:" when not provider-specific', () => {
  const ids = taxonomy.families.map(f => f.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const f of taxonomy.families) assert.equal(f.id.split(':')[0], f.provider ?? 'generic');
});

test('a family with no detector always carries a reason: a source or a note', () => {
  for (const f of undetectedFamilies()) assert.ok((f.sources?.length ?? 0) > 0 || f.note, `${f.id} claims unsupported with no evidence`);
});

test('github-token serves five families; the fine-grained PAT is scored as its own arrival family, not by github-token', () => {
  assert.equal(familiesForDetector('github-token').length, 5);
  const fgpat = familyById('github:fine-grained-personal-access-token');
  assert.ok(fgpat);
  assert.deepEqual(fgpat.detectors, ['github-fine-grained-pat']);
});

test('#730: each scored arrival family is the sole id of exactly one taxonomy family', () => {
  for (const id of scoredArrivalFamilies) {
    const served = familiesForDetector(id);
    assert.equal(served.length, 1, id);
    assert.deepEqual(served[0].detectors, [id], id);
  }
});

test('a detector serving several families and a family served by several detectors are both expressible', () => {
  assert.ok(familiesForDetector('stripe-token').length > 1);
  assert.ok(familiesForProvider('digitalocean').every(f => f.detectors.includes('digitalocean-token')));
});
