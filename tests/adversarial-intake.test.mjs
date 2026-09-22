import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  canonicalJson, derivedQualification, expectationsDigest, fileDigest, firstRunImmutabilityProblems,
  rejectionGrounds, TRANSITIONS, validateIntake,
} from '../benchmarks/lib/adversarial-intake.ts';
import {
  applyRejectionCase, evidenceSources, loadPacks, packProblems, rejectionCaseProblems, uiLanguageProblems,
} from '../benchmarks/lib/adversarial-packs.ts';
import {
  EVIDENCE_CLASSES, EVIDENCE_CLASS_IDS, evidenceLanguageProblems, independenceClaims, queryEvidence,
} from '../benchmarks/lib/evidence-classes.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const packs = loadPacks(root);
const sample = packs.find(pack => pack.record.id === 'synthetic-sample');
const cases = JSON.parse(readFileSync(new URL('../adversarial/samples/synthetic-sample/rejections.json', import.meta.url), 'utf8')).cases;
const caseById = id => cases.find(c => c.id === id);
const external = () => applyRejectionCase(sample, caseById('external-pack-accepted'));

test('every checked-in pack, including the synthetic sample, satisfies the intake contract', () => {
  assert.ok(sample, 'the synthetic sample pack is checked in');
  assert.deepEqual(packProblems(packs), []);
});

test('the synthetic sample exercises every rejection path it declares', () => {
  assert.ok(cases.length >= 10);
  assert.ok(cases.some(c => c.expect === null), 'at least one case validates');
  assert.deepEqual(rejectionCaseProblems(sample, cases), []);
});

test('schema rejects a record missing a required contract field', () => {
  const { record, firstRunBytes } = external();
  delete record.implementationExposure;
  assert.match(validateIntake(record, firstRunBytes).join('\n'), /implementationExposure/);
  const withoutLicense = external().record;
  delete withoutLicense.license.redistribution;
  assert.match(validateIntake(withoutLicense, firstRunBytes).join('\n'), /redistribution/);
});

test('real, live, revoked, real-derived and unknown credential material is a rejection ground', () => {
  for (const status of ['live', 'revoked', 'real-derived', 'unknown']) {
    const { record, firstRunBytes } = external();
    record.fixtures[1].credentialStatus = status;
    assert.deepEqual(rejectionGrounds(record).map(g => g.reason), ['real-credential-material']);
    assert.match(validateIntake(record, firstRunBytes).join('\n'), /must be rejected with reason real-credential-material/);
  }
  const { record } = external();
  assert.deepEqual(rejectionGrounds(record), []);
});

test('problems never echo fixture content', () => {
  const { record, firstRunBytes } = external();
  record.fixtures[0].credentialStatus = 'live';
  record.fixtures[0].expected[0].end = 999;
  const text = validateIntake(record, firstRunBytes).join('\n');
  for (const fixture of record.fixtures) assert.ok(!text.includes(fixture.content.trim()));
});

test('expectations authored from scanner output are rejected, and expectations are frozen before the first run', () => {
  const consulted = external();
  consulted.record.expectations.scannerOutputConsulted = true;
  assert.match(validateIntake(consulted.record, consulted.firstRunBytes).join('\n'), /scanner-derived-expectations/);

  // Replacing expected ranges with what the scanner reported, after the first run, breaks the committed digest.
  const copied = external();
  const run = JSON.parse(copied.firstRunBytes);
  copied.record.fixtures[2].expected = run.results.find(r => r.fixtureId === 'commit-hash-lookalike').findings;
  copied.record.fixtures[2].action = 'must-redact';
  assert.match(validateIntake(copied.record, copied.firstRunBytes).join('\n'), /differ from the expectations digest committed at submission/);

  // A digest recomputed to match the edit no longer matches the first run that froze it.
  copied.record.expectations.digest = expectationsDigest(copied.record.fixtures);
  assert.match(validateIntake(copied.record, copied.firstRunBytes).join('\n'), /first-run expectationsDigest differs/);
});

test('the first run is a separate, digest-pinned, immutable record', () => {
  const tampered = applyRejectionCase(sample, caseById('first-run-rewritten'));
  assert.match(validateIntake(tampered.record, tampered.firstRunBytes).join('\n'), /does not match the SHA-256 pinned/);

  const missing = external();
  assert.match(validateIntake(missing.record, null).join('\n'), /first-run record first-run\.json is missing/);

  const early = external();
  early.record.status = 'safety-review';
  early.record.history = early.record.history.slice(0, 2);
  assert.match(validateIntake(early.record, early.firstRunBytes).join('\n'), /cannot carry a first run/);

  const current = new Map([['adversarial/packs/a', 'b'.repeat(64)], ['adversarial/packs/new', 'c'.repeat(64)]]);
  assert.deepEqual(firstRunImmutabilityProblems(current, new Map([['adversarial/packs/a', 'b'.repeat(64)]])), []);
  assert.match(firstRunImmutabilityProblems(current, new Map([['adversarial/packs/a', 'a'.repeat(64)]])).join(), /changed since the base revision/);
  assert.match(firstRunImmutabilityProblems(new Map(), new Map([['adversarial/packs/a', 'a'.repeat(64)]])).join(), /was removed/);
  assert.equal(fileDigest(sample.firstRunBytes), sample.record.firstRun.sha256);
});

test('a material maintainer edit removes the externally-authored qualification', () => {
  const { record } = external();
  assert.equal(derivedQualification(record), 'externally-authored');
  record.maintainerEdits.push({ at: '2026-09-22T14:00:00Z', by: 'maintainer', material: false, summary: 'Reflowed rationale text.', fixtures: [] });
  assert.equal(derivedQualification(record), 'externally-authored', 'a non-material edit keeps the qualification');
  record.maintainerEdits.push({ at: '2026-09-22T15:00:00Z', by: 'maintainer', material: true, summary: 'Changed an expected action.', fixtures: ['commit-hash-lookalike'] });
  assert.equal(derivedQualification(record), 'maintainer-regression');

  const converted = applyRejectionCase(sample, caseById('converted-still-externally-authored'));
  converted.record.qualification = 'maintainer-regression';
  assert.deepEqual(validateIntake(converted.record, converted.firstRunBytes), []);
  assert.equal(derivedQualification({ ...sample.record, author: { ...sample.record.author, affiliation: 'project-contributor' } }), 'maintainer-regression');
});

test('lifecycle transitions follow submitted -> safety review -> frozen first run -> accepted/rejected/converted', () => {
  assert.deepEqual(TRANSITIONS.submitted, ['safety-review', 'rejected']);
  assert.deepEqual(TRANSITIONS.rejected, []);
  assert.deepEqual(TRANSITIONS['converted-to-maintainer-regression'], []);
  const { record, firstRunBytes } = external();
  record.history.splice(1, 1);
  assert.match(validateIntake(record, firstRunBytes).join('\n'), /submitted -> frozen-first-run is not allowed/);
});

test('fixture ranges are UTF-8 byte ranges and actions agree with them', () => {
  const { record, firstRunBytes } = external();
  record.fixtures[2].expected = [{ start: 0, end: 4 }];
  record.fixtures[0].expected = [];
  const text = validateIntake(record, firstRunBytes).join('\n');
  assert.match(text, /commit-hash-lookalike is must-not-flag but expects ranges/);
  assert.match(text, /env-assignment is must-redact but expects no range/);
});

test('canonical JSON and the expectations digest ignore key order', () => {
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] }), '{"a":[{"c":3,"d":2}],"b":1}');
  const reordered = sample.record.fixtures.map(f => Object.fromEntries(Object.entries(f).reverse()));
  assert.equal(expectationsDigest(reordered), sample.record.expectations.digest);
});

test('public adversarial, protected holdout and maintainer regression evidence are separately queryable', () => {
  const sources = evidenceSources(root, packs);
  assert.deepEqual(EVIDENCE_CLASS_IDS.sort(), ['maintainer-regression', 'protected-holdout', 'public-adversarial']);
  for (const id of EVIDENCE_CLASS_IDS) for (const row of queryEvidence(sources, id)) assert.equal(row.evidenceClass, id);

  // The checked-in sample is never evidence; public controls are not protected holdout.
  assert.ok(!Object.values(EVIDENCE_CLASS_IDS).flatMap(id => queryEvidence(sources, id)).some(row => row.id === 'synthetic-sample'));
  assert.deepEqual(queryEvidence(sources, 'protected-holdout'), []);
  assert.deepEqual(queryEvidence(sources, 'maintainer-regression').map(r => r.id), ['sendgrid-regressions', 'milestone-6-closed']);

  const accepted = { path: 'adversarial/packs/ext', record: { ...external().record, id: 'ext', sample: false } };
  const convertedRecord = applyRejectionCase(sample, caseById('converted-still-externally-authored')).record;
  const converted = { path: 'adversarial/packs/conv', record: { ...convertedRecord, id: 'conv', sample: false, qualification: 'maintainer-regression' } };
  const submitted = { path: 'adversarial/packs/sub', record: { ...external().record, id: 'sub', sample: false, status: 'submitted' } };
  const protectedManifest = { path: 'holdout/protected-manifest.json', manifest: { schemaVersion: 1, id: 'opaque', revision: 1, purpose: 'protected', review: 'reviewed', corpusHash: 'a'.repeat(64), seedHash: 'b'.repeat(64), dataDirectory: 'generated/x', maxRuns: 1 } };
  const mixed = { ...sources, packs: [accepted, converted, submitted], holdoutManifests: [...sources.holdoutManifests, protectedManifest] };
  assert.deepEqual(queryEvidence(mixed, 'public-adversarial').map(r => r.id), ['ext']);
  assert.deepEqual(queryEvidence(mixed, 'maintainer-regression').map(r => r.id).slice(-1), ['conv']);
  const [holdout] = queryEvidence(mixed, 'protected-holdout');
  assert.equal(holdout.id, 'opaque');
  assert.deepEqual(Object.keys(holdout.detail).sort(), ['corpusHash', 'review', 'revision']);
  assert.equal(queryEvidence(mixed, 'public-adversarial')[0].detail.inspectedDetectorImplementation, true);
});

test('language cannot call project-authored evidence independent', () => {
  assert.deepEqual(independenceClaims('Public controls cannot establish independent detector performance.'), []);
  assert.deepEqual(independenceClaims('A scanner-independent view. Reads h.independence.'), []);
  assert.equal(independenceClaims('An independent evaluation of the detectors.').length, 1);
  assert.equal(independenceClaims('<p>Not reviewed.</p><p>Independently verified coverage.</p>').length, 1);

  assert.equal(evidenceLanguageProblems('maintainer-regression', 'Independent adversarial evidence.').length, 1);
  assert.equal(evidenceLanguageProblems('public-adversarial', 'Independently authored fixtures.').length, 1);
  assert.deepEqual(evidenceLanguageProblems('protected-holdout', 'Independent blind evaluation.'), []);
  for (const id of EVIDENCE_CLASS_IDS) {
    const { label, description } = EVIDENCE_CLASSES[id];
    assert.deepEqual(evidenceLanguageProblems(id, `${label}. ${description}`), [], `${id} describes itself within its own rule`);
  }
  assert.equal(EVIDENCE_CLASSES['maintainer-regression'].mayClaimIndependence, false);
  assert.deepEqual(uiLanguageProblems(root), []);
});
