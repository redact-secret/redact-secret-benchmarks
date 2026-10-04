import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Synthetic views only: nothing here reads a committed view, ledger value or count.
const script = new URL('../scripts/compare-adoption-views.ts', import.meta.url).pathname;
const result = (scanner, flagged) => ({ scanner, measurement: 'control', observed: Number(flagged), flagged, findings: Number(flagged), coDetected: false });
const makeCase = (id, over = {}) => ({ id, family: 'p:f', tier: 'T1', evidenceClass: 'provider-documented', group: 'g', kind: 'must-not-flag', detectors: ['fam-a'], results: [result('s', false)], ...over });
const family = (name, evidence, status) => ({
  family: name, evidence: { positiveCases: 3, differentialUnresolvedContractDisagreements: 0, metamorphicCriticalFailures: 0, mutationUnresolvedCritical: 0, ...evidence },
  status: { value: 'stable', reasons: [], evidenceTier: 'T1', ...status }, gates: [], populations: [], attribution: {}, contract: {}, differential: {}, fixtureProfile: {}, axisCoverage: {},
});
const view = ({ families, cases, revision = 'rs-policy-1:sha256:aa' }) => ({
  distribution: { stable: families.filter(f => f.status.value === 'stable').length, provisional: families.filter(f => f.status.value === 'provisional').length, pending: 0, unsupported: 0 },
  stableDistribution: { documented: 1, empirical: 0, 'policy-qualified': 0 },
  supportMatrix: { distribution: { stable: 1 }, families: families.map(f => ({ family: `p:${f.family}`, status: f.status.value, detectors: [f.family], unresolvedCriticalItems: null })) },
  families,
  populations: [{ population: 'public-evidence-snapshot', cases, unmeasured: { cases: [{ scanner: 's', unmeasured: 0, reasons: {} }] } }],
  policy: { revision, axisOverlay: { contexts: 1, controls: 1, corpusDigest: 'x' }, twinScope: { twins: 0 }, ledgerRekey: { occurrences: 1 }, differentialPeers: [], scanner: 's', components: [] },
  unmappedFamilies: [], undetected: [], knownGaps: [],
});
const run = (files, strict = false) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'compare-views-'));
  const write = (name, value) => { const file = path.join(dir, name); writeFileSync(file, JSON.stringify(value)); return file; };
  const args = ['--import', 'tsx', script, '--accepted', write('a.json', files.A), '--replay-old', write('b.json', files.B), '--candidate', write('c.json', files.C), '--report', write('r.json', { evidenceRelease: 'snapshot-test', diff: { added: files.added, evidenceClassTransitions: {} }, ...(files.report ?? {}) }), '--out-json', path.join(dir, 'out.json'), '--out-md', path.join(dir, 'out.md'), ...(files.superseded ? ['--superseded-comparison', write('s.json', files.superseded)] : []), ...(strict ? ['--strict'] : [])];
  const proc = spawnSync('node', args, { encoding: 'utf8' });
  return { status: proc.status, stderr: proc.stderr, out: proc.status === 0 || strict ? JSON.parse(readFileSync(path.join(dir, 'out.json'), 'utf8')) : null, md: readFileSync(path.join(dir, 'out.md'), 'utf8') };
};

test('an engine effect of nothing and a corpus effect of an added case are separated and the evidence delta is attributed to the added case', () => {
  const base = view({ families: [family('fam-a', {}), family('fam-b', {})], cases: [makeCase('c1')] });
  const candidate = view({
    families: [family('fam-a', { positiveCases: 4 }), family('fam-b', {})], revision: 'rs-policy-1:sha256:bb',
    cases: [makeCase('c1'), makeCase('added-1', { kind: 'must-redact' })],
  });
  const { status, out, md } = run({ A: base, B: structuredClone(base), C: candidate, added: ['added-1'] }, true);
  assert.equal(status, 0);
  assert.deepEqual(out.engineEffect.familiesWithAnyDifference, []);
  assert.equal(out.engineEffect.supportMatrixSame, true);
  assert.equal(out.publicPopulation.addedCases, 1);
  assert.equal(out.publicPopulation.commonCases, 1);
  assert.equal(out.corpusEffect.evidenceDeltasWithoutStatusChange[0].family, 'fam-a');
  assert.deepEqual(out.corpusEffect.evidenceDeltasWithoutStatusChange[0].evidenceDelta.positiveCases, { from: 3, to: 4 });
  assert.deepEqual(out.unexplained, []);
  assert.match(md, /Adoption report: snapshot-test/);
});

test('an evidence change no added or regrouped case explains is listed as unexplained, and strict mode fails', () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1')] });
  const drifted = view({ families: [family('fam-a', { positiveCases: 9 })], cases: [makeCase('c1')] });
  const loose = run({ A: base, B: structuredClone(base), C: drifted, added: [] });
  assert.equal(loose.status, 0);
  assert.match(loose.out.unexplained[0], /fam-a: evidence changed \(positiveCases\) with no added or regrouped case/);
  assert.equal(run({ A: base, B: structuredClone(base), C: drifted, added: [] }, true).status, 1);
});

test('an engine effect is never hidden: a replayed corpus that differs from the accepted view is unexplained', () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1')] });
  const replay = view({ families: [family('fam-a', {})], cases: [makeCase('c1', { results: [result('s', true)] })] });
  const { out } = run({ A: base, B: replay, C: structuredClone(base), added: [] });
  assert.equal(out.engineEffect.publicCasesWithAnyDifference, 1);
  assert.ok(out.unexplained.some(u => /engine effect/.test(u)));
});

test('a common case whose outcome changes without a twin family assignment is unexplained', () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1', { results: [result('s', true)] })] });
  const changed = view({ families: [family('fam-a', {})], cases: [makeCase('c1', { results: [result('s', false)] })] });
  const { out } = run({ A: base, B: structuredClone(base), C: changed, added: [] });
  assert.equal(out.publicPopulation.commonCaseOutcomeDrift.cases, 1);
  assert.ok(out.unexplained.some(u => /common case c1 changed outcome/.test(u)));
});

test('the report separates the superseded candidate and the representation capability, and says unverified facts are unverified (#690)', () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1')] });
  const bucket = { 's': { fragment: { pending: 1, 'positive:exact': 2 } } };
  const scanners = { s: { compared: 3, unchanged: 2, moves: { 'not-measured -> positive:exact': 1 }, movesByFactClass: {}, cases: {} } };
  const superseded = { evidenceRelease: 'snapshot-old', views: { candidate: { distribution: { stable: 1, provisional: 1, pending: 0, unsupported: 0 }, supportMatrix: { stable: 1, provisional: 0, pending: 0, unsupported: 0 }, stableDistribution: {}, policyRevision: 'rs-policy-1:sha256:cc' } }, corpusEffect: { statusChanges: [{ family: 'fam-x' }], supportMatrixStatusChanges: [] } };
  const report = {
    representation: { casesWithFacts: 3, casesByTransformationOp: { fragment: 1 }, casesByEncodeCodec: {}, fragmentMechanisms: { a: 1 }, expectedSpansWithFragments: 1, expectedSpansWithDecoded: 0, decodedByCodec: {}, factsDigest: 'sha256:aa', notExported: { invalidUtf8: { total: 0 }, twinLineageNotExported: 0 } },
    replay: { representationEffect: {
      note: 'synthetic', engines: { previous: { manifestRepresentation: null }, candidate: { manifestRepresentation: { facts_digest: 'sha256:bb', decoded_spans: 2, decoded_verified: 1, decoded_unverified: 1 } } },
      factClasses: { fragment: 3 }, unmeasuredPlain: { previousEngine: { s: { unmeasured: 1, reasons: {} } }, candidate: { s: { unmeasured: 0, reasons: {} } } },
      mappedFindings: { previousEngine: { s: { findingsByMapping: {}, cases: 0, casesByOutcome: {} } }, candidate: { s: { findingsByMapping: { 'source-segment | layers 1 | base64': 1 }, cases: 1, casesByOutcome: { pending: 1 } } } },
      outcomesByFactClass: { previousEngine: bucket, previousEngineNewCorpus: null, candidate: bucket }, engineEffect: { scanners }, corpusEffect: { changedExpectationCases: 0, scanners }, combined: { scanners },
    } },
  };
  const { status, out, md } = run({ A: base, B: structuredClone(base), C: structuredClone(base), added: [], report, superseded }, true);
  assert.equal(status, 0);
  assert.deepEqual(out.supersededCandidate.familyStatusChangesOnlyThere, ['fam-x']);
  assert.match(md, /Against the superseded candidate \(snapshot-old/);
  assert.match(md, /Accept this candidate .*not the superseded one/);
  assert.match(md, /DIFFERS from the release's/);
  assert.match(md, /not-measured -> positive:exact 1/);
  assert.match(md, /Still not measured/);
});
