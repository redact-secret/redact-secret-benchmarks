import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildLedgerRekey, ledgerRekeyProblems, ledgerSettledId, serializeLedgerRekey, LEDGER_REKEY_FILE, LEGACY_PROPERTY } from '../benchmarks/qualification/ledger-rekey.ts';
import { FROZEN_QUEUE_FILE, frozenQueueProblems } from '../benchmarks/qualification/legacy-review.ts';
import { policyRevision, POLICY_FILES } from '../benchmarks/qualification/inputs.ts';

// Synthetic only. No mapping, count or digest read from a committed file is asserted beyond structure: a repin re-keys them, and
// `npm run qualification:ledger-rekey -- ... --check` (with the snapshot and the canonical methods run) is what holds the committed mapping.

const read = async path => JSON.parse(await readFile(new URL(`../${path}`, import.meta.url), 'utf8'));
const hex = n => String(n).padStart(64, '0');
const CANON = n => `sha256:${hex(n)}`;
const SNAPSHOT = { corpusDigest: CANON(1), cases: 4 };

// Legacy fixture slug `cat--one` joins canonical case `canon-one`, and so on.
const joined = new Map([['cat--one', 'canon-one'], ['cat--two', 'canon-two'], ['cat--three', 'canon-three']]);
const legacy = (n, slug, peer, disagreement, extra = {}) => ({ id: hex(n), caseId: `${slug}--differential`, method: 'differential', variant: 'canonical', peer, disagreement, evidence: { input: { contentHash: hex(`c-${slug}`.length + 100) } }, ...extra });
const canonicalOccurrence = (n, caseId, peer, disagreement) => ({ id: CANON(n), case_id: `${caseId}--differential`, method: 'differential', variant: 'canonical', reference: 'redact-secret', peer, disagreement });
const variants = [['canon-one', 'cat--one'], ['canon-two', 'cat--two'], ['canon-three', 'cat--three']].map(([c, s]) => ({ case_id: `${c}--differential`, variant: 'canonical', content_digest: `sha256:${hex(`c-${s}`.length + 100)}` }));
const ledger = ids => ({ schemaVersion: 2, entries: Object.fromEntries(ids.map((id, i) => [hex(id), { status: ['resolved', 'not-assertable', 'open'][i % 3], firstSeenRun: 'r', note: 'n' }])) });
const run = (queue, extra = {}) => ({ snapshot: SNAPSHOT, methodsRun: { run: 'run-1', semanticDigest: CANON(2), reviewQueue: queue, variants, ...extra } });

test('a decision maps to the canonical occurrence of the same case, peer, property and bytes, and nothing else', () => {
  const map = buildLedgerRekey({
    ...run([canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only'), canonicalOccurrence(11, 'canon-one', 'trufflehog', 'peer-only'), canonicalOccurrence(12, 'canon-two', 'gitleaks', 'range-disagreement')]),
    legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only'), legacy(21, 'cat--two', 'gitleaks', 'classification-disagreement'), legacy(22, 'cat--two', 'trufflehog', 'range-disagreement')],
    joined, ledger: ledger([20, 21, 22]),
  });
  // Same case, peer and property: mapped. Same case, other peer: not. Same case and peer, other property: not.
  assert.deepEqual(map.occurrences, { [CANON(10)]: hex(20) });
  assert.equal(map.derivation.canonical.mapped, 1);
  assert.equal(map.derivation.canonical.unmatched['no-legacy-occurrence'], 2);
  assert.equal(map.derivation.legacy.unmatched['no-canonical-occurrence'], 2);
  assert.deepEqual(ledgerRekeyProblems(map, ledger([20, 21, 22])), []);
});

test('the legacy word for a reference-only disagreement maps to the canonical one, and no other kind is renamed', () => {
  assert.deepEqual(LEGACY_PROPERTY, { 'redact-secret-only': 'reference-only' });
  const map = buildLedgerRekey({
    ...run([canonicalOccurrence(10, 'canon-one', 'gitleaks', 'reference-only'), canonicalOccurrence(11, 'canon-two', 'gitleaks', 'peer-only')]),
    legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'redact-secret-only'), legacy(21, 'cat--two', 'gitleaks', 'reference-only')],
    joined, ledger: ledger([20, 21]),
  });
  assert.deepEqual(Object.keys(map.occurrences), [CANON(10)]);
});

test('an occurrence the legacy run could not have decided stays unreviewed and is counted by reason', () => {
  const map = buildLedgerRekey({
    ...run([
      canonicalOccurrence(10, 'canon-one', 'flare-redact', 'peer-only'),   // a peer the legacy run never scanned
      canonicalOccurrence(11, 'canon-new', 'gitleaks', 'peer-only'),       // a case the legacy fixtures do not join
      canonicalOccurrence(12, 'canon-two', 'gitleaks', 'peer-only'),       // joined, but the bytes differ
      canonicalOccurrence(13, 'canon-three', 'gitleaks', 'peer-only'),     // mapped
    ]),
    legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only'), legacy(21, 'cat--two', 'gitleaks', 'peer-only', { evidence: { input: { contentHash: hex(999) } } }), legacy(22, 'cat--three', 'gitleaks', 'peer-only'), legacy(23, 'cat--gone', 'gitleaks', 'peer-only')],
    joined, ledger: ledger([20, 21, 22, 23]),
  });
  assert.deepEqual(Object.keys(map.occurrences), [CANON(13)]);
  assert.deepEqual(map.derivation.canonical.unmatched, { 'peer-not-in-legacy-run': 1, 'case-not-joined': 1, 'no-legacy-occurrence': 0, 'content-differs': 1, ambiguous: 0 });
  assert.equal(map.derivation.legacy.unmatched['content-differs'], 1);
  assert.equal(map.derivation.legacy.unmatched['case-not-joined'], 1);
  assert.equal(map.derivation.legacy.unmatched['no-canonical-occurrence'], 1, 'a legacy decision for a case with no canonical occurrence is counted, not applied');
  assert.deepEqual(map.derivation.canonical.byPeer['flare-redact'], { occurrences: 1, mapped: 0 });
});

test('a legacy mutation entry has no canonical counterpart and is counted, never mapped; a mapped decision keeps its legacy status', () => {
  const l = ledger([20, 21, 22]);
  const map = buildLedgerRekey({
    ...run([canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only')]),
    legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only'), { id: hex(21), caseId: 'cat--one--mutation', method: 'mutation', variant: 'lexical.length-minus-one' }, { id: hex(22), caseId: 'cat--two--mutation', method: 'mutation', variant: 'x' }],
    joined, ledger: l,
  });
  assert.deepEqual(map.derivation.legacy.otherMethods, { mutation: 2 });
  assert.deepEqual(map.derivation.mappedByLegacyStatus, { resolved: 1 });
  // The decision is the legacy ledger's: the mapping stores no status, and the settled id is the legacy one.
  assert.ok(!JSON.stringify(map.occurrences).includes('resolved'));
  assert.equal(ledgerSettledId(CANON(10), l, map), hex(20));
  assert.equal(ledgerSettledId(CANON(99), l, map), CANON(99));
  assert.equal(ledgerSettledId(CANON(10), l, undefined), CANON(10));
  // A canonical id the ledger holds itself is settled by its own row.
  assert.equal(ledgerSettledId(hex(21), l, map), hex(21));
});

test('a content or occurrence shared by several cases is ambiguous and is never guessed', () => {
  const twice = [canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only'), canonicalOccurrence(11, 'canon-one', 'gitleaks', 'peer-only')];
  const map = buildLedgerRekey({ ...run(twice), legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only')], joined, ledger: ledger([20]) });
  assert.deepEqual(map.occurrences, {});
  assert.equal(map.derivation.canonical.unmatched.ambiguous, 2);
  assert.equal(map.derivation.legacy.unmatched.ambiguous, 1);
});

test('a decision the ledger does not hold maps to nothing', () => {
  const map = buildLedgerRekey({ ...run([canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only')]), legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only')], joined, ledger: ledger([]) });
  assert.deepEqual(map.occurrences, {});
  assert.equal(map.derivation.legacy.unmatched['not-in-ledger'], 1);
});

test('the mapping is deterministic whatever the order of its inputs', () => {
  const queue = [canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only'), canonicalOccurrence(12, 'canon-two', 'trufflehog', 'peer-only')];
  const legacyQueue = [legacy(20, 'cat--one', 'gitleaks', 'peer-only'), legacy(22, 'cat--two', 'trufflehog', 'peer-only')];
  const a = serializeLedgerRekey(buildLedgerRekey({ ...run(queue), legacyQueue, joined, ledger: ledger([20, 22]) }));
  const b = serializeLedgerRekey(buildLedgerRekey({ ...run([...queue].reverse()), legacyQueue: [...legacyQueue].reverse(), joined: new Map([...joined].reverse()), ledger: ledger([20, 22]) }));
  assert.equal(a, b);
});

test('a mapping that is not well formed or not one to one with the ledger is refused', () => {
  const l = ledger([20, 21]);
  const good = buildLedgerRekey({ ...run([canonicalOccurrence(10, 'canon-one', 'gitleaks', 'peer-only')]), legacyQueue: [legacy(20, 'cat--one', 'gitleaks', 'peer-only')], joined, ledger: l });
  const mutate = change => { const m = structuredClone(good); change(m); return ledgerRekeyProblems(m, l); };
  assert.deepEqual(ledgerRekeyProblems(good, l), []);
  assert.ok(mutate(m => { m.occurrences[CANON(11)] = hex(99); }).some(p => /not in benchmarks\/review-ledger\.json/.test(p)));
  assert.ok(mutate(m => { m.occurrences[CANON(11)] = hex(20); }).some(p => /one to one/.test(p)));
  assert.ok(mutate(m => { m.occurrences['not-an-id'] = hex(21); }).some(p => /not a canonical occurrence id/.test(p)));
  assert.ok(mutate(m => { m.occurrences[CANON(10)] = 'x'; }).some(p => /not a legacy ledger id/.test(p)));
  assert.ok(mutate(m => { m.derivation.canonical.mapped = 5; }).some(p => /derivation\.canonical\.mapped/.test(p)));
  assert.ok(mutate(m => { m.snapshot.corpusDigest = 'x'; }).some(p => /corpusDigest/.test(p)));
  assert.ok(mutate(m => { m.methodsRun.semanticDigest = 'x'; }).some(p => /methodsRun/.test(p)));
  assert.ok(mutate(m => { m.owner = 'credential-evidence'; }).some(p => /identity/.test(p)));
  assert.deepEqual(ledgerRekeyProblems(null, l), ['the mapping is not an object']);
});

test('the committed mapping is well formed against the committed ledger, bound to the pinned run, and a policy revision component', async () => {
  const map = await read(LEDGER_REKEY_FILE);
  assert.deepEqual(ledgerRekeyProblems(map, await read('benchmarks/review-ledger.json')), []);
  assert.equal(map.owner, 'redact-secret-benchmarks');
  const registry = await read('benchmarks/official-runs.json');
  assert.equal(map.snapshot.corpusDigest, registry.populations.find(p => p.id === map.population).evidence.corpusDigest);
  assert.equal(map.methodsRun.semanticDigest, registry.runs.find(r => r.id === map.methodsRun.run).artifact.semanticDigest);
  assert.ok(POLICY_FILES.includes(LEDGER_REKEY_FILE), 'the mapping is a component of the policy revision');
  // Both files move the revision: the mapping, and the legacy ledger it reads decisions from.
  const base = [{ path: LEDGER_REKEY_FILE, digest: CANON(1) }, { path: 'benchmarks/review-ledger.json', digest: CANON(2) }];
  assert.notEqual(policyRevision(base).revision, policyRevision([{ ...base[0], digest: CANON(3) }, base[1]]).revision);
  assert.notEqual(policyRevision(base).revision, policyRevision([base[0], { ...base[1], digest: CANON(3) }]).revision);
});

test('the frozen legacy review queue is intact: its digest, counts and entries are those it records (#660)', async () => {
  const queue = await read(FROZEN_QUEUE_FILE);
  assert.deepEqual(frozenQueueProblems(queue), []);
  assert.ok(queue.differential.length > 0);
  const edited = { ...queue, differential: queue.differential.slice(1) };
  assert.ok(frozenQueueProblems(edited).some(p => p.includes('edited')));
  assert.ok(frozenQueueProblems({ ...queue, differential: [...queue.differential, { ...queue.differential[0], method: 'mutation' }] }).length > 0);
  assert.ok(frozenQueueProblems({ ...queue, id: 'other' })[0].includes('is not a'));
});
