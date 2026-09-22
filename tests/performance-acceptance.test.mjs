import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAcceptance, validateAcceptanceCriteria, renderAcceptanceMarkdown } from '../benchmarks/lib/performance-acceptance.ts';

function criteria(overrides = {}) {
  return {
    schemaVersion: '1', criteriaId: 'test-criteria', fixedAt: '2026-09-22',
    derivation: { repetitions: 5, percentile: 'p95', margin: 'test' },
    baseline: { summaryPath: 'test.json', sourceCommit: 'a'.repeat(40), accuracyCorpusVersion: '3', accuracyCorpusHash: 'b'.repeat(64), workloadProfilesVersion: '1', workloadProfilesHash: 'c'.repeat(64) },
    minimumRepetitions: 5,
    environment: { id: 'test-env', osPrefixes: ['linux-'], cpus: ['x86_64'], runtimePrefixes: { 'rust-core': ['rustc-'], python: ['cpython-'], node: ['node-'], 'browser-wasm': ['chromium-'], cli: ['rustc '] } },
    accuracy: { truePositives: 21, falsePositives: 1, falseNegatives: 5, policyMismatches: 0 },
    performance: [{ surface: 'rust-core', profileId: 'scale-logs-small-whole', maxInitializationP95Ms: 5, maxProcessingP95Ms: 50, minThroughputBytesPerSecond: 1000000, memoryCapsBytes: { processRss: 10000000 } }],
    ...overrides,
  };
}

function memoryMetrics(samples) {
  const empty = { unit: 'bytes', samples: [], samplingLimit: 'n/a' };
  return { nodeHeap: empty, nodeRss: empty, nodeExternal: empty, browserJsHeap: empty, wasmLinearMemory: empty, pythonHeap: empty, streamingBuffer: empty,
    processRss: { unit: 'bytes', samples: samples.map(maximumObservedBytes => ({ baselineBytes: 0, maximumObservedBytes })), samplingLimit: 'n/a' } };
}

function passingSummary() {
  return {
    schemaVersion: '1', status: 'complete', sourceCommit: 'a'.repeat(40),
    accuracyCorpus: { version: '3', hash: 'b'.repeat(64) }, workloadProfiles: { version: '1', hash: 'c'.repeat(64) },
    repetitions: 5, performanceProfiles: [{ id: 'scale-logs-small-whole', chunkProfile: 'whole' }],
    requiredSurfaces: ['rust-core'], validationFailures: [],
    runs: [
      {
        surface: 'rust-core', kind: 'accuracy', profileId: 'accuracy-corpus', resultPath: 'x', markdownPath: 'x', path: 'whole-input', status: 'complete',
        result: { schemaVersion: '3', surface: 'rust-core', profileId: 'accuracy-corpus', accuracy: { truePositives: 21, falsePositives: 1, falseNegatives: 5, policyMismatches: 0 },
          provenance: { commit: 'a'.repeat(40), artifactIdentity: 'x', corpusVersion: '3', corpusHash: 'b'.repeat(64), os: 'linux-6.0', cpu: 'x86_64', runtime: 'rustc-1.0', command: '[]' } },
      },
      {
        surface: 'rust-core', kind: 'performance', profileId: 'scale-logs-small-whole', resultPath: 'x', markdownPath: 'x', path: 'whole-input', status: 'complete',
        result: {
          schemaVersion: '3', surface: 'rust-core', profileId: 'scale-logs-small-whole',
          performance: {
            initialization: { unit: 'milliseconds', samples: [1], minimum: 1, median: 1, p95: 1, maximum: 1, mean: 1, standardDeviation: 0 },
            processing: { unit: 'milliseconds', samples: [20], minimum: 20, median: 20, p95: 20, maximum: 20, mean: 20, standardDeviation: 0 },
            throughput: { unit: 'bytes-per-second', samples: [2000000], minimum: 2000000, median: 2000000, p95: 2000000, maximum: 2000000, mean: 2000000, standardDeviation: 0 },
            memory: memoryMetrics([5000000, 5000000, 5000000, 5000000, 5000000]),
          },
          provenance: { commit: 'a'.repeat(40), artifactIdentity: 'x', corpusVersion: '3', corpusHash: 'b'.repeat(64), os: 'linux-6.0', cpu: 'x86_64', runtime: 'rustc-1.0', command: '[]', buildProfile: 'release' },
        },
      },
    ],
  };
}

test('validateAcceptanceCriteria rejects a non-40-hex source commit', () => {
  assert.throws(() => validateAcceptanceCriteria(criteria({ baseline: { ...criteria().baseline, sourceCommit: 'not-a-sha' } })), /invalid-metadata/);
});

test('validateAcceptanceCriteria rejects duplicate surface:profileId criteria', () => {
  const one = criteria().performance[0];
  assert.throws(() => validateAcceptanceCriteria(criteria({ performance: [one, one] })), /invalid-performance-threshold/);
});

test('evaluateAcceptance accepts a fully passing run', () => {
  const evaluation = evaluateAcceptance(passingSummary(), criteria());
  assert.equal(evaluation.status, 'accepted');
  assert.equal(evaluation.failures.length, 0);
  assert.equal(evaluation.checks.length, 4); // init, processing, throughput, one memory cap
});

test('evaluateAcceptance rejects on a debug rust-core build', () => {
  const summary = passingSummary();
  summary.runs[1].result.provenance.buildProfile = 'debug';
  const evaluation = evaluateAcceptance(summary, criteria());
  assert.equal(evaluation.status, 'rejected');
  assert.ok(evaluation.failures.some(f => f.endsWith(':release-build-required')));
});

test('evaluateAcceptance rejects when a processing threshold is exceeded', () => {
  const summary = passingSummary();
  summary.runs[1].result.performance.processing.p95 = 999;
  const evaluation = evaluateAcceptance(summary, criteria());
  assert.equal(evaluation.status, 'rejected');
  assert.ok(evaluation.failures.some(f => f.includes('processing-p95-ms')));
});

test('evaluateAcceptance rejects on accuracy-corpus identity mismatch', () => {
  const summary = passingSummary();
  summary.accuracyCorpus.hash = 'f'.repeat(64);
  const evaluation = evaluateAcceptance(summary, criteria());
  assert.ok(evaluation.failures.includes('suite:accuracy-corpus-identity-mismatch'));
});

test('evaluateAcceptance rejects when repetitions fall below the criteria minimum', () => {
  const summary = passingSummary();
  summary.repetitions = 2;
  const evaluation = evaluateAcceptance(summary, criteria());
  assert.ok(evaluation.failures.includes('suite:insufficient-repetitions'));
});

test('renderAcceptanceMarkdown states the headline status and every check', () => {
  const evaluation = evaluateAcceptance(passingSummary(), criteria());
  const markdown = renderAcceptanceMarkdown(evaluation);
  assert.match(markdown, /Status: \*\*ACCEPTED\*\*/);
  assert.match(markdown, /rust-core:performance:scale-logs-small-whole:processing-p95-ms/);
});
