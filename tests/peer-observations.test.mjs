import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  digest, executionIdentity, inputIdentity, makeSnapshot, readSnapshot, snapshotObservation,
  observationSuiteIdentity, validateSnapshot, writeSnapshot,
} from '../benchmarks/lib/peer-observations.ts';
import { createMethods } from '../benchmarks/methods/index.ts';
import { createOperators } from '../benchmarks/operators/index.ts';
import { runEvaluation } from '../benchmarks/engine/runner.ts';
import { loadCases } from '../benchmarks/engine/cases.ts';

const fixtures = [{ id: 'case', path: 'provider/case.env', content: 'TOKEN=benchmark-never-issued-secret' }];
const input = () => inputIdentity({ surface: 'comparison/accuracy', suite: { replays: 2 }, corpus: { revision: 1 }, fixtures,
  semanticIndex: { schemaVersion: 1, algorithm: 'sha256', digest: 'a'.repeat(64), fixtureCount: 1 } });
const scanner = { id: 'gitleaks', mode: 'test', configuration: { adapterVersion: 2, arguments: ['dir'] },
  version: async () => '8.30.1', scan: async () => [] };
const peer = () => executionIdentity(scanner, '8.30.1', 'b'.repeat(64));
const snapshot = () => makeSnapshot({ observedAt: '2026-09-26T12:00:00.000Z',
  sourceRun: { runId: 'refresh-1', benchmarkRevision: 'c'.repeat(40) }, input: input(), peer: peer(), replayCount: 2,
  findings: [{ path: fixtures[0].path, start: 6, end: 35 }] });

test('snapshot stores only normalized fixture-relative ranges and carries a canonical digest', () => {
  const value = snapshot();
  assert.deepEqual(value.findings, [{ path: fixtures[0].path, start: 6, end: 35 }]);
  const { digest: _ignored, ...payload } = value;
  assert.equal(value.digest, digest(payload));
  assert.doesNotMatch(JSON.stringify(value), /benchmark-never-issued-secret/);
  assert.equal(snapshotObservation(value).observation.source, 'snapshot');
});

test('snapshot cache hit is readable and every identity class fails closed', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'peer-observation-test-'));
  const file = path.join(directory, 'gitleaks.json');
  try {
    await writeSnapshot(file, snapshot());
    await assert.doesNotReject(readSnapshot(file, { input: input(), peer: peer() }));
    const invalidations = {
      corpus: { input: inputIdentity({ surface: 'comparison/accuracy', suite: { replays: 2 }, corpus: { revision: 2 }, fixtures,
        semanticIndex: input().semanticIndex }), peer: peer() },
      bytes: { input: inputIdentity({ surface: 'comparison/accuracy', suite: { replays: 2 }, corpus: { revision: 1 }, fixtures: [{ ...fixtures[0], content: `${fixtures[0].content}!` }],
        semanticIndex: input().semanticIndex }), peer: peer() },
      suite: { input: inputIdentity({ surface: 'comparison/accuracy', suite: { replays: 3 }, corpus: { revision: 1 }, fixtures,
        semanticIndex: input().semanticIndex }), peer: peer() },
      index: { input: { ...input(), semanticIndex: { schemaVersion: 1, algorithm: 'sha256', digest: 'd'.repeat(64), fixtureCount: 1 } }, peer: peer() },
      version: { input: input(), peer: executionIdentity(scanner, '8.30.2', 'b'.repeat(64)) },
      artifact: { input: input(), peer: executionIdentity(scanner, '8.30.1', 'e'.repeat(64)) },
      options: { input: input(), peer: executionIdentity({ ...scanner, configuration: { adapterVersion: 3 } }, '8.30.1', 'b'.repeat(64)) },
      adapter: { input: input(), peer: executionIdentity(scanner, '8.30.1', 'b'.repeat(64), 'f'.repeat(64)) },
    };
    for (const [name, expected] of Object.entries(invalidations)) await t.test(name, async () => {
      await assert.rejects(readSnapshot(file, expected), /identity mismatch/);
    });
    await writeFile(file, '{');
    await assert.rejects(readSnapshot(file, { input: input(), peer: peer() }), /Missing or corrupt/);
    await assert.rejects(readSnapshot(path.join(directory, 'missing.json'), { input: input(), peer: peer() }), /Missing or corrupt/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('corrupt, incomplete and secret-bearing snapshot shapes are rejected', () => {
  const good = snapshot();
  assert.throws(() => validateSnapshot({ ...good, digest: '0'.repeat(64) }), /corrupt/);
  const unstable = { ...good, replay: { ...good.replay, agreed: false } };
  unstable.digest = digest((({ digest: _, ...payload }) => payload)(unstable));
  assert.throws(() => validateSnapshot(unstable), /incomplete/);
  const raw = { ...good, findings: [{ ...good.findings[0], match: 'secret' }] };
  raw.digest = digest((({ digest: _, ...payload }) => payload)(raw));
  assert.throws(() => validateSnapshot(raw), /non-normalized/);
  const future = { ...good, schemaVersion: 2 };
  future.digest = digest((({ digest: _, ...payload }) => payload)(future));
  assert.throws(() => validateSnapshot(future), /corrupt/);
});

test('scoring-only accounting changes preserve observation identity while replay changes invalidate it', () => {
  const suite = { schemaVersion: 1, accounting: { replays: 2, minDenominator: 5, intervalZ: 1.96 } };
  const changedScoring = { schemaVersion: 1, accounting: { replays: 2, minDenominator: 50, intervalZ: 2.58 } };
  const changedExecution = { schemaVersion: 1, accounting: { replays: 3, minDenominator: 5, intervalZ: 1.96 } };
  assert.deepEqual(observationSuiteIdentity(suite), observationSuiteIdentity(changedScoring));
  assert.notDeepEqual(observationSuiteIdentity(suite), observationSuiteIdentity(changedExecution));
});

test('reused observations are rescored without executing a peer and remain visibly mixed-source', async () => {
  const methods = createMethods(), operators = createOperators();
  const cases = [(await loadCases(operators)).find(c => c.method === 'benign')];
  let scans = 0;
  const product = { id: 'redact-secret', mode: 'fresh', version: async () => '1.0.0', scan: async () => { scans++; return []; } };
  const reused = { id: 'peer', version: '2.0.0', mode: 'snapshot', configurationHash: digest({}), status: 'complete', findings: [], durationMs: 0,
    replays: { count: 2, agreed: true }, observation: { source: 'snapshot', observedAt: '2026-09-26T12:00:00.000Z', sourceRunId: 'refresh',
      snapshotDigest: 'a'.repeat(64), inputDigest: 'b'.repeat(64) } };
  const suite = JSON.parse(await readFile(new URL('../qualification/suite-v1.json', import.meta.url), 'utf8'));
  const report = await runEvaluation({ cases, methods, operators, scanners: [product], reusedObservations: [reused], accounting: suite.accounting });
  const rescored = await runEvaluation({ cases, methods, operators, scanners: [product], reusedObservations: [reused],
    accounting: { ...suite.accounting, minDenominator: suite.accounting.minDenominator + 100 } });
  assert.equal(scans, report.accounting.replays + rescored.accounting.replays, 'only the product executes');
  assert.deepEqual(report.scanners.map(s => [s.id, s.observation.source]), [['redact-secret', 'fresh'], ['peer', 'snapshot']]);
  assert.equal(report.scanners[1].observation.sourceRunId, 'refresh');
  assert.equal(rescored.accounting.minDenominator, suite.accounting.minDenominator + 100);
  assert.equal(rescored.scanners[1].observation.snapshotDigest, reused.observation.snapshotDigest);
});

test('ordinary validation and publication consume snapshots before any peer provisioning', async () => {
  const validate = await readFile(new URL('../.github/workflows/validate.yml', import.meta.url), 'utf8');
  const comparison = validate.slice(validate.indexOf('  scanner-comparison:'));
  assert.doesNotMatch(comparison, /peers:provision|test:integration/);
  assert.match(comparison, /npm run eval:classify/);
  assert.match(comparison, /npm run queue:check/);
  assert.match(comparison, /npm run bench -- --strict/);

  const publish = await readFile(new URL('../.github/workflows/publish-site.yml', import.meta.url), 'utf8');
  const measure = publish.indexOf('- name: Measure the corpus');
  const provision = publish.indexOf('- name: Provision checksum-pinned peers for qualification only');
  assert.ok(measure >= 0 && provision > measure, 'comparison runs without provisioned peer binaries');
  const measurement = publish.slice(measure, provision);
  assert.match(measurement, /npm run bench -- --strict/);
  assert.doesNotMatch(measurement, /peers:provision|--live-peers|--refresh-peer-snapshots/);
});

test('explicit refresh and live-reproduction workflow pins TruffleHog and exposes a reviewable diff', async () => {
  const workflow = await readFile(new URL('../.github/workflows/refresh-peer-snapshots.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /trufflehog --version[\s\S]*3\.97\.4/);
  assert.match(workflow, /npm run peers:snapshots:refresh/);
  assert.match(workflow, /npm run peers:snapshots:live/);
  assert.match(workflow, /git diff --binary -- peer-observations/);
  assert.match(workflow, /peer executions: 150 comparison \+ 4 suite-development/);
});
