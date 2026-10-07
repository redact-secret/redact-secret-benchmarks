// The committed record of the first official public/synthetic PII execution (#796): its durable copies, receipt and provenance, held against the committed pins and the
// production consumer. Nothing here asserts a ledger value; every expectation is derived from the committed files themselves, and each mutation shows the gate refusing it.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { OFFICIAL_ARTIFACT, OFFICIAL_RECEIPT, OFFICIAL_RECORD, officialRecordProblems } from '../scripts/lib/pii-official-record.mjs';
import { deriveOfficialPins } from '../scripts/run-pii-official.mjs';
import { computeCriteria } from '../scripts/check-pii-authority.mjs';
import { PII_AUTHORITY_FILE } from '../benchmarks/evaluation/domains/pii/authority.ts';

const root = new URL('..', import.meta.url).pathname;
const bytes = file => readFileSync(path.join(root, file));
const sha256 = value => createHash('sha256').update(value).digest('hex');
const views = ['oracle-plan', 'qualification-plan', 'diagnostic-balanced', 'benign-heavy-stress'];

/** A reader over the committed tree with some files replaced. */
const reader = overrides => file => (file in overrides ? Buffer.from(overrides[file]) : bytes(file));
const edited = (file, change) => { const doc = JSON.parse(bytes(file).toString('utf8')); change(doc); return `${JSON.stringify(doc, null, 2)}\n`; };

test('the committed official-run record holds: durable copies, receipt, pins and the production consumer agree', () => {
  assert.deepEqual(officialRecordProblems({ root }), []);
  const record = JSON.parse(bytes(OFFICIAL_RECORD).toString('utf8'));
  assert.equal(record.provenance.kind, 'fresh-execution');
  assert.equal(record.provenance.replay, false);
  assert.equal(record.provenance.scannersLaunched, true);
  assert.equal(record.supportClaims, false);
  assert.equal(record.authorityChanged, false);
  assert.equal(record.ownerAcceptance, null, 'the repository records no acceptance on the owner\'s behalf');
  assert.equal(record.attempts.dispatches, 1);
  assert.deepEqual(record.populations.map(p => p.view), views);
  for (const item of record.populations) assert.equal(sha256(bytes(OFFICIAL_ARTIFACT(item.view))), item.artifactSha256);
});

test('the run is an execution under its own identity: the candidate is the tree digest, not the recorded artifact-set commitment', () => {
  const record = JSON.parse(bytes(OFFICIAL_RECORD).toString('utf8'));
  assert.equal(record.candidate.equalsRecordedArtifactSetCommitment, false);
  assert.notEqual(record.candidate.packageTreeSha256, record.candidate.recordedArtifactSetCommitment);
  const pins = JSON.parse(bytes('benchmarks/pii-eval-population-pins.json').toString('utf8'));
  for (const pin of pins.populations) {
    assert.equal(pin.projection.mode, 'official');
    assert.equal(pin.scanners[0].product.candidateDigest, record.candidate.packageTreeSha256);
    assert.equal(pin.scanners[0].candidateSourceCommit, record.candidate.sourceCommit, 'the source commit still binds the product by commit');
  }
});

test('a changed durable copy, receipt, pin or claim is refused', () => {
  const [view] = views;
  const artifact = bytes(OFFICIAL_ARTIFACT(view)).toString('utf8');
  const changedArtifact = artifact.replace('"authoredCases"', '"authoredCases "');
  assert.ok(officialRecordProblems({ root, readText: reader({ [OFFICIAL_ARTIFACT(view)]: changedArtifact }) }).length > 0, 'a byte of a durable copy');
  assert.ok(officialRecordProblems({ root, readText: reader({ [OFFICIAL_RECEIPT]: `${bytes(OFFICIAL_RECEIPT).toString('utf8')} ` }) }).some(p => /receipt/.test(p)), 'the receipt');
  assert.ok(officialRecordProblems({ root, readText: reader({ [OFFICIAL_RECORD]: edited(OFFICIAL_RECORD, d => { d.ownerAcceptance = { by: 'agent' }; }) }) }).some(p => /owner acceptance/.test(p)), 'an owner acceptance in the record');
  assert.ok(officialRecordProblems({ root, readText: reader({ [OFFICIAL_RECORD]: edited(OFFICIAL_RECORD, d => { d.provenance.replay = true; }) }) }).some(p => /provenance/.test(p)), 'a replay recorded as an execution');
  const pinsFile = 'benchmarks/pii-eval-population-pins.json';
  assert.ok(officialRecordProblems({ root, readText: reader({ [pinsFile]: edited(pinsFile, d => { d.populations[0].projection.mode = 'exploratory'; }) }) }).some(p => /official mode/.test(p)), 'an exploratory pin');
  assert.ok(officialRecordProblems({ root, readText: reader({ [pinsFile]: edited(pinsFile, d => { d.populations[1].retiredArtifactDigests = []; }) }) }).some(p => /retired/.test(p)), 'an exploratory replay that is not retired');
  assert.ok(officialRecordProblems({ root, readText: reader({ [pinsFile]: edited(pinsFile, d => { d.populations[2].scanners[0].artifactDigest = 'a'.repeat(64); }) }) }).some(p => /tree digest/.test(p)), 'a candidate digest that is not the launched package');
});

test('deriving the official pins is idempotent and retires only a head that changes', () => {
  const pins = JSON.parse(bytes('benchmarks/pii-eval-population-pins.json').toString('utf8'));
  const pin = pins.populations[0];
  const same = deriveOfficialPins(pins, { view: pin.label, artifactDigest: pin.artifactDigest, manifestDigest: pin.manifestDigest, candidateDigest: pin.scanners[0].artifactDigest });
  assert.deepEqual(same, pins);
  const moved = deriveOfficialPins(pins, { view: pin.label, artifactDigest: 'b'.repeat(64), manifestDigest: 'c'.repeat(64), candidateDigest: 'd'.repeat(64) });
  const next = moved.populations[0];
  assert.ok(next.retiredArtifactDigests.includes(pin.artifactDigest) && !next.retiredArtifactDigests.includes(next.artifactDigest));
  assert.throws(() => deriveOfficialPins(pins, { view: 'nope', artifactDigest: 'b'.repeat(64), manifestDigest: 'c'.repeat(64), candidateDigest: 'd'.repeat(64) }), /no pin/);
});

test('the authority record: official-mode is computed from the recorded run, the owner criteria are the owner\'s, and nothing is switched', async () => {
  const { state } = await computeCriteria();
  assert.equal(state['official-mode-measurement'], 'met');
  const file = JSON.parse(bytes(PII_AUTHORITY_FILE).toString('utf8'));
  assert.equal(file.authority, 'legacy');
  assert.equal(file.new.authorisation, null);
  const owner = Object.fromEntries(file.exitCriteria.filter(c => c.basis === 'owner').map(c => [c.id, c.state]));
  assert.equal(owner['owner-accepted-verdict'], 'unmet', 'the repository never records the owner\'s verdict');
});
