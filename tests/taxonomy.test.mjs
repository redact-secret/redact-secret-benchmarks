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

test('#373: Vercel modern classes are separate and do not inherit the compatibility aggregate measurement', () => {
  // #1012/#1013: the three READY classes are scored arrival families under their own finding types (redact-secret#1036);
  // vci_ and vck_ stay blocked (ruling Q-VC) and pending.
  const scored = { 'vercel:personal-access-token': 'vercel-personal-access-token', 'vercel:app-access-token': 'vercel-app-access-token', 'vercel:app-refresh-token': 'vercel-app-refresh-token' };
  for (const [id, arrival] of Object.entries(scored)) {
    const family = familyById(id);
    assert.deepEqual(family.detectors, [arrival], id);
    assert.equal(family.supportStatus, undefined, `${id}: no hand-edited support status`);
  }
  const blocked = ['vercel:integration-token', 'vercel:api-key'].map(id => familyById(id));
  assert.ok(blocked.every(Boolean));
  assert.ok(blocked.every(family => family.detectors.length === 0));
  assert.ok(blocked.every(family => family.supportStatus === 'pending'));
  assert.deepEqual(familiesForDetector('vercel-token').map(family => family.id), ['vercel:access-token']);
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

// The product repository publishes each family's display name in its public
// site feed (redact-secret docs/contracts/site-feed/v1/feed.schema.json),
// which bounds every string so no free text or markup reaches a site. A name
// outside that pattern makes the product's `site-feed:generate` fail on the
// next support-matrix refresh, as `tr_<env>_` did for Beta.11. Spell
// placeholders in capitals (`tr_ENV_`) instead of angle brackets.
const FEED_FAMILY_NAME = /^[A-Za-z0-9][A-Za-z0-9 ()/,._+-]{0,79}$/;

test('every family display name fits the product site feed v1 name pattern', () => {
  const invalid = taxonomy.families.filter(family => !FEED_FAMILY_NAME.test(family.name)).map(family => `${family.id}: ${family.name}`);
  assert.deepEqual(invalid, []);
});
