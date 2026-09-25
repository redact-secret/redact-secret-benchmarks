import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  allowedChange, candidateFromSnapshot, ceilToFivePercent, deriveTriggers, evaluateBudgets, exitCodeFor, historyProblems,
  ledgerProblems, metricsFromAdapterOverhead, metricsFromOperational, RULES, sha256OfText,
} from '../benchmarks/lib/regression-budgets.ts';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const COMMIT_A = 'a'.repeat(40);
const COMMIT_B = 'b'.repeat(40);

const LATENCY_PROFILE = { os: 'linux', cpu: 'x86_64', rustBuildProfile: 'release', workloadProfilesHash: 'h', status: 'complete' };

function snapshot(id, sourceCommit, overrides = {}) {
  const metrics = {
    'latency/node/p/processing-p95': { id: 'latency/node/p/processing-p95', dimension: 'latency', profile: 'linux-x64-release', unit: 'milliseconds', value: 100, samples: 5, corroboration: { statistic: 'processing median', value: 90 } },
    'memory/node/p/nodeRss': { id: 'memory/node/p/nodeRss', dimension: 'memory', profile: 'linux-x64-release', unit: 'bytes', value: 100 * 1024 * 1024, samples: 5 },
    'size/wasm/full/gzip': { id: 'size/wasm/full/gzip', dimension: 'size', profile: 'release-artifacts', unit: 'bytes', value: 100_000, samples: 1, role: 'default' },
    'size/wasm/common/gzip': { id: 'size/wasm/common/gzip', dimension: 'size', profile: 'release-artifacts', unit: 'bytes', value: 80_000, samples: 1, role: 'optional' },
    'adapter/pino/log-flat/traversal': { id: 'adapter/pino/log-flat/traversal', dimension: 'adapter-overhead', profile: 'darwin-arm64|M|node-22', unit: 'microseconds-per-event', value: 2, samples: 75 },
    'adapter/pino/log-flat/scanner-calls': { id: 'adapter/pino/log-flat/scanner-calls', dimension: 'adapter-overhead', profile: 'darwin-arm64|M|node-22', unit: 'calls-per-event', value: 9, samples: 5 },
    ...overrides,
  };
  return {
    schemaVersion: '1', id, productVersion: id, sourceCommit, takenAt: '2026-09-25', sources: {},
    profiles: { latency: LATENCY_PROFILE, 'adapter-overhead': { javascript: 'darwin-arm64|M|node-22', 'javascript:workloadDigest': 'd', 'javascript:quick': 'false' } },
    metrics,
  };
}

const NOISE = {
  ciDispersion: { processing: { 'node/p': 0.05 }, initialization: { 'node/p': 0.2 } },
  ciMemorySpread: { 'node/p/nodeRss': 0.03 },
  rerunMedianSpread: { processing: 0.04, initialization: 0.16 },
  rerunMemorySpread: 0.02,
  adapterTraversal: { 'pino/log-flat': { spread: 0.1, standardDeviation: 0.05 } },
};

function withValues(base, values) {
  const metrics = structuredClone(base.metrics);
  for (const [id, value] of Object.entries(values)) {
    if (typeof value === 'object') Object.assign(metrics[id], value);
    else metrics[id].value = value;
  }
  return metrics;
}

function candidate(metrics, sourceCommit = COMMIT_B) {
  return {
    sourceCommit, sources: ['test'], metrics,
    profiles: { latency: LATENCY_PROFILE, memory: LATENCY_PROFILE, size: {}, 'adapter-overhead': { javascript: 'darwin-arm64|M|node-22', 'javascript:workloadDigest': 'd', 'javascript:quick': 'false' } },
  };
}

const baseline = snapshot('base', COMMIT_A);
const triggers = deriveTriggers(baseline, NOISE);
const budgets = { budgetsId: 'test', triggers };
const byId = id => triggers.find(t => t.id === id);
const verdictOf = (report, id) => report.triggers.find(t => t.id === id).verdict;

test('ceilToFivePercent rounds up to the next five points and keeps exact multiples', () => {
  assert.equal(ceilToFivePercent(0.15), 0.15);
  assert.equal(ceilToFivePercent(0.151), 0.2);
  assert.equal(ceilToFivePercent(0.0758), 0.1);
  assert.equal(ceilToFivePercent(2.87), 2.9);
});

test('every trigger states profile, metric, direction, threshold and minimum samples', () => {
  for (const trigger of triggers) {
    for (const field of ['profile', 'metric', 'direction', 'threshold', 'minimumSamples']) assert.ok(trigger[field] !== undefined, `${trigger.id}.${field}`);
  }
});

test('latency: p95 threshold is the largest of the 15% floor, the row dispersion and twice the rerun spread; the median corroborates at 10%', () => {
  const trigger = byId('latency/node/p/processing-p95');
  assert.deepEqual(trigger.threshold, { relative: 0.15, absoluteFloor: 1 });
  assert.deepEqual(trigger.corroboration.threshold, { relative: 0.1, absoluteFloor: 1 });
  const wide = deriveTriggers(baseline, { ...NOISE, ciDispersion: { ...NOISE.ciDispersion, processing: { 'node/p': 0.49 } } });
  assert.equal(wide.find(t => t.id === trigger.id).threshold.relative, 0.5);
});

test('memory, size and adapter triggers follow their rules', () => {
  assert.deepEqual(byId('memory/node/p/nodeRss').threshold, { relative: 0.1, absoluteFloor: 1024 * 1024 });
  assert.deepEqual(byId('size/wasm/full/gzip').threshold, { relative: 0.05, absoluteFloor: 4096 });
  assert.equal(byId('size/wasm/full/gzip').role, 'default');
  assert.equal(byId('size/wasm/common/gzip').role, 'optional');
  assert.deepEqual(byId('adapter/pino/log-flat/traversal').threshold, { relative: 0.2, absoluteFloor: 0.5 });
  assert.equal(byId('adapter/pino/log-flat/traversal').minimumSamples, 15);
  assert.deepEqual(byId('adapter/pino/log-flat/scanner-calls').threshold, { relative: 0, absoluteFloor: 0 });
  assert.equal(allowedChange(100, { relative: 0.05, absoluteFloor: 16 }), 16);
});

test('a change inside every budget is accepted, and every dimension is counted separately', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, { 'latency/node/p/processing-p95': 110, 'size/wasm/full/gzip': 104_000 })), []);
  assert.equal(report.status, 'accepted');
  assert.equal(exitCodeFor(report), 0);
  assert.equal(report.dimensions.latency['within-budget'], 1);
  assert.equal(report.dimensions.size['within-budget'], 2);
  assert.equal(report.dimensions['adapter-overhead']['within-budget'], 2);
  assert.equal(report.dimensions.initialization['within-budget'], 0);
  assert.ok(!('score' in report));
});

test('a corroborated p95 breach is a regression and exits 1', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, {
    'latency/node/p/processing-p95': { value: 130, corroboration: { statistic: 'processing median', value: 110 } },
  })), []);
  assert.equal(verdictOf(report, 'latency/node/p/processing-p95'), 'regression');
  assert.equal(report.status, 'regression');
  assert.equal(exitCodeFor(report), 1);
});

test('a p95 breach the median does not corroborate is tail-only: invalid measurement, rerun, exit 2', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, {
    'latency/node/p/processing-p95': { value: 130, corroboration: { statistic: 'processing median', value: 92 } },
  })), []);
  const result = report.triggers.find(t => t.id === 'latency/node/p/processing-p95');
  assert.equal(result.verdict, 'invalid-measurement');
  assert.match(result.reason, /tail-only/);
  assert.equal(exitCodeFor(report), 2);
});

test('a measured regression outranks an invalid measurement elsewhere in the report', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, {
    'latency/node/p/processing-p95': { value: 130, corroboration: { statistic: 'processing median', value: 92 } },
    'size/wasm/full/gzip': 120_000,
  })), []);
  assert.equal(report.status, 'regression');
});

test('an accepted tradeoff covers exactly its trigger, baseline and candidate commit, and keeps the original measurement', () => {
  const entry = {
    id: 'AR-1', triggerId: 'size/wasm/full/gzip', baselineId: 'base', candidate: { sourceCommit: COMMIT_B },
    measured: { baseline: 100_000, candidate: 120_000, unit: 'bytes' },
    rationale: 'Adds the provider families that close the beta.9 detection gaps.',
    benefit: { kind: 'detection', summary: 'twelve new provider families', links: ['https://github.com/redact-secret/redact-secret/issues/1'] },
    decidedAt: '2026-09-25', decidedBy: 'maintainer',
  };
  const metrics = withValues(baseline, { 'size/wasm/full/gzip': 120_000 });
  const accepted = evaluateBudgets(budgets, baseline, candidate(metrics), [entry]);
  const row = accepted.triggers.find(t => t.id === 'size/wasm/full/gzip');
  assert.equal(row.verdict, 'accepted-tradeoff');
  assert.equal(row.acceptedBy, 'AR-1');
  assert.equal(row.baseline, 100_000);
  assert.equal(row.candidate, 120_000);
  assert.equal(accepted.status, 'accepted');
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate(metrics, 'c'.repeat(40)), [entry]), 'size/wasm/full/gzip'), 'regression');
});

test('growth in an optional profile is its own row and never folded into the default bundle', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, { 'size/wasm/common/gzip': 90_000 })), []);
  const optional = report.triggers.find(t => t.id === 'size/wasm/common/gzip');
  const fallback = report.triggers.find(t => t.id === 'size/wasm/full/gzip');
  assert.equal(optional.role, 'optional');
  assert.equal(optional.verdict, 'regression');
  assert.equal(fallback.verdict, 'within-budget');
});

test('a wrong profile, a missing metric, or too few samples is an invalid measurement, not a regression', () => {
  const wrongProfile = candidate(withValues(baseline, {}));
  wrongProfile.profiles.latency = { ...LATENCY_PROFILE, os: 'darwin' };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, wrongProfile, []), 'latency/node/p/processing-p95'), 'invalid-measurement');

  const missing = withValues(baseline, {});
  delete missing['memory/node/p/nodeRss'];
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate(missing), []), 'memory/node/p/nodeRss'), 'invalid-measurement');

  const thin = withValues(baseline, { 'adapter/pino/log-flat/traversal': { samples: 3 } });
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate(thin), []), 'adapter/pino/log-flat/traversal'), 'invalid-measurement');

  const quick = candidate(withValues(baseline, {}));
  quick.profiles['adapter-overhead'] = { ...quick.profiles['adapter-overhead'], 'javascript:quick': 'true' };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, quick, []), 'adapter/pino/log-flat/scanner-calls'), 'invalid-measurement');
});

test('a dimension with no candidate source is not evaluated, and does not fail the report', () => {
  const sizeOnly = candidate(withValues(baseline, {}));
  sizeOnly.profiles = { size: {} };
  const report = evaluateBudgets(budgets, baseline, sizeOnly, []);
  assert.equal(verdictOf(report, 'latency/node/p/processing-p95'), 'not-evaluated');
  assert.equal(report.status, 'accepted');
});

test('adapter scanner calls are deterministic: any increase is a trigger', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, { 'adapter/pino/log-flat/scanner-calls': 10 })), []);
  assert.equal(verdictOf(report, 'adapter/pino/log-flat/scanner-calls'), 'regression');
});

test('the ledger requires a rationale, a linked detection or safety benefit, and the original measurement', () => {
  const ids = new Set(triggers.map(t => t.id));
  const good = {
    id: 'AR-1', triggerId: 'size/wasm/full/gzip', baselineId: 'base', candidate: { sourceCommit: COMMIT_B },
    measured: { baseline: 1, candidate: 2, unit: 'bytes' }, rationale: 'x'.repeat(40),
    benefit: { kind: 'safety', summary: 's', links: ['https://github.com/redact-secret/redact-secret/pull/9'] }, decidedAt: '2026-09-25', decidedBy: 'm',
  };
  assert.deepEqual(ledgerProblems([good], ids), []);
  assert.equal(ledgerProblems([{ ...good, benefit: { ...good.benefit, links: [] } }], ids).length, 1);
  assert.equal(ledgerProblems([{ ...good, benefit: { ...good.benefit, links: ['https://example.com/x'] } }], ids).length, 1);
  assert.equal(ledgerProblems([{ ...good, rationale: 'faster' }], ids).length, 1);
  assert.equal(ledgerProblems([{ ...good, measured: { unit: 'bytes' } }], ids).length, 1);
  assert.equal(ledgerProblems([{ ...good, triggerId: 'nope' }], ids).length, 1);
  assert.equal(ledgerProblems([good, good], ids).length, 1);
});

test('a breach never disappears through baseline replacement', () => {
  const older = snapshot('older', COMMIT_A);
  const newer = snapshot('newer', COMMIT_B);
  newer.metrics['size/wasm/full/gzip'] = { ...newer.metrics['size/wasm/full/gzip'], value: 120_000 };
  const files = { 'older.json': JSON.stringify(older), 'newer.json': JSON.stringify(newer) };
  const history = (overrides = {}) => ({
    budgetsId: 'test', baseline: 'newer', triggers,
    baselines: [
      { id: 'older', file: 'older.json', sha256: sha256OfText(files['older.json']), sourceCommit: COMMIT_A, promotedAt: '2026-09-25', supersedes: null },
      { id: 'newer', file: 'newer.json', sha256: sha256OfText(files['newer.json']), sourceCommit: COMMIT_B, promotedAt: '2026-09-26', supersedes: 'older' },
    ],
    ...overrides,
  });
  const read = file => files[file];

  const problems = historyProblems(history(), read, []);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /replaced older over an unaccepted breach of size\/wasm\/full\/gzip/);

  const accepted = [{
    id: 'AR-1', triggerId: 'size/wasm/full/gzip', baselineId: 'older', candidate: { sourceCommit: COMMIT_B },
    measured: { baseline: 100_000, candidate: 120_000, unit: 'bytes' }, rationale: 'x'.repeat(40),
    benefit: { kind: 'detection', summary: 's', links: ['https://github.com/redact-secret/redact-secret/issues/1'] }, decidedAt: '2026-09-26', decidedBy: 'm',
  }];
  assert.deepEqual(historyProblems(history(), read, accepted), []);

  const tampered = { ...files, 'older.json': JSON.stringify({ ...older, metrics: newer.metrics }) };
  assert.ok(historyProblems(history(), file => tampered[file], accepted).some(p => /sha256 mismatch/.test(p)));
  assert.ok(historyProblems(history({ baseline: 'older' }), read, accepted).some(p => /not the newest/.test(p)));
});

test('adapter overhead metrics exclude core scan time and keep deterministic counts', () => {
  const output = (traversal, quick = false) => ({
    schema: 'redact-secret-adapters/overhead-v1', language: 'javascript', workloads: { digest: 'd' },
    environment: { platform: 'darwin', arch: 'arm64', cpuModel: 'M', runtime: 'node-22.16.0' },
    method: { quick, repetitions: 15 },
    results: [{ host: 'pino', profileId: 'log-flat', scannerCallsPerEvent: 9, scannedCodeUnitsPerEvent: 367, derived: { traversal, coreScan: 80, adapterOverhead: 82 } }],
  });
  const { metrics, profiles } = metricsFromAdapterOverhead([output(1.4), output(1.6), output(1.5)]);
  assert.deepEqual(metrics.map(m => m.id).sort(), ['adapter/pino/log-flat/scanned-code-units', 'adapter/pino/log-flat/scanner-calls', 'adapter/pino/log-flat/traversal']);
  assert.equal(metrics.find(m => m.id.endsWith('/traversal')).value, 1.5);
  assert.equal(metrics.find(m => m.id.endsWith('/traversal')).samples, 45);
  assert.equal(profiles.javascript, 'darwin-arm64|M|node-22');
  assert.equal(metricsFromAdapterOverhead([output(1, true)]).profiles['javascript:quick'], 'true');
});

test('size metrics mark the default bundle and optional profiles separately', () => {
  const metrics = metricsFromOperational(readJson('benchmarks/operational-evidence.json'));
  assert.equal(metrics.find(m => m.id === 'size/wasm/full/gzip').role, 'default');
  assert.equal(metrics.find(m => m.id === 'size/wasm/common/gzip').role, 'optional');
  assert.equal(metrics.find(m => m.id === 'size/browser-bundle/quickstart/gzip').role, 'default');
});

test('the committed budgets cover every dimension from the committed baseline, and the history and ledger are consistent', () => {
  const committed = readJson('benchmarks/regression-budgets.json');
  const ledger = readJson('benchmarks/accepted-regressions.json');
  for (const dimension of Object.keys(RULES)) assert.ok(committed.triggers.some(t => t.dimension === dimension), dimension);
  assert.deepEqual(committed.rules, RULES);
  assert.deepEqual(ledgerProblems(ledger, new Set(committed.triggers.map(t => t.id))), []);
  assert.deepEqual(historyProblems(committed, file => readFileSync(file, 'utf8'), ledger), []);
  const current = readJson(committed.baselines.at(-1).file);
  for (const trigger of committed.triggers) assert.equal(trigger.baselineValue, current.metrics[trigger.id].value, trigger.id);
  // The baseline accepts itself: the frozen measurement is inside every budget.
  const self = evaluateBudgets(committed, current, candidateFromSnapshot(current), ledger);
  assert.equal(self.status, 'accepted');
});
