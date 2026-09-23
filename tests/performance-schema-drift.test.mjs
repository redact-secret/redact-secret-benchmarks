import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCoreSchemaDrift } from '../benchmarks/lib/performance-schema-drift.ts';

const COMPLETE_SOURCE = `
export const COMPLETE_ASSESSMENT_SCHEMA_VERSION = "1";
export const REQUIRED_ASSESSMENT_SURFACES = [
  "rust-core",
  "python",
  "node",
  "browser-wasm",
  "cli",
] as const satisfies readonly AssessmentSurface[];
`;

const SCHEMA_SOURCE = `
export interface AssessmentProvenance {
  readonly commit: string;
  readonly artifactIdentity: string;
  readonly corpusVersion: string;
  readonly corpusHash: string;
  readonly os: string;
  readonly cpu: string;
  readonly runtime: string;
  readonly command: string;
  readonly buildProfile?: "debug" | "release";
}

export interface AssessmentDistribution {
  readonly unit: "milliseconds" | "bytes-per-second";
  readonly samples: readonly number[];
  readonly minimum: number;
  readonly median: number;
  readonly p95: number;
  readonly maximum: number;
  readonly mean: number;
  readonly standardDeviation: number;
}

export interface AssessmentMemorySample {
  readonly baselineBytes: number;
  readonly maximumObservedBytes: number;
}

export interface AssessmentMemoryMetric {
  readonly unit: "bytes";
  readonly samples: readonly AssessmentMemorySample[];
  readonly unavailableReason?: string;
  readonly samplingLimit: string;
}

export interface AssessmentMemoryMetrics {
  readonly nodeHeap: AssessmentMemoryMetric;
  readonly nodeRss: AssessmentMemoryMetric;
  readonly nodeExternal: AssessmentMemoryMetric;
  readonly browserJsHeap: AssessmentMemoryMetric;
  readonly wasmLinearMemory: AssessmentMemoryMetric;
  readonly pythonHeap: AssessmentMemoryMetric;
  readonly processRss: AssessmentMemoryMetric;
  readonly streamingBuffer: AssessmentMemoryMetric;
}
`;

test('checkCoreSchemaDrift passes against source that matches the pinned contract', () => {
  assert.deepEqual(checkCoreSchemaDrift(COMPLETE_SOURCE, SCHEMA_SOURCE), []);
});

test('checkCoreSchemaDrift flags a bumped schema version', () => {
  const drifted = COMPLETE_SOURCE.replace('COMPLETE_ASSESSMENT_SCHEMA_VERSION = "1"', 'COMPLETE_ASSESSMENT_SCHEMA_VERSION = "2"');
  const failures = checkCoreSchemaDrift(drifted, SCHEMA_SOURCE);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /COMPLETE_ASSESSMENT_SCHEMA_VERSION/);
});

test('checkCoreSchemaDrift flags a required surface being added', () => {
  const drifted = COMPLETE_SOURCE.replace('"cli",', '"cli",\n  "go",');
  const failures = checkCoreSchemaDrift(drifted, SCHEMA_SOURCE);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /REQUIRED_ASSESSMENT_SURFACES/);
});

test('checkCoreSchemaDrift flags a renamed field on a pinned interface', () => {
  const drifted = SCHEMA_SOURCE.replace('readonly p95: number;', 'readonly p95Latency: number;');
  const failures = checkCoreSchemaDrift(COMPLETE_SOURCE, drifted);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /AssessmentDistribution/);
});

test('checkCoreSchemaDrift flags a removed memory category', () => {
  const drifted = SCHEMA_SOURCE.replace('  readonly streamingBuffer: AssessmentMemoryMetric;\n', '');
  const failures = checkCoreSchemaDrift(COMPLETE_SOURCE, drifted);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /AssessmentMemoryMetrics/);
});

test('checkCoreSchemaDrift flags a missing interface as structural drift', () => {
  const drifted = SCHEMA_SOURCE.replace(/AssessmentProvenance/g, 'AssessmentSourceInfo');
  const failures = checkCoreSchemaDrift(COMPLETE_SOURCE, drifted);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /could not find interface AssessmentProvenance/);
});

test('checkCoreSchemaDrift flags a missing schema-version constant as structural drift', () => {
  const drifted = COMPLETE_SOURCE.replace('COMPLETE_ASSESSMENT_SCHEMA_VERSION', 'ASSESSMENT_SCHEMA_VERSION');
  const failures = checkCoreSchemaDrift(drifted, SCHEMA_SOURCE);
  assert.equal(failures.length, 1);
  assert.match(failures[0], /could not find COMPLETE_ASSESSMENT_SCHEMA_VERSION/);
});
