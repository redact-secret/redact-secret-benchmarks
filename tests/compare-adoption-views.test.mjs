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
// The adoption record and registry are synthetic too (#700): the report states the state of the record it is given, never of the repository's.
const recordOf = (state, extra = {}) => ({
  schema: 'redact-secret/evidence-adoption/v1', state,
  candidate: { evidenceRelease: 'snapshot-test', engine: { tag: 'v0.1.0-alpha.9' }, ownerAcceptance: state === 'accepted' ? { acceptedBy: 'Synthetic Owner', acceptedOn: '2026-01-02', decision: 'docs/decisions/synthetic-decision.md' } : null,
    replay: { ciRun: 'https://example.invalid/runs/1', archive: { release: 'official-runs-1', sha256: 'sha256:aa' } }, deployment: { staging: null, production: null }, ...extra },
});
const registryOf = (version = '0.1.0-beta.1') => ({ scanners: [{ id: 'redact-secret', version }] });
const run = (files, strict = false) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'compare-views-'));
  const write = (name, value) => { const file = path.join(dir, name); writeFileSync(file, JSON.stringify(value)); return file; };
  const args = ['--import', 'tsx', script, '--accepted', write('a.json', files.A), '--replay-old', write('b.json', files.B), '--candidate', write('c.json', files.C), '--report', write('r.json', { evidenceRelease: 'snapshot-test', diff: { added: files.added, evidenceClassTransitions: {} }, ...(files.report ?? {}) }), '--out-json', path.join(dir, 'out.json'), '--out-md', path.join(dir, 'out.md'), ...(files.superseded ? ['--superseded-comparison', write('s.json', files.superseded)] : []), '--record', write('record.json', files.record ?? recordOf('candidate')), '--registry', write('registry.json', registryOf()), ...(strict ? ['--strict'] : [])];
  files.dir = dir;
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

const rerender = (dir, record, extra = []) => {
  const file = (name, value) => { const f = path.join(dir, name); writeFileSync(f, JSON.stringify(value)); return f; };
  const proc = spawnSync('node', ['--import', 'tsx', script, '--from-comparison', path.join(dir, 'out.json'), '--report', path.join(dir, 'r.json'), '--record', file('record2.json', record), '--registry', file('registry2.json', registryOf('0.1.0-beta.1')), '--out-json', path.join(dir, 'out2.json'), '--out-md', path.join(dir, 'out2.md'), ...extra], { encoding: 'utf8' });
  assert.equal(proc.status, 0, proc.stderr);
  return { md: readFileSync(path.join(dir, 'out2.md'), 'utf8'), json: JSON.parse(readFileSync(path.join(dir, 'out2.json'), 'utf8')) };
};
const synthetic = () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1')] });
  const files = { A: base, B: structuredClone(base), C: structuredClone(base), added: [] };
  const result = run(files);
  assert.equal(result.status, 0);
  return { ...result, dir: files.dir };
};

test('a report rendered from an accepted record does not ask for acceptance, labels the proposal instructions historical and shows absent receipts as absent (#700)', () => {
  const { dir } = synthetic();
  const { md, json } = rerender(dir, recordOf('accepted'));
  assert.equal(json.adoptionState.state, 'accepted');
  assert.doesNotMatch(md, /Nothing here is accepted/);
  assert.doesNotMatch(md, /Accept this candidate/);
  assert.doesNotMatch(md, /^## What the owner decides and runs/m);
  assert.match(md, /^## Historical: the proposal instructions \(not pending\)/m);
  assert.match(md, /nothing below is awaiting acceptance/);
  assert.match(md, /Synthetic Owner, 2026-01-02/);
  assert.match(md, /\| Deployment receipts \| staging: not recorded in the adoption record; production: not recorded/);
  assert.match(md, /Deployment receipts: staging absent, production absent/);
  // The two sides of every comparison are the baseline and the accepted population.
  assert.match(md, /Baseline \(.*\) \| Accepted \(/);
});

test('a report rendered from a candidate record still asks the owner and says nothing is accepted; a receipt appears only when the record holds one (#700)', () => {
  const { dir } = synthetic();
  const candidate = rerender(dir, recordOf('candidate'));
  assert.match(candidate.md, /Nothing here is accepted/);
  assert.match(candidate.md, /^## What the owner decides and runs/m);
  assert.doesNotMatch(candidate.md, /Historical: the proposal instructions/);
  assert.match(candidate.md, /\| Owner acceptance \| none \|/);
  const deployed = rerender(dir, recordOf('accepted', { deployment: { staging: { verifiedOn: '2026-01-03', run: 'r' }, production: null } }));
  assert.match(deployed.md, /staging: \{"verifiedOn":"2026-01-03","run":"r"\}; production: not recorded/);
  assert.match(deployed.md, /staging recorded, production absent/);
});

test('every report keeps the maintainer-only disclosure, never presents owner acceptance as independent review, and states the engine contract and the product identity (#700)', () => {
  const { dir } = synthetic();
  for (const record of [recordOf('candidate'), recordOf('accepted')]) {
    const { md } = rerender(dir, record);
    assert.match(md, /Maintainer-reviewed \(independent review pending\)/);
    assert.match(md, /메인테이너 검토 \(독립 검토 대기\)/);
    assert.match(md, /not (an )?independent (evidence )?review/);
    assert.doesNotMatch(md, /independently reviewed by the owner|accepted as independent/i);
    // The engine's representation contract, in its own words: whole encoded segment up to four layers, enclosing range, no fragment-aware scoring, other codecs unmeasured.
    assert.match(md, /base64 or hex finding \(up to four layers\) is mapped to the whole original encoded segment/);
    assert.match(md, /enclosing range, and there is no fragment-aware scoring/);
    assert.match(md, /percent-encoding, UTF-16, escaped Unicode\) and any mapping the engine cannot re-derive are unmeasured/);
    assert.doesNotMatch(md, /Decoded and fragment semantics are NOT measured/);
    // Product identity: the engine tag measured the registry's core release, and a later release needs the pinned replay.
    assert.match(md, /alpha\.9 measured core 0\.1\.0-beta\.1 /);
    assert.match(md, /pinned replay of this identical snapshot against that release \(#697\)/);
    assert.doesNotMatch(md, /beta\.13 through credential-eval needs a further engine tag/);
  }
});

test('the changed common-case count is reconciled against the change report, and a disagreement with the views is unexplained (#700)', () => {
  const base = view({ families: [family('fam-a', {})], cases: [makeCase('c1', { family: 'p:one' })] });
  const regrouped = view({ families: [family('fam-a', {})], cases: [makeCase('c1', { family: 'p:two' })] });
  const agreeing = run({ A: base, B: structuredClone(base), C: regrouped, added: [], report: { diff: { added: [], evidenceClassTransitions: {}, cases: { changed: 1 }, changed: [{ id: 'c1' }] } } });
  assert.ok(!agreeing.out.unexplained.some(u => /change report lists/.test(u)));
  assert.match(agreeing.md, /count the same 1\./);
  const disagreeing = run({ A: base, B: structuredClone(base), C: regrouped, added: [], report: { diff: { added: [], evidenceClassTransitions: {}, cases: { changed: 2 }, changed: [{ id: 'c1' }, { id: 'c2' }] } } });
  assert.ok(disagreeing.out.unexplained.some(u => /the change report lists 2 changed common cases, the views regroup 1/.test(u)));
});

test('the checked-in adoption report agrees with the structured adoption record on state, acceptance, engine, run and receipts (#700)', () => {
  const read = file => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const adoption = JSON.parse(read('benchmarks/evidence-adoption.json'));
  if (adoption.state === 'none') return;
  const c = adoption.candidate;
  const md = read(c.changeReport.replace(/\.json$/, '.md'));
  assert.ok(md.includes(`state \`${adoption.state}\``));
  assert.ok(md.includes(`credential-eval ${c.engine.tag}`));
  if (c.replay?.ciRun) assert.ok(md.includes(c.replay.ciRun), 'the report names the recorded replay run');
  if (adoption.state === 'accepted') {
    assert.doesNotMatch(md, /Nothing here is accepted|Accept this candidate/);
    assert.ok(md.includes(c.ownerAcceptance.acceptedBy) && md.includes(c.ownerAcceptance.acceptedOn));
    assert.ok(md.includes(c.ownerAcceptance.decision.split('/').pop()), 'the report links the accepted decision');
  } else {
    assert.match(md, /Nothing here is accepted/);
  }
  // A deployment receipt is shown only when the record holds one; an absent receipt is reported as absent, never invented.
  for (const environment of ['staging', 'production']) assert.equal(md.includes(`${environment}: not recorded in the adoption record`), !c.deployment?.[environment]);
  assert.match(md, /Maintainer-reviewed \(independent review pending\)/);
});
