/**
 * Six-family PII protected lifecycle (benchmarks #428). Every fixture here is the disposable public control of
 * `b11ProtectedPublicControl`: a public seed, `PUBLIC CONTROL` prose and reserved `example.invalid` addresses. No
 * protected-like content is authored, and no product is run: surfaces and the seam are fakes.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import { serialize } from '../holdout/storage.ts';
import { runHoldout } from '../holdout/lifecycle.ts';
import { piiHoldoutDomain } from '../benchmarks/evaluation/domains/pii/holdout.ts';
import { B11_EXPECTED_ACTIVATION, B11_FAMILIES, b11Commitment } from '../benchmarks/evaluation/domains/pii/beta11-qualification.ts';
import { B11P_BETA11_CORE_COMMIT, B11P_INPUT_KIND, b11ProtectedCandidatePlan, b11ProtectedCounts, b11ProtectedDomain, b11ProtectedMinimums,
  b11ProtectedPublicControl, b11ProtectedPublicGates, buildB11ProtectedDisposition, buildB11ProtectedTrust, readB11ProtectedInput, runB11ProtectedFamily,
  sealB11ProtectedInput, validateB11ProtectedAggregate, validateB11ProtectedInput } from '../benchmarks/evaluation/domains/pii/beta11-protected.ts';

const repo = fileURLToPath(new URL('../', import.meta.url));
const PUBLIC_SEED = 'PUBLIC-CONTROL-SEED-for-lifecycle-tests-only-0001';
const COMMIT = '0123456789abcdef0123456789abcdef01234567';
const d = char => char.repeat(64);

function publicInput() {
  const corpus = b11ProtectedPublicControl('unused');
  return { schemaVersion: 1, kind: B11P_INPUT_KIND, seed: PUBLIC_SEED, attestation: corpus.attestation, cases: corpus.fixtures };
}
function fakeFreeze() {
  const base = { candidate: { sourceCommit: COMMIT, versionString: '0.0.0-public-control',
    artifacts: { core: { file: 'core.tgz', sha256: d('a') }, node: { file: 'node.tgz', sha256: d('b') }, wasm: { file: 'wasm.tgz', sha256: d('c') } },
    wasmPayloads: [{ file: 'redact_secret_wasm_bg.wasm', role: 'default-full', sha256: d('d') }, { file: 'redact_secret_wasm_pii_bg.wasm', role: 'pii', sha256: d('e') }],
    identityExample: { binarySha256: d('f') } } };
  return { ...base, freezeCommitment: b11Commitment(base) };
}
function fakeReport(freeze, costStatus = 'met', extraGate = null) {
  const base = { freeze: { freezeCommitment: freeze.freezeCommitment }, candidate: { sourceCommit: COMMIT },
    families: B11_FAMILIES.map(family => ({ family, gates: [{ id: 'diagnostic-population', status: 'met' }, { id: 'runtime-and-package-cost', status: costStatus },
      ...(extraGate ? [extraGate] : []), { id: 'protected-partition', status: 'not-run' }], protected: { epochCommitment: hash(`epoch:${family}`) } })) };
  return { ...base, artifactCommitment: b11Commitment(base) };
}
function fakeDisposition(report) {
  const base = { reportCommitment: report.artifactCommitment };
  return { ...base, artifactCommitment: b11Commitment(base) };
}
const measured = () => ({ artifacts: { core: d('a'), node: d('b'), wasm: d('c') },
  wasmPayloads: [{ file: 'redact_secret_wasm_pii_bg.wasm', sha256: d('e') }, { file: 'redact_secret_wasm_bg.wasm', sha256: d('d') }], identityExampleSha256: d('f') });

async function workspace(t, input = publicInput()) {
  const root = await mkdtemp(path.join(tmpdir(), 'pii-b11-protected-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const holdout = path.join(root, 'holdout'), generated = path.join(holdout, 'generated');
  await mkdir(generated, { recursive: true, mode: 0o700 });
  await chmod(generated, 0o700);
  const inputFile = path.join(generated, 'pii-b11-input.json');
  await writeFile(inputFile, serialize(input), { mode: 0o600 });
  return { root, holdout, generated, inputFile, input };
}
async function sealed(t) {
  const w = await workspace(t);
  const { sealFile, record } = await sealB11ProtectedInput({ inputFile: w.inputFile, holdoutDirectory: w.holdout, review: 'reviewed' });
  const freeze = fakeFreeze(), report = fakeReport(freeze);
  const plan = b11ProtectedCandidatePlan({ coreCommit: COMMIT, family: 'pii:global:email', freeze, report, seal: record,
    benchmarkRevision: '1'.repeat(40), lockfileSha256: d('2'), measured: measured() });
  const store = path.join(w.holdout, JSON.parse(await readFile(path.join(w.holdout, record.families[0].manifest), 'utf8')).dataDirectory);
  return { ...w, sealFile, record, freeze, report, ...plan, store };
}
/** A perfect fake product: redacts exactly the authored sensitive candidates on both surfaces, silent when off. */
function fakeScanner(w, overrides = {}) {
  const truth = new Map(w.input.cases.map(row => [row.id, row]));
  return { id: 'redact-secret-pii-b11-protected', mode: 'candidate', configuration: w.configuration, capabilities: { ranges: true, classification: true },
    version: async () => '0.0.0-public-control',
    async observe({ surface, selectors, cases }) {
      const key = selectors.length ? selectors[0] : 'off';
      return { activationIdentity: B11_EXPECTED_ACTIVATION[key], artifact: surface === 'node-wasm' ? 'wasm' : 'addon',
        cases: cases.map(row => {
          const authored = truth.get(row.id), hit = selectors.length > 0 && authored.sensitivity === 'sensitive';
          return { id: row.id, family: hit ? [[authored.candidate.start, authored.candidate.end, 'redact']] : [], otherPii: [], otherPiiAtTarget: false,
            credential: 0, ranges: row.ranges.map(range => [range.start, range.end, !hit]), outsidePreserved: true, scanRedactAgree: true };
        }) };
    },
    async seam({ family, cases }) {
      return { header: { format: 'redact-secret/pii-identity-evaluation/1', family, vocabulary: 'pii-context/v2',
        activationIdentity: B11_EXPECTED_ACTIVATION[`pii:family:${family.slice(4)}`] },
      observations: cases.map(row => { const authored = truth.get(row.id);
        return { id: row.id, family, identity: authored.identity === 'valid' ? 'established' : 'unmatched',
          sensitivity: authored.identity === 'valid' ? authored.sensitivity : 'not-established' }; }) };
    },
    ...overrides };
}
const run = (w, scanner = fakeScanner(w), verifyCandidate = async () => w.candidate) =>
  runB11ProtectedFamily({ sealFile: w.sealFile, family: 'pii:global:email', scanner, candidate: w.candidate, verifyCandidate });
const runsSpent = async w => JSON.parse(await readFile(path.join(w.store, 'state.json'), 'utf8')).runs.length;

test('per-family minimums follow pii-v1: 4 per denominator, 6 benign over 3 axes, 4 twin pairs, 20 cases per family', () => {
  const profile = JSON.parse(readFileSync(new URL('../qualification/pii-v1.json', import.meta.url), 'utf8'));
  for (const family of B11_FAMILIES) {
    const minimum = b11ProtectedMinimums(family);
    assert.equal(minimum.sensitive, profile.mechanics.minDenominator);
    assert.equal(minimum.benign, profile.gates.minBenignCases);
    assert.equal(minimum.benignAxes, profile.gates.minBenignAxes);
    assert.equal(minimum.twinPairs, profile.mechanics.minDenominator);
    assert.equal(minimum.nonSensitive, ['pii:global:iban', 'pii:us:ssn'].includes(family) ? 0 : 4);
    assert.equal(minimum.casesPerFamily, 20);
  }
});

test('the custodian template holds placeholders only and can never validate or be sealed', () => {
  const template = JSON.parse(readFileSync(new URL('../holdout/pii-custodian-template.json', import.meta.url), 'utf8'));
  const leaves = [];
  const walk = (value, key) => { if (value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => walk(v, k)); else leaves.push([key, value]); };
  walk(template, '');
  for (const [key, value] of leaves) {
    if (key === 'schemaVersion' || key === 'kind') continue;
    assert.equal(typeof value, 'string', key);
    assert.ok(value.startsWith('<CUSTODIAN:') && value.endsWith('>'), `${key} is not a placeholder`);
  }
  assert.throws(() => validateB11ProtectedInput(template), /invalid-input/);
});

test('input validation reports codes and positions only, and enforces minimums, twins and English/Korean context', () => {
  const input = publicInput();
  validateB11ProtectedInput(input);
  assert.deepEqual(b11ProtectedCounts(input.cases)['pii:global:email']['benign-heavy-stress'],
    { cases: 10, sensitive: 4, nonSensitive: 4, notEstablished: 2, benignAxes: 3, twinPairs: 4 });
  const mutate = change => { const copy = structuredClone(input); change(copy); return () => validateB11ProtectedInput(copy); };
  const secret = input.cases[0];
  for (const [change, code] of [
    [c => c.cases.splice(0, 1), /minimum:pii:global:email:diagnostic-balanced:sensitive<4|twin-target/],
    [c => { c.cases[8].axis = 'control-reserved-a'; c.cases[9].axis = 'control-reserved-a'; }, /benign-axes<3/],
    [c => { c.cases[4].twinOf = null; }, /twin-pairs<4/],
    [c => { c.cases[4].twinOf = c.cases[14].id; }, /twin-scope/],
    [c => { c.cases[0].action = 'none'; }, /action#1/],
    [c => { c.cases[0].selector = 'pii:family:us:ssn'; }, /selector#1/],
    [c => { c.cases[0].language = 'ko'; }, /language#1/],
    [c => { c.cases[0].candidate = { start: 0, end: 9999 }; }, /oracle-label#1|candidate-range#1/],
    [c => { c.cases[0].sensitivityBasis = []; }, /oracle-label#1/],
    [c => { c.cases[1].id = c.cases[0].id; }, /duplicate-id#2/],
    [c => { c.seed = 'short'; }, /invalid-input:seed/],
    [c => { c.attestation.statements.noRealPersonData = false; }, /attestation-statements/],
    [c => { c.cases[0].extra = 1; }, /case-shape#1/],
  ]) {
    let message = '';
    try { mutate(change)(); } catch (error) { message = error.message; }
    assert.match(message, code);
    for (const leak of [secret.text, secret.id, 'example.invalid', PUBLIC_SEED, 'control-slot']) assert.equal(message.includes(leak), false);
  }
});

test('sealing binds the whole input, seed and review attestation; one budget per family; metadata carries no case content', async t => {
  const w = await sealed(t);
  assert.equal(w.record.inputCommitment, hash(serialize(w.input)));
  assert.equal(w.record.seedCommitment, hash(PUBLIC_SEED));
  assert.deepEqual(w.record.review.statements.length, 5);
  assert.deepEqual(w.record.families.map(row => [row.family, row.maxRuns]), [['pii:global:email', 1]]);
  assert.deepEqual(w.record.absentFamilies, B11_FAMILIES.filter(family => family !== 'pii:global:email'));
  const manifest = JSON.parse(await readFile(path.join(w.holdout, w.record.families[0].manifest), 'utf8'));
  assert.equal(manifest.maxRuns, 1);
  assert.deepEqual(manifest.evaluation, { schemaVersion: 1, domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-b11-protected-v1' });
  const metadata = (await readFile(w.sealFile, 'utf8')) + JSON.stringify(manifest);
  for (const leak of [PUBLIC_SEED, 'example.invalid', 'public-control-0-0', 'control-slot', 'PUBLIC CONTROL']) assert.equal(metadata.includes(leak), false);
  assert.equal((await stat(w.store)).mode & 0o777, 0o700);
  assert.equal((await stat(path.join(w.store, 'corpus.json'))).mode & 0o777, 0o600);
  await assert.rejects(sealB11ProtectedInput({ inputFile: w.inputFile, holdoutDirectory: w.holdout, review: 'reviewed' }), /corpus-already-sealed/);
  await assert.rejects(sealB11ProtectedInput({ inputFile: w.inputFile, holdoutDirectory: w.holdout, review: 'self-checked' }), /review-declaration-required/);
});

test('a run scores with the #428 gates and the identity seam and emits only allowlisted aggregate counts; a second run is refused', async t => {
  const w = await sealed(t);
  const aggregate = await run(w);
  assert.equal(aggregate.status, 'complete');
  assert.equal(aggregate.protectedGate, 'met');
  assert.equal(aggregate.independence, 'custodian-declared');
  assert.deepEqual(aggregate.gates.map(row => row.status), Array(9).fill('met'));
  assert.equal(aggregate.views['diagnostic-balanced'].sensitive.detected, 4);
  assert.equal(aggregate.views['benign-heavy-stress'].nonSensitive.falseAlarm, 0);
  assert.ok(aggregate.views['diagnostic-balanced'].metrics.every(row => row.status === 'met'), 'every required metric is measured, none vacuous');
  assert.equal(aggregate.identity.eligible, 12);
  assert.equal(aggregate.identity.correct, 12);
  assert.equal(aggregate.binding.epochCommitment, hash('epoch:pii:global:email'));
  const text = JSON.stringify(aggregate);
  for (const leak of [PUBLIC_SEED, 'example.invalid', 'PUBLIC CONTROL', 'public-control-0-0', 'control-reserved-a', 'control-slot', '"start"', '"end"'])
    assert.equal(text.includes(leak), false, leak);
  assert.equal(await runsSpent(w), 1);
  await assert.rejects(run(w), /run-budget-exhausted/);
  assert.throws(() => validateB11ProtectedAggregate({ ...aggregate, text: 'x' }), /invalid-protected-aggregate/);
  assert.throws(() => validateB11ProtectedAggregate({ ...aggregate, views: { ...aggregate.views, 'diagnostic-balanced':
    { ...aggregate.views['diagnostic-balanced'], caseIds: ['x'] } } }), /invalid-protected-aggregate/);
});

test('a failing product is measured, not retried: the gate fails and the budget is spent', async t => {
  const w = await sealed(t);
  const base = fakeScanner(w);
  const aggregate = await run(w, { ...base, async observe(request) {
    const result = await base.observe(request);
    return { ...result, cases: result.cases.map(row => ({ ...row, family: [] })) };
  } });
  assert.equal(aggregate.status, 'complete');
  assert.equal(aggregate.protectedGate, 'not-met');
  assert.equal(aggregate.gates.find(row => row.id === 'diagnostic-population').status, 'not-met');
  await assert.rejects(run(w), /run-budget-exhausted/);
});

test('a crashed attempt consumes its reservation and a retry is refused', async t => {
  const w = await sealed(t);
  const aggregate = await run(w, fakeScanner(w, { async observe() { throw new Error('PRIVATE-RAW-FAILURE example.invalid'); } }));
  assert.equal(aggregate.status, 'incomplete');
  assert.equal(aggregate.protectedGate, 'not-met');
  assert.equal(aggregate.views, null);
  assert.equal(JSON.stringify(aggregate).includes('PRIVATE-RAW-FAILURE'), false);
  assert.equal(await runsSpent(w), 1);
  await assert.rejects(run(w), /run-budget-exhausted/);
});

test('an interrupted (killed) process keeps its reservation: after the stale lock is cleared the budget is exhausted', async t => {
  const w = await sealed(t);
  const config = path.join(w.root, 'child.json'), child = path.join(w.root, 'child.mjs');
  await writeFile(config, JSON.stringify({ sealFile: w.sealFile, configuration: w.configuration, candidate: w.candidate }));
  await writeFile(child, [
    `import { readFileSync } from 'node:fs';`,
    `import { runB11ProtectedFamily } from ${JSON.stringify(pathToFileURL(path.join(repo, 'benchmarks/evaluation/domains/pii/beta11-protected.ts')).href)};`,
    `const { sealFile, configuration, candidate } = JSON.parse(readFileSync(${JSON.stringify(config)}, 'utf8'));`,
    `setInterval(() => {}, 1000);`,
    `const scanner = { id: 'redact-secret-pii-b11-protected', mode: 'candidate', configuration, capabilities: { ranges: true, classification: true },`,
    `  version: async () => '0.0.0-public-control', observe: () => new Promise(() => {}), seam: () => new Promise(() => {}) };`,
    `await runB11ProtectedFamily({ sealFile, family: 'pii:global:email', scanner, candidate, verifyCandidate: async () => candidate });`,
  ].join('\n'));
  const processHandle = spawn(process.execPath, ['--import', 'tsx', child], { cwd: repo, stdio: 'ignore' });
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const spent = await runsSpent(w).catch(() => 0);
    if (spent === 1) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  processHandle.kill('SIGKILL');
  await new Promise(resolve => processHandle.once('exit', resolve));
  assert.equal(await runsSpent(w), 1);
  await assert.rejects(run(w), /Holdout operation rejected/);
  // The custodian verifies no process owns the lock, removes only the stale lock, and the budget stays spent.
  await rm(path.join(w.store, '.lock'));
  await assert.rejects(run(w), /run-budget-exhausted/);
});

test('candidate drift is refused before any byte is read, and drift during a run invalidates it', async t => {
  const w = await sealed(t);
  const plan = patch => () => b11ProtectedCandidatePlan({ coreCommit: COMMIT, family: 'pii:global:email', freeze: w.freeze, report: w.report, seal: w.record,
    benchmarkRevision: '1'.repeat(40), lockfileSha256: d('2'), measured: measured(), ...patch });
  assert.throws(plan({ measured: { ...measured(), artifacts: { ...measured().artifacts, node: d('9') } } }), /candidate-artifact-mismatch/);
  assert.throws(plan({ measured: { ...measured(), wasmPayloads: [{ file: 'redact_secret_wasm_bg.wasm', sha256: d('d') }] } }), /wasm-payload-mismatch/);
  assert.throws(plan({ measured: { ...measured(), identityExampleSha256: d('9') } }), /identity-example-mismatch/);
  assert.throws(plan({ coreCommit: B11P_BETA11_CORE_COMMIT }), /core-commit-mismatch/);
  assert.throws(plan({ freeze: { ...w.freeze, candidate: { ...w.freeze.candidate, versionString: 'edited' } } }), /freeze-commitment-mismatch/);
  assert.throws(plan({ report: { ...w.report, artifactCommitment: d('0') } }), /report-not-bound-to-freeze/);
  const noPii = { ...w.freeze.candidate, wasmPayloads: w.freeze.candidate.wasmPayloads.filter(row => row.role !== 'pii') };
  const freezeNoPii = { candidate: noPii, freezeCommitment: b11Commitment({ candidate: noPii }) };
  assert.throws(plan({ freeze: freezeNoPii, report: fakeReport(freezeNoPii) }), /pii-wasm-payload-missing/);
  const drifted = { ...w.candidate, candidateArtifactHash: d('9') };
  // Changed before the corpus is opened: rejected and the budget is untouched.
  await assert.rejects(run(w, fakeScanner(w), async () => drifted), /candidate-changed/);
  assert.equal(await runsSpent(w), 0);
  // Changed while the corpus is being scored: the attempt is spent and the result is incomplete.
  let calls = 0;
  const aggregate = await run(w, fakeScanner(w), async () => (calls++ === 0 ? w.candidate : drifted));
  assert.equal(aggregate.status, 'incomplete');
  assert.equal(aggregate.gates.find(row => row.id === 'candidate-stable').status, 'not-met');
  assert.equal(aggregate.protectedGate, 'not-met');
  assert.equal(await runsSpent(w), 1);
});

test('unsafe modes and symlinks are rejected for the input, the generated directory and sealed bytes', async t => {
  const w = await workspace(t);
  await chmod(w.inputFile, 0o644);
  await assert.rejects(readB11ProtectedInput(w.inputFile), /unsafe-file-permissions/);
  await chmod(w.inputFile, 0o600);
  const link = path.join(w.generated, 'linked-input.json');
  await symlink(w.inputFile, link);
  await assert.rejects(readB11ProtectedInput(link), /unsafe-or-unreadable-input/);
  await chmod(w.generated, 0o755);
  await assert.rejects(readB11ProtectedInput(w.inputFile), /unsafe-storage-permissions/);
  await chmod(w.generated, 0o700);
  // A symlinked generated/ directory is refused when sealing.
  const other = await workspace(t);
  const linkedHoldout = path.join(other.root, 'linked-holdout');
  await mkdir(linkedHoldout);
  await symlink(other.generated, path.join(linkedHoldout, 'generated'));
  await assert.rejects(sealB11ProtectedInput({ inputFile: other.inputFile, holdoutDirectory: linkedHoldout, review: 'reviewed' }), /unsafe-storage-permissions/);
  // Sealed bytes whose mode was loosened are refused at run time.
  const s = await sealed(t);
  await chmod(path.join(s.store, 'corpus.json'), 0o644);
  await assert.rejects(run(s), /unsafe-file-permissions/);
});

test('nothing under holdout/generated can be staged: gitignored, and the fixture-storage check fails on a staged file', async t => {
  const ignored = spawnSync('git', ['check-ignore', '-q', 'holdout/generated/pii-b11-input.json'], { cwd: repo });
  assert.equal(ignored.status, 0);
  const root = await mkdtemp(path.join(tmpdir(), 'pii-b11-staging-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  await mkdir(path.join(root, 'holdout/generated'), { recursive: true });
  const check = () => spawnSync(process.execPath, [path.join(repo, 'scripts/check-fixture-storage.mjs')], { cwd: root });
  assert.equal(check().status, 0);
  await writeFile(path.join(root, 'holdout/generated/corpus.json'), '{}');
  execFileSync('git', ['add', '-f', 'holdout/generated/corpus.json'], { cwd: root });
  assert.equal(check().status, 1);
});

test('the SSN arrival runner cannot spend a six-family budget, and public controls cannot resolve trust', async t => {
  const w = await sealed(t);
  const manifestFile = path.join(w.holdout, w.record.families[0].manifest);
  await assert.rejects(runHoldout({ manifestFile, scanners: [{ id: 'x', mode: 'm', version: async () => '1.0.0', scan: async () => [] }],
    candidate: w.candidate, verifyCandidate: async () => w.candidate, domain: piiHoldoutDomain }), /manifest-evaluation-mismatch/);
  assert.equal(await runsSpent(w), 0);
  // Public-conformance manifests of this domain are repeatable and say so.
  const publicSeed = 'public-b11-control';
  const control = b11ProtectedPublicControl(publicSeed);
  const publicManifest = path.join(w.holdout, 'public-b11.json');
  await writeFile(publicManifest, serialize({ schemaVersion: 1, id: 'public-b11', revision: 1, purpose: 'public-conformance', review: 'conformance-only',
    corpusHash: hash(serialize(control)), seedHash: hash(publicSeed), dataDirectory: 'generated/public-b11', maxRuns: 1, publicSeed,
    evaluation: { schemaVersion: 1, domain: 'pii', evaluationProfile: 'pii-v1', domainAccountingVersion: 'pii-b11-protected-v1' } }));
  const scanner = fakeScanner({ ...w, input: { cases: control.fixtures } });
  const once = () => runHoldout({ manifestFile: publicManifest, scanners: [scanner], candidate: w.candidate, verifyCandidate: async () => w.candidate,
    domain: b11ProtectedDomain });
  const [a, b] = [await once(), await once()];
  assert.equal(a.independence, 'public-control');
  assert.notEqual(a.runId, b.runId);
  assert.throws(() => buildB11ProtectedTrust({ aggregate: a, decision: 'accepted', custodian: 'c', reviewer: 'r', reviewedAt: '2026-09-28T00:00:00Z' }),
    /public-control-cannot-resolve/);
});

test('the disposition reaches provisional only when public gates, cost and the protected run all pass; never stable', async t => {
  const w = await sealed(t);
  const aggregate = await run(w);
  const trust = buildB11ProtectedTrust({ aggregate, decision: 'accepted', custodian: 'public-control', reviewer: 'public-control-review',
    reviewedAt: '2026-09-28T00:00:00Z' });
  const record = buildB11ProtectedDisposition({ report: w.report, disposition: fakeDisposition(w.report), seal: w.record, runs: [{ aggregate, trust }] });
  const row = family => record.families.find(item => item.family === family);
  assert.equal(row('pii:global:email').status, 'provisional');
  assert.equal(row('pii:global:email').protected.state, 'met');
  assert.equal(row('pii:global:phone').status, 'pending');
  assert.equal(row('pii:global:phone').protected.reason, 'no-sealed-corpus');
  assert.deepEqual(record.distribution, { pending: 5, provisional: 1, stable: 0 });
  assert.equal(record.maximumStatus, 'provisional');
  // A cost gate that is not met keeps the family pending even with a passing protected run.
  const costFailed = fakeReport(w.freeze, 'not-met');
  const pending = buildB11ProtectedDisposition({ report: costFailed, disposition: fakeDisposition(costFailed), seal: w.record, runs: [{ aggregate, trust }] });
  assert.equal(pending.families.find(item => item.family === 'pii:global:email').status, 'pending');
  const costUnresolved = fakeReport(w.freeze, 'met', { id: 'profile-cost', status: 'unresolved' });
  assert.equal(buildB11ProtectedDisposition({ report: costUnresolved, disposition: fakeDisposition(costUnresolved), seal: w.record, runs: [{ aggregate, trust }] })
    .families.find(item => item.family === 'pii:global:email').status, 'pending');
  // No run: sealed and eligible, or a known public rejection, is recorded unspent with its reason.
  const unspent = buildB11ProtectedDisposition({ report: costFailed, disposition: fakeDisposition(costFailed), seal: w.record, runs: [] });
  assert.equal(unspent.families[1].protected.state, 'unspent');
  assert.match(unspent.families[1].protected.reason, /^public-gates-failed:runtime-and-package-cost$/);
  const eligible = buildB11ProtectedDisposition({ report: w.report, disposition: fakeDisposition(w.report), seal: w.record, runs: [] });
  assert.equal(eligible.families.find(item => item.family === 'pii:global:email').protected.reason, 'not-run:eligible');
  // A rejected trust resolution leaves the protected gate unresolved.
  const rejected = buildB11ProtectedTrust({ aggregate, decision: 'rejected', custodian: 'public-control', reviewer: 'public-control-review',
    reviewedAt: '2026-09-28T00:00:00Z' });
  const unresolved = buildB11ProtectedDisposition({ report: w.report, disposition: fakeDisposition(w.report), seal: w.record, runs: [{ aggregate, trust: rejected }] });
  assert.equal(unresolved.families.find(item => item.family === 'pii:global:email').protected.state, 'unresolved');
  assert.equal(unresolved.distribution.provisional, 0);
  // A run bound to another epoch, or a tampered trust record, is refused.
  assert.throws(() => buildB11ProtectedDisposition({ report: w.report, disposition: fakeDisposition(w.report), seal: w.record,
    runs: [{ aggregate, trust: { ...trust, reviewer: 'someone-else' } }] }), /invalid-protected-trust-resolution/);
  const otherEpoch = { ...w.report, families: w.report.families.map(item => ({ ...item, protected: { epochCommitment: d('7') } })) };
  const rebound = { ...otherEpoch, artifactCommitment: b11Commitment({ ...otherEpoch, artifactCommitment: undefined }) };
  assert.throws(() => buildB11ProtectedDisposition({ report: rebound, disposition: fakeDisposition(rebound), seal: w.record, runs: [{ aggregate, trust }] }),
    /protected-run-not-bound/);
});

test('bound to the committed final #428 record (core ec9224d9, the beta.11 candidate): all six pending, unspent, refused on the failed public gates', () => {
  assert.equal(B11P_BETA11_CORE_COMMIT, 'ec9224d9743066fe73d6e61e9843ef52bd853833');
  const dir = new URL(`../evidence/901/428/core-${B11P_BETA11_CORE_COMMIT.slice(0, 12)}/`, import.meta.url);
  const report = JSON.parse(readFileSync(new URL('pii-beta11-report-v2.json', dir), 'utf8'));
  const disposition = JSON.parse(readFileSync(new URL('pii-beta11-disposition-v2.json', dir), 'utf8'));
  assert.equal(report.candidate.sourceCommit, B11P_BETA11_CORE_COMMIT);
  const record = buildB11ProtectedDisposition({ report, disposition, seal: null, runs: [] });
  assert.deepEqual(record.distribution, { pending: 6, provisional: 0, stable: 0 });
  for (const row of record.families) {
    const gates = b11ProtectedPublicGates(report, row.family);
    // profile-cost is bound to the official runs and not-met; the cost gates the #143 ledger can cover follow the ledger rows.
    assert.ok(gates.notMet.includes('profile-cost'));
    assert.deepEqual(gates.unresolved, []);
    assert.equal(row.protected.state, 'unspent');
    assert.equal(row.protected.runs, '0/1');
    assert.equal(row.protected.reason, `public-gates-failed:${gates.notMet.join(',')}`);
    assert.deepEqual(row.publicGates.unresolved, []);
  }
});
