import { currentPerformanceInputs } from '../../benchmarks/lib/current-performance-inputs.mjs';

// Fresh intake tests need a complete producer shape, not archived historical payloads.
export function currentPerformanceFixture() {
  const summary = structuredClone(currentPerformanceInputs().baseline);
  Object.assign(summary, { schemaVersion: '1', performanceProfiles: [], requiredSurfaces: ['rust-core','python','node','browser-wasm','cli'], validationFailures: [] });
  const distribution = (value, unit) => ({ unit, samples: Array(summary.repetitions).fill(value), minimum: value, median: value, p95: value, maximum: value, mean: value, standardDeviation: 0 });
  for (const run of summary.runs) {
    Object.assign(run, { resultPath: 'synthetic-result.json', markdownPath: 'synthetic-result.md' });
    if (!run.result) continue;
    Object.assign(run.result, { schemaVersion: '1', surface: run.surface, profileId: run.profileId });
    Object.assign(run.result.provenance, { artifactIdentity: 'synthetic', runtime: 'node-22-synthetic', commit: summary.sourceCommit, corpusVersion: 'synthetic', corpusHash: 'synthetic', os: 'linux-synthetic', cpu: 'x64', command: 'synthetic intake probe' });
    const p = run.result.performance;
    if (!p) continue;
    p.initialization = distribution(p.initialization.p95, 'milliseconds');
    p.processing = { ...distribution(p.processing.p95, 'milliseconds'), ...p.processing };
    p.throughput = { ...distribution(p.throughput.minimum, 'bytes-per-second'), ...p.throughput };
    for (const metric of Object.values(p.memory)) Object.assign(metric, { unit: 'bytes', samplingLimit: 'synthetic intake probe', samples: metric.samples.length ? Array.from({ length: summary.repetitions }, () => ({ baselineBytes: 0, maximumObservedBytes: metric.samples[0].maximumObservedBytes })) : [] });
  }
  return summary;
}
