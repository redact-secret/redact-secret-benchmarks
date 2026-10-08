import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  DESCRIPTION_MAX, EVIDENCE_CASE_METADATA_FILE, FIXTURE_DESCRIPTIONS_FILE, TITLE_MAX,
  authoredTextProblems, caseMetadataBindingProblem, deriveEvidenceCaseMetadata, evidenceCaseMetadataProblems, fixtureDescriptionsProblems, serializeCaseMetadata,
} from '../benchmarks/lib/fixture-metadata.ts';

// Authored fixture titles and descriptions (#593). Synthetic release files only: no title, count or digest of the committed projection is asserted
// (a repin re-keys them); `npm run fixture-metadata:check` and `npm run evidence:case-metadata -- --verify` hold the committed files.

const enc = new TextEncoder();
const hex = value => createHash('sha256').update(value).digest('hex');
const COMMIT = 'a'.repeat(40);

/** A synthetic pinned release: one case record, two case fixtures and one scenario fixture. */
function release({ tamperRecords = false } = {}) {
  const caseText = JSON.stringify({ schemaVersion: 1, kind: 'case', id: 'demo-case', title: 'A synthetic carrier', summary: 'A synthetic value in a synthetic carrier.', lifecycle: 'draft' });
  const records = { format: 'credential-evidence/records-bundle', formatVersion: 1, sourceRevision: { commit: COMMIT }, records: [{ path: 'records/cases/demo-case.json', sha256: hex(caseText), bytes: caseText.length, text: caseText }] };
  const materialized = {
    format: 'credential-evidence/materialized-fixtures', formatVersion: 2, digest: 'b'.repeat(64), fixtures: [
      { id: 'demo--b', case: 'demo-case', target: { type: 'case', id: 'demo-case' } },
      { id: 'demo--a', case: 'demo-case', target: { type: 'case', id: 'demo-case' } },
      { id: 'demo--scenario', target: { type: 'scenario', id: 'some-scenario' } },
    ],
  };
  const recordsBundleBytes = enc.encode(JSON.stringify(records) + (tamperRecords ? ' ' : ''));
  const materializedBytes = enc.encode(JSON.stringify(materialized));
  const recordsListed = enc.encode(JSON.stringify(records));
  const manifest = {
    format: 'credential-evidence/release-manifest', tag: 'snapshot-synthetic', sourceRevision: { commit: COMMIT }, fixtures: { digest: 'b'.repeat(64) },
    files: [
      { asset: 'records-bundle.json', bytes: recordsListed.length, sha256: hex(recordsListed) },
      { asset: 'fixtures-materialized-manifest.json', bytes: materializedBytes.length, sha256: hex(materializedBytes) },
    ],
  };
  const manifestBytes = enc.encode(JSON.stringify(manifest));
  const pin = { corpusDigest: `sha256:${'c'.repeat(64)}`, release: { tag: 'snapshot-synthetic', manifestDigest: `sha256:${hex(manifestBytes)}` } };
  return { pin, manifestBytes, recordsBundleBytes, materializedBytes };
}

test('the projection copies the case record\'s own text for each fixture the release attaches to a case, and nothing for a scenario fixture', () => {
  const r = release();
  const out = deriveEvidenceCaseMetadata(r);
  assert.deepEqual(Object.keys(out.fixtures), ['demo--a', 'demo--b'], 'sorted by fixture id; the scenario fixture has no case');
  assert.deepEqual(out.cases['demo-case'], { title: 'A synthetic carrier', summary: 'A synthetic value in a synthetic carrier.', lifecycle: 'draft', record: 'records/cases/demo-case.json', sha256: out.cases['demo-case'].sha256 });
  assert.equal(out.source.tag, r.pin.release.tag);
  assert.equal(out.source.manifestDigest, r.pin.release.manifestDigest);
  assert.deepEqual(evidenceCaseMetadataProblems(out, r.pin), []);
  assert.equal(serializeCaseMetadata(deriveEvidenceCaseMetadata(r)), serializeCaseMetadata(out), 'a re-derivation is byte-identical');
});

test('a release that is not the pinned one, or whose assets are not the bytes its manifest lists, is refused', () => {
  const r = release();
  assert.throws(() => deriveEvidenceCaseMetadata({ ...r, pin: { ...r.pin, release: { ...r.pin.release, manifestDigest: `sha256:${'0'.repeat(64)}` } } }), /release manifest digest/);
  assert.throws(() => deriveEvidenceCaseMetadata({ ...r, pin: { ...r.pin, release: { ...r.pin.release, tag: 'snapshot-other' } } }), /manifest names snapshot-synthetic/);
  assert.throws(() => deriveEvidenceCaseMetadata(release({ tamperRecords: true })), /records-bundle\.json is not the bytes the manifest lists/);
});

test('the committed projection is checked against the registry pin, and every fixture names a case that has an entry', () => {
  const r = release();
  const out = deriveEvidenceCaseMetadata(r);
  assert.match(evidenceCaseMetadataProblems(out, { ...r.pin, release: { ...r.pin.release, tag: 'snapshot-next' } }).join(), /source\.tag is snapshot-synthetic, the registry pins snapshot-next/);
  assert.match(evidenceCaseMetadataProblems({ ...out, fixtures: { ...out.fixtures, 'demo--x': 'missing-case' } }, r.pin).join(), /names case missing-case, which has no entry/);
  assert.match(evidenceCaseMetadataProblems({ ...out, fixtures: {} }, r.pin).join(), /cases\.demo-case: no fixture targets it/);
});

test('a projection is shown only for the snapshot a run measured: tag, manifest digest and corpus digest', () => {
  const r = release();
  const out = deriveEvidenceCaseMetadata(r);
  const evidence = { corpus_digest: r.pin.corpusDigest, release: { tag: r.pin.release.tag, manifest_digest: r.pin.release.manifestDigest } };
  assert.equal(caseMetadataBindingProblem(out, evidence), undefined);
  assert.match(caseMetadataBindingProblem(out, { ...evidence, release: { ...evidence.release, tag: 'snapshot-other' } }), /the run measured snapshot-other/);
  assert.match(caseMetadataBindingProblem(out, { ...evidence, corpus_digest: `sha256:${'d'.repeat(64)}` }), /bound to corpus/);
  assert.match(caseMetadataBindingProblem(out, { ...evidence, release: null }), /names no evidence release/);
});

test('authored text is one line, bounded, and never the shape of a value', () => {
  assert.deepEqual(authoredTextProblems('A bearer token in an HTTP Authorization header', TITLE_MAX, 't'), []);
  assert.match(authoredTextProblems('', TITLE_MAX, 't').join(), /non-empty/);
  assert.match(authoredTextProblems(' padded', TITLE_MAX, 't').join(), /whitespace/);
  assert.match(authoredTextProblems('x'.repeat(TITLE_MAX + 1), TITLE_MAX, 't').join(), /over 160/);
  assert.match(authoredTextProblems('two\nlines', DESCRIPTION_MAX, 'd').join(), /control character or line break/);
  assert.match(authoredTextProblems('The value 6nhHohlnBUYbHFNWgxMsUiQnd5ceRNhs is here', DESCRIPTION_MAX, 'd').join(), /shape of a value/);
});

test('this repository authors descriptions for its product-owned fixtures only', () => {
  const owned = new Set(['policy-qualified-credentials--bearer-token-authorization-header']);
  const entry = { title: 'A bearer token in an HTTP Authorization header', description: 'Checks the value after Authorization: Bearer.', authoredOn: '2026-10-08' };
  const file = { schema: 'redact-secret/fixture-descriptions/v1', spec: '', note: '', fixtures: { 'policy-qualified-credentials--bearer-token-authorization-header': entry } };
  assert.deepEqual(fixtureDescriptionsProblems(file, owned), []);
  assert.match(fixtureDescriptionsProblems({ ...file, fixtures: { 'beta8-207--public-case': entry } }, owned).join(), /belongs to credential-evidence/);
  assert.match(fixtureDescriptionsProblems({ ...file, fixtures: { 'policy-qualified-credentials--bearer-token-authorization-header': { ...entry, reviewer: 'x' } } }, owned).join(), /only title, description and authoredOn/);
});

test('the titles are display text: no fixture index, corpus generator or hash manifest reads them (identity unchanged by authoring)', async () => {
  // The fixture index identity, the generated corpora and their hash manifest, and the pin manifest are the identities a peer snapshot or a
  // run is bound to (docs/specs/fixture-index.md). None of their producers may read the metadata files, so authoring or repinning a title re-keys nothing.
  for (const producer of ['scripts/generate-fixture-index.mjs', 'benchmarks/lib/fixture-index.ts', 'scripts/generate-fixtures.mjs', 'fixtures/generated/build.mjs', 'benchmarks/shared/report-model.mjs']) {
    const text = await readFile(new URL(`../${producer}`, import.meta.url), 'utf8');
    for (const file of [EVIDENCE_CASE_METADATA_FILE, FIXTURE_DESCRIPTIONS_FILE, 'fixture-metadata']) assert.ok(!text.includes(file.split('/').pop().replace('.json', '')), `${producer} reads ${file}`);
  }
});
