// #562 / #563: measures what each runtime library (and one redact-secret setting) does to each value of
// qualification/runtime-comparison-v2.json, and how long one call takes, on its three PII and three credential
// workloads. One process measures one setting; scripts/run-runtime-comparison-docker.sh runs all three.
//
// Usage: node --import tsx scripts/measure-runtime-comparison.mjs --setting=<default|pii-global|pii-global-us> --out=<path>
//   [--redact-secret-addon=<path>]
// The environment comes from the Docker runner, as for #429: REDACT_SECRET_REF, IMAGE_DIGEST, CPU_LIMIT, EMULATED.
import { performance } from 'node:perf_hooks';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadAdapters } from './runtime-comparison/adapters.mjs';
import { hash } from '../benchmarks/evaluation/substrate/hash.ts';
import {
  SETTING_IDS, describeLineOutcome, renderLine, renderRuntimeComparisonWorkload, runtimeComparisonCommitment,
  runtimeComparisonPlan as plan, runtimeComparisonWriteRefusal, summarizeSamples, validateRuntimeComparisonReport,
} from '../benchmarks/evaluation/domains/pii/runtime-comparison.ts';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = {};
for (const argument of process.argv.slice(2)) {
  const match = /^--(setting|out|redact-secret-addon)=(.+)$/.exec(argument);
  if (!match) throw new Error(`Unrecognized argument: ${argument}`);
  args[match[1]] = match[2];
}
if (!SETTING_IDS.includes(args.setting)) throw new Error(`--setting must be one of ${SETTING_IDS.join(', ')}`);
const setting = plan.settings.find(s => s.id === args.setting);
if (!args.out) throw new Error('--out=<path> is required');

const need = name => process.env[name] || (() => { throw new Error(`${name} is not set: run this through scripts/run-runtime-comparison-docker.sh`); })();
const pinRef = JSON.parse(await readFile(path.join(root, 'benchmarks/pin-manifest.json'), 'utf8')).pins.redactSecretRevision;
const productRef = need('REDACT_SECRET_REF');
const imageDigest = need('IMAGE_DIGEST');
const cpuLimit = Number(need('CPU_LIMIT'));
const emulated = need('EMULATED') === 'true';
const outPath = path.resolve(args.out);
const refusal = runtimeComparisonWriteRefusal({ ref: productRef, pinRef, emulated, outPath, root });
if (refusal) throw new Error(refusal);
if (emulated) console.warn('WARNING: emulated run; timings are a smoke check only and must not be committed.');

async function timeCall(adapter, text) {
  const start = performance.now();
  const result = adapter.async ? await adapter.redact(text) : adapter.redact(text);
  const elapsed = performance.now() - start;
  if (typeof result !== 'string') throw new Error(`${adapter.id}: redact() did not return a string`);
  return elapsed;
}

const TOOL_IDS = plan.tools.map(t => t.id);
console.log(`Setting ${setting.id} (${setting.selectors.join(', ') || 'no PII'})`);
const adapters = await loadAdapters({ selectors: setting.selectors, redactSecretAddonPath: args['redact-secret-addon'] });
for (const id of TOOL_IDS) console.log(`  ${id}: ${adapters[id].version} (${adapters[id].provenance.kind})`);
const activation = adapters['redact-secret'].provenance.piiActivation;
const families = /(?:^|;)families=([^;]*)/.exec(activation)?.[1].split(',').filter(Boolean) ?? [];

const observations = [];
const outcomes = [];
for (const workload of plan.workloads) {
  const text = renderRuntimeComparisonWorkload(workload.id);
  const bytes = Buffer.byteLength(text);
  console.log(`Workload ${workload.id} (${bytes} bytes)`);
  for (const toolId of TOOL_IDS) for (let i = 0; i < plan.sampleProtocol.warmupSamples; i++) await timeCall(adapters[toolId], text);
  const samplesByTool = Object.fromEntries(TOOL_IDS.map(id => [id, []]));
  for (let round = 0; round < plan.sampleProtocol.samplesPerCell; round++) {
    for (const toolId of TOOL_IDS) {
      const ms = await timeCall(adapters[toolId], text);
      samplesByTool[toolId].push({ redactMs: Math.round(ms * 1000) / 1000, bytesPerSecond: ms === 0 ? Number.MAX_VALUE : Math.round(bytes * 1000 / ms) });
    }
  }
  for (const toolId of TOOL_IDS) {
    console.log(`  ${toolId}: median ${summarizeSamples(samplesByTool[toolId]).medianMs.toFixed(3)}ms`);
    observations.push({ tool: toolId, workload: workload.id, workloadBytes: bytes, workloadCommitment: hash(text), samples: samplesByTool[toolId], summary: summarizeSamples(samplesByTool[toolId]) });
    // Outside the timed calls: each distinct line goes through the tool once on its own, and only the outcome is kept.
    const lines = [];
    for (let index = 0; index < workload.lines.length; index++) {
      const { text: lineText, values } = renderLine(workload, index);
      const input = `${lineText}\n`;
      const output = adapters[toolId].async ? await adapters[toolId].redact(input) : adapters[toolId].redact(input);
      lines.push(describeLineOutcome(input, output, values));
    }
    outcomes.push({ tool: toolId, workload: workload.id, lines });
  }
}

const report = {
  schemaVersion: 1,
  reportType: 'runtime-comparison',
  supportClaims: false,
  planCommitment: plan.contentCommitment,
  setting: { id: setting.id, selectors: setting.selectors, activation, families },
  generatedAt: new Date().toISOString(),
  runner: { platform: process.platform, arch: process.arch, node: process.version, cpuModel: os.cpus()[0]?.model ?? 'unknown', cpuLimit, emulated, imageDigest },
  tools: TOOL_IDS.map(id => ({ id, version: adapters[id].version, provenance: id === 'redact-secret' ? { ...adapters[id].provenance, commit: productRef } : adapters[id].provenance })),
  methodologyNotes: [
    'Informational only: no pass/fail verdict, no ranking assertion (this repository measures and records; see AGENTS.md Boundary rule).',
    "OpenRedaction's detect() is Promise-returning (asynchronous); flare-redact's redact() and redact-secret's scanAndRedact() are synchronous. Each is timed with performance.now() around the actual call, awaited where applicable, so the OpenRedaction figures include at least one Node event-loop microtask tick that the other two tools' figures do not.",
    `redact-secret is measured from a local-source-build native addon (main branch at the pinned commit), not the published @redact-secret/core npm package: PII selection is not in any published release yet. This run used the ${setting.label} setting (${setting.selectors.join(', ') || 'no PII selectors'}). flare-redact and OpenRedaction are measured from their published npm packages at their package defaults, so their columns do not change with the setting; they are timed in every setting's run as a reference for how much the machine varied between runs.`,
    'Workloads are the ones in qualification/runtime-comparison-v2.json: validator-heavy and multilingual-context are the v1 workloads rendered byte-identically, the others are new and synthetic. Credential values are generated from a seed at run time and never stored; a value that reaches a recorded outcome is replaced by its index.',
    'One setting is measured per process because the native add-on accepts one PII selection per process. The tools run in-process, interleaved round-robin per workload, after two discarded warmup calls each, and each time is the median of the recorded samples.',
    'Outcomes come from one untimed call per distinct line, outside the timed calls. A value counts as hidden when it no longer appears verbatim in the returned text. Outcomes are recorded, never graded.',
  ],
  observations,
  outcomes,
};
report.artifactCommitment = runtimeComparisonCommitment(report);
validateRuntimeComparisonReport(report);

await mkdir(path.dirname(outPath), { recursive: true });
await writeFile(outPath, JSON.stringify(report, null, 2) + '\n');
console.log(`Wrote ${outPath}`);
