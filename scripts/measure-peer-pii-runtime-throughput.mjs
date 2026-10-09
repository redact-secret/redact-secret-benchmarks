// #429: measures redact-secret / flare-redact / OpenRedaction runtime
// PII-redaction latency and throughput on the same synthetic workloads and
// writes an informational-only report. See
// docs/specs/peer-pii-runtime-throughput.md and
// docs/decisions/2026-09-28-add-peer-runtime-pii-redaction-throughput.md.
//
// Usage: node --import tsx scripts/measure-peer-pii-runtime-throughput.mjs
//   [--redact-secret-addon=<path-to-built-.node-file>] [--out=<path>]
// Reproducible run (#513): scripts/run-peer-pii-runtime-throughput-docker.sh, which supplies the
// REDACT_SECRET_REF / IMAGE_DIGEST / CPU_LIMIT / EMULATED environment this script requires.
import { performance } from 'node:perf_hooks';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadAdapters } from './peer-pii-runtime-throughput/adapters.mjs';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import {
  TOOL_IDS,
  peerRuntimeThroughputPlan,
  renderWorkloadText,
  snapshotWriteRefusal,
  summarizeSamples,
  validatePeerRuntimeThroughputReport,
} from '../benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts';

import { measurementOutput, writeMeasurement } from './lib/measurement-output.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(redact-secret-addon|out)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unrecognized argument: ${argument}`);
  args[match[1]] = match[2];
}

const outPath = measurementOutput(path.resolve(root, args.out ?? `results-output/peer-pii-runtime-throughput/${Date.now()}/report.json`), root);
const need = name => process.env[name] || (() => { throw new Error(`${name} is not set: run this through scripts/run-peer-pii-runtime-throughput-docker.sh (#513)`); })();
const pinRef = JSON.parse(await readFile(path.join(root, 'benchmarks/pin-manifest.json'), 'utf8')).pins.redactSecretRevision;
const productRef = need('REDACT_SECRET_REF');
const imageDigest = need('IMAGE_DIGEST');
const cpuLimit = Number(need('CPU_LIMIT'));
const emulated = need('EMULATED') === 'true';
// Fail before measuring, not after: a refused snapshot must not cost a full run.
const refusal = snapshotWriteRefusal({ ref: productRef, pinRef, emulated, outPath, root });
if (refusal) throw new Error(refusal);
if (emulated) console.warn('WARNING: emulated run; timings are a smoke check only and must not be committed.');

const plan = peerRuntimeThroughputPlan;
const { piiProfileCostWorkloads } = await import('../benchmarks/evaluation/domains/pii/profile-cost.ts');

async function timeCall(adapter, text) {
  const start = performance.now();
  const result = adapter.async ? await adapter.redact(text) : adapter.redact(text);
  const elapsed = performance.now() - start;
  if (typeof result !== 'string') throw new Error(`${adapter.id}: redact() did not return a string`);
  return elapsed;
}

console.log('Loading adapters...');
const adapters = await loadAdapters({ redactSecretAddonPath: args['redact-secret-addon'] });
for (const id of TOOL_IDS) console.log(`  ${id}: ${adapters[id].version} (${adapters[id].provenance.kind})`);

const observations = [];
for (const workload of piiProfileCostWorkloads.workloads) {
  const text = renderWorkloadText(workload.id);
  const bytes = Buffer.byteLength(text);
  console.log(`Workload ${workload.id} (${bytes} bytes)`);
  for (const toolId of TOOL_IDS) {
    for (let i = 0; i < plan.sampleProtocol.warmupSamples; i++) await timeCall(adapters[toolId], text);
  }
  const samplesByTool = Object.fromEntries(TOOL_IDS.map(id => [id, []]));
  for (let round = 0; round < plan.sampleProtocol.samplesPerCell; round++) {
    for (const toolId of TOOL_IDS) {
      const ms = await timeCall(adapters[toolId], text);
      samplesByTool[toolId].push({ redactMs: Math.round(ms * 1000) / 1000, bytesPerSecond: ms === 0 ? Number.MAX_VALUE : Math.round(bytes * 1000 / ms) });
    }
  }
  for (const toolId of TOOL_IDS) {
    console.log(`  ${toolId}: median ${summarizeSamples(samplesByTool[toolId]).medianMs.toFixed(3)}ms`);
    observations.push({
      tool: toolId, workload: workload.id, workloadBytes: bytes, workloadCommitment: hash(text),
      samples: samplesByTool[toolId], summary: summarizeSamples(samplesByTool[toolId]),
    });
  }
}

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
const commitment = value => hash(JSON.stringify(canonical(value)));

const withoutArtifactCommitment = ({ artifactCommitment: _artifactCommitment, ...rest }) => rest;
const report = withoutArtifactCommitment({
  schemaVersion: 2,
  reportType: 'peer-pii-runtime-throughput',
  supportClaims: false,
  planCommitment: plan.contentCommitment,
  generatedAt: new Date().toISOString(),
  runner: { platform: process.platform, arch: process.arch, node: process.version, cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuLimit, emulated, imageDigest },
  tools: TOOL_IDS.map(id => ({ id, version: adapters[id].version,
    provenance: id === 'redact-secret' ? { ...adapters[id].provenance, commit: productRef } : adapters[id].provenance })),
  methodologyNotes: [
    'Informational only: no pass/fail verdict, no ranking assertion (this repository measures and records; see AGENTS.md Boundary rule).',
    "OpenRedaction's detect() is Promise-returning (asynchronous); flare-redact's redact() and redact-secret's scanAndRedact() are synchronous. Each is timed with performance.now() around the actual call, awaited where applicable, so the OpenRedaction figures include at least one Node event-loop microtask tick that the other two tools' figures do not.",
    "redact-secret is measured from a local-source-build native addon (main branch, PII pii:global selector active), not the published @redact-secret/core npm package: PII selection is not in any published release yet as of this plan. flare-redact and OpenRedaction are measured from their published npm packages at their package defaults.",
    'Workloads are qualification/pii-profile-cost-workloads-v1.json, unchanged, reused from pii-profile-cost-v1 (#286) for a shared, already safety-reviewed input; these numbers are independently measured in this run, not imported from that plan\'s frozen results.',
  ],
  observations,
});
report.artifactCommitment = commitment(report);

validatePeerRuntimeThroughputReport(report);

writeMeasurement(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
