import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts, controlAxis } from '../benchmarks/lib/assessment.ts';
import { BETA8_MODULES, arrivalIds } from '../benchmarks/lib/beta8/index.ts';
import { BEDROCK_SHORT_HEAD, BEDROCK_SHORT_HEAD_TEXT } from '../benchmarks/lib/beta8/384b.ts';
import { beta8ProfileCounts } from '../scripts/report-beta8-profiles.mjs';

// Beta.10 contracts and corpus (#384): the conventions that tests/beta8.test.mjs cannot see because
// they are specific to these five slices.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const generated = buildCorpora();
const slices = ['384a', '384b', '384c', '384d', '384e'];
const corpora = slices.map(key => [`beta8-${key}`, generated[`beta8-${key}`]]);
const modules = BETA8_MODULES.filter(m => slices.includes(m.issue));
const families = modules.flatMap(m => m.arrivalFamilies);
const taxonomy = await read('benchmarks/support/taxonomy.json');
const secretsOf = f => f.expected.filter(r => (r.role ?? 'secret') === 'secret');
const valueOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();

test('the thirteen Beta.10 families are arrival families, each with a contract, a taxonomy row that maps no detector, and a profile', () => {
  assert.equal(families.length, 13);
  const taxonomyIds = new Set(taxonomy.families.map(f => f.id));
  for (const family of families) {
    assert.ok(arrivalIds.has(family.id), family.id);
    assert.ok(contracts[family.id], family.id);
    const row = taxonomy.families.find(f => f.id === family.taxonomy);
    assert.ok(row, `${family.id}: taxonomy row ${family.taxonomy}`);
    assert.deepEqual(row.detectors, [], `${family.id}: an unscored arrival family maps no registry detector`);
    assert.ok(taxonomyIds.has(family.taxonomy));
  }
  // The two research dispositions that stay pending carry no corpus.
  for (const id of ['mistral:realtime-client-token', 'voyage-ai:api-key']) {
    const row = taxonomy.families.find(f => f.id === id);
    assert.equal(row.supportStatus, 'pending', id);
    assert.deepEqual(row.detectors, [], id);
  }
});

test('tiers follow the evidence: T1 only on the Anthropic prefixes, T0 where no shape is evidenced, context-gated where no bare value is claimed', () => {
  const tier = Object.fromEntries(families.map(f => [f.id, contracts[f.id].tier]));
  assert.deepEqual(Object.entries(tier).filter(([, t]) => t === 'T1').map(([id]) => id).sort(), ['anthropic-admin01-key', 'anthropic-api01-key']);
  assert.deepEqual(Object.entries(tier).filter(([, t]) => t === 'T0').map(([id]) => id).sort(), ['ai21-api-key', 'exa-api-key']);
  for (const id of ['mistral-api-key', 'cohere-api-key', 'deepgram-api-key', 'ai21-api-key', 'exa-api-key']) assert.equal(contracts[id].contextGated, true, id);
  for (const id of ['aws-bedrock-long-term-api-key', 'aws-bedrock-short-term-api-key', 'elevenlabs-api-key']) assert.ok(contracts[id].candidateSource, `${id}: the T1 candidate source is recorded, the tier is not promoted`);
  assert.equal(contracts['exa-api-key'].pattern, undefined, 'Exa has no evidenced value grammar');
  // Marker-less sk-admin- bodies are out of contract (redact-secret#863).
  assert.equal(new RegExp(contracts['openai-admin-api-key'].pattern).test(`sk-admin-${'a'.repeat(124)}`), false);
});

test('every Beta.10 target meets its declared fixture profile', async () => {
  const counts = (await beta8ProfileCounts()).filter(c => families.some(f => f.id === c.target));
  assert.equal(counts.length, 13);
  for (const c of counts) assert.deepEqual(c.debt, [], `${c.target} (${c.profile})`);
});

test('no Beta.10 source file carries a complete synthetic credential as a literal', async () => {
  const files = slices.flatMap(key => [`fixtures/generated/beta8/${key}.mjs`, `benchmarks/lib/beta8/${key}.ts`]);
  const shapes = [/sk-ant-(?:api01|admin01)-[A-Za-z0-9_-]{40,}/, /sk-admin-[A-Za-z0-9_-]{40,}/, /ABSK[A-Za-z0-9+/]{60,}/, /bedrock-api-key-[A-Za-z0-9+/]{150,}/,
    /tgp_v1_[A-Za-z0-9_-]{40,}/, /tvly-(?:dev-)?[A-Za-z0-9]{30,}/, /\bsk_[0-9a-f]{40,}/, /sk_live_[A-Za-z0-9]{20,}/];
  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    for (const shape of shapes) assert.equal(shape.test(source), false, `${file} matches ${shape}`);
  }
});

test('every positive satisfies its own contract pattern, and every twin of a pattern-bearing family differs by one recorded property', () => {
  for (const [category, corpus] of corpora) {
    const byId = new Map(corpus.fixtures.map(f => [f.id, f]));
    for (const f of corpus.fixtures) {
      const target = (f.arrivalTargets ?? f.detectors)[0];
      const pattern = contracts[target].pattern && new RegExp(contracts[target].pattern);
      if (secretsOf(f).length && pattern) for (const r of secretsOf(f)) assert.ok(pattern.test(valueOf(f, r)), `${category}--${f.id}`);
      if (f.twinOf) {
        const positive = byId.get(f.twinOf);
        assert.ok(positive && secretsOf(positive).length, `${f.id}: twin names an authored positive`);
        assert.ok(f.mutation && f.mutationKind, f.id);
        if (f.mutationKind === 'context') {
          // A context twin keeps the positive's value byte-for-byte and changes only the context.
          const value = valueOf(positive, secretsOf(positive)[0]);
          assert.ok(f.content.includes(value), `${f.id}: context twin keeps the value`);
          assert.notEqual(f.content, positive.content, f.id);
        } else if (pattern) assert.equal(pattern.test(f.content.trim()), false, `${f.id}: a structural twin is outside the contract`);
      }
    }
  }
});

test('Bedrock: the 133-character short-term head is derived from the fixed pre-signed URL head, and every short-term positive carries it', () => {
  assert.equal(BEDROCK_SHORT_HEAD.length, 133);
  assert.ok(Buffer.from(BEDROCK_SHORT_HEAD, 'base64').toString('utf8').startsWith(BEDROCK_SHORT_HEAD_TEXT.slice(0, 96)));
  const corpus = generated['beta8-384b'];
  const short = corpus.fixtures.filter(f => f.arrivalTargets[0] === 'aws-bedrock-short-term-api-key' && secretsOf(f).length && !f.twinOf);
  assert.ok(short.length >= 6);
  for (const f of short) assert.ok(valueOf(f, secretsOf(f)[0]).startsWith(`bedrock-api-key-${BEDROCK_SHORT_HEAD}`), f.id);
  const lengths = new Set(corpus.fixtures.filter(f => f.arrivalTargets[0] === 'aws-bedrock-long-term-api-key' && secretsOf(f).length && !f.twinOf).map(f => valueOf(f, secretsOf(f)[0]).length));
  assert.deepEqual([...lengths].sort(), [132, 136], 'long-term positives carry the 132 and 136 character shapes');
});

test('ElevenLabs: the residency suffix is an envelope around the 51-character secret span, never asserted inside or outside it', () => {
  const corpus = generated['beta8-384c'];
  const residency = corpus.fixtures.find(f => f.id === 'elevenlabs-api-key-residency-suffix');
  const [span] = secretsOf(residency);
  assert.equal(valueOf(residency, span).length, 51);
  assert.ok(span.envelope.end - span.envelope.start > span.end - span.start);
  assert.ok(residency.content.includes('_residency_eu'));
  assert.ok(!corpus.fixtures.some(f => f.twinOf && /uppercase/.test(f.id)), 'no uppercase-hex twin: the tools disagree');
});

test('the Stripe-shaped ElevenLabs twin and the api03 Anthropic twin are twins, never controls', () => {
  const eleven = generated['beta8-384c'].fixtures.find(f => f.id === 'elevenlabs-api-key-stripe-shaped-twin');
  assert.ok(eleven.twinOf && /sk_live_/.test(eleven.content));
  const anthropic = generated['beta8-384a'].fixtures.find(f => f.id === 'anthropic-api01-key-api03-prefix-twin');
  assert.ok(anthropic.twinOf && /sk-ant-api03-/.test(anthropic.content));
  for (const [category, corpus] of corpora)
    for (const f of corpus.fixtures.filter(f => !f.twinOf && !secretsOf(f).length))
      assert.ok(!/sk_live_|sk_test_|AKIA[A-Z2-7]{16}|ASIA[A-Z0-9]{16}/.test(f.content), `${category}--${f.id}: a benign control carries another family's credential shape`);
});

test('every Beta.10 control names a reviewed axis', () => {
  for (const [category, corpus] of corpora)
    for (const f of corpus.fixtures.filter(f => !f.twinOf && !secretsOf(f).length)) assert.ok(controlAxis(category, f), `${category}--${f.id}`);
});
