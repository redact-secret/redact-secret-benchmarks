import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildCorpora } from '../fixtures/generated/build.mjs';
import { contracts, classifyFixture, validateAssessment, validateContracts, MUTATION_KINDS } from '../benchmarks/lib/assessment.ts';
import { validateCorpus } from '../benchmarks/lib/scoring.ts';
import { twinProbe } from '../benchmarks/lib/twin-probe.ts';

const read = async path => JSON.parse(await readFile(new URL('../' + path, import.meta.url), 'utf8'));
const registry = await read('benchmarks/detectors.json');
const generated = buildCorpora();
const handwritten = { accuracy: await read('fixtures/accuracy/corpus.json'), 'token-contexts': await read('fixtures/token-contexts/corpus.json') };
const fixtures = Object.entries({ ...generated, ...handwritten }).flatMap(([category, c]) => c.fixtures.map(f => ({ ...f, category })));
const twins = fixtures.filter(f => f.twinOf);
const bytesOf = (f, r) => Buffer.from(f.content).subarray(r.start, r.end).toString();

// The 22 families issue #36 found with no twin anywhere in the corpus.
const TWINNED = ['aws-access-key', 'generic-token', 'connection-string', 'otpauth-uri', 'bearer-token', 'pypi-token', 'new-relic-license-key', 'azure-devops-personal-access-token'];
const UNPROBEABLE = ['vercel-token', 'supabase-token', 'discord-bot-token', 'telegram-bot-token', 'datadog-api-key', 'datadog-application-key', 'twilio-auth-token', 'twilio-api-key-secret', 'new-relic-user-api-key', 'sentry-org-auth-token', 'sentry-user-auth-token', 'grafana-service-account-token', 'grafana-cloud-access-policy-token', 'microsoft-entra-client-secret'];

test('every detector family either has a twin or is recorded un-probeable, never both and never neither', () => {
  assert.equal(TWINNED.length + UNPROBEABLE.length, 22);
  for (const { id } of registry.detectors) {
    const twinned = twins.some(t => t.detectors?.[0] === id), record = contracts[id].unprobeable;
    assert.notEqual(twinned, Boolean(record), id);
    if (record) { assert.ok(record.reason.trim().length > 40, `${id} states why`); assert.match(record.observedAt, /^\d{4}-\d{2}-\d{2}$/, id); }
  }
  assert.deepEqual(registry.detectors.map(d => d.id).filter(id => contracts[id].unprobeable).sort(), [...UNPROBEABLE].sort());
  for (const id of TWINNED) assert.ok(twins.some(t => t.detectors[0] === id), id);
});

test('every family twinned for #36 cites dated documentation for the property its twin mutates', () => {
  for (const id of TWINNED) {
    const source = contracts[id].providerSource ?? contracts[id].twinSource;
    assert.ok(source?.url && source.covers && source.formatVersion, id);
    assert.match(source.observedAt, /^\d{4}-\d{2}-\d{2}$/, id);
    for (const t of twins.filter(t => t.detectors[0] === id)) {
      validateCorpus({ fixtures: fixtures.filter(f => f.category === t.category) });
      validateAssessment(t);
      assert.ok(MUTATION_KINDS.includes(t.mutationKind), t.id);
      assert.equal(t.expected.length, 0, t.id);
    }
  }
});

test('a context twin keeps the value byte-for-byte, changes only its surroundings and is policy-tier', () => {
  const context = twins.filter(t => t.mutationKind === 'context');
  assert.deepEqual([...new Set(context.map(t => t.detectors[0]))].sort(), ['connection-string', 'generic-token']);
  for (const t of context) {
    const positive = fixtures.find(f => f.category === t.category && f.id === t.twinOf);
    const value = bytesOf(positive, positive.expected[0]);
    assert.ok(t.content.includes(value), `${t.id} keeps the value`);
    assert.notEqual(t.content, positive.content);
    assert.equal(positive.assessment.tier, 'T3');
    assert.deepEqual([t.assessment.kind, t.assessment.tier], ['must-not-flag', 'T3'], t.id);
  }
  // A family with a contracted value grammar mutates the value, never the context.
  const github = fixtures.find(f => f.twinOf && f.detectors?.[0] === 'github-token');
  assert.throws(() => classifyFixture('common-formats', { ...github, mutationKind: 'context' }), /Context twin on a contracted value grammar/);
  assert.throws(() => validateAssessment({ ...github, mutationKind: 'scanner-derived' }), /Invalid twin metadata/);
});

test('contract validation rejects an undated or unexplained un-probeable record and a record that also cites a twin source', () => {
  const saved = contracts['vercel-token'].unprobeable;
  try {
    contracts['vercel-token'].unprobeable = { reason: ' ', observedAt: '2026-09-20' };
    assert.throws(() => validateContracts(), /Un-probeable without reason or date/);
    contracts['vercel-token'].unprobeable = { reason: 'Documented nowhere.', observedAt: 'today' };
    assert.throws(() => validateContracts(), /Un-probeable without reason or date/);
    contracts['vercel-token'].unprobeable = saved;
    contracts['vercel-token'].twinSource = contracts['bearer-token'].twinSource;
    assert.throws(() => validateContracts(), /Un-probeable contract with a twin source/);
  } finally { contracts['vercel-token'].unprobeable = saved; delete contracts['vercel-token'].twinSource; }
  validateContracts();
});

test('twinProbe separates discriminated, not discriminated and un-probeable, and keeps un-probeable out of every pair count', () => {
  const book = { a: { tier: 'T2' }, b: { tier: 'T2' }, c: { tier: 'T2', unprobeable: { reason: 'Provider documents nothing.', observedAt: '2026-09-20' } }, d: { tier: 'T0' }, e: { tier: 'T2' } };
  const list = [
    { id: 'a-pos', detectors: ['a'] }, { id: 'a-twin', detectors: ['a'], twinOf: 'a-pos' },
    { id: 'b-pos', detectors: ['b'] }, { id: 'b-twin', detectors: ['b'], twinOf: 'b-pos' }, { id: 'b-twin-2', detectors: ['b'], twinOf: 'b-pos' },
    { id: 'c-pos', detectors: ['c'] },
    { id: 'd-pos', detectors: ['d'] }, { id: 'd-twin', detectors: ['d'], twinOf: 'd-pos' },
    { id: 'e-pos', detectors: ['e'] },
  ];
  const positive = (id, outcome, tier = 'T2') => ({ id, kind: 'must-redact', tier, spanOutcomes: [outcome], expected: [], actual: [] });
  const control = (id, flagged) => ({ id, kind: 'must-not-flag', tier: 'T2', flagged, expected: [], actual: [] });
  const rows = [positive('a-pos', 'COVERED'), control('a-twin', false), positive('b-pos', 'EXACT'), control('b-twin', false), control('b-twin-2', true), positive('c-pos', 'MISS'), positive('d-pos', 'EXACT', 'T0'), control('d-twin', false), positive('e-pos', 'EXACT')];
  const probe = twinProbe(['a', 'b', 'c', 'd', 'e'], list, rows, book);
  assert.deepEqual(probe.entries.map(x => [x.id, x.status, x.pairs, x.discriminated]), [['a', 'discriminated', 1, 1], ['b', 'not-discriminated', 2, 1], ['c', 'un-probeable', 0, 0], ['d', 'not-measured', 0, 0], ['e', 'unrecorded', 0, 0]]);
  assert.deepEqual(probe.counts, { discriminated: 1, 'not-discriminated': 1, 'un-probeable': 1, 'not-measured': 1, unrecorded: 0 + 1 });
  assert.equal(probe.entries[2].reason, 'Provider documents nothing.');
  // An OVERBROAD positive has not demonstrated discrimination (v1.1 strict rule).
  assert.equal(twinProbe(['a'], list, [positive('a-pos', 'OVERBROAD'), control('a-twin', false)], book).entries[0].status, 'not-discriminated');
  assert.equal(twinProbe(['a'], list, undefined, book).entries[0].status, 'not-measured');
  assert.throws(() => twinProbe(['c'], [...list, { id: 'c-twin', detectors: ['c'], twinOf: 'c-pos' }], rows, book), /Un-probeable family with twins/);
});

// #46: "targeting stable" is exactly the T1 contracts (the only tier
// `benchmarks/support/status-criteria.json`'s `stable.positiveContract` can
// ever certify). Each must carry a twin for every dimension its provider
// source documents — see docs/decisions/2026-09-20-fill-per-family-twin-coverage.md
// for the per-family rationale and the two prefix twins that needed a
// stem-breaking fallback after an empirically-not-discriminated first attempt.
const T1_DIMENSIONS = {
  'aws-access-key': ['prefix'],
  'github-token': ['length', 'prefix'],
  'gitlab-token': ['length', 'prefix'],
  'shopify-token': ['prefix'],
  'vault-token': ['length', 'prefix'],
  'stripe-token': ['public-prefix'],
  'slack-token': ['boundary', 'prefix'],
  'pypi-token': ['prefix'],
  'cloudflare-token': ['alphabet', 'prefix'],
  'digitalocean-token': ['length', 'prefix'],
  'npm-token': ['length', 'prefix', 'boundary'],
  'sendgrid-token': ['boundary', 'length'],
  'private-key': ['public-prefix'],
  jwt: ['boundary', 'alphabet'],
  'terraform-cloud-token': ['length', 'boundary'],
  'pulumi-access-token': ['length', 'alphabet'],
};

test('every T1 ("stable"-track) family has a twin for each structural dimension its provider source asserts', () => {
  const t1 = Object.entries(contracts).filter(([, c]) => c.tier === 'T1').map(([id]) => id);
  assert.deepEqual(t1.sort(), Object.keys(T1_DIMENSIONS).sort(), 'T1_DIMENSIONS must cover exactly the T1 contracts');
  for (const [family, expected] of Object.entries(T1_DIMENSIONS)) {
    const kinds = [...new Set(twins.filter(t => t.detectors[0] === family).map(t => t.mutationKind))];
    assert.deepEqual(kinds.sort(), [...expected].sort(), family);
  }
  // A checksum for github-token and npm-token is provider-documented (github.blog,
  // npm's changelog) but not part of either contract's lexical `pattern`, so a
  // checksum-only mutation still satisfies the pattern and cannot be a twin here
  // (enforced structurally by the "must not satisfy the contract" check above).
  for (const family of ['github-token', 'npm-token'])
    for (const t of twins.filter(t => t.detectors[0] === family))
      assert.doesNotMatch(t.mutation, /checksum/, `${t.id} — checksum is not twin-constructible for this contract`);
});

test('on the real corpus no family is left unrecorded', () => {
  const probe = twinProbe(registry.detectors.map(d => d.id), fixtures.map(f => ({ id: `${f.category}--${f.id}`, detectors: f.detectors, twinOf: f.twinOf && `${f.category}--${f.twinOf}` })), undefined, contracts);
  assert.equal(probe.counts.unrecorded, 0);
  assert.equal(probe.counts['un-probeable'], 14);
  assert.equal(probe.counts['not-measured'], 30);
});
