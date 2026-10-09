import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/credential-regressions/index.ts';
import { HANDOFF_REVISION } from '../benchmarks/lib/credential-regressions/434-sources.ts';
import { beta8ProfileCounts } from '../scripts/report-fixture-profiles.mjs';

// Beta.11 contracts and corpus for the #860 Tier A READY credential families (#434): the conventions
// tests/beta8.test.mjs cannot see because they are specific to these seven slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = ['434a', '434b', '434c', '434d', '434e', '434f', '434g'];
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
const families = modules.flatMap(m => m.arrivalFamilies);
/** The seven detector-id families graduated to registry contracts at the 1127bf9 re-pin; the eleven siblings stay arrival families. */
const graduated = modules.flatMap(m => Object.keys(m.registryContracts ?? {}));
const ids = [...families.map(f => f.id), ...graduated];
const taxonomy = await read('benchmarks/support/taxonomy.json');
const targetOf = f => (f.arrivalTargets ?? f.detectors)[0];
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();
const handoffFile = { '434a': 'doppler.md', '434b': 'trigger-dev.md', '434c': 'e2b.md', '434d': 'posthog.md', '434e': 'helicone.md', '434f': 'firecrawl.md', '434g': 'composio.md' };
/** An unanchored form of a contract pattern, bounded the way every handoff bounds a match: no [A-Za-z0-9_-] on either side. */
const unanchored = pattern => new RegExp(`(?<![A-Za-z0-9_.-])(?:${pattern.slice(1, -1)})(?![A-Za-z0-9_-])`);

test('the eighteen #434 families are T1 with a provider source, a taxonomy row, a documented-24 profile and their handoff; seven graduated at the 1127bf9 re-pin, eleven are scored by finding type', async () => {
  assert.deepEqual([...ids].sort(), [
    'composio-api-key', 'composio-org-api-key', 'composio-user-api-key',
    'doppler-audit-token', 'doppler-cli-token', 'doppler-personal-token', 'doppler-scim-token',
    'doppler-service-account-identity-token', 'doppler-service-account-token', 'doppler-token',
    'e2b-api-key', 'firecrawl-api-key', 'helicone-api-key', 'helicone-write-api-key',
    'posthog-project-secret-api-key', 'posthog-token', 'trigger-dev-personal-access-token', 'trigger-dev-token',
  ]);
  assert.deepEqual([...graduated].sort(), ['composio-api-key', 'doppler-token', 'e2b-api-key', 'firecrawl-api-key', 'helicone-api-key', 'posthog-token', 'trigger-dev-token']);
  const registry = new Set((await read('benchmarks/detectors.json')).detectors.map(d => d.id));
  const taxonomyOf = { 'doppler-token': 'doppler:service-token', 'trigger-dev-token': 'trigger-dev:secret-api-key', 'e2b-api-key': 'e2b:api-key', 'posthog-token': 'posthog:personal-api-key', 'helicone-api-key': 'helicone:api-key', 'firecrawl-api-key': 'firecrawl:api-key', 'composio-api-key': 'composio:project-api-key' };
  for (const m of modules)
    for (const id of [...m.arrivalFamilies.map(f => f.id), ...Object.keys(m.registryContracts ?? {})]) {
      const arrival = m.arrivalFamilies.find(f => f.id === id);
      assert.equal(arrivalIds.has(id), Boolean(arrival), id);
      assert.equal(registry.has(id), !arrival, `${id}: a graduated family is a registry detector, a sibling is not`);
      const c = contracts[id];
      assert.equal(c.tier, 'T1', id);
      assert.ok(c.providerSource?.url, `${id}: T1 carries its provider source`);
      assert.ok(c.pattern?.startsWith('^') && c.pattern.endsWith('$'), `${id}: anchored value grammar`);
      assert.ok(c.references.includes(`https://github.com/redact-secret/redact-secret/blob/${HANDOFF_REVISION}/docs/audits/evidence/860/${handoffFile[m.issue]}`), `${id}: cites its frozen handoff`);
      assert.ok(c.fields.some(x => x.field === 'peer-lag'), `${id}: records where the pinned peers stand`);
      assert.equal(m.profiles[id], 'documented-24', id);
      const row = taxonomy.families.find(t => t.id === (arrival?.taxonomy ?? taxonomyOf[id]));
      assert.ok(row, `${id}: taxonomy row`);
      assert.deepEqual(row.detectors, [id], `${id}: the taxonomy row maps to the family's own id (registry detector or scored arrival id)`);
      assert.equal(row.supportStatus, undefined, `${id}: no hand-edited support status`);
    }
});

test('every #434 target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => ids.includes(c.target));
  assert.equal(counts.length, 18);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
});

test('no #434 source file carries a complete credential-shaped literal', async () => {
  const files = [...slices.flatMap(key => [`fixtures/generators/credential-regressions/${key}.mjs`, `benchmarks/lib/credential-regressions/${key}.ts`]), 'fixtures/generators/credential-regressions/434-shared.mjs'];
  const shapes = ids.map(id => unanchored(contracts[id].pattern));
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const shape of shapes) assert.equal(shape.test(source), false, `${file} matches ${shape}`);
  }
});

test('every positive satisfies its own contract, and every twin is outside it by one recorded property', () => {
  for (const [category, corpus] of corpora) {
    const byId = new Map(corpus.fixtures.map(f => [f.id, f]));
    for (const f of corpus.fixtures) {
      const target = targetOf(f);
      const pattern = new RegExp(contracts[target].pattern);
      for (const r of secretsOf(f)) assert.ok(pattern.test(valueOf(f, r)), `${category}--${f.id}`);
      if (f.twinOf) {
        const positive = byId.get(f.twinOf);
        assert.ok(positive && secretsOf(positive).length, `${f.id}: twin names an authored positive`);
        assert.ok(f.mutation && f.mutationKind && f.mutationKind !== 'context', `${f.id}: a structural twin with a recorded mutation`);
        assert.equal(unanchored(contracts[target].pattern).test(f.content), false, `${f.id}: no in-contract value of its own family remains in the twin`);
      }
    }
  }
});

test('no benign control contains a value inside any #434 contract', () => {
  const shapes = ids.map(id => [id, unanchored(contracts[id].pattern)]);
  for (const [category, corpus] of corpora)
    for (const f of corpus.fixtures.filter(x => !x.twinOf && !secretsOf(x).length))
      for (const [id, shape] of shapes) assert.equal(shape.test(f.content), false, `${category}--${f.id} holds a ${id} value`);
});

test('the handoff test axes are present: the nine index contexts per family, public siblings only as controls, other credential classes only as twins', () => {
  const index = ['bare-prose', 'dotenv', 'export', 'bearer-header', 'x-api-key-header', 'json-token', 'json-api-key', 'sdk-kwarg', 'chat-paste'];
  const all = corpora.flatMap(([, c]) => c.fixtures);
  for (const id of ids)
    for (const slug of index) assert.ok(all.some(f => f.id === `${id}-${slug}` && secretsOf(f).length), `${id}: ${slug}`);
  // PostHog phc_ and Trigger.dev pk_<env>_ are public by design: controls, never positives, never under a credential-named key.
  const phc = all.filter(f => /(?<![A-Za-z0-9_])phc_[0-9A-Za-z]{40,}/.test(f.content));
  assert.ok(phc.some(f => !f.twinOf && f.id.endsWith('-public-id')));
  for (const f of phc.filter(x => !x.twinOf)) assert.ok(!/_(?:API_)?KEY\s*[=:]|api_key|token"/i.test(f.content), `${f.id}: phc_ outside credential-named assignments`);
  // The retired sk_e2b_, bkend.ai ak_ + 64 hex and the org key in the project-key position are twins.
  for (const slug of ['e2b-api-key-retired-user-token-twin', 'composio-api-key-bkend-ak-64-hex-twin', 'composio-api-key-inside-oak-twin', 'trigger-dev-token-public-key-prefix-twin'])
    assert.ok(all.some(f => f.id === slug && f.twinOf), slug);
  // Doppler: every type has the 40/43/44 band, and dp.st. carries 2- and 35-byte environment segments.
  const dopplerWidths = new Set(all.filter(f => targetOf(f) === 'doppler-token' && secretsOf(f).length && !f.twinOf).map(f => valueOf(f, secretsOf(f)[0]).split('.').at(-1).length));
  assert.deepEqual([...dopplerWidths].sort(), [40, 43, 44]);
  for (const width of [2, 35]) assert.ok(all.some(f => targetOf(f) === 'doppler-token' && secretsOf(f).length && valueOf(f, secretsOf(f)[0]).split('.').length === 4 && valueOf(f, secretsOf(f)[0]).split('.')[2].length === width), `segment ${width}`);
  // PostHog: base57 48/49 and base62 42/43/46/47/48 bodies for both prefixes.
  for (const target of ['posthog-token', 'posthog-project-secret-api-key']) {
    const widths = new Set(all.filter(f => targetOf(f) === target && secretsOf(f).length && !f.twinOf).map(f => valueOf(f, secretsOf(f)[0]).length - 4));
    assert.deepEqual([...widths].sort((a, b) => a - b), [42, 43, 46, 47, 48, 49], target);
  }
});
