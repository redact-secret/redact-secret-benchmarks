import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildTriageQueue, CLASSIFICATIONS } from '../benchmarks/qualification/triage-queue.ts';

// Synthetic only (#698): no ledger value, count or committed queue is asserted. The queue is built from artifacts made here.
const D = n => `sha256:${String(n).padStart(64, '0')}`;
const manifest = (extra = {}) => ({ engine: { name: 'credential-eval', version: '9.9.9' }, protocol_version: 'p/1', config_hash: D(1), evidence: { corpus_digest: D(2) }, ...extra,
  scanners: ['core', 'peer'].map(id => ({ id, version: id === 'core' ? '1.0.0-beta' : '2.0', adapter: { id, version: '1' }, configuration_hash: D(id === 'core' ? 3 : 4), build: 'released' })) });
const result = (id, outcomes, extra = {}) => ({ case_id: id, path: `${id}.txt`, kind: 'must-redact', tier: 'T1', family: 'syn:fam', group: 'g', evidence_class: 'x', expected: [{ start: 0, end: 4 }], actual: [], measurement: { type: 'positive', span_outcomes: outcomes, leaked_bytes: 0, collateral_bytes: 0 }, ...extra });
const control = (id, flagged) => ({ ...result(id, []), kind: 'must-not-flag', expected: [], measurement: { type: 'control', flagged, findings: Number(flagged), co_detected: false } });

const plainCases = [result('added-miss', ['MISS']), result('added-part', ['EXACT', 'PARTIAL']), result('added-exact', ['EXACT']), control('added-flag', true), control('added-clear', false), result('common-miss', ['MISS'])];
const plain = { artifact: { manifest: manifest(), scanners: [{ scanner: 'core', cases: plainCases }, { scanner: 'peer', cases: [] }] }, semanticDigest: D(10) };

const variants = [
  { case_id: 'seed-a--differential', variant: 'canonical', operator: 'identity', operator_version: 1, parameters: {}, strategy: 'authored', content_digest: D(20) },
  { case_id: 'seed-a--metamorphic', variant: 'context.indent', operator: 'context-indent', operator_version: 1, parameters: { n: 2 }, strategy: 'seeded', content_digest: D(21) },
  { case_id: 'seed-a--metamorphic', variant: 'context.tab', operator: 'context-tab', operator_version: 1, parameters: {}, strategy: 'seeded', content_digest: D(22) },
];
const methodsArtifact = {
  manifest: manifest({ config_hash: D(5) }), variants,
  review_queue: [{ id: D(30), case_id: 'seed-a--differential', method: 'differential', variant: 'canonical', reference: 'core', peer: 'peer', disagreement: 'peer-only' }],
  scanners: [
    { scanner: 'core', cases: [{ ...result('seed-a--differential--canonical', ['EXACT']) }, { ...result('seed-a--metamorphic--context.indent', ['MISS']) }, { ...result('seed-a--metamorphic--context.tab', ['MISS']) }],
      assertions: [
        { case_id: 'seed-a--metamorphic', method: 'metamorphic', baseline: 'canonical', candidate: 'context.indent', assertion: 'same-detection', status: 'fail' },
        { case_id: 'seed-a--metamorphic', method: 'metamorphic', baseline: 'canonical', candidate: 'context.tab', assertion: 'same-detection', status: 'fail' },
        { case_id: 'seed-a--metamorphic', method: 'metamorphic', baseline: 'canonical', candidate: 'context.ok', assertion: 'same-detection', status: 'pass' },
        { case_id: 'seed-common--metamorphic', method: 'metamorphic', baseline: 'canonical', candidate: 'context.tab', assertion: 'same-detection', status: 'fail' },
      ] },
    { scanner: 'peer', cases: [{ ...result('seed-a--differential--canonical', []) }] },
  ],
};
const methods = { artifact: methodsArtifact, semanticDigest: D(11) };
const base = () => ({
  source: { evidenceRelease: 'snapshot-x', corpusDigest: D(2), manifestDigest: D(40) }, plain, methods,
  snapshotCases: [{ id: 'added-miss', grouping: { group: 'g' }, representation: { derivation: { kind: 'encode' } } }],
  addedIds: ['added-miss', 'added-part', 'added-exact', 'added-flag', 'added-clear', 'seed-a'], maintainerOnlyIds: ['added-miss', 'seed-a'],
  unsettledGate: [{ id: D(30), peer: 'peer', case: 'seed-a', variant: 'canonical', disagreement: 'peer-only', origin: 'added', families: ['syn-token'] }],
  reference: 'core', gatePeers: ['peer'], disclosure: { maintainerOnlyFixtures: 3, independentlyReviewed: 0, newlyScoredPositives: 2, newlyScoredControls: 1 },
});

test('every core non-exact positive and flagged control of the added cases is queued once, and nothing exact, clear or common is', () => {
  const q = buildTriageQueue(base());
  const kinds = Object.fromEntries(q.rootCauses.filter(r => r.source === 'plain-run').map(r => [r.seedCase, r.kind]));
  assert.deepEqual(kinds, { 'added-flag': 'core-control-flagged', 'added-miss': 'core-positive-miss', 'added-part': 'core-positive-partial-or-overbroad' });
  assert.ok(!('common-miss' in kinds) && !('added-exact' in kinds) && !('added-clear' in kinds));
});

test('generated variants of one seed collapse into one root cause that keeps each occurrence with its operator, occurrence id and identity', () => {
  const q = buildTriageQueue(base());
  const roots = q.rootCauses.filter(r => r.kind === 'reference-assertion-failure');
  assert.equal(roots.length, 1, 'two failed variants of one seed and assertion are one root cause');
  const [root] = roots;
  assert.deepEqual(root.occurrences.map(o => o.operator).sort(), ['context-indent', 'context-tab']);
  assert.equal(new Set(root.occurrences.map(o => o.occurrenceId)).size, 2, 'each affected occurrence keeps its own id');
  for (const o of root.occurrences) {
    assert.equal(o.occurrenceIdKind, 'derived');
    assert.equal(o.method, 'metamorphic');
    assert.deepEqual([o.scanner.scanner, o.scanner.version, o.scanner.configurationHash, o.configHash], ['core', '1.0.0-beta', D(3), D(5)]);
    assert.ok(o.observed.candidate && o.observed.baseline === null, 'the product\'s observed ranges and actions are recorded where the artifact has them');
  }
  // A passed assertion and a failure on a common case are not queued.
  assert.ok(root.occurrences.every(o => o.case === 'seed-a'));
});

test('a gate-peer occurrence keeps the engine\'s own id, the peer\'s and the reference\'s identity and the family handoff, and a mismatch with the artifact is refused', () => {
  const q = buildTriageQueue(base());
  const [gate] = q.rootCauses.filter(r => r.kind === 'gate-peer-differential-unsettled');
  assert.equal(gate.occurrences[0].occurrenceId, D(30));
  assert.equal(gate.occurrences[0].occurrenceIdKind, 'engine');
  assert.equal(gate.occurrences[0].operator, 'identity');
  assert.deepEqual([gate.occurrences[0].scanner.scanner, gate.occurrences[0].reference.scanner], ['peer', 'core']);
  assert.equal(gate.coreHandoff, null);
  const withHandoff = buildTriageQueue({ ...base(), unsettledGate: [{ ...base().unsettledGate[0], families: ['sendgrid-token'] }] });
  assert.equal(withHandoff.rootCauses.find(r => r.kind === 'gate-peer-differential-unsettled').coreHandoff, 'redact-secret/redact-secret#1199');
  assert.throws(() => buildTriageQueue({ ...base(), unsettledGate: [{ ...base().unsettledGate[0], peer: 'other' }] }), /not in the methods artifact's review queue/);
});

test('the queue is an export: nothing is classified, settled or restored, the disclosure is kept and maintainer-only reliance is stated per root cause', () => {
  const q = buildTriageQueue(base());
  assert.ok(q.rootCauses.every(r => r.classification === null && r.disposition === null && r.ledger === null));
  assert.equal(q.classifications.length, CLASSIFICATIONS.length);
  assert.match(q.note, /not a decision/);
  assert.match(q.disclosure.note, /Maintainer-reviewed \(independent review pending\)/);
  assert.match(q.disclosure.note, /메인테이너 검토 \(독립 검토 대기\)/);
  assert.deepEqual([q.disclosure.maintainerOnlyFixtures, q.disclosure.independentlyReviewed], [3, 0]);
  assert.deepEqual(Object.fromEntries(q.rootCauses.filter(r => r.source === 'plain-run').map(r => [r.seedCase, r.restsOnMaintainerOnlyDecision])), { 'added-flag': false, 'added-miss': true, 'added-part': false });
  assert.equal(q.summary.restingOnMaintainerOnly.rootCauses, q.rootCauses.filter(r => r.restsOnMaintainerOnlyDecision).length);
  assert.equal(q.identity.product.version, '1.0.0-beta');
});

test('the export is deterministic and independent of input order', () => {
  const a = buildTriageQueue(base());
  const reordered = base();
  reordered.plain = { ...plain, artifact: { ...plain.artifact, scanners: [{ scanner: 'core', cases: [...plainCases].reverse() }, plain.artifact.scanners[1]] } };
  reordered.addedIds = [...reordered.addedIds].reverse();
  assert.equal(JSON.stringify(buildTriageQueue(reordered)), JSON.stringify(a));
});

test('the checked-in queue carries the disclosure and settles nothing', () => {
  const adoption = JSON.parse(readFileSync(new URL('../benchmarks/evidence-adoption.json', import.meta.url), 'utf8'));
  const text = readFileSync(new URL(`../${adoption.candidate.changeReport.replace(/\.json$/, '.triage-queue.json')}`, import.meta.url), 'utf8');
  const q = JSON.parse(text);
  assert.equal(q.schema, 'redact-secret/triage-queue/v1');
  assert.equal(q.source.corpusDigest, adoption.candidate.snapshotDigest);
  assert.ok(q.rootCauses.every(r => r.classification === null && r.disposition === null && r.ledger === null));
  assert.ok(q.rootCauses.every(r => r.occurrences.length > 0 && r.occurrences.every(o => o.occurrenceId && o.scanner?.configurationHash && o.configHash)));
  assert.ok(q.disclosure.independentlyReviewed === 0 && q.disclosure.maintainerOnlyFixtures > 0);
  assert.equal(q.summary.occurrences, q.rootCauses.reduce((n, r) => n + r.occurrences.length, 0));
});
