import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import { buildSupportMatrixDrift } from '../benchmarks/support/drift.ts';

const driftSchema = JSON.parse(await readFile(new URL('../schemas/support-matrix-drift-v1.json', import.meta.url), 'utf8'));
const ajv = new Ajv({ strict: true });
const validDrift = ajv.compile(driftSchema);

const providerSource = (overrides = {}) => ({ url: 'https://docs.example.invalid/tokens', observedAt: '2026-09-01', formatVersion: '2026-09', covers: 'prefix and body', ...overrides });

/** One `support-matrix.json` family entry, defaulted to a detector-backed stable family. */
function entry(overrides = {}) {
  return {
    provider: 'example', family: 'example:token', familyName: 'Example token', status: 'stable',
    evidenceTier: 'T1', providerSource: providerSource(), corroboratingScanners: ['gitleaks 8.30.1'],
    twinCoverage: { pairs: 5, failures: 0, unprobeable: null },
    unresolvedCriticalItems: { metamorphic: 0, mutation: 0, differential: 0 },
    detectors: ['example-token'], reason: null,
    ...overrides,
  };
}

/** A full `support-matrix.json`-shaped file wrapping the given families. */
function matrixOf(families, overrides = {}) {
  const distribution = { stable: 0, provisional: 0, pending: 0, unsupported: 0 };
  for (const f of families) distribution[f.status]++;
  return {
    schemaVersion: 1, taxonomySchemaVersion: 1,
    sourceReport: { schemaVersion: 1, generatedAt: '2026-09-20T00:00:00.000Z', runId: 'run-a', revision: 'a'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
      scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-09-20T00:00:00.000Z', sourceRunId: 'run-a' } } },
    providerCount: 1, familyCount: families.length, distribution, families,
    ...overrides,
  };
}

test('an unchanged family produces no drift entries', () => {
  const baseline = matrixOf([entry()]);
  const candidate = matrixOf([entry()], { sourceReport: { ...baseline.sourceReport, runId: 'run-b' } });
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.deepEqual(drift.summary, { regressions: 0, improvements: 0, newAndUnclassified: 0, staleProviderProvenance: 0 });
  assert.deepEqual(drift.regressions, []);
  assert.deepEqual(drift.improvements, []);
  assert.deepEqual(drift.newAndUnclassified, []);
  assert.deepEqual(drift.staleProviderProvenance, []);
});

test('a family leaving stable is reported as a regression carrying its new reason', () => {
  const baseline = matrixOf([entry({ status: 'stable', reason: null })]);
  const candidate = matrixOf([entry({ status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' })]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.equal(drift.summary.regressions, 1);
  assert.deepEqual(drift.regressions, [{
    provider: 'example', family: 'example:token', familyName: 'Example token',
    baselineStatus: 'stable', candidateStatus: 'provisional', reason: 'minimumTwinPairs: 2 < 5',
  }]);
  assert.deepEqual(drift.improvements, []);
  assert.deepEqual(drift.staleProviderProvenance, []);
});

test('a family reaching stable is reported as an improvement carrying the evidence that earned it', () => {
  const baseline = matrixOf([entry({ status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' })]);
  const candidateEntry = entry({ status: 'stable', reason: null, twinCoverage: { pairs: 6, failures: 0, unprobeable: null } });
  const candidate = matrixOf([candidateEntry]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.equal(drift.summary.improvements, 1);
  assert.deepEqual(drift.improvements, [{
    provider: 'example', family: 'example:token', familyName: 'Example token',
    baselineStatus: 'provisional', candidateStatus: 'stable',
    evidence: {
      evidenceTier: candidateEntry.evidenceTier, providerSource: candidateEntry.providerSource,
      corroboratingScanners: candidateEntry.corroboratingScanners, twinCoverage: candidateEntry.twinCoverage,
      unresolvedCriticalItems: candidateEntry.unresolvedCriticalItems, detectors: candidateEntry.detectors,
    },
  }]);
  assert.deepEqual(drift.regressions, []);
});

test('a family absent from the baseline is reported as new and unclassified, never guessed at', () => {
  const baseline = matrixOf([]);
  const candidate = matrixOf([entry({ status: 'pending', reason: 'awaiting evidence' })]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.equal(drift.summary.newAndUnclassified, 1);
  assert.deepEqual(drift.newAndUnclassified, [{ provider: 'example', family: 'example:token', familyName: 'Example token', status: 'pending' }]);
  assert.deepEqual(drift.regressions, []);
  assert.deepEqual(drift.improvements, []);
});

test('a family holding its status while its provider source changes is a stale-provenance warning', () => {
  const baseline = matrixOf([entry({ status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' })]);
  const movedSource = providerSource({ formatVersion: '2026-10', observedAt: '2026-10-01' });
  const candidate = matrixOf([entry({ status: 'provisional', reason: 'minimumTwinPairs: 2 < 5', providerSource: movedSource })]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.equal(drift.summary.staleProviderProvenance, 1);
  assert.deepEqual(drift.staleProviderProvenance, [{
    provider: 'example', family: 'example:token', familyName: 'Example token',
    baselineStatus: 'provisional', candidateStatus: 'provisional',
    baselineProviderSource: providerSource(), candidateProviderSource: movedSource,
  }]);
  assert.deepEqual(drift.regressions, []);
  assert.deepEqual(drift.improvements, []);
});

test('a status change between two non-stable statuses is neither a regression nor an improvement', () => {
  const baseline = matrixOf([entry({ status: 'pending', reason: 'awaiting evidence' })]);
  const candidate = matrixOf([entry({ status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' })]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.deepEqual(drift.regressions, []);
  assert.deepEqual(drift.improvements, []);
  assert.deepEqual(drift.staleProviderProvenance, []);
});

test('two detectorless families with no provider source at all are never flagged as stale provenance', () => {
  const detectorless = { status: 'unsupported', evidenceTier: null, providerSource: null, corroboratingScanners: [], twinCoverage: null, unresolvedCriticalItems: null, detectors: [], reason: 'no detector exists' };
  const baseline = matrixOf([entry(detectorless)]);
  const candidate = matrixOf([entry(detectorless)]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.deepEqual(drift.staleProviderProvenance, []);
});

test('summary counts always match each array length', () => {
  const baseline = matrixOf([
    entry({ family: 'a', status: 'stable', reason: null }),
    entry({ family: 'b', status: 'pending', reason: 'awaiting evidence' }),
  ]);
  const candidate = matrixOf([
    entry({ family: 'a', status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' }),
    entry({ family: 'b', status: 'stable', reason: null }),
    entry({ family: 'c', status: 'unsupported', reason: 'no detector exists', evidenceTier: null, providerSource: null, corroboratingScanners: [], twinCoverage: null, unresolvedCriticalItems: null, detectors: [] }),
  ]);
  const drift = buildSupportMatrixDrift(baseline, candidate);
  assert.equal(drift.summary.regressions, drift.regressions.length);
  assert.equal(drift.summary.improvements, drift.improvements.length);
  assert.equal(drift.summary.newAndUnclassified, drift.newAndUnclassified.length);
  assert.equal(drift.summary.staleProviderProvenance, drift.staleProviderProvenance.length);
  assert.equal(drift.summary.regressions, 1);
  assert.equal(drift.summary.improvements, 1);
  assert.equal(drift.summary.newAndUnclassified, 1);
});

test('throws rather than defaulting when a family leaves stable with no reason recorded', () => {
  const baseline = matrixOf([entry({ status: 'stable', reason: null })]);
  const candidate = matrixOf([entry({ status: 'provisional', reason: null })]);
  assert.throws(() => buildSupportMatrixDrift(baseline, candidate), /left stable with no reason recorded/);
});

test('a computed drift, wrapped exactly as the CLI writes it, satisfies its own schema', () => {
  const baseline = matrixOf([
    entry({ family: 'a', status: 'stable', reason: null }),
    entry({ family: 'b', status: 'pending', reason: 'awaiting evidence' }),
  ]);
  const candidate = matrixOf([
    entry({ family: 'a', status: 'provisional', reason: 'minimumTwinPairs: 2 < 5' }),
    entry({ family: 'b', status: 'stable', reason: null }),
    entry({ family: 'c', status: 'unsupported', reason: 'no detector exists', evidenceTier: null, providerSource: null, corroboratingScanners: [], twinCoverage: null, unresolvedCriticalItems: null, detectors: [] }),
  ], { sourceReport: { schemaVersion: 1, generatedAt: '2026-09-21T00:00:00.000Z', runId: 'run-b', revision: 'b'.repeat(40), dirty: false, criteriaSchemaVersion: 1,
    scannerObservations: { 'redact-secret': { source: 'fresh', observedAt: '2026-09-21T00:00:00.000Z', sourceRunId: 'run-b' } } } });
  const drift = buildSupportMatrixDrift(baseline, candidate);
  const output = {
    schemaVersion: 1, generatedAt: '2026-09-21T00:00:01.000Z', taxonomySchemaVersion: candidate.taxonomySchemaVersion, familyCount: candidate.familyCount,
    baseline: { generatedAt: baseline.sourceReport.generatedAt, runId: baseline.sourceReport.runId, revision: baseline.sourceReport.revision },
    candidate: { generatedAt: candidate.sourceReport.generatedAt, runId: candidate.sourceReport.runId, revision: candidate.sourceReport.revision },
    ...drift,
  };
  assert.ok(validDrift(output), JSON.stringify(validDrift.errors));
});
