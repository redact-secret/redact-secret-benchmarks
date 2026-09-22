import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveProcessingCeilingMs, deriveThroughputFloorBytesPerSecond, deriveMemoryCapBytes, deriveCriteria,
} from '../benchmarks/lib/performance-derivation.ts';

test('processing/initialization ceiling: whole ms below 10', () => {
  assert.equal(deriveProcessingCeilingMs(0.019126), 1); // 2x = 0.038..., ceil -> 1
  assert.equal(deriveProcessingCeilingMs(2.4), 5); // 2x = 4.8, ceil -> 5
});

test('processing/initialization ceiling: nearest 5 in [10, 100)', () => {
  assert.equal(deriveProcessingCeilingMs(17.5), 35); // 2x = 35 exactly
  assert.equal(deriveProcessingCeilingMs(13), 30); // 2x = 26, ceil to nearest 5 -> 30
});

test('processing/initialization ceiling: nearest 50 in [100, 1000)', () => {
  assert.equal(deriveProcessingCeilingMs(150), 300); // 2x = 300 exactly
  assert.equal(deriveProcessingCeilingMs(151), 350); // 2x = 302, ceil to nearest 50 -> 350
});

test('processing/initialization ceiling: nearest 100 at or above 1000', () => {
  assert.equal(deriveProcessingCeilingMs(650), 1300); // 2x = 1300 exactly
  assert.equal(deriveProcessingCeilingMs(651), 1400); // 2x = 1302, ceil to nearest 100 -> 1400
});

test('throughput floor: nearest 10,000 below 1,000,000', () => {
  assert.equal(deriveThroughputFloorBytesPerSecond(360000), 180000); // half = 180000 exactly
  assert.equal(deriveThroughputFloorBytesPerSecond(365000), 180000); // half = 182500, floor -> 180000
});

test('throughput floor: nearest 100,000 at or above 1,000,000', () => {
  assert.equal(deriveThroughputFloorBytesPerSecond(3200000), 1600000); // half = 1600000 exactly
  assert.equal(deriveThroughputFloorBytesPerSecond(3250000), 1600000); // half = 1625000, floor -> 1600000
});

test('memory cap: 2.5x rounded up to the nearest mebibyte', () => {
  const MIB = 1024 * 1024;
  assert.equal(deriveMemoryCapBytes(4 * MIB), 10 * MIB); // 2.5x = 10 MiB exactly
  assert.equal(deriveMemoryCapBytes(4.1 * MIB), 11 * MIB); // 2.5x = 10.25 MiB, ceil -> 11 MiB
});

function distribution(p95, minimum, maximum, samples) {
  return { unit: 'milliseconds', samples, minimum, median: (minimum + maximum) / 2, p95, maximum, mean: (minimum + maximum) / 2, standardDeviation: 0 };
}
function memoryMetric(maxBytes, count = 5) {
  return { unit: 'bytes', samples: Array.from({ length: count }, () => ({ baselineBytes: 0, maximumObservedBytes: maxBytes })), samplingLimit: 'test fixture' };
}
const EMPTY_MEMORY = { unit: 'bytes', samples: [], samplingLimit: 'unavailable in this fixture' };
function memoryMetrics(overrides = {}) {
  return {
    nodeHeap: EMPTY_MEMORY, nodeRss: EMPTY_MEMORY, nodeExternal: EMPTY_MEMORY, browserJsHeap: EMPTY_MEMORY,
    wasmLinearMemory: EMPTY_MEMORY, pythonHeap: EMPTY_MEMORY, processRss: EMPTY_MEMORY, streamingBuffer: EMPTY_MEMORY,
    ...overrides,
  };
}

function performanceResult(surface, profileId, { buildProfile } = {}) {
  return {
    surface, kind: 'performance', profileId, resultPath: `${surface}/${profileId}.json`, markdownPath: `${surface}/${profileId}.md`,
    path: 'whole-input', status: 'complete',
    result: {
      schemaVersion: '3', surface, profileId,
      performance: {
        initialization: distribution(0.02, 0.006, 0.03, [0.006, 0.02]),
        processing: distribution(30, 20, 40, [20, 30]),
        throughput: distribution(2000000, 1800000, 2200000, [1800000, 2000000]),
        memory: memoryMetrics({ processRss: memoryMetric(9 * 1024 * 1024) }),
      },
      provenance: {
        commit: 'a'.repeat(40), artifactIdentity: 'redact-secret@0.1.0-test', corpusVersion: '3', corpusHash: 'b'.repeat(64),
        os: 'linux-6.0', cpu: 'x86_64', runtime: 'rustc-1.98.0', command: '[]',
        ...(surface === 'rust-core' ? { buildProfile: buildProfile ?? 'release' } : {}),
      },
    },
  };
}

function accuracyResult(surface) {
  return {
    surface, kind: 'accuracy', profileId: 'accuracy-corpus', resultPath: `${surface}/accuracy-corpus.json`, markdownPath: `${surface}/accuracy-corpus.md`,
    path: 'whole-input', status: 'complete',
    result: {
      schemaVersion: '3', surface, profileId: 'accuracy-corpus',
      accuracy: { truePositives: 21, falsePositives: 1, falseNegatives: 5, policyMismatches: 0 },
      provenance: {
        commit: 'a'.repeat(40), artifactIdentity: 'redact-secret@0.1.0-test', corpusVersion: '3', corpusHash: 'b'.repeat(64),
        os: 'linux-6.0', cpu: 'x86_64', runtime: 'rustc-1.98.0', command: '[]',
      },
    },
  };
}

function summaryOf(runs, overrides = {}) {
  return {
    schemaVersion: '1', status: 'complete', sourceCommit: 'a'.repeat(40),
    accuracyCorpus: { version: '3', hash: 'b'.repeat(64) }, workloadProfiles: { version: '1', hash: 'c'.repeat(64) },
    repetitions: 5, performanceProfiles: [{ id: 'scale-logs-small-whole', chunkProfile: 'whole' }],
    requiredSurfaces: ['rust-core'], runs, validationFailures: [],
    ...overrides,
  };
}

const options = { criteriaId: 'test-criteria', fixedAt: '2026-09-22', summaryPath: 'test/summary.json',
  environment: { id: 'test-env', osPrefixes: ['linux-'], cpus: ['x86_64'], runtimePrefixes: { 'rust-core': ['rustc-'], python: [], node: [], 'browser-wasm': [], cli: [] } } };

test('deriveCriteria produces one criterion per complete performance run, by construction acceptable', async () => {
  const { evaluateAcceptance } = await import('../benchmarks/lib/performance-acceptance.ts');
  const summary = summaryOf([accuracyResult('rust-core'), performanceResult('rust-core', 'scale-logs-small-whole')]);
  const criteria = deriveCriteria(summary, options);
  assert.equal(criteria.performance.length, 1);
  assert.equal(criteria.performance[0].surface, 'rust-core');
  assert.equal(criteria.accuracy.truePositives, 21);
  const evaluation = evaluateAcceptance(summary, criteria);
  assert.equal(evaluation.status, 'accepted');
});

test('deriveCriteria rejects a summary with fewer than 5 repetitions', () => {
  const summary = summaryOf([accuracyResult('rust-core'), performanceResult('rust-core', 'scale-logs-small-whole')], { repetitions: 3 });
  assert.throws(() => deriveCriteria(summary, options), /insufficient-repetitions/);
});

test('deriveCriteria rejects a debug-build rust-core performance run', () => {
  const summary = summaryOf([accuracyResult('rust-core'), performanceResult('rust-core', 'scale-logs-small-whole', { buildProfile: 'debug' })]);
  assert.throws(() => deriveCriteria(summary, options), /release-build-required/);
});

test('deriveCriteria rejects surfaces that disagree on accuracy counts', () => {
  const disagreeing = { ...accuracyResult('python'), result: { ...accuracyResult('python').result, accuracy: { truePositives: 1, falsePositives: 0, falseNegatives: 0, policyMismatches: 0 } } };
  const summary = summaryOf([accuracyResult('rust-core'), disagreeing, performanceResult('rust-core', 'scale-logs-small-whole')]);
  assert.throws(() => deriveCriteria(summary, options), /accuracy-disagreement/);
});

test('deriveCriteria is indifferent to accuracy object key order across surfaces', () => {
  const reordered = accuracyResult('python');
  reordered.result = {
    ...reordered.result,
    accuracy: { policyMismatches: 0, truePositives: 21, falseNegatives: 5, falsePositives: 1 },
  };
  const summary = summaryOf([accuracyResult('rust-core'), reordered, performanceResult('rust-core', 'scale-logs-small-whole')]);
  assert.doesNotThrow(() => deriveCriteria(summary, options));
});
