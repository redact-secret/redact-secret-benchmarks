import { currentPerformanceFixture } from './helpers/current-performance-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { browserLane, bundleFiles, normalizeAsset } from '../scripts/measure-quickstart-bundle.mjs';

import {
  allowedChange, candidateFromSnapshot, ceilToFivePercent, deriveTriggers, evaluateBudgets, exitCodeFor, historyProblems,
  ledgerProblems, metricsFromAdapterOverhead, metricsFromOperational, metricsFromPaired, metricsFromQuickstartBundle, metricsFromWasmSizes,
  pairedRatios, PERFORMANCE_RUN_REQUIRED_TRIGGERS, quickstartBundleProblem, ratioDeviation, renderReportMarkdown, roundOrder, RULES,
  sha256OfText, wasmSizesProblem,
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
    'adapter/pino/log-flat/allocated-bytes': { id: 'adapter/pino/log-flat/allocated-bytes', dimension: 'adapter-overhead', profile: 'darwin-arm64|M|node-22', unit: 'bytes-per-event', value: 50_000, samples: 5 },
    'adapter/pino/log-flat/gc-count': { id: 'adapter/pino/log-flat/gc-count', dimension: 'adapter-overhead', profile: 'darwin-arm64|M|node-22', unit: 'collections-per-event', value: 0.01, samples: 5 },
    ...overrides,
  };
  return {
    schemaVersion: '1', id, productVersion: id, sourceCommit, takenAt: '2026-09-25', sources: {},
    profiles: { latency: LATENCY_PROFILE, 'adapter-overhead': { javascript: 'darwin-arm64|M|node-22', 'javascript:workloadDigest': 'd', 'javascript:quick': 'false' } },
    metrics,
  };
}

const NOISE = {
  paired: { processing: { p95: { 'node/p': 0.05 }, median: { 'node/p': 0.04 } }, initialization: { p95: { 'node/p': 0.2 }, median: { 'node/p': 0.16 } } },
  ciMemorySpread: { 'node/p/nodeRss': 0.03 },
  rerunMemorySpread: 0.02,
  adapterTraversal: { 'pino/log-flat': { spread: 0.1, standardDeviation: 0.05 } },
  adapterChange: { 'pino/log-flat': { traversal: 0.08, p95Latency: 0.2, allocatedBytes: 0.02 } },
};

function withValues(base, values) {
  const metrics = structuredClone(base.metrics);
  for (const [id, value] of Object.entries(values)) {
    if (typeof value === 'object') Object.assign(metrics[id], value);
    else metrics[id].value = value;
  }
  return metrics;
}

/** A same-job paired latency ratio metric; the in-job baseline is 100 ms unless given. */
function ratio(p95, median, extra = {}) {
  return { id: 'latency/node/p/processing-ratio', dimension: 'latency', profile: 'linux-x64-release', unit: 'ratio', value: median, samples: 12,
    pairedBaseline: 90, tail: { statistic: 'processing p95 ratio', value: p95, pairedBaseline: 100 }, ...extra };
}
const PAIRED_PROFILE = { ...LATENCY_PROFILE, sameJob: 'true', baselineRevision: COMMIT_A, cpuModel: 'test CPU' };

/** A same-session adapter traversal change: the previous release's in-process traversal is 2 microseconds and its p95 latency 100. */
function traversalChange(value, extra = {}) {
  return { id: 'adapter/pino/log-flat/traversal-change', dimension: 'adapter-overhead', profile: 'darwin-arm64|M|node-22', unit: 'ratio', value, samples: 45,
    pairedBaseline: 2, tail: { statistic: 'adapter-core single-event p95 latency ratio', value: 1, pairedBaseline: 100 }, ...extra };
}

function candidate(metrics, sourceCommit = COMMIT_B) {
  return {
    sourceCommit, sources: ['test'],
    metrics: { 'latency/node/p/processing-ratio': ratio(1, 1), 'adapter/pino/log-flat/traversal-change': traversalChange(1), ...metrics },
    profiles: { latency: PAIRED_PROFILE, memory: LATENCY_PROFILE, size: {}, 'adapter-overhead': { javascript: 'darwin-arm64|M|node-22', 'javascript:workloadDigest': 'd', 'javascript:quick': 'false' } },
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

test('latency is a paired median ratio judged at the larger of 10% and twice the row\'s A/A deviation; the p95 ratio is the tail check at 15%', () => {
  assert.equal(byId('latency/node/p/processing-p95'), undefined);
  const trigger = byId('latency/node/p/processing-ratio');
  assert.equal(trigger.unit, 'ratio');
  assert.equal(trigger.baselineValue, 1);
  assert.equal(trigger.pairedFloorMilliseconds, 1);
  assert.equal(trigger.minimumSamples, 10);
  assert.deepEqual(trigger.threshold, { relative: 0.1, absoluteFloor: 0 });
  assert.deepEqual(trigger.tail.threshold, { relative: 0.15, absoluteFloor: 0 });
  assert.equal(trigger.corroboration, undefined);
  const wide = deriveTriggers(baseline, { ...NOISE, paired: { ...NOISE.paired, processing: { p95: { 'node/p': 0.24 }, median: { 'node/p': 0.07 } } } });
  assert.equal(wide.find(t => t.id === trigger.id).tail.threshold.relative, 0.5);
  assert.equal(wide.find(t => t.id === trigger.id).threshold.relative, 0.15);
  assert.throws(() => deriveTriggers(baseline, { ...NOISE, paired: { ...NOISE.paired, processing: { p95: {}, median: {} } } }), /no-paired-noise/);
});

test('a millisecond floor is scaled by the in-job baseline: a large ratio on a tiny timing stays within budget', () => {
  const tiny = ratio(1.3, 1.3, { pairedBaseline: 2, tail: { statistic: 'processing p95 ratio', value: 1.3, pairedBaseline: 2 } });
  const report = evaluateBudgets(budgets, baseline, candidate({ 'latency/node/p/processing-ratio': tiny }), []);
  assert.equal(verdictOf(report, 'latency/node/p/processing-ratio'), 'within-budget');
  assert.equal(report.triggers.find(t => t.id === 'latency/node/p/processing-ratio').allowedChange, 0.5);
});

test('memory, size and adapter triggers follow their rules', () => {
  assert.deepEqual(byId('memory/node/p/nodeRss').threshold, { relative: 0.1, absoluteFloor: 1024 * 1024 });
  assert.deepEqual(byId('size/wasm/full/gzip').threshold, { relative: 0.05, absoluteFloor: 4096 });
  assert.equal(byId('size/wasm/full/gzip').role, 'default');
  assert.equal(byId('size/wasm/common/gzip').role, 'optional');
  assert.equal(byId('adapter/pino/log-flat/traversal'), undefined, 'the absolute traversal is reported, not judged');
  assert.equal(byId('adapter/pino/log-flat/gc-count'), undefined, 'GC count is recorded, not budgeted');
  assert.deepEqual(byId('adapter/pino/log-flat/scanner-calls').threshold, { relative: 0, absoluteFloor: 0 });
  assert.equal(allowedChange(100, { relative: 0.05, absoluteFloor: 16 }), 16);
});

test('a change inside every budget is accepted, and every dimension is counted separately', () => {
  const report = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, { 'size/wasm/full/gzip': 104_000 }), 'latency/node/p/processing-ratio': ratio(1.1, 1.05) }), []);
  assert.equal(report.status, 'accepted');
  assert.equal(exitCodeFor(report), 0);
  assert.equal(report.dimensions.latency['within-budget'], 1);
  assert.equal(report.dimensions.size['within-budget'], 2);
  assert.equal(report.dimensions['adapter-overhead']['within-budget'], 3);
  assert.equal(report.dimensions.initialization['within-budget'], 0);
  assert.ok(!('score' in report));
});

test('a median ratio breach is a regression and exits 1, whatever the tail does', () => {
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'latency/node/p/processing-ratio': ratio(1.05, 1.12) }), []),
    'latency/node/p/processing-ratio'), 'regression');
  const report = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'latency/node/p/processing-ratio': ratio(1.3, 1.12) }), []);
  assert.equal(verdictOf(report, 'latency/node/p/processing-ratio'), 'regression');
  assert.equal(report.status, 'regression');
  assert.equal(exitCodeFor(report), 1);
});

test('a p95 ratio breach with the median ratio inside is tail-only: invalid measurement, rerun, exit 2', () => {
  const report = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'latency/node/p/processing-ratio': ratio(1.3, 0.98) }), []);
  const result = report.triggers.find(t => t.id === 'latency/node/p/processing-ratio');
  assert.equal(result.verdict, 'invalid-measurement');
  assert.match(result.reason, /tail-only/);
  assert.equal(exitCodeFor(report), 2);
});

test('a measured regression outranks an invalid measurement elsewhere in the report', () => {
  const report = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, { 'size/wasm/full/gzip': 120_000 }), 'latency/node/p/processing-ratio': ratio(1.3, 0.98) }), []);
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
  wrongProfile.profiles.latency = { ...PAIRED_PROFILE, os: 'darwin' };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, wrongProfile, []), 'latency/node/p/processing-ratio'), 'invalid-measurement');

  const acrossJobs = candidate(withValues(baseline, {}));
  acrossJobs.profiles.latency = LATENCY_PROFILE;
  const acrossReport = evaluateBudgets(budgets, baseline, acrossJobs, []);
  assert.equal(verdictOf(acrossReport, 'latency/node/p/processing-ratio'), 'invalid-measurement');
  assert.match(acrossReport.triggers.find(t => t.id === 'latency/node/p/processing-ratio').reason, /same-job paired run/);

  const otherBaseline = candidate(withValues(baseline, {}));
  otherBaseline.profiles.latency = { ...PAIRED_PROFILE, baselineRevision: COMMIT_B };
  assert.match(evaluateBudgets(budgets, baseline, otherBaseline, []).triggers.find(t => t.id === 'latency/node/p/processing-ratio').reason, /not the budgets' baseline commit/);

  const thinPaired = candidate({ ...withValues(baseline, {}), 'latency/node/p/processing-ratio': ratio(1, 1, { samples: 6 }) });
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, thinPaired, []), 'latency/node/p/processing-ratio'), 'invalid-measurement');

  const missing = withValues(baseline, {});
  delete missing['memory/node/p/nodeRss'];
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate(missing), []), 'memory/node/p/nodeRss'), 'invalid-measurement');

  const thin = { ...withValues(baseline, {}), 'adapter/pino/log-flat/traversal-change': traversalChange(1, { samples: 3 }) };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, candidate(thin), []), 'adapter/pino/log-flat/traversal-change'), 'invalid-measurement');

  const quick = candidate(withValues(baseline, {}));
  quick.profiles['adapter-overhead'] = { ...quick.profiles['adapter-overhead'], 'javascript:quick': 'true' };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, quick, []), 'adapter/pino/log-flat/scanner-calls'), 'invalid-measurement');
});

test('a dimension with no candidate source is not evaluated, and does not fail the report', () => {
  const sizeOnly = candidate(withValues(baseline, {}));
  sizeOnly.profiles = { size: {} };
  const report = evaluateBudgets(budgets, baseline, sizeOnly, []);
  assert.equal(verdictOf(report, 'latency/node/p/processing-ratio'), 'not-evaluated');
  assert.equal(report.status, 'accepted');
});

test('absolute timings across jobs are informational: reported, never judged', () => {
  const absolute = candidate(withValues(baseline, { 'latency/node/p/processing-p95': 400 }));
  absolute.profiles = { memory: LATENCY_PROFILE };
  const report = evaluateBudgets(budgets, baseline, absolute, []);
  assert.equal(report.status, 'accepted');
  assert.equal(verdictOf(report, 'latency/node/p/processing-ratio'), 'not-evaluated');
  const row = report.informational.find(r => r.id === 'latency/node/p/processing-p95');
  assert.equal(row.relativeChange, 3);
  assert.ok(!report.triggers.some(t => t.id === 'latency/node/p/processing-p95'));
});

test('paired ratios are recomputed from interleaved samples, and rounds are counterbalanced', () => {
  const r = pairedRatios([10, 10, 11, 10, 12], [15, 15, 16, 15, 18]);
  assert.equal(r.median, 1.5);
  assert.equal(r.p95, 1.5);
  assert.equal(r.baselineMedian, 10);
  assert.equal(ratioDeviation(0.8), 0.25);
  assert.equal(ratioDeviation(1.25), 0.25);
  assert.deepEqual(roundOrder(4).map(o => o.side[0]).join(''), 'bccbbccb');
  const { metrics, profile } = metricsFromPaired({
    baseline: { revision: COMMIT_A }, candidate: { revision: COMMIT_B }, aa: false, samplesPerSide: 5,
    runner: { cpuModel: 'Test CPU' }, profile: LATENCY_PROFILE, ratios: 'ignored',
    rows: { 'node/p': { baseline: { processing: [10, 10, 11, 10, 12], initialization: [1, 1, 1, 1, 1] },
      candidate: { processing: [15, 15, 16, 15, 18], initialization: [1, 1, 1, 1, 1] } } },
  });
  assert.deepEqual(metrics.map(m => m.id), ['latency/node/p/processing-ratio', 'initialization/node/p/initialization-ratio']);
  assert.equal(metrics[0].value, 1.5);
  assert.equal(metrics[0].tail.value, 1.5);
  assert.equal(profile.sameJob, 'true');
  assert.equal(profile.baselineRevision, COMMIT_A);
  assert.equal(profile.cpuModel, 'Test CPU');
});

test('adapter scanner calls are deterministic: any increase is a trigger', () => {
  const report = evaluateBudgets(budgets, baseline, candidate(withValues(baseline, { 'adapter/pino/log-flat/scanner-calls': 10 })), []);
  assert.equal(verdictOf(report, 'adapter/pino/log-flat/scanner-calls'), 'regression');
});

test('adapter traversal is a same-session ratio at the larger of 15% and twice the row\'s A/A deviation, with a microsecond floor and a p95 tail check', () => {
  const trigger = byId('adapter/pino/log-flat/traversal-change');
  assert.equal(trigger.unit, 'ratio');
  assert.equal(trigger.baselineValue, 1);
  assert.equal(trigger.pairedFloorMicroseconds, 0.5);
  assert.equal(trigger.pairedFloorMilliseconds, undefined);
  assert.equal(trigger.minimumSamples, 15);
  assert.deepEqual(trigger.threshold, { relative: 0.2, absoluteFloor: 0 });
  assert.deepEqual(trigger.tail.threshold, { relative: 0.4, absoluteFloor: 0 });
  const quiet = deriveTriggers(baseline, { ...NOISE, adapterChange: { 'pino/log-flat': { traversal: 0.01, p95Latency: 0.02, allocatedBytes: 0.02 } } });
  assert.equal(quiet.find(t => t.id === trigger.id).threshold.relative, 0.15);
  assert.equal(quiet.find(t => t.id === trigger.id).tail.threshold.relative, 0.15);
  const noisy = deriveTriggers(baseline, { ...NOISE, adapterTraversal: { 'pino/log-flat': { spread: 0.1, standardDeviation: 0.31 } } });
  assert.equal(noisy.find(t => t.id === trigger.id).pairedFloorMicroseconds, 1);
  const bare = snapshot('bare', COMMIT_A);
  delete bare.metrics['adapter/pino/log-flat/allocated-bytes'];
  const unstudied = deriveTriggers(bare, { ...NOISE, adapterChange: {} });
  assert.equal(unstudied.find(t => t.id === trigger.id), undefined);
  assert.deepEqual(unstudied.find(t => t.id === 'adapter/pino/log-flat/traversal').threshold, { relative: 0.2, absoluteFloor: 0.5 });
  assert.throws(() => deriveTriggers(bare, { ...NOISE, adapterTraversal: {} }), /no-adapter-noise/);
  assert.throws(() => deriveTriggers(baseline, { ...NOISE, adapterChange: {} }), /no-adapter-noise:adapter\/pino\/log-flat\/allocated-bytes/);
});

test('a same-session traversal ratio above its threshold and microsecond floor is a regression; the floor scales with the in-process baseline', () => {
  const judged = value => verdictOf(evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'adapter/pino/log-flat/traversal-change': value }), []), 'adapter/pino/log-flat/traversal-change');
  assert.equal(judged(traversalChange(1.15)), 'within-budget');
  assert.equal(judged(traversalChange(1.4)), 'regression');
  // 0.5 us of a 2 us baseline is 0.25 of the ratio: 1.24 exceeds the 20% threshold and stays inside the floor; 1.3 exceeds both.
  assert.equal(judged(traversalChange(1.24)), 'within-budget');
  assert.equal(judged(traversalChange(1.3)), 'regression');
  // A 40 us in-process baseline turns the same floor into 1.25% of the ratio, so the relative threshold decides.
  assert.equal(judged(traversalChange(1.21, { pairedBaseline: 40 })), 'regression');
  const report = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'adapter/pino/log-flat/traversal-change': traversalChange(1.3) }), []);
  assert.equal(report.triggers.find(t => t.id === 'adapter/pino/log-flat/traversal-change').allowedChange, 0.25);
});

test('a p95 latency tail breach with the traversal median inside is invalid-measurement, not a regression', () => {
  const tail = value => traversalChange(1.05, { tail: { statistic: 'adapter-core single-event p95 latency ratio', value, pairedBaseline: 100 } });
  const judged = value => evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'adapter/pino/log-flat/traversal-change': tail(value) }), []);
  assert.equal(verdictOf(judged(1.3), 'adapter/pino/log-flat/traversal-change'), 'within-budget');
  const breached = judged(1.6);
  assert.equal(verdictOf(breached, 'adapter/pino/log-flat/traversal-change'), 'invalid-measurement');
  assert.equal(breached.status, 'invalid-measurement');
  assert.match(breached.triggers.find(t => t.id === 'adapter/pino/log-flat/traversal-change').reason, /tail-only/);
});

test('an incomparable previous release is invalid-measurement and a moved scanner-call count is not evaluated', () => {
  const judged = extra => evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, {}), 'adapter/pino/log-flat/traversal-change': traversalChange(3, extra) }), []);
  const invalid = judged({ invalid: 'the previous adapter release is not comparable: nothing published below 0.1.0' });
  assert.equal(verdictOf(invalid, 'adapter/pino/log-flat/traversal-change'), 'invalid-measurement');
  assert.equal(invalid.status, 'invalid-measurement');
  const moved = judged({ notComparable: 'scanner calls per event moved from 1 to 9' });
  assert.equal(verdictOf(moved, 'adapter/pino/log-flat/traversal-change'), 'not-evaluated');
  assert.equal(moved.status, 'accepted');
  // The calls trigger still reports the moved count on its own.
  const calls = evaluateBudgets(budgets, baseline, candidate({ ...withValues(baseline, { 'adapter/pino/log-flat/scanner-calls': 18 }),
    'adapter/pino/log-flat/traversal-change': traversalChange(3, { notComparable: 'scanner calls per event moved from 9 to 18' }) }), []);
  assert.equal(verdictOf(calls, 'adapter/pino/log-flat/scanner-calls'), 'regression');
});

test('adapter allocation is budgeted absolutely at the larger of 10% and twice the A/A deviation, with a 1 KiB floor', () => {
  const trigger = byId('adapter/pino/log-flat/allocated-bytes');
  assert.deepEqual(trigger.threshold, { relative: 0.1, absoluteFloor: 1024 });
  assert.equal(trigger.baselineValue, 50_000);
  const wide = deriveTriggers(baseline, { ...NOISE, adapterChange: { 'pino/log-flat': { traversal: 0.08, p95Latency: 0.2, allocatedBytes: 0.09 } } });
  assert.equal(wide.find(t => t.id === trigger.id).threshold.relative, 0.2);
  const judged = value => verdictOf(evaluateBudgets(budgets, baseline, candidate(withValues(baseline, { 'adapter/pino/log-flat/allocated-bytes': value })), []), trigger.id);
  assert.equal(judged(54_900), 'within-budget');
  assert.equal(judged(55_100), 'regression');
  const python = snapshot('py', COMMIT_A, { 'adapter/pino/log-flat/peak-bytes': { id: 'adapter/pino/log-flat/peak-bytes', dimension: 'adapter-overhead',
    profile: 'darwin-arm64|M|node-22', unit: 'bytes', value: 8_000, samples: 5 } });
  const peak = deriveTriggers(python, { ...NOISE, adapterChange: { 'pino/log-flat': { traversal: 0.08, p95Latency: 0.2, allocatedBytes: 0.02, peakBytes: 0 } } });
  assert.deepEqual(peak.find(t => t.id === 'adapter/pino/log-flat/peak-bytes').threshold, { relative: 0.1, absoluteFloor: 1024 });
  assert.throws(() => deriveTriggers(python, NOISE), /no-adapter-noise/);
});

test('a snapshot compared with itself has a traversal change of exactly 1', () => {
  const self = candidateFromSnapshot(baseline);
  assert.equal(self.metrics['adapter/pino/log-flat/traversal-change'].value, 1);
  assert.equal(evaluateBudgets(budgets, baseline, self, []).status, 'accepted');
});

test('a baseline promotion at a new adapter workload digest is compared row by row', () => {
  const older = snapshot('older', COMMIT_A);
  const newer = snapshot('newer', COMMIT_A);
  newer.profiles['adapter-overhead'] = { ...newer.profiles['adapter-overhead'], 'javascript:workloadDigest': 'd2' };
  newer.metrics['adapter/pino/log-flat/scanner-calls'] = { ...newer.metrics['adapter/pino/log-flat/scanner-calls'], value: 12 };
  const files = { 'older.json': JSON.stringify(older), 'newer.json': JSON.stringify(newer) };
  const chain = {
    budgetsId: 'test', baseline: 'newer', triggers,
    baselines: [
      { id: 'older', file: 'older.json', sha256: sha256OfText(files['older.json']), sourceCommit: COMMIT_A, promotedAt: '2026-09-25', supersedes: null },
      { id: 'newer', file: 'newer.json', sha256: sha256OfText(files['newer.json']), sourceCommit: COMMIT_A, promotedAt: '2026-09-30', supersedes: 'older' },
    ],
  };
  const problems = historyProblems(chain, file => files[file], []);
  assert.equal(problems.length, 1, problems.join('; '));
  assert.match(problems[0], /replaced older over an unaccepted breach of adapter\/pino\/log-flat\/scanner-calls/);
});

/** A trimmed `measure-overhead.mjs --baseline` output, one process: change values are current against the previous release. */
function v2Process({ traversal = 6, previous = 5, calls = 22, previousCalls = 22, comparable = true, allocated = 4096, peak = null, tail = [300, 200] } = {}) {
  const memory = { basis: 'test', allocatedBytesPerEvent: allocated, peakBytes: peak, gcCountPerEvent: 0.02, gcPauseMicrosecondsPerEvent: 0 };
  const mode = { unit: 'microseconds-per-event', samples: [1], median: 1, latency: { median: 1, p95: tail[0], p99: 1 }, memory };
  return {
    schema: 'redact-secret-adapters/overhead-v2', language: 'javascript', workloads: { digest: 'd2' },
    environment: { platform: 'darwin', arch: 'arm64', cpuModel: 'M', runtime: 'node-22.16.0' },
    method: { quick: false, repetitions: 15 },
    results: [{
      host: 'mask-js', profileId: 'mask-payload', scannerCallsPerEvent: calls, scannedCodeUnitsPerEvent: 3000,
      modes: { 'adapter-core': mode, host: { ...mode, memory: { ...memory, allocatedBytesPerEvent: 1 } } },
      derived: { traversal, coreScan: 1000, adapterOverhead: 1001 },
      baseline: comparable ? { comparable: true } : { comparable: false, reason: 'no adapter release below 0.1.0 is published' },
      ...(comparable ? { change: {
        traversal: { baseline: previous, current: traversal, difference: traversal - previous, relative: traversal / previous - 1 },
        adapterCoreLatencyP95: { baseline: tail[1], current: tail[0], difference: tail[0] - tail[1], relative: tail[0] / tail[1] - 1 },
        scannerCallsPerEvent: { baseline: previousCalls, current: calls, difference: calls - previousCalls, relative: calls / previousCalls - 1 },
      } } : {}),
    }],
  };
}

test('v2 outputs yield a same-session traversal ratio, its tail, and adapter-core allocation', () => {
  const { metrics } = metricsFromAdapterOverhead([6, 7, 5, 6, 8].map(traversal => v2Process({ traversal, previous: 5 })));
  const byMetric = id => metrics.find(m => m.id === `adapter/mask-js/mask-payload/${id}`);
  const change = byMetric('traversal-change');
  assert.equal(change.unit, 'ratio');
  assert.equal(change.value, 6 / 5);
  assert.equal(change.pairedBaseline, 5);
  assert.equal(change.samples, 75);
  assert.equal(change.tail.value, 1.5);
  assert.equal(change.tail.pairedBaseline, 200);
  assert.equal(change.invalid, undefined);
  assert.equal(change.notComparable, undefined);
  assert.equal(byMetric('allocated-bytes').value, 4096, 'the adapter-core mode, not the host');
  assert.equal(byMetric('gc-count').value, 0.02);
  assert.equal(byMetric('peak-bytes'), undefined, 'JavaScript reports no peak');
  assert.equal(byMetric('traversal').value, 6, 'the absolute traversal is still recorded');
  const python = metricsFromAdapterOverhead([v2Process({ allocated: null, peak: 7578 })]).metrics;
  assert.equal(python.find(m => m.id.endsWith('/peak-bytes')).value, 7578);
  assert.equal(python.find(m => m.id.endsWith('/allocated-bytes')), undefined);
});

test('v2 outputs without a previous release carry no traversal change, and a v1 output carries no allocation', () => {
  const plain = v2Process();
  delete plain.results[0].baseline;
  delete plain.results[0].change;
  assert.equal(metricsFromAdapterOverhead([plain]).metrics.find(m => m.id.endsWith('/traversal-change')), undefined);
  const v1 = { ...v2Process(), schema: 'redact-secret-adapters/overhead-v1' };
  delete v1.results[0].modes;
  const ids = metricsFromAdapterOverhead([v1]).metrics.map(m => m.id);
  assert.ok(!ids.some(id => /allocated-bytes|peak-bytes|gc-count/.test(id)));
});

test('a previous release the harness could not compare is invalid; a moved scanner-call count makes timing not applicable', () => {
  const five = extra => [...Array(4).fill(v2Process()), v2Process(extra)];
  const incomparable = metricsFromAdapterOverhead(five({ comparable: false })).metrics.find(m => m.id.endsWith('/traversal-change'));
  assert.match(incomparable.invalid, /not comparable: no adapter release below 0.1.0 is published/);
  const moved = metricsFromAdapterOverhead(five({ calls: 9, previousCalls: 1 })).metrics.find(m => m.id.endsWith('/traversal-change'));
  assert.match(moved.notComparable, /moved from 1 to 9/);
  assert.equal(moved.invalid, undefined);
  const single = metricsFromAdapterOverhead([v2Process()]).metrics.find(m => m.id.endsWith('/traversal-change'));
  assert.match(single.invalid, /at least 5 required: a single process is never judged/);
  assert.equal(metricsFromAdapterOverhead(five({})).metrics.find(m => m.id.endsWith('/traversal-change')).invalid, undefined);
});

test('an adapter-only re-take continues the earlier baseline: its accepted tradeoffs still apply, and any other difference is a history problem', () => {
  const older = snapshot('older', COMMIT_A);
  const newer = { ...snapshot('newer', COMMIT_A), continues: 'older' };
  const files = { 'older.json': JSON.stringify(older), 'newer.json': JSON.stringify(newer) };
  const chain = files2 => ({
    budgetsId: 'test', baseline: 'newer', triggers,
    baselines: [
      { id: 'older', file: 'older.json', sha256: sha256OfText(files2['older.json']), sourceCommit: COMMIT_A, promotedAt: '2026-09-25', supersedes: null },
      { id: 'newer', file: 'newer.json', sha256: sha256OfText(files2['newer.json']), sourceCommit: COMMIT_A, promotedAt: '2026-09-30', supersedes: 'older' },
    ],
  });
  assert.deepEqual(historyProblems(chain(files), file => files[file], []), []);
  const changed = { ...newer, metrics: { ...newer.metrics, 'size/wasm/full/gzip': { ...newer.metrics['size/wasm/full/gzip'], value: 90_000 } } };
  const bad = { ...files, 'newer.json': JSON.stringify(changed) };
  assert.ok(historyProblems(chain(bad), file => bad[file], []).some(p => /differs outside the adapter-overhead series/.test(p)));
  const entry = { id: 'AR-1', triggerId: 'size/wasm/full/gzip', baselineId: 'older', candidate: { sourceCommit: COMMIT_B },
    measured: { baseline: 100_000, candidate: 120_000, unit: 'bytes' }, rationale: 'x'.repeat(40),
    benefit: { kind: 'safety', summary: 's', links: ['https://github.com/redact-secret/redact-secret/pull/9'] }, decidedAt: '2026-09-26', decidedBy: 'm' };
  const over = candidate(withValues(newer, { 'size/wasm/full/gzip': 120_000 }));
  assert.equal(verdictOf(evaluateBudgets(budgets, newer, over, [entry]), 'size/wasm/full/gzip'), 'accepted-tradeoff');
  assert.equal(verdictOf(evaluateBudgets(budgets, older, over, [{ ...entry, baselineId: 'other' }]), 'size/wasm/full/gzip'), 'regression');
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

test('adapter overhead-v2 outputs yield every v1 metric unchanged, plus the v2 metrics', () => {
  // Trimmed from a real `measure-overhead.mjs --baseline` run (redact-secret-adapters#97): v2 adds
  // per-mode latency and memory, two derived values, and a per-result baseline and change.
  const mode = median => ({ unit: 'microseconds-per-event', samples: [median], median, p95: median, minimum: median, maximum: median, standardDeviation: 0,
    latency: { unit: 'microseconds', count: 400, median, p95: median, p99: median, maximum: median },
    memory: { basis: 'v8.GCProfiler', allocatedBytesPerEvent: 1024, peakBytes: null, gcCountPerEvent: 0, gcPauseMicrosecondsPerEvent: 0 } });
  const row = (host, traversal) => ({
    host, profileId: 'mask-payload', eventsPerRepetition: 400, scannerCallsPerEvent: 22, scannedCodeUnitsPerEvent: 3024.5,
    modes: { host: mode(0.1), 'adapter-identity': mode(0.1 + traversal), 'adapter-core': mode(1500), 'core-direct': mode(1490) },
    derived: { unit: 'microseconds-per-event', basis: 'difference of per-mode medians', traversal, coreScan: 1490, adapterOverhead: 1499.9,
      unattributed: 9.9, traversalAllocatedBytes: 512, adapterOverheadRatio: null },
    baseline: { comparable: true, scannerCallsPerEvent: 22, scannedCodeUnitsPerEvent: 3024.5, modes: {}, derived: { traversal: traversal + 1 } },
    change: { traversal: { baseline: traversal + 1, current: traversal, difference: -1, relative: -1 / (traversal + 1) } },
  });
  const v2 = traversal => ({
    schema: 'redact-secret-adapters/overhead-v2', language: 'javascript', workloads: { digest: 'd2' },
    environment: { platform: 'linux', arch: 'arm64', cpuModel: null, runtime: 'node-22.23.3', containerImage: 'sha256:0' },
    method: { quick: false, repetitions: 15, passes: ['batch', 'latency', 'memory'] },
    baseline: { packages: { '@redact-secret/adapter': '0.1.2' } },
    results: [row('mask-js', traversal), row('mcp-js', traversal + 10)],
  });
  const v1 = traversal => ({ ...v2(traversal), schema: 'redact-secret-adapters/overhead-v1',
    results: v2(traversal).results.map(({ baseline, change, modes, ...rest }) => rest) });
  const fromV2 = metricsFromAdapterOverhead([v2(5.5), v2(5.7), v2(5.6)]);
  const fromV1 = metricsFromAdapterOverhead([v1(5.5), v1(5.7), v1(5.6)]);
  const v1Ids = /\/(traversal|scanner-calls|scanned-code-units)$/;
  assert.deepEqual({ ...fromV2, metrics: fromV2.metrics.filter(m => v1Ids.test(m.id)) }, fromV1);
  assert.ok(fromV2.metrics.some(m => m.id.endsWith('/allocated-bytes')) && fromV2.metrics.some(m => m.id.endsWith('/traversal-change')));
  assert.ok(!fromV1.metrics.some(m => !v1Ids.test(m.id)));
  assert.equal(fromV2.metrics.find(m => m.id === 'adapter/mcp-js/mask-payload/traversal').value, 15.6);
  assert.equal(fromV2.profiles.javascript, 'linux-arm64|unknown-cpu|node-22');
  assert.equal(fromV2.profiles['javascript:workloadDigest'], 'd2');
});

test('size metrics mark the default bundle and optional profiles separately', () => {
  const metrics = metricsFromOperational(readJson('benchmarks/operational-evidence.json'));
  assert.equal(metrics.find(m => m.id === 'size/wasm/full/gzip').role, 'default');
  assert.equal(metrics.find(m => m.id === 'size/wasm/common/gzip').role, 'optional');
  assert.equal(metrics.find(m => m.id === 'size/browser-bundle/quickstart/gzip').role, 'default');
});

// redact-secret#929: a performance run judged no wasm size row because no size
// source was supplied, so a common-profile growth shipped without a verdict.
function wasmSizes(overrides = {}, sourceCommit = COMMIT_B) {
  const row = (profile, gzipBytes) => ({ profile, artifact: `wasm-${profile}`, file: `${profile}.wasm`, sha256: 'c'.repeat(64),
    rawBytes: gzipBytes * 3, gzipBytes, brotliBytes: Math.round(gzipBytes * 0.8) });
  return { schemaVersion: '1', kind: 'wasm-artifact-sizes', sourceCommit,
    artifacts: [row('full', overrides.full ?? 100_000), row('common', overrides.common ?? 80_000)] };
}

function wasmSizeCandidate(evidence, required = PERFORMANCE_RUN_REQUIRED_TRIGGERS) {
  const metrics = Object.fromEntries(metricsFromWasmSizes(evidence).map(m => [m.id, m]));
  return { sourceCommit: COMMIT_B, sources: ['wasm-sizes.json'], metrics, profiles: { size: { coverage: 'wasm' } }, required };
}

test('a performance run with no wasm size source fails loudly (invalid-measurement, exit 2), not silently not-evaluated', () => {
  const noSize = candidate(withValues(baseline, {}));
  noSize.profiles = { memory: LATENCY_PROFILE };
  noSize.required = PERFORMANCE_RUN_REQUIRED_TRIGGERS;
  const report = evaluateBudgets(budgets, baseline, noSize, []);
  for (const id of ['size/wasm/full/gzip', 'size/wasm/common/gzip']) {
    const row = report.triggers.find(t => t.id === id);
    assert.equal(row.verdict, 'invalid-measurement', id);
    assert.match(row.reason, /required source missing/);
  }
  assert.equal(report.status, 'invalid-measurement');
  assert.equal(exitCodeFor(report), 2);
  // Without the requirement (not a performance run) the same gap stays an explicit not-evaluated.
  const optional = { ...noSize, required: [] };
  assert.equal(verdictOf(evaluateBudgets(budgets, baseline, optional, []), 'size/wasm/common/gzip'), 'not-evaluated');
});

test('a wasm size source judges both profiles and leaves the other size families not evaluated', () => {
  const sizeTriggers = [...triggers, { ...byId('size/wasm/full/gzip'), id: 'size/npm/core/packed', role: undefined }];
  const extended = { budgetsId: 'test', triggers: sizeTriggers };
  const within = evaluateBudgets(extended, baseline, wasmSizeCandidate(wasmSizes()), []);
  assert.equal(verdictOf(within, 'size/wasm/full/gzip'), 'within-budget');
  assert.equal(verdictOf(within, 'size/wasm/common/gzip'), 'within-budget');
  assert.equal(verdictOf(within, 'size/npm/core/packed'), 'not-evaluated');
  // The #929 shape: the optional common profile grows well past its budget while full is unchanged.
  const grown = evaluateBudgets(extended, baseline, wasmSizeCandidate(wasmSizes({ common: 200_000 })), []);
  const common = grown.triggers.find(t => t.id === 'size/wasm/common/gzip');
  assert.equal(common.verdict, 'regression');
  assert.equal(common.role, 'optional');
  assert.equal(verdictOf(grown, 'size/wasm/full/gzip'), 'within-budget');
  assert.equal(exitCodeFor(grown), 1);
});

test('a wasm size source must name the candidate commit and carry both profiles', () => {
  assert.equal(wasmSizesProblem(wasmSizes(), COMMIT_B), null);
  assert.match(wasmSizesProblem(wasmSizes({}, COMMIT_A), COMMIT_B), /measured core a{40}, but the candidate is b{40}/);
  const onlyFull = wasmSizes();
  onlyFull.artifacts = onlyFull.artifacts.filter(a => a.profile === 'full');
  assert.match(wasmSizesProblem(onlyFull, COMMIT_B), /one common WebAssembly artifact, found 0/);
  assert.match(wasmSizesProblem({ ...wasmSizes(), kind: 'operational' }, COMMIT_B), /not a wasm-artifact-sizes v1/);
  const metrics = metricsFromWasmSizes(wasmSizes());
  assert.equal(metrics.find(m => m.id === 'size/wasm/full/gzip').role, 'default');
  assert.equal(metrics.find(m => m.id === 'size/wasm/common/gzip').role, 'optional');
});

test('evaluate --summary without --wasm-sizes exits 2 and names the wasm size rows; with a measured build it judges them', async () => {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = mkdtempSync(path.join(tmpdir(), 'wasm-sizes-'));
  const summary = currentPerformanceFixture();
  const summaryFile = path.join(dir, 'synthetic-summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary));
  const evaluateCli = extra => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/regression-budgets.mjs', 'evaluate',
    '--summary', summaryFile, '--source-commit', summary.sourceCommit, '--json-out', path.join(dir, 'r.json'),
    '--markdown-out', path.join(dir, 'r.md'), ...extra], { encoding: 'utf8', env: { ...process.env, GITHUB_ACTIONS: '' } });

  const missing = evaluateCli([]);
  assert.equal(missing.status, 2, missing.stderr);
  assert.match(missing.stderr, /INVALID size\/wasm\/full\/gzip: required source missing/);
  assert.match(missing.stderr, /INVALID size\/wasm\/common\/gzip: required source missing/);
  assert.match(missing.stderr, /INVALID size\/browser-bundle\/quickstart\/gzip: required source missing: .*--quickstart-bundle/);

  // The beta.7 quickstart build (#141): every emitted file was fetched, so fetched = emitted = the baseline.
  const bundle = quickstartFromOperational(summary.sourceCommit);
  const bundleFile = path.join(dir, 'quickstart-bundle.json');
  writeFileSync(bundleFile, JSON.stringify(bundle));

  // The committed #141 values at the baseline commit: judged, within budget.
  const operational = readJson('benchmarks/operational-evidence.json').measurements.artifacts.wasm;
  const sizes = { schemaVersion: '1', kind: 'wasm-artifact-sizes', sourceCommit: summary.sourceCommit, artifacts: operational.map(w =>
    ({ profile: w.profile, artifact: w.artifact, file: w.file, sha256: w.sha256, rawBytes: w.rawBytes, gzipBytes: w.gzipBytes, brotliBytes: w.brotliBytes })) };
  const file = path.join(dir, 'wasm-sizes.json');
  writeFileSync(file, JSON.stringify(sizes));
  const onlyWasm = evaluateCli(['--wasm-sizes', file]);
  assert.equal(onlyWasm.status, 2, 'the quickstart bundle row is required too');
  const judged = evaluateCli(['--wasm-sizes', file, '--quickstart-bundle', bundleFile]);
  assert.equal(judged.status, 0, judged.stderr);
  const report = readJson(path.join(dir, 'r.json'));
  assert.equal(verdictOf(report, 'size/wasm/full/gzip'), 'within-budget');
  assert.equal(verdictOf(report, 'size/wasm/common/gzip'), 'within-budget');
  assert.equal(verdictOf(report, 'size/browser-bundle/quickstart/gzip'), 'within-budget');
  assert.equal(report.triggers.find(t => t.id === 'size/browser-bundle/quickstart/gzip').candidate, 144501);
  assert.equal(verdictOf(report, 'size/npm/core/packed'), 'not-evaluated');
  assert.equal(report.diagnostics[0].id, 'size/browser-bundle/quickstart/emitted-gzip');

  // Sizes measured at another commit are not this candidate's: exit 2.
  writeFileSync(file, JSON.stringify({ ...sizes, sourceCommit: COMMIT_B }));
  const wrong = evaluateCli(['--wasm-sizes', file, '--quickstart-bundle', bundleFile]);
  assert.equal(wrong.status, 2);
  assert.match(wrong.stderr, /wasm-sizes: measured core b{40}/);
});

test('measure-wasm-sizes measures both profiles of a checkout and refuses a missing profile or another commit', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { mkdirSync, mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const { gzipSync } = await import('node:zlib');
  const core = mkdtempSync(path.join(tmpdir(), 'core-'));
  const git = (...args) => execFileSync('git', ['-C', core, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'core');
  const head = git('rev-parse', 'HEAD');
  mkdirSync(path.join(core, 'bindings/wasm/pkg'), { recursive: true });
  const full = Buffer.from('\0asm synthetic full '.repeat(64));
  writeFileSync(path.join(core, 'bindings/wasm/pkg/redact_secret_wasm_bg.wasm'), full);
  const out = path.join(core, 'out/wasm-sizes.json');
  const measure = commit => spawnSync(process.execPath, ['scripts/measure-wasm-sizes.mjs', '--core', core, '--source-commit', commit, '--out', out], { encoding: 'utf8' });
  const noCommon = measure(head);
  assert.notEqual(noCommon.status, 0);
  assert.match(noCommon.stderr, /pkg-common\/redact_secret_wasm_common_bg\.wasm is missing/);
  mkdirSync(path.join(core, 'bindings/wasm/pkg-common'), { recursive: true });
  writeFileSync(path.join(core, 'bindings/wasm/pkg-common/redact_secret_wasm_common_bg.wasm'), Buffer.from('\0asm synthetic common '.repeat(32)));
  assert.match(measure(COMMIT_A).stderr, /not the candidate a{40}/);
  const ok = measure(head);
  assert.equal(ok.status, 0, ok.stderr);
  const evidence = readJson(out);
  assert.equal(wasmSizesProblem(evidence, head), null);
  const row = evidence.artifacts.find(a => a.profile === 'full');
  assert.equal(row.rawBytes, full.length);
  assert.equal(row.gzipBytes, gzipSync(full, { level: 9 }).length);
});

// redact-secret#937: the pii builds are separate, lazily loaded artifacts.
function quickstartFromOperational(sourceCommit) {
  const { files } = readJson('benchmarks/operational-evidence.json').measurements.browserBundle;
  const rows = files.map(f => ({ ...f, fetched: true }));
  const total = list => ({ bytes: list.reduce((n, f) => n + f.bytes, 0), gzipBytes: list.reduce((n, f) => n + f.gzipBytes, 0) });
  return { schemaVersion: '1', kind: 'quickstart-bundle-sizes', sourceCommit, tool: 'vite 7.3.6', pageText: 'x', files: rows,
    totals: { fetched: total(rows), emitted: total(rows) } };
}

function splitBundle() {
  const rows = [
    { file: 'index.html', kind: 'html', bytes: 187, gzipBytes: 166, fetched: true },
    { file: 'assets/index-<hash>.js', kind: 'js', bytes: 11_000, gzipBytes: 4_000, fetched: true },
    { file: 'assets/redact_secret_wasm-<hash>.js', kind: 'js', bytes: 11_000, gzipBytes: 3_000, fetched: true },
    { file: 'assets/redact_secret_wasm_bg-<hash>.wasm', kind: 'wasm', bytes: 400_000, gzipBytes: 130_000, fetched: true },
    { file: 'assets/redact_secret_wasm_pii-<hash>.js', kind: 'js', bytes: 11_000, gzipBytes: 3_000, fetched: false },
    { file: 'assets/redact_secret_wasm_pii_bg-<hash>.wasm', kind: 'wasm', bytes: 700_000, gzipBytes: 270_000, fetched: false },
  ];
  const total = list => ({ bytes: list.reduce((n, f) => n + f.bytes, 0), gzipBytes: list.reduce((n, f) => n + f.gzipBytes, 0) });
  return { schemaVersion: '1', kind: 'quickstart-bundle-sizes', sourceCommit: COMMIT_B, tool: 'vite 7.3.6', pageText: 'x', files: rows,
    totals: { fetched: total(rows.filter(f => f.fetched)), emitted: total(rows) } };
}

test('the quickstart bundle row is what a default quickstart fetches; every emitted asset stays visible as a diagnostic', () => {
  const evidence = splitBundle();
  assert.equal(quickstartBundleProblem(evidence, COMMIT_B), null);
  const { metrics, diagnostics } = metricsFromQuickstartBundle(evidence);
  assert.deepEqual(metrics.map(m => [m.id, m.value, m.role]), [['size/browser-bundle/quickstart/gzip', 137_166, 'default']]);
  assert.equal(diagnostics[0].value, 410_166);
  assert.match(diagnostics[0].note, /2 not fetched/);

  const report = evaluateBudgets(
    { budgetsId: 'test', triggers: [{ ...byId('size/wasm/full/gzip'), id: 'size/browser-bundle/quickstart/gzip', baselineValue: 135_000 }] },
    { ...baseline, metrics: { ...baseline.metrics, 'size/browser-bundle/quickstart/gzip': { ...baseline.metrics['size/wasm/full/gzip'], id: 'size/browser-bundle/quickstart/gzip', value: 135_000 } } },
    { sourceCommit: COMMIT_B, sources: ['q'], metrics: Object.fromEntries(metrics.map(m => [m.id, m])), profiles: { size: { coverage: 'browser-bundle' } }, diagnostics }, []);
  assert.equal(verdictOf(report, 'size/browser-bundle/quickstart/gzip'), 'within-budget', 'the lazy pii assets do not count against the fetched row');
  assert.match(renderReportMarkdown(report), /Diagnostics \(measured, never budgeted\)[\s\S]*emitted-gzip` \| 410166 bytes/);

  assert.match(quickstartBundleProblem({ ...evidence, sourceCommit: COMMIT_A }, COMMIT_B), /measured core a{40}/);
  assert.match(quickstartBundleProblem({ ...evidence, totals: { ...evidence.totals, fetched: evidence.totals.emitted } }, COMMIT_B), /fetched totals do not add up/);
  const noWasm = { ...evidence, files: evidence.files.map(f => (f.kind === 'wasm' ? { ...f, fetched: false } : f)) };
  assert.match(quickstartBundleProblem(noWasm, COMMIT_B), /fetched no WebAssembly/);
});

test('operational evidence keeps its beta.7 bundle value: fetched when recorded, else every emitted file (all fetched before #937)', () => {
  const operational = readJson('benchmarks/operational-evidence.json');
  const row = id => metricsFromOperational(operational).find(m => m.id === id).value;
  assert.equal(row('size/browser-bundle/quickstart/gzip'), operational.measurements.browserBundle.totals.allGzipBytes);
  const withFetched = structuredClone(operational);
  withFetched.measurements.browserBundle.totals.fetchedGzipBytes = 1234;
  assert.equal(metricsFromOperational(withFetched).find(m => m.id === 'size/browser-bundle/quickstart/gzip').value, 1234);
});

test('pii wasm builds are optional rows reported baseline-pending, never given an invented budget', () => {
  const evidence = wasmSizes();
  evidence.piiBuilds = 'present';
  const pii = (profile, gzipBytes) => ({ profile, artifact: 'wasm-web', file: `${profile}.wasm`, sha256: 'd'.repeat(64), rawBytes: gzipBytes * 3, gzipBytes, brotliBytes: gzipBytes });
  evidence.artifacts = [...evidence.artifacts, pii('full-pii', 270_000), pii('common-pii', 220_000)];
  assert.equal(wasmSizesProblem(evidence, COMMIT_B), null);
  const metrics = metricsFromWasmSizes(evidence);
  assert.equal(metrics.find(m => m.id === 'size/wasm/full-pii/gzip').role, 'optional');
  assert.equal(metrics.find(m => m.id === 'size/wasm/common-pii/gzip').role, 'optional');

  const report = evaluateBudgets(budgets, baseline, wasmSizeCandidate(evidence), []);
  assert.ok(!report.triggers.some(t => t.id.includes('-pii/')), 'no trigger is invented for a row the baseline never measured');
  assert.deepEqual(report.pending.map(r => [r.id, r.candidate, r.verdict, r.role]), [
    ['size/wasm/common-pii/gzip', 220_000, 'baseline-pending', 'optional'],
    ['size/wasm/full-pii/gzip', 270_000, 'baseline-pending', 'optional'],
  ]);
  assert.equal(report.status, 'accepted', 'a pending row is reported, not judged');
  assert.match(renderReportMarkdown(report), /baseline-pending, not judged[\s\S]*full-pii\/gzip` \(optional\) \| 270000 bytes/);

  const onlyOne = { ...evidence, artifacts: evidence.artifacts.filter(a => a.profile !== 'common-pii') };
  assert.match(wasmSizesProblem(onlyOne, COMMIT_B), /one common-pii WebAssembly artifact, found 0/);
  assert.match(wasmSizesProblem({ ...evidence, piiBuilds: 'absent' }, COMMIT_B), /piiBuilds is absent but pii artifacts are listed/);
  assert.match(wasmSizesProblem({ ...evidence, artifacts: [...evidence.artifacts, pii('full-x', 1)] }, COMMIT_B), /unknown WebAssembly profile full-x/);
});

test('measure-quickstart-bundle reads the documented browser lane and marks lazily loaded assets unfetched', () => {
  const doc = [
    '```sh qualify=browser:setup', 'npm install @redact-secret/core@0.1.0 vite@7.3.6', '```', '',
    '```html qualify=browser:file:index.html', '<script type="module" src="/main.js"></script>', '```', '',
    '```js qualify=browser:file:main.js', 'import { initialize } from "@redact-secret/core";', '```', '',
    '```text qualify=browser:expect', 'loaded wasm', 'findings: 1', '```',
  ].join('\n');
  const lane = browserLane(doc);
  assert.equal(lane.vite, '7.3.6');
  assert.deepEqual(lane.files.map(f => f.name), ['index.html', 'main.js']);
  assert.equal(lane.expect, 'loaded wasm\nfindings: 1');
  assert.throws(() => browserLane(doc.replace('vite@7.3.6', 'vite')), /no complete browser lane/);
  assert.throws(() => browserLane(doc.replace('file:main.js', 'file:../main.js')), /unsafe quickstart file name/);

  assert.equal(normalizeAsset('assets/redact_secret_wasm_bg-Ab_9-xYz.wasm'), 'assets/redact_secret_wasm_bg-<hash>.wasm');
  const entries = [
    { file: 'index.html', bytes: Buffer.from('<html>') },
    { file: 'assets/redact_secret_wasm_bg-AAAAAAAA.wasm', bytes: Buffer.alloc(2000, 1) },
    { file: 'assets/redact_secret_wasm_pii_bg-BBBBBBBB.wasm', bytes: Buffer.alloc(5000, 2) },
  ];
  const { files, totals } = bundleFiles(entries, new Set(['index.html', 'assets/redact_secret_wasm_bg-AAAAAAAA.wasm']));
  assert.deepEqual(files.map(f => [f.file, f.fetched]), [
    ['assets/redact_secret_wasm_bg-<hash>.wasm', true], ['assets/redact_secret_wasm_pii_bg-<hash>.wasm', false], ['index.html', true]]);
  assert.equal(totals.fetched.bytes, 2006);
  assert.equal(totals.emitted.bytes, 7006);
});

test('measure-wasm-sizes measures the pii variants when both are built and refuses only one', async () => {
  const { execFileSync, spawnSync } = await import('node:child_process');
  const { mkdirSync, mkdtempSync, rmSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const core = mkdtempSync(path.join(tmpdir(), 'core-pii-'));
  const git = (...args) => execFileSync('git', ['-C', core, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'core');
  const head = git('rev-parse', 'HEAD');
  const put = (dir, file, text) => { mkdirSync(path.join(core, dir), { recursive: true }); writeFileSync(path.join(core, dir, file), Buffer.from(text.repeat(40))); };
  put('bindings/wasm/pkg', 'redact_secret_wasm_bg.wasm', 'synthetic full ');
  put('bindings/wasm/pkg-common', 'redact_secret_wasm_common_bg.wasm', 'synthetic common ');
  const out = path.join(core, 'out.json');
  const measure = () => spawnSync(process.execPath, ['scripts/measure-wasm-sizes.mjs', '--core', core, '--source-commit', head, '--out', out], { encoding: 'utf8' });
  assert.equal(measure().status, 0);
  assert.equal(readJson(out).piiBuilds, 'absent');
  assert.equal(wasmSizesProblem(readJson(out), head), null);
  put('bindings/wasm/pkg', 'redact_secret_wasm_pii_bg.wasm', 'synthetic full pii ');
  const half = measure();
  assert.notEqual(half.status, 0);
  assert.match(half.stderr, /redact_secret_wasm_common_pii_bg\.wasm is missing while another pii build exists/);
  put('bindings/wasm/pkg-common', 'redact_secret_wasm_common_pii_bg.wasm', 'synthetic common pii ');
  assert.equal(measure().status, 0);
  const evidence = readJson(out);
  assert.equal(evidence.piiBuilds, 'present');
  assert.deepEqual(evidence.artifacts.map(a => a.profile), ['full', 'common', 'full-pii', 'common-pii']);
  assert.equal(wasmSizesProblem(evidence, head), null);
  rmSync(core, { recursive: true, force: true });
});

test('the committed budgets cover every dimension from the committed baseline, and the history and ledger are consistent', () => {
  const committed = readJson('benchmarks/regression-budgets.json');
  const ledger = readJson('benchmarks/accepted-regressions.json');
  for (const dimension of Object.keys(RULES)) assert.ok(committed.triggers.some(t => t.dimension === dimension), dimension);
  assert.deepEqual(committed.rules, RULES);
  assert.deepEqual(ledgerProblems(ledger, new Set(committed.triggers.map(t => t.id))), []);
  assert.deepEqual(historyProblems(committed, file => readFileSync(file, 'utf8'), ledger), []);
  const current = readJson(committed.baselines.at(-1).file);
  for (const trigger of committed.triggers) {
    if (trigger.unit === 'ratio') {
      assert.equal(trigger.baselineValue, 1, trigger.id);
      const source = trigger.id.replace(/\/(processing|initialization)-ratio$/, '/$1-p95').replace(/\/traversal-change$/, '/traversal');
      assert.ok(current.metrics[source], `${trigger.id} derives from ${source}`);
    } else assert.equal(trigger.baselineValue, current.metrics[trigger.id].value, trigger.id);
  }
  // The baseline accepts itself: the frozen measurement is inside every budget.
  const self = evaluateBudgets(committed, current, candidateFromSnapshot(current), ledger);
  assert.equal(self.status, 'accepted');
});

test('the beta.9 RC size tradeoff covers only the exact 93ddf510 candidate and retains its measurement', () => {
  const committed = readJson('benchmarks/regression-budgets.json');
  const ledger = readJson('benchmarks/accepted-regressions.json');
  const current = readJson(committed.baselines.at(-1).file);
  const id = 'size/cli/aarch64-unknown-linux-gnu';
  const metric = structuredClone(current.metrics[id]);
  metric.value = 930_616;
  const measurement = sourceCommit => ({
    sourceCommit,
    sources: ['artifact qualification run 36233877397'],
    metrics: { [id]: metric },
    profiles: { size: {} },
    detection: null,
  });
  const exact = evaluateBudgets(committed, current,
    measurement('93ddf510a31563d58c7d4c202363ef65c4d92d55'), ledger);
  const exactRow = exact.triggers.find(trigger => trigger.id === id);
  assert.equal(exactRow.verdict, 'accepted-tradeoff');
  assert.equal(exactRow.acceptedBy, 'beta9-rc-cli-aarch64-linux-gnu-detector-pack');
  assert.equal(exactRow.baseline, 863_848);
  assert.equal(exactRow.candidate, 930_616);

  const different = evaluateBudgets(committed, current,
    measurement('93ddf510a31563d58c7d4c202363ef65c4d92d56'), ledger);
  assert.equal(different.triggers.find(trigger => trigger.id === id).verdict, 'regression');
});

test('the final beta.9 size tradeoff covers only the exact 09e1d7f8 candidate and retains the byte-identical measurement', () => {
  const committed = readJson('benchmarks/regression-budgets.json');
  const ledger = readJson('benchmarks/accepted-regressions.json');
  const current = readJson(committed.baselines.at(-1).file);
  const id = 'size/cli/aarch64-unknown-linux-gnu';
  const metric = structuredClone(current.metrics[id]);
  metric.value = 930_616;
  const measurement = sourceCommit => ({
    sourceCommit,
    sources: ['artifact qualification run 36243644354'],
    metrics: { [id]: metric },
    profiles: { size: {} },
    detection: null,
  });
  const exact = evaluateBudgets(committed, current,
    measurement('09e1d7f85cd2ada9f387cc5c9beef3b29023d17d'), ledger);
  const exactRow = exact.triggers.find(trigger => trigger.id === id);
  assert.equal(exactRow.verdict, 'accepted-tradeoff');
  assert.equal(exactRow.acceptedBy, 'beta9-final-cli-aarch64-linux-gnu-detector-pack');
  assert.equal(exactRow.baseline, 863_848);
  assert.equal(exactRow.candidate, 930_616);

  const different = evaluateBudgets(committed, current,
    measurement('09e1d7f85cd2ada9f387cc5c9beef3b29023d17e'), ledger);
  assert.equal(different.triggers.find(trigger => trigger.id === id).verdict, 'regression');
});

test('runner-reruns reduces same-pin performance runs and rejects a different pin', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = mkdtempSync(path.join(tmpdir(), 'runner-reruns-'));
  const summary = currentPerformanceFixture();
  const summaryFile = path.join(dir, 'synthetic-summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary));
  const entry = (runId, file) => ({ runId, url: `https://example.invalid/${runId}`, runner: { label: 'ubuntu-latest' },
    artifact: { digest: 'sha256:0' }, completedAt: `2026-09-25T00:0${runId}:00Z`, summary: file });
  const manifest = path.join(dir, 'manifest.json');
  const out = path.join(dir, 'out.json');
  const run = () => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/regression-budgets.mjs', 'runner-reruns', '--runs', manifest, '--out', out], { stdio: 'pipe' });

  writeFileSync(manifest, JSON.stringify({ runs: [entry(1, summaryFile), entry(2, summaryFile)], limitations: [] }));
  run();
  const study = readJson(out);
  assert.equal(study.sourceCommit, summary.sourceCommit);
  assert.equal(study.method.runs, 2);
  assert.equal(study.runs[0].summarySha256, sha256OfText(readFileSync(summaryFile, 'utf8')));
  assert.ok(study.series.length > 0 && study.series.every(s => s.runs.length === 2));
  assert.equal(study.series[0].runs[0].processing.median, study.series[0].runs[1].processing.median);

  const other = path.join(dir, 'other.json');
  writeFileSync(other, JSON.stringify({ ...summary, sourceCommit: COMMIT_B }));
  writeFileSync(manifest, JSON.stringify({ runs: [entry(1, summaryFile), entry(2, other)], limitations: [] }));
  assert.throws(run, /different pinned commit/);
});

test('paired-performance reduces interleaved invocations into one paired evidence file and rejects a wrong revision', async () => {
  const { execFileSync } = await import('node:child_process');
  const { mkdirSync, mkdtempSync, writeFileSync, copyFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const path = await import('node:path');
  const dir = mkdtempSync(path.join(tmpdir(), 'paired-'));
  const summary = currentPerformanceFixture();
  const summaryFile = path.join(dir, 'synthetic-summary.json');
  writeFileSync(summaryFile, JSON.stringify(summary));
  const order = roundOrder(2);
  order.forEach((entry, i) => {
    mkdirSync(path.join(dir, `${i}-${entry.side}`));
    copyFileSync(summaryFile, path.join(dir, `${i}-${entry.side}`, 'summary.json'));
  });
  writeFileSync(path.join(dir, 'invocations.json'), JSON.stringify({ rounds: 2, runsPerInvocation: summary.repetitions,
    invocations: order.map((entry, i) => ({ ...entry, output: `${i}-${entry.side}`, durationMs: 1 })) }));
  writeFileSync(path.join(dir, 'runner.json'), JSON.stringify({ cpuModel: 'Test CPU', logicalCpus: 4 }));
  const out = path.join(dir, 'paired.json');
  const reduce = revision => execFileSync(process.execPath, ['--import', 'tsx', 'scripts/paired-performance.mjs', 'reduce', '--dir', dir,
    '--baseline-revision', summary.sourceCommit, '--candidate-revision', revision, '--runner', path.join(dir, 'runner.json'), '--out', out], { stdio: 'pipe' });
  reduce(summary.sourceCommit);
  const paired = readJson(out);
  assert.equal(paired.aa, true);
  assert.equal(paired.samplesPerSide, 2 * summary.repetitions);
  assert.deepEqual(paired.order, ['baseline', 'candidate', 'candidate', 'baseline']);
  assert.equal(paired.runner.cpuModel, 'Test CPU');
  for (const row of Object.values(paired.rows)) assert.equal(row.ratios.processing.median, 1);
  assert.throws(() => reduce(COMMIT_B), /expected/);
});
