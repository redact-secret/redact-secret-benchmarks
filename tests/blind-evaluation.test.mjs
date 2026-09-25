// Custodian-held blind evaluation (#142): runner lifecycle, aggregate-only
// release and the public-surface exclusion check. Every fixture here is a
// throwaway synthetic set generated in a temp directory by this test; no real
// blind fixture exists in the repository.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { freezeBlind, runBlind } from '../benchmarks/blind/lifecycle.ts';
import { assertNoPrivateDetail, summarize, validateAggregate, wilson, MINIMUM_STRATUM_FIXTURES } from '../benchmarks/blind/aggregate.ts';
import { validateCorpus } from '../benchmarks/blind/storage.ts';
import { blindPublicProblems } from '../scripts/check-blind-public.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
// A prefix no provider issues; bodies are fresh randomness from this test run.
const PREFIX = 'BLINDTEST_';
const value = () => PREFIX + randomBytes(16).toString('hex');

/** A tiny synthetic corpus: 8 positives (1 missed), 6 controls (1 flagged), 1 unstable positive. */
function syntheticCorpus({ epoch = 'test-epoch-1' } = {}) {
  const fixtures = [];
  for (let i = 0; i < 8; i++) {
    const secret = value(), prefix = `TOKEN_${i}=`;
    const hidden = i === 7; // the fake candidate cannot see this one: a leaked span
    const content = `${prefix}${hidden ? secret.replace(PREFIX, 'HIDDENXXX_') : secret}\n`;
    fixtures.push({ id: `pos-${i}`, path: `positives/case-${i}.env`, content, kind: 'must-redact',
      expected: [{ start: prefix.length, end: prefix.length + secret.length }], credentialStatus: 'synthetic', stratum: 'family-a' });
  }
  for (let i = 0; i < 6; i++) {
    const flagged = i === 0; // a benign control the fake candidate flags: a false alarm
    fixtures.push({ id: `ctl-${i}`, path: `controls/case-${i}.md`,
      content: flagged ? `example ${value()} in documentation\n` : `Plain prose control number ${i}.\n`,
      kind: 'must-not-flag', expected: [], credentialStatus: 'synthetic', stratum: i < 3 ? 'family-b' : 'family-c' });
  }
  const unstable = value();
  fixtures.push({ id: 'pos-unstable', path: 'unstable/case.env', content: `X=${unstable}\n`, kind: 'must-redact',
    expected: [{ start: 2, end: 2 + unstable.length }], credentialStatus: 'synthetic' });
  return { schemaVersion: 1, corpusType: 'blind-custodian-fixtures', epoch, nonce: randomBytes(32).toString('hex'),
    custodian: { role: 'isolated-custodian-agent', session: 'test-session' },
    safetyReview: { status: 'passed', reviewedAt: '2026-09-25T00:00:00Z', credentialStatuses: ['synthetic'], statement: 'Test-generated synthetic values only.' },
    fixtures };
}

/** A fake candidate: finds `BLINDTEST_<hex>` by byte offset; alternates its answer on `unstable/`. */
function fakeScanner() {
  let calls = 0;
  return async (root, fixtures) => {
    const findings = [];
    for (const f of fixtures) {
      const text = await readFile(path.join(root, f.path), 'utf8');
      if (f.path.startsWith('unstable/') && calls++ % 2) continue;
      for (const m of text.matchAll(/BLINDTEST_[a-f0-9]{32}/g))
        findings.push({ path: f.path, start: Buffer.byteLength(text.slice(0, m.index)), end: Buffer.byteLength(text.slice(0, m.index + m[0].length)) });
    }
    return findings;
  };
}

const benchmarkIdentity = { sourceCommit: 'b'.repeat(40), dirty: false, lockfileSha256: 'c'.repeat(64) };
function context(overrides = {}) {
  return {
    benchmark: async () => benchmarkIdentity,
    environment: () => ({ node: 'v22.12.0', os: 'linux', arch: 'x64' }),
    load: async () => ({ packageName: '@redact-secret/core', declaredVersion: '0.1.0-beta.9', scan: fakeScanner(), dispose: async () => {} }),
    configuration: { adapterVersion: 2, detectors: 'default' }, replays: 2, ...overrides,
  };
}

async function setup(t, corpus = syntheticCorpus()) {
  const base = await mkdtemp(path.join(tmpdir(), 'blind-evaluation-test-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const fixtures = path.join(base, 'custodian-private');
  await mkdir(fixtures, { mode: 0o700 });
  await writeFile(path.join(fixtures, 'fixtures.json'), JSON.stringify(corpus, null, 2), { mode: 0o600 });
  const candidate = path.join(base, 'candidate');
  await mkdir(path.join(candidate, 'artifacts'), { recursive: true });
  const artifacts = [];
  for (const role of ['package', 'node', 'wasm']) {
    const bytes = randomBytes(64);
    await writeFile(path.join(candidate, 'artifacts', `${role}-fake.tgz`), bytes);
    artifacts.push({ role, sha256: sha(bytes) });
  }
  await writeFile(path.join(candidate, 'candidate-evidence-v1.json'), JSON.stringify({ candidate: { sourceCommit: 'a'.repeat(40), sourceState: 'clean', artifacts } }));
  return { base, fixtures, candidate, corpus };
}
const rejects = (promise, code) => assert.rejects(promise, error => { assert.equal(error.code, code); return true; });

test('freeze then run releases only the whitelisted aggregate, with correct counts', async t => {
  const s = await setup(t);
  const output = path.join(s.base, 'released-aggregate.json');
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const { report } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, output, context: context() });
  assert.equal(report.status, 'complete');
  assert.equal(report.evidenceClass, 'custodian-blind');
  assert.equal(report.independence.organisationalIndependence, false);
  assert.match(report.independence.statement, /procedural separation, not organisational independence/);
  assert.deepEqual(report.measurability, { fixtures: 15, measurable: 14, share: 0.9333, withheld: 1, withheldReasons: { 'unstable-across-replays': 1, 'scan-error': 0 } });
  assert.deepEqual(report.leakage.outcomes, { EXACT: 7, COVERED: 0, OVERBROAD: 0, PARTIAL: 0, MISS: 1 });
  assert.equal(report.leakage.leakedSpans.count, 1);
  assert.equal(report.falseAlarms.flaggedControls.count, 1);
  assert.equal(report.falseAlarms.controls, 6);
  assert.equal(report.instability.count, 1);
  assert.ok(report.leakage.leakedSpans.interval[0] < 0.125 && report.leakage.leakedSpans.interval[1] > 0.125);
  // family-b and family-c have 3 controls each: suppressed together is 6 >= 5, so family-a (8) is released alone.
  assert.equal(report.strata.status, 'released');
  assert.deepEqual(report.strata.rows.map(r => r.label), ['family-a']);
  // No overall ranking score anywhere.
  const keys = value => value && typeof value === 'object' ? Object.entries(value).flatMap(([k, v]) => [k, ...keys(v)]) : [];
  assert.deepEqual(keys(report).filter(k => /score|rank|f1|overall|precision|recall/i.test(k)), []);
  // Nothing private in the release.
  const released = await readFile(output, 'utf8');
  for (const f of s.corpus.fixtures) {
    assert.ok(!released.includes(f.id) || f.id.length < 6, 'fixture id released');
    assert.ok(!released.includes(f.path), 'fixture path released');
    for (const m of f.content.matchAll(/(BLINDTEST|HIDDENXXX)_[a-f0-9]{32}/g)) assert.ok(!released.includes(m[0]), 'fixture value released');
  }
  assert.ok(!released.includes('"start"') && !released.includes('"expected"'), 'ranges released');
  assert.deepEqual(validateAggregate(JSON.parse(released)), report);
  // The freeze is consumed, the run is on the ledger, the private copy exists, the scratch is gone.
  const entries = await readdir(s.fixtures);
  assert.ok(!entries.includes('freeze.json'));
  assert.ok(!entries.some(e => e.startsWith('scratch-') || e === '.lock'));
  const ledger = JSON.parse(await readFile(path.join(s.fixtures, 'ledger.json'), 'utf8'));
  assert.deepEqual(ledger.runs.map(r => [r.runId, r.status]), [[report.runId, 'complete']]);
  assert.ok(existsSync(path.join(s.fixtures, 'runs', report.runId, 'aggregate.json')));
  assert.ok(existsSync(path.join(s.fixtures, 'runs', report.runId, 'freeze.json')));
});

test('a run requires a prior freeze, and one candidate identity gets one run per epoch', async t => {
  const s = await setup(t);
  await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'missing-freeze');
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'freeze-already-pending');
  await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'missing-freeze');
  // A post-result change must arrive as a new candidate identity with a new freeze.
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'candidate-already-evaluated-on-epoch');
});

test('a failed candidate load still spends the attempt and yields an incomplete, withheld aggregate', async t => {
  const s = await setup(t);
  const broken = context({ load: async () => { throw new Error('candidate-installation-failed'); } });
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: broken });
  const { report } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: broken });
  assert.equal(report.status, 'incomplete');
  assert.equal(report.measurability.withheldReasons['scan-error'], 15);
  assert.deepEqual(report.failures, [{ phase: 'installation', code: 'candidate-installation-failed' }]);
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: broken }), 'candidate-already-evaluated-on-epoch');
});

test('changes after the freeze invalidate the run', async t => {
  await t.test('corpus', async t => {
    const s = await setup(t);
    await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
    await writeFile(path.join(s.fixtures, 'fixtures.json'), JSON.stringify(syntheticCorpus(), null, 2), { mode: 0o600 });
    await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'corpus-changed-after-freeze');
  });
  await t.test('candidate artifact', async t => {
    const s = await setup(t);
    await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
    await writeFile(path.join(s.candidate, 'artifacts', 'node-fake.tgz'), randomBytes(64));
    await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'candidate-artifact-hash-mismatch');
  });
  await t.test('environment, benchmark and configuration', async t => {
    const s = await setup(t);
    await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
    await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context({ environment: () => ({ node: 'v24.0.0', os: 'linux', arch: 'x64' }) }) }), 'environment-changed-after-freeze');
    await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context({ benchmark: async () => ({ ...benchmarkIdentity, sourceCommit: 'd'.repeat(40) }) }) }), 'benchmark-changed-after-freeze');
    await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context({ replays: 3 }) }), 'configuration-changed-after-freeze');
  });
  await t.test('a dirty benchmark checkout cannot be frozen', async t => {
    const s = await setup(t);
    await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context({ benchmark: async () => ({ ...benchmarkIdentity, dirty: true }) }) }), 'benchmark-checkout-dirty');
  });
});

test('a changed corpus needs a new epoch, and a new epoch cannot reuse an old corpus', async t => {
  const s = await setup(t);
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const original = await readFile(path.join(s.fixtures, 'fixtures.json'), 'utf8');
  const replaced = { ...JSON.parse(original), fixtures: syntheticCorpus().fixtures };
  await writeFile(path.join(s.fixtures, 'fixtures.json'), JSON.stringify(replaced), { mode: 0o600 });
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'corpus-changed-without-new-epoch');
  await writeFile(path.join(s.fixtures, 'fixtures.json'), JSON.stringify({ ...JSON.parse(original), epoch: 'test-epoch-2' }, null, 2), { mode: 0o600 });
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'corpus-reused-under-new-epoch');
  await writeFile(path.join(s.fixtures, 'fixtures.json'), JSON.stringify({ ...replaced, epoch: 'test-epoch-2' }), { mode: 0o600 });
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const { report } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  assert.equal(report.corpus.epoch, 'test-epoch-2');
});

test('the private root must be 0700, a real directory, and outside every Git repository', async t => {
  const s = await setup(t);
  await chmod(s.fixtures, 0o755);
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'fixtures-directory-permissions-must-be-0700');
  await chmod(s.fixtures, 0o700);
  await chmod(path.join(s.fixtures, 'fixtures.json'), 0o644);
  await rejects(freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() }), 'private-file-permissions-must-be-0600');
  await chmod(path.join(s.fixtures, 'fixtures.json'), 0o600);
  const link = path.join(s.base, 'link');
  await symlink(s.fixtures, link);
  await rejects(freezeBlind({ fixtures: link, candidate: s.candidate, context: context() }), 'fixtures-directory-not-a-directory');
  await rejects(freezeBlind({ fixtures: 'relative/dir', candidate: s.candidate, context: context() }), 'fixtures-directory-must-be-absolute');
  // A directory anywhere below a .git entry is inside a repository.
  const repo = path.join(s.base, 'some-repo');
  await mkdir(path.join(repo, '.git'), { recursive: true });
  await mkdir(path.join(repo, 'private'), { mode: 0o700 });
  await rejects(freezeBlind({ fixtures: path.join(repo, 'private'), candidate: s.candidate, context: context() }), 'fixtures-directory-inside-git-repository');
});

test('the private root cannot sit inside the benchmark repository, and releases land outside it', async t => {
  const s = await setup(t);
  const inside = path.join(repositoryRoot, 'results-output', `blind-test-${randomBytes(4).toString('hex')}`);
  await mkdir(inside, { recursive: true, mode: 0o700 });
  await chmod(inside, 0o700);
  t.after(() => rm(inside, { recursive: true, force: true }));
  await rejects(freezeBlind({ fixtures: inside, candidate: s.candidate, context: context() }), 'fixtures-directory-inside-benchmark-repository');
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  await rejects(runBlind({ fixtures: s.fixtures, candidate: s.candidate, output: path.join(s.fixtures, 'out.json'), context: context() }), 'output-inside-private-root');
  const releases = path.join(s.base, 'results-output', 'blind');
  const { report, release } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, outputDirectory: releases, context: context() });
  assert.equal(release, path.join(releases, `blind-aggregate-${report.runId}.json`));
  assert.deepEqual(JSON.parse(await readFile(release, 'utf8')), report);
});

test('the corpus contract rejects unsafe credentials, bad ranges and a missing safety review', () => {
  const base = syntheticCorpus();
  const mutate = f => { const c = structuredClone(base); f(c); return c; };
  const code = c => { try { validateCorpus(c); return 'valid'; } catch (e) { return e.code; } };
  assert.equal(code(base), 'valid');
  assert.equal(code(mutate(c => { c.fixtures[0].credentialStatus = 'live'; })), 'credential-not-synthetic-or-revoked');
  assert.equal(code(mutate(c => { c.fixtures[0].credentialStatus = 'revoked'; })), 'safety-review-does-not-cover-credential-status');
  assert.equal(code(mutate(c => { c.fixtures[0].expected[0].end = 10_000; })), 'invalid-expected-ranges');
  assert.equal(code(mutate(c => { c.fixtures[8].expected = [{ start: 0, end: 1 }]; })), 'invalid-fixture-kind');
  assert.equal(code(mutate(c => { c.fixtures[0].path = '../escape.env'; })), 'invalid-fixture-identity');
  assert.equal(code(mutate(c => { c.fixtures[1].id = c.fixtures[0].id; })), 'duplicate-fixture-identity');
  assert.equal(code(mutate(c => { c.safetyReview.status = 'pending'; })), 'safety-review-not-passed');
  assert.equal(code(mutate(c => { c.nonce = 'short'; })), 'invalid-nonce');
  assert.equal(code(mutate(c => { c.seed = 'x'; })), 'invalid-corpus-shape');
});

test('wilson intervals and small-stratum suppression', () => {
  assert.deepEqual(wilson(0, 10), { count: 0, of: 10, value: 0, interval: [0, 0.2775] });
  assert.deepEqual(wilson(5, 10), { count: 5, of: 10, value: 0.5, interval: [0.2366, 0.7634] });
  assert.deepEqual(wilson(0, 0), { count: 0, of: 0, value: null, interval: null });
  const control = (stratum, i) => ({ fixture: { id: `${stratum}-${i}`, path: `${stratum}/${i}`, content: 'x', kind: 'must-not-flag', expected: [], credentialStatus: 'synthetic', stratum }, status: 'measured', findings: [] });
  const make = sizes => Object.entries(sizes).flatMap(([s, n]) => Array.from({ length: n }, (_, i) => control(s, i)));
  // One small stratum of 2: releasing the other would let it be recovered by subtraction.
  assert.equal(summarize(make({ big: 6, small: 2 })).strata.status, 'suppressed');
  assert.deepEqual(summarize(make({ big: 6, small: 2 })).strata.rows, []);
  assert.deepEqual(summarize(make({ big: 6, other: MINIMUM_STRATUM_FIXTURES })).strata.rows.map(r => r.label), ['big', 'other']);
});

test('the aggregate whitelist rejects extra fields, overall scores and private detail', async t => {
  const s = await setup(t);
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const { report } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const code = r => { try { validateAggregate(r); return 'valid'; } catch (e) { return e.code.split(':')[0]; } };
  assert.equal(code(report), 'valid');
  assert.equal(code({ ...report, overallScore: 0.9 }), 'aggregate-schema-violation');
  assert.equal(code({ ...report, leakage: { ...report.leakage, ranges: [[0, 4]] } }), 'aggregate-schema-violation');
  assert.equal(code({ ...report, independence: { ...report.independence, organisationalIndependence: true } }), 'aggregate-schema-violation');
  assert.equal(code({ ...report, measurability: { ...report.measurability, measurable: 99 } }), 'aggregate-inconsistent');
  const leaked = s.corpus.fixtures[0].content.trim().split('=')[1];
  assert.throws(() => assertNoPrivateDetail({ ...report, candidate: { ...report.candidate, declaredVersion: leaked } }, s.corpus.fixtures), e => e.code === 'aggregate-contains-fixture-content');
  assert.throws(() => assertNoPrivateDetail({ ...report, corpus: { ...report.corpus, epoch: 'pos-unstable' } }, s.corpus.fixtures), e => e.code === 'aggregate-contains-fixture-identity');
});

test('public-surface check: private blind material is refused, a valid aggregate passes', async t => {
  const s = await setup(t);
  await freezeBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const { report } = await runBlind({ fixtures: s.fixtures, candidate: s.candidate, context: context() });
  const root = path.join(s.base, 'site');
  await mkdir(path.join(root, 'public'), { recursive: true });
  await mkdir(path.join(root, 'docs/reports'), { recursive: true });
  const write = (file, text) => writeFile(path.join(root, file), text);
  await write('docs/reports/blind.json', JSON.stringify(report, null, 2));
  await write('public/blind.json', JSON.stringify(report));
  assert.deepEqual(blindPublicProblems(root, { files: ['docs/reports/blind.json'], checkIgnore: false }), []);
  await write('public/fixtures.json', JSON.stringify(s.corpus, null, 2));
  await write('public/freeze.json', JSON.stringify({ freezeType: 'blind-freeze' }));
  await write('docs/reports/scored.json', JSON.stringify({ ...report, overallScore: 1 }));
  await write('docs/reports/embedded.md', `Result:\n\n${JSON.stringify(report)}\n`);
  const problems = blindPublicProblems(root, { files: ['docs/reports/blind.json', 'docs/reports/scored.json', 'docs/reports/embedded.md'], checkIgnore: false });
  assert.equal(problems.length, 4, problems.join('\n'));
  assert.ok(problems.some(p => p.startsWith('public/fixtures.json:')));
  assert.ok(problems.some(p => p.startsWith('public/freeze.json:')));
  assert.ok(problems.some(p => p.startsWith('docs/reports/scored.json:') && p.includes('whitelist')));
  assert.ok(problems.some(p => p.startsWith('docs/reports/embedded.md:') && p.includes('standalone')));
});

test('this repository carries no blind corpus, freeze, ledger or invalid aggregate', () => {
  assert.deepEqual(blindPublicProblems(repositoryRoot), []);
});
