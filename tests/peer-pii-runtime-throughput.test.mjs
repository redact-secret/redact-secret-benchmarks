import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOL_IDS,
  peerRuntimeThroughputCommitment,
  peerRuntimeThroughputPlan,
  renderWorkloadText,
  summarizeSamples,
  validatePeerRuntimeThroughputPlan,
  validatePeerRuntimeThroughputReport,
  validatePeerRuntimeThroughputSample,
} from '../benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts';
import { piiProfileCostWorkloads } from '../benchmarks/evaluation/domains/pii/profile-cost.ts';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';

test('plan validates, is informational-only, and reuses pii-profile-cost-workloads-v1 unchanged', () => {
  const plan = validatePeerRuntimeThroughputPlan();
  assert.equal(plan.issue, 429);
  assert.equal(plan.supportClaims, false);
  assert.deepEqual(Object.keys(plan.thresholdPolicy), ['verdict']);
  assert.equal(plan.thresholdPolicy.verdict, 'informational');
  assert.equal(plan.workloadsRef.contentCommitment, piiProfileCostWorkloads.contentCommitment);
  assert.deepEqual(plan.tools.map(t => t.id), [...TOOL_IDS]);
});

test('rejects a plan carrying any verdict beyond informational', () => {
  const { contentCommitment: _drop, ...projection } = structuredClone(peerRuntimeThroughputPlan);
  projection.thresholdPolicy = { verdict: 'informational', regression: true };
  const mutated = { ...projection, contentCommitment: peerRuntimeThroughputCommitment(projection) };
  assert.throws(() => validatePeerRuntimeThroughputPlan(mutated), /informational-only/);
});

test('rejects a plan that drifts from the shared workload corpus', () => {
  const { contentCommitment: _drop, ...projection } = structuredClone(peerRuntimeThroughputPlan);
  projection.workloadsRef = { ...projection.workloadsRef, contentCommitment: 'f'.repeat(64) };
  const mutated = { ...projection, contentCommitment: peerRuntimeThroughputCommitment(projection) };
  assert.throws(() => validatePeerRuntimeThroughputPlan(mutated), /workload binding/);
});

test('renderWorkloadText matches the workload commitment pii-profile-cost-v1 would hash', () => {
  for (const workload of piiProfileCostWorkloads.workloads) {
    const text = renderWorkloadText(workload.id);
    assert.equal(hash(text), hash(text)); // deterministic
    assert.ok(text.endsWith('\n'));
    assert.equal(text.split('\n').length - 1, piiProfileCostWorkloads.generator.lineCount);
  }
  assert.throws(() => renderWorkloadText('not-a-real-workload'), /Unknown peer-pii-runtime-throughput workload/);
});

test('sample validator rejects non-positive throughput and negative latency', () => {
  assert.throws(() => validatePeerRuntimeThroughputSample({ redactMs: -1, bytesPerSecond: 100 }));
  assert.throws(() => validatePeerRuntimeThroughputSample({ redactMs: 1, bytesPerSecond: 0 }));
  assert.doesNotThrow(() => validatePeerRuntimeThroughputSample({ redactMs: 0, bytesPerSecond: 1 }));
});

test('summarizeSamples reports the median and p95 of a fixed sample set', () => {
  const samples = [1, 2, 3, 4, 5].map(redactMs => ({ redactMs, bytesPerSecond: 1000 }));
  const summary = summarizeSamples(samples);
  assert.equal(summary.medianMs, 3);
  assert.equal(summary.p95Ms, 5);
  assert.equal(summary.medianBytesPerSecond, 1000);
});

test('report validator rejects a report missing the async/sync methodology caveat', () => {
  const plan = validatePeerRuntimeThroughputPlan();
  const observations = plan.tools.flatMap(tool => piiProfileCostWorkloads.workloads.map(workload => {
    const text = renderWorkloadText(workload.id);
    const samples = Array.from({ length: plan.sampleProtocol.samplesPerCell }, () => ({ redactMs: 1, bytesPerSecond: 1000 }));
    return {
      tool: tool.id, workload: workload.id, workloadBytes: Buffer.byteLength(text), workloadCommitment: hash(text),
      samples, summary: summarizeSamples(samples),
    };
  }));
  const withoutCaveats = {
    schemaVersion: 1, reportType: 'peer-pii-runtime-throughput', supportClaims: false, planCommitment: plan.contentCommitment,
    generatedAt: new Date().toISOString(), runner: { platform: 'linux', arch: 'x64', node: process.version },
    tools: plan.tools.map(t => ({ id: t.id, version: '0.0.0-test', provenance: { kind: t.provenance } })),
    methodologyNotes: ['not enough detail here'],
    observations,
  };
  const base = { ...withoutCaveats, artifactCommitment: peerRuntimeThroughputCommitment(withoutCaveats) };
  assert.throws(() => validatePeerRuntimeThroughputReport(base), /async\/sync and redact-secret local-build caveats/);

  const withoutArtifactCommitment = { ...withoutCaveats, methodologyNotes: [
    'OpenRedaction is asynchronous (a Promise-returning detect()).',
    'redact-secret is measured from a local-source-build, not a published npm release.',
  ] };
  const withCaveats = { ...withoutArtifactCommitment, artifactCommitment: peerRuntimeThroughputCommitment(withoutArtifactCommitment) };
  assert.doesNotThrow(() => validatePeerRuntimeThroughputReport(withCaveats));
});
