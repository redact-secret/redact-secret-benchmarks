import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hash } from '../benchmarks/evaluation/model/model.ts';
import { historicalBytes, historicalReplayOptions } from './helpers/historical-evidence-archive.mjs';

const execFile = promisify(execFileCallback);
const root = path.resolve(import.meta.dirname, '..');
const FROZEN = 'docs/specs/qualification/engine-v1.json';
const SNAPSHOT = 'benchmarks/inputs/credential/qualification-suite.json';
const run = (...args) => execFile(process.execPath, ['--import', 'tsx', 'benchmarks/validate-evidence.ts', ...args], { cwd: root, timeout: 60_000 })
  .then(({ stdout }) => ({ code: 0, stdout }), error => ({ code: error.code, stdout: error.stdout, stderr: error.stderr }));

const candidate = { sourceHash: 'a'.repeat(64), lockHash: 'b'.repeat(64), candidateArtifactHash: 'c'.repeat(64) };
function syntheticReport(suite) {
  const runId = randomUUID(), time = new Date().toISOString();
  const scanners = Object.entries(suite.scanners).map(([id, version]) => ({ id, version, configuration: {}, configurationHash: hash({}),
    status: 'complete', assertions: { pass: 2, fail: 0, 'review-required': 0 }, byStratum: { 'must-redact:T1': { pass: 2, fail: 0, 'review-required': 0 } } }));
  return {
    schemaVersion: 2, reportType: 'qualification', engineVersion: '1.1.0', accountingVersion: '1.1', suiteId: 'engine-v1', suiteHash: hash(suite), runId,
    startedAt: time, finishedAt: time, scope: 'engine-conformance', status: 'execution-qualified', supportClaims: false,
    provenance: { ...candidate, revision: 'test', dirty: false, runtime: { node: 'test', platform: 'test', arch: 'test' } },
    development: { seed: 'engine-v1', casesHash: 'd'.repeat(64), corpusHashes: { control: 'e'.repeat(64) }, failures: 0, reviewEntries: 0, byDetector: {} },
    methods: suite.methods.map(method => ({ method, cases: 2, variants: 2, generationErrors: 0,
      scanners: scanners.map(({ id, status, assertions }) => ({ id, status, assertions: method === 'differential' ? { pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 } : method === 'holdout' ? structuredClone(assertions) : { ...assertions, 'not-measured': 0 } })) })),
    accounting: { reasons: [], unresolvedGroups: [], review: { open: 0, resolved: 0, notAssertable: 0, unknown: 0, oldestOpenRun: null } },
    holdout: { schemaVersion: 1, reportType: 'holdout', runId, planHash: 'f'.repeat(64), startedAt: time, finishedAt: time,
      methodology: 'frozen-candidate-canonical-cases-aggregate-only', independence: 'public-control', status: 'complete',
      corpus: { id: 'public-controls', revision: 1, purpose: 'public-conformance', corpusHash: 'd'.repeat(64), seedHash: 'e'.repeat(64), lifecycle: 'sealed-at-execution' },
      candidate, caseCount: 2, variantCount: 2, generationErrors: 0, scanners },
    milestone: { checkedAt: time, repository: 'redact-secret/redact-secret-benchmarks', number: 1, status: 'open', openPrerequisites: [8], outOfScope: [] },
  };
}

async function syntheticFile(suite, check) {
  const directory = await mkdtemp(path.join(tmpdir(), 'validate-evidence-'));
  try {
    const file = path.join(directory, 'synthetic-qualification.json');
    await writeFile(file, JSON.stringify(syntheticReport(suite)));
    return await check(file, directory);
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test('fresh synthetic qualification validates against the independently bound canonical suite', async () => {
  const suite = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
  await syntheticFile(suite, async file => {
    const result = await run(file, `--suite=${SNAPSHOT}`);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /checks passed/);
  });
});

test('without --suite fresh live evidence succeeds and a different frozen suite is rejected', async () => {
  const live = JSON.parse(await readFile(path.join(root, 'qualification/suite-v1.json'), 'utf8'));
  const snapshot = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
  assert.notDeepEqual(live, snapshot, 'the live suite has moved past the Beta.11 snapshot');
  await syntheticFile(live, async file => assert.equal((await run(file)).code, 0));
  await syntheticFile(snapshot, async file => {
    const result = await run(file);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Invalid or incomplete evidence/);
  });
});

test('a stale suite passed via --suite is rejected for a report with another suiteHash', async () => {
  const snapshot = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
  await syntheticFile(snapshot, async (file, directory) => {
    const stale = path.join(directory, 'stale-suite.json');
    await writeFile(stale, JSON.stringify({ ...snapshot, scanners: { ...snapshot.scanners, 'redact-secret': '0.0.0-stale' } }));
    assert.equal((await run(file, `--suite=${stale}`)).code, 1);
  });
});

test('argument handling stays strict: the report path plus at most one --suite flag', async () => {
  assert.equal((await run()).code, 1);
  assert.equal((await run(FROZEN, SNAPSHOT)).code, 1);
  assert.equal((await run(FROZEN, '--suite=')).code, 1);
  assert.equal((await run(FROZEN, '--other=x')).code, 1);
  assert.equal((await run(FROZEN, `--suite=${SNAPSHOT}`, `--suite=${SNAPSHOT}`)).code, 1);
});


test('the original frozen report retains canonical-suite success, live-suite rejection and stale-suite rejection', historicalReplayOptions, async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'validate-original-evidence-'));
  try {
    const report = path.join(directory, 'original-qualification.json');
    await writeFile(report, historicalBytes('evidence/449/credential-qualification-engine-v1.json'));
    const accepted = await run(report, `--suite=${SNAPSHOT}`);
    assert.equal(accepted.code, 0);
    assert.match(accepted.stdout, /checks passed/);
    assert.equal((await run(report)).code, 1);
    const snapshot = JSON.parse(await readFile(path.join(root, SNAPSHOT), 'utf8'));
    const stale = path.join(directory, 'stale-suite.json');
    await writeFile(stale, JSON.stringify({ ...snapshot, scanners: { ...snapshot.scanners, 'redact-secret': '0.0.0-stale' } }));
    assert.equal((await run(report, `--suite=${stale}`)).code, 1);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
