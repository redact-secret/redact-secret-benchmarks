import test from 'node:test';
import assert from 'node:assert/strict';
import { CANDIDATE_DIFF_SCHEMA, buildCandidateDiff, candidateDiffArtifactProblems, candidateDiffProblems, receiptFilesProblems, METHODS_KEY, PLAIN_POPULATIONS } from '../benchmarks/qualification/candidate-diff.ts';
import { MATRIX_ARTIFACT_SCHEMA, buildMatrixArtifact, matrixArtifactProblems } from '../benchmarks/qualification/matrix-artifact.ts';
import { supportMatrixProblem } from '../src/support-model.ts';

// Synthetic only (#657): the registry, the artifacts, the receipts and every digest are built here. No committed ledger value, count or run is read, and the expected
// numbers below are written by hand from the case tables, not by calling the code under test.

const D = n => `sha256:${String(n).padStart(64, '0')}`;
const COMMIT = 'a'.repeat(40);
const candidate = {
  id: 'cand-1', product: { commit: COMMIT, version: '1.0.0-x', published: false }, platform: 'linux-x64', runClass: 'exploratory', publication: 'internal',
  packages: [{ name: '@p/core', sha256: D(11), platform: null }, { name: '@p/node-linux-x64', sha256: D(12), platform: 'linux-x64' }, { name: '@p/node-darwin-arm64', sha256: D(13), platform: 'darwin-arm64' }, { name: '@p/wasm', sha256: D(14), platform: null }],
};
const tarballs = [{ name: '@p/core', sha256: D(11) }, { name: '@p/node-linux-x64', sha256: D(12) }, { name: '@p/wasm', sha256: D(14) }];
const evidence = { source: 's', revision: 'r', evidence_schema: 'e', corpus_digest: D(5), release: { tag: 't', manifest_digest: D(6) } };
const identity = (id, version, build = 'released') => ({ id, version, mode: 'm', adapter: { id, version: '1' }, configuration_hash: D(id.length), build });
const positive = (...span_outcomes) => ({ type: 'positive', span_outcomes, leaked_bytes: span_outcomes.filter(o => o === 'MISS').length * 8, collateral_bytes: 0 });
const control = flagged => ({ type: 'control', flagged, findings: flagged ? 1 : 0 });
const caseOf = (case_id, measurement, family = 'fam-a', actual = []) => ({ case_id, path: `${case_id}.txt`, kind: measurement.type === 'positive' ? 'must-redact' : 'must-not-flag', tier: 'T1', group: 'g', family, expected: [], actual, measurement });

// The product's cases on the baseline and the candidate (hand-written). Expected, by hand:
//   c1 MISS -> EXACT             fixed
//   c2 EXACT -> MISS             regressed
//   c3 EXACT -> EXACT            unchanged
//   c4 flagged -> clear          fixed
//   c5 clear -> flagged          regressed
//   c6 MISS -> MISS (more leak)  regressed (a failing case that leaks more)
//   c7 pending -> pending        changed (outside every denominator, but its findings differ)
const base = [caseOf('c1', positive('MISS')), caseOf('c2', positive('EXACT')), caseOf('c3', positive('EXACT')), caseOf('c4', control(true), 'fam-b'), caseOf('c5', control(false), 'fam-b'), caseOf('c6', positive('MISS')), caseOf('c7', { type: 'pending' }, 'fam-b')];
const cand = [caseOf('c1', positive('EXACT')), caseOf('c2', positive('MISS')), caseOf('c3', positive('EXACT')), caseOf('c4', control(false), 'fam-b'), caseOf('c5', control(true), 'fam-b'), caseOf('c6', positive('MISS', 'MISS')), caseOf('c7', { type: 'pending' }, 'fam-b', [{ start: 0, end: 4, family: 'x', action: 'redact' }])];
const peerCases = [caseOf('c1', positive('MISS')), caseOf('c3', positive('EXACT'))];
const run = (scanner, cases) => ({ scanner, status: 'complete', cases, aggregates: { groups: {} } });
const artifactOf = (cases, over = {}) => ({
  schema: 'credential-eval/run-artifact/v1',
  manifest: { engine: { name: 'e', version: '2.0.0' }, protocol_version: 'p/1', evidence, config_hash: D(7), run_class: 'exploratory', publication: 'internal', methods: [], scanners: [identity('redact-secret', '1.0.0-x'), identity('gitleaks', '8.0.0')], ...over },
  scanners: [run('redact-secret', structuredClone(cases)), run('gitleaks', structuredClone(peerCases))], non_semantic: {},
});
const record = (key, over = {}) => ({
  schema: 'r', population: key, platform: 'linux-x64', runClass: 'exploratory', publication: 'internal', engine: { name: 'e', version: '2.0.0', revision: 'rev', protocol: 'p/1' }, evidence, configHash: D(7),
  artifact: { digest: D(100), semanticDigest: D(200) }, determinism: { runs: 2, semanticDigestsEqual: true }, ...over,
});
const receipt = over => ({ schema: 'redact-secret/product-candidate-receipt/v1', candidate: 'cand-1', commit: COMMIT, version: '1.0.0-x', platform: 'linux-x64', runClass: 'exploratory', publication: 'internal',
  packages: tarballs.map(p => ({ name: p.name, version: '1.0.0-x', tarballSha256: p.sha256, files: [{ path: 'package.json', sha256: D(1) }] })), ...over });
const candidateRecord = (key, over = {}) => record(key, { productCandidate: { id: 'cand-1', commit: COMMIT, version: '1.0.0-x', published: false, packages: structuredClone(tarballs), receipt: 'product-candidate-receipt.json' }, ...over });

const sides = () => {
  const baseline = [], cands = [];
  for (const key of [...PLAIN_POPULATIONS, METHODS_KEY]) {
    const plain = key !== METHODS_KEY;
    baseline.push({ key, record: record(key, { runClass: 'official', publication: 'public' }), artifactDigest: D(100), semanticDigest: plain ? D(200) : null, ...(plain ? { artifact: artifactOf(base, { run_class: 'official', publication: 'public', scanners: [identity('redact-secret', '0.9.0'), identity('gitleaks', '8.0.0')] }) } : {}) });
    cands.push({ key, record: candidateRecord(key, { artifact: { digest: D(300), semanticDigest: D(400) } }), receipt: receipt(), artifactDigest: D(300), semanticDigest: plain ? D(400) : null, ...(plain ? { artifact: artifactOf(cand) } : {}) });
  }
  return { baseline, cands };
};
const input = (over = {}) => {
  const { baseline, cands } = sides();
  return { candidate, control: { archive: { release: 'rel', sha256: D(9) }, product: { version: '0.9.0' }, sides: baseline }, candidateSides: cands, ...over };
};
const problemsOf = i => candidateDiffProblems(i);

test('the diff of a registered candidate against its baseline equals the hand-computed counts', () => {
  const diff = buildCandidateDiff(input());
  assert.equal(diff.schema, CANDIDATE_DIFF_SCHEMA);
  assert.deepEqual(candidateDiffArtifactProblems(diff), []);
  for (const p of diff.populations) {
    assert.equal(p.cases, 7);
    assert.deepEqual([p.fixed, p.regressed, p.changed, p.unchanged, p.stillFailing], [2, 3, 1, 1, 3]);
  }
  // c7 is pending on both sides but its findings changed: changed, never fixed or regressed.
  const first = diff.populations[0];
  assert.deepEqual(first.differing.map(d => `${d.case_id}:${d.direction}`), ['c1:fixed', 'c2:regressed', 'c4:fixed', 'c5:regressed', 'c6:regressed', 'c7:changed']);
  assert.equal(diff.worsened, true);
  assert.deepEqual(first.families, [{ family: 'fam-a', cases: 4, passBaseline: 2, passCandidate: 2 }, { family: 'fam-b', cases: 3, passBaseline: 1, passCandidate: 1 }]);
});

test('the projection carries labels and counts only: no span, no byte, no finding text', () => {
  const text = JSON.stringify(buildCandidateDiff(input()));
  assert.ok(!text.includes('"start"') && !text.includes('"end"') && !text.includes('"action"') && !text.includes('"actual"'));
  assert.ok(!text.includes('.txt'));
});

test('the diff names the registered tarball set of the platform and the baseline archive', () => {
  const diff = buildCandidateDiff(input());
  assert.deepEqual(diff.candidate.tarballs, tarballs);
  assert.deepEqual(diff.baseline.archive, { release: 'rel', sha256: D(9) });
  assert.equal(diff.publication, 'internal');
  assert.equal(diff.runClass, 'exploratory');
});

test('wrong artifacts fail: a public or official run, another candidate, another commit, another tarball', () => {
  const mutate = (fn) => { const i = input(); fn(i); return problemsOf(i); };
  assert.ok(mutate(i => { i.candidateSides[0].record.runClass = 'official'; }).some(p => p.includes('exploratory/internal')));
  assert.ok(mutate(i => { i.candidateSides[0].record.publication = 'public'; }).some(p => p.includes('exploratory/internal')));
  assert.ok(mutate(i => { i.candidateSides[0].artifact.manifest.publication = 'public'; }).some(p => p.includes('the artifact says')));
  assert.ok(mutate(i => { i.candidateSides[0].record.productCandidate.id = 'other'; }).some(p => p.includes('not cand-1')));
  assert.ok(mutate(i => { i.candidateSides[1].record.productCandidate.commit = 'b'.repeat(40); }).some(p => p.includes('registry holds')));
  assert.ok(mutate(i => { i.candidateSides[0].record.productCandidate.packages[0].sha256 = D(99); }).some(p => p.includes('registry pins')));
  assert.ok(mutate(i => { i.candidateSides[0].receipt.packages[1].tarballSha256 = D(98); }).some(p => p.includes('receipt') && p.includes('registry pins')));
  assert.ok(mutate(i => { i.candidateSides[0].record.productCandidate.packages.pop(); }).some(p => p.includes('is not listed')));
  assert.ok(mutate(i => { i.candidateSides[0].record.productCandidate.packages.push({ name: '@p/node-darwin-arm64', sha256: D(13) }); }).some(p => p.includes('not a registered package')));
  assert.ok(mutate(i => { i.candidateSides[0].receipt = undefined; }).some(p => p.includes('no product-candidate-receipt.json')));
  assert.ok(mutate(i => { i.candidateSides[0].receipt.packages[0].files = []; }).some(p => p.includes('lists no installed file')));
  assert.ok(mutate(i => { i.candidateSides[0].record.productCandidate = undefined; }).some(p => p.includes('names no product candidate')));
});

test('wrong artifacts fail: bytes that do not hash to the record, repeat runs that disagree, a missing population', () => {
  const mutate = (fn) => { const i = input(); fn(i); return problemsOf(i); };
  assert.ok(mutate(i => { i.candidateSides[0].artifactDigest = D(555); }).some(p => p.includes('bytes hash to')));
  assert.ok(mutate(i => { i.candidateSides[0].semanticDigest = D(556); }).some(p => p.includes('semantic digest')));
  assert.ok(mutate(i => { i.candidateSides[2].record.determinism.semanticDigestsEqual = false; }).some(p => p.includes('repeat runs did not agree')));
  assert.ok(mutate(i => { i.candidateSides.splice(1, 1); }).some(p => p.includes('no candidate artifact')));
  assert.ok(mutate(i => { i.control.sides.splice(0, 1); }).some(p => p.includes('baseline holds no artifact')));
  assert.throws(() => buildCandidateDiff(Object.assign(input(), { candidateSides: [] })), /Refusing the candidate diff/);
});

test('the baseline cannot be a candidate run, and the sides differ in the product build only', () => {
  const mutate = (fn) => { const i = input(); fn(i); return problemsOf(i); };
  assert.ok(mutate(i => { i.control.sides[0].record.productCandidate = candidateRecord('x').productCandidate; }).some(p => p.includes('cannot be the baseline')));
  assert.ok(mutate(i => { i.control.sides[0].artifact.manifest.scanners[0].build = 'candidate'; }).some(p => p.includes('candidate build')));
  assert.ok(mutate(i => { i.control.sides[0].record.configHash = D(8); }).some(p => p.includes('configuration hash differs')));
  assert.ok(mutate(i => { i.control.sides[0].record.evidence = { ...evidence, revision: 'other' }; }).some(p => p.includes('evidence identity differs')));
  assert.ok(mutate(i => { i.control.sides[0].record.engine.version = '1.0.0'; }).some(p => p.includes('engine differs')));
  assert.ok(mutate(i => { i.candidateSides[0].artifact.scanners[1].cases[0] = caseOf('c1', positive('EXACT')); }).some(p => p.includes('peer gitleaks measured differently')));
  assert.ok(mutate(i => { i.candidateSides[0].artifact.manifest.scanners[1].version = '9.9.9'; }).some(p => p.includes('peer gitleaks differs in identity')));
  assert.ok(mutate(i => { i.candidateSides[0].artifact.scanners[0].cases.pop(); }).some(p => p.includes('case universe differs')));
  assert.ok(mutate(i => { i.candidateSides[0].artifact.manifest.scanners[0].version = '5.0.0'; }).some(p => p.includes('registry holds')));
  assert.ok(mutate(i => { i.control.product.version = '0.8.0'; }).some(p => p.includes('the control is')));
});

test('a candidate diff is internal: a public or recorded reading of it is refused', () => {
  const diff = buildCandidateDiff(input());
  assert.ok(candidateDiffArtifactProblems({ ...diff, publication: 'public' }).some(p => p.includes('never public')));
  assert.ok(candidateDiffArtifactProblems({ ...diff, worsened: false }).some(p => p.includes('worsened')));
  assert.ok(candidateDiffArtifactProblems({ ...diff, populations: [{ ...diff.populations[0], fixed: 9 }] }).length > 0);
  assert.ok(candidateDiffArtifactProblems({ schema: 'other' })[0].includes('not a'));
});

test('candidate data never enters the published matrix: an exploratory population is refused', () => {
  const view = {
    schema: 'qualification-view/v1', publication: 'public', policy: { revision: 'p' }, adapter: { id: 'a', version: 1 },
    populations: [{ population: 'pop-a', runClass: 'internal', artifact: { semanticDigest: D(400), artifactDigest: D(300), engine: { name: 'e', version: '2.0.0' }, scanners: [{ id: 'redact-secret', version: '1.0.0-x', build: 'released' }] } }],
    supportMatrix: { distribution: { stable: 0, provisional: 0, pending: 0, unsupported: 0 }, stableDistribution: { documented: 0, empirical: 0, 'policy-qualified': 0 }, families: [] },
  };
  const registry = { engine: { version: '2.0.0' }, runs: [{ id: 'pop-a@linux-x64', population: 'pop-a', canonical: true, platform: 'linux-x64', runClass: 'public', artifact: { semanticDigest: D(1) } }] };
  const problems = matrixArtifactProblems(buildMatrixArtifact(view, 'published'), registry);
  assert.ok(problems.some(p => p.includes('public runs only')));
  assert.ok(problems.some(p => p.includes('not a canonical official run')));
});

test('the legacy matrix consumers refuse the view matrix: it carries no legacy provenance, so none is forged for it', () => {
  const families = [{ provider: 'p', family: 'f', familyName: 'F', status: 'stable', evidenceTier: 'T1', evidenceBasis: 'documented', qualificationProfile: 'documented', detectors: ['f'], reason: null }];
  const view = {
    schema: 'qualification-view/v1', publication: 'public', policy: { revision: 'p' }, adapter: { id: 'a', version: 1 }, populations: [{ population: 'pop-a', runClass: 'public', artifact: { semanticDigest: D(1), artifactDigest: D(2), engine: { name: 'e', version: '2.0.0' }, scanners: [] } }],
    supportMatrix: { distribution: { stable: 1, provisional: 0, pending: 0, unsupported: 0 }, stableDistribution: { documented: 1, empirical: 0, 'policy-qualified': 0 }, families },
  };
  const artifact = buildMatrixArtifact(view, 'published');
  assert.equal(artifact.schema, MATRIX_ARTIFACT_SCHEMA);
  // `eval:publish:matrix`, the drift check and the legacy site validate with this function; a view matrix must not pass it by accident.
  assert.ok(supportMatrixProblem(artifact));
  assert.equal(artifact.sourceReport, undefined);
});

test('the receipt must list exactly the files of the registered tarball', () => {
  const r = receipt();
  const held = [{ name: '@p/core', tarballSha256: D(11), files: [{ path: 'package.json', sha256: D(1) }] }, { name: '@p/node-linux-x64', tarballSha256: D(12), files: [{ path: 'package.json', sha256: D(1) }] }, { name: '@p/wasm', tarballSha256: D(14), files: [{ path: 'package.json', sha256: D(1) }] }];
  assert.deepEqual(receiptFilesProblems(r, held), []);
  assert.ok(receiptFilesProblems(r, [{ ...held[0], files: [{ path: 'package.json', sha256: D(2) }] }, held[1], held[2]]).some(p => p.includes('differs from the receipt')));
  assert.ok(receiptFilesProblems(r, [{ ...held[0], files: [...held[0].files, { path: 'extra.js', sha256: D(3) }] }, held[1], held[2]]).some(p => p.includes('absent from the receipt')));
  assert.ok(receiptFilesProblems({ ...r, packages: [{ ...r.packages[0], files: [...r.packages[0].files, { path: 'gone.js', sha256: D(3) }] }] }, held).some(p => p.includes('does not hold it')));
  assert.ok(receiptFilesProblems(r, [{ ...held[0], tarballSha256: D(77) }, held[1], held[2]]).some(p => p.includes('the checked tarball is')));
  assert.ok(receiptFilesProblems(r, held.slice(1)).some(p => p.includes('no registered tarball was checked')));
});
