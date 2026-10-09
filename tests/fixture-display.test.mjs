import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deriveFixtureDisplay, decodeFixtureDisplay, encodeFixtureDisplay, displayDigest, displayMatchesCase, fixtureDisplayProblems, SUITE_CONTENT_BUDGET } from '../benchmarks/lib/fixture-display.ts';

const sha = v => createHash('sha256').update(v).digest('hex');
const bytes = v => Buffer.from(JSON.stringify(v));
function release({ content = 'env=demo-value\n', expected = [{ start: 4, end: 14, role: 'secret' }], mutate = () => {} } = {}) {
  const commit = 'a'.repeat(40), corpusDigest = `sha256:${'b'.repeat(64)}`, recordsDigest = 'c'.repeat(64);
  const c = { id: 'demo--one', path: 'demo/one.txt', content, expected, grouping: { kind: 'must-redact', tier: 'T1', group: 'synthetic-scenario' } };
  const snapshot = { schema: 'credential-eval/corpus-snapshot/v1', identity: { source: 'credential-evidence', revision: `records-tree-sha256:${recordsDigest}`, evidence_schema: 'credential-evidence/schema/1.8.0', corpus_digest: corpusDigest }, cases: [c] };
  const materialized = { format: 'credential-evidence/materialized-fixtures', digest: 'd'.repeat(64), fixtures: [{ id: c.id, path: c.path, sha256: sha(content), bytes: Buffer.byteLength(content), target: { type: 'scenario', id: 'synthetic-scenario' }, expected: { outcome: 'must-flag', spans: expected } }] };
  const records = [
    ['records/scenarios/synthetic-scenario.json', { id: 'synthetic-scenario', title: 'A synthetic scenario', description: 'A synthetic value in an assignment.', lifecycle: 'draft' }],
    ['records/sources/demo.json', { id: 'demo-source', locator: { url: 'https://example.invalid/format' } }],
    ['records/fixtures/demo.json', { id: 'demo', fixtures: [{ id: c.id, sha256: sha(content), evidence: 'constructed' }], evidence: { constructed: { rationale: 'Synthetic input constructed for this fixture.', sources: [{ sourceId: 'demo-source' }] } } }],
  ].map(([path, r]) => ({ path, text: JSON.stringify(r), sha256: sha(JSON.stringify(r)) }));
  mutate({ snapshot, materialized, records });
  const recordsBundleBytes = bytes({ format: 'credential-evidence/records-bundle', sourceRevision: { commit }, records });
  const materializedBytes = bytes(materialized), snapshotBytes = bytes(snapshot);
  const manifestBytes = bytes({ format: 'credential-evidence/release-manifest', tag: 'snapshot-synthetic', schemaRevision: '1.8.0', sourceRevision: { commit, recordsTree: { digest: recordsDigest } }, fixtures: { digest: materialized.digest, count: materialized.fixtures.length }, files: [['records-bundle.json', recordsBundleBytes], ['fixtures-materialized-manifest.json', materializedBytes], ['credential-eval-corpus-snapshot.json', snapshotBytes]].map(([asset, b]) => ({ asset, bytes: b.length, sha256: sha(b) })) });
  return { pin: { corpusDigest, release: { tag: 'snapshot-synthetic', manifestDigest: `sha256:${sha(manifestBytes)}` } }, manifestBytes, recordsBundleBytes, materializedBytes, snapshotBytes };
}

test('display derivation preserves exact bytes, scenario ownership and fixture-specific rationale', () => {
  const input = release(), out = deriveFixtureDisplay(input);
  assert.deepEqual(fixtureDisplayProblems(out, input.pin), []);
  assert.equal(out.fixtures['demo--one'].content, 'env=demo-value\n');
  assert.equal(out.descriptions[out.fixtures['demo--one'].description].kind, 'scenario');
  assert.equal(out.assessments[out.fixtures['demo--one'].assessment].reason, 'Synthetic input constructed for this fixture.');
  assert.deepEqual(out.assessments[out.fixtures['demo--one'].assessment].sources, ['https://example.invalid/format']);
  assert.equal(JSON.stringify(out), JSON.stringify(deriveFixtureDisplay(input)));
});

test('the large suite retains metadata and byte commitments while withholding inputs explicitly', () => {
  const input = release({ content: 'x\n'.repeat(SUITE_CONTENT_BUDGET / 2 + 1) });
  const out = deriveFixtureDisplay(input);
  assert.equal(out.fixtures['demo--one'].content, undefined);
  assert.ok(out.fixtures['demo--one'].bytes > SUITE_CONTENT_BUDGET);
  assert.ok(out.fixtures['demo--one'].assessment);
});

test('wrong release, corrupt assets, corrupt records and contradictory fixture commitments are refused', () => {
  const r = release();
  assert.throws(() => deriveFixtureDisplay({ ...r, snapshotBytes: Buffer.from('{}') }), /snapshot asset commitment/);
  assert.throws(() => deriveFixtureDisplay({ ...r, pin: { ...r.pin, release: { ...r.pin.release, tag: 'other' } } }), /manifest names/);
  assert.throws(() => deriveFixtureDisplay(release({ mutate: ({ records }) => { records[0].sha256 = '0'.repeat(64); } })), /record commitment/);
  assert.throws(() => deriveFixtureDisplay(release({ mutate: ({ materialized }) => { materialized.fixtures[0].sha256 = '0'.repeat(64); } })), /fixture-set commitment/);
  assert.throws(() => deriveFixtureDisplay(release({ mutate: ({ snapshot }) => { snapshot.cases[0].path = 'other.txt'; } })), /snapshot fixture commitment/);
  assert.throws(() => deriveFixtureDisplay(release({ mutate: ({ snapshot }) => { snapshot.identity.corpus_digest = `sha256:${'0'.repeat(64)}`; } })), /snapshot identity/);
});

test('offline checks reject missing, stale, edited and byte-corrupt projections', () => {
  const input = release(), out = deriveFixtureDisplay(input);
  assert.ok(fixtureDisplayProblems(undefined, input.pin).length);
  assert.ok(fixtureDisplayProblems(out, { ...input.pin, corpusDigest: `sha256:${'0'.repeat(64)}` }).length);
  const corrupt = structuredClone(out);
  corrupt.fixtures['demo--one'].content = 'different';
  assert.ok(fixtureDisplayProblems(corrupt, input.pin).some(p => p.includes('digest')));
  corrupt.digest = displayDigest(corrupt);
  assert.ok(fixtureDisplayProblems(corrupt, input.pin).some(p => p.includes('byte commitment')));
});

test('a fixture join requires path, grouping and the complete authored spans', () => {
  const d = deriveFixtureDisplay(release()).fixtures['demo--one'];
  assert.equal(displayMatchesCase(d, d), true);
  for (const over of [{ path: 'other' }, { tier: 'T0' }, { group: 'other' }, { kind: 'policy' }, { expected: [] }]) assert.equal(displayMatchesCase(d, { ...d, ...over }), false);
});


test('base64 transport preserves exact UTF-8 and hides all authored literal fields in the serialized projection', () => {
  const input = release({ content: 'env=合成😀\n', expected: [{ start: 4, end: 14, role: 'secret' }] });
  const out = deriveFixtureDisplay(input), encoded = encodeFixtureDisplay(out);
  assert.deepEqual(decodeFixtureDisplay(encoded), out);
  assert.deepEqual(fixtureDisplayProblems(encoded, input.pin), []);
  assert.equal(JSON.stringify(encoded).includes(out.fixtures['demo--one'].content), false);
  assert.equal(JSON.stringify(encoded).includes(out.assessments[out.fixtures['demo--one'].assessment].reason), false);
  assert.deepEqual(encodeFixtureDisplay(decodeFixtureDisplay(encoded)), encoded);
});

test('transport rejects malformed base64, altered commitments, invalid UTF-8, JSON and schema', () => {
  const input = release(), encoded = encodeFixtureDisplay(deriveFixtureDisplay(input));
  for (const over of [{ payload: encoded.payload + '\n' }, { payload: encoded.payload.slice(1) }, { bytes: encoded.bytes + 1 }, { sha256: '0'.repeat(64) }, { encoding: 'utf8' }, { schema: 'other' }, { extra: true }]) {
    assert.throws(() => decodeFixtureDisplay({ ...encoded, ...over }));
    assert.ok(fixtureDisplayProblems({ ...encoded, ...over }, input.pin).length);
  }
  const transport = b => ({ ...encoded, bytes: b.length, sha256: sha(b), payload: b.toString('base64') });
  for (const b of [Buffer.from([0xc3, 0x28]), Buffer.from('{'), Buffer.from('{"schema":"other"}')]) assert.throws(() => decodeFixtureDisplay(transport(b)));
  // Nonzero padding bits are accepted by Buffer, but are not canonical base64.
  assert.throws(() => decodeFixtureDisplay({ ...transport(Buffer.from('x')), payload: 'eB==' }));
  const corrupt = deriveFixtureDisplay(input);
  corrupt.fixtures['demo--one'].content = 'different'; corrupt.digest = displayDigest(corrupt);
  assert.ok(fixtureDisplayProblems(encodeFixtureDisplay(corrupt), input.pin).some(p => p.includes('byte commitment')));
});
