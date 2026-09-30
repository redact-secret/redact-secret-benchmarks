// #429: independent, informational-only peer comparison of runtime
// PII-redaction throughput (redact-secret vs. flare-redact vs.
// OpenRedaction). Deliberately separate from pii-profile-cost.ts
// (pii-profile-cost-v1, #286): that plan is a self-referential
// redact-secret off/enabled A/B with a frozen regression gate; this one
// never gates anything (thresholdPolicy.verdict is always "informational"),
// so it carries no threshold-freeze or AA-run machinery. See
// docs/decisions/2026-09-28-add-peer-runtime-pii-redaction-throughput.md.
import planData from '../../../../qualification/peer-pii-runtime-throughput-v1.json' with { type: 'json' };
import { piiProfileCostWorkloads, validatePiiProfileCostWorkloads } from './profile-cost.ts';
import { hash } from '../../substrate/hash.ts';
import { validateRuntimeComparisonReport } from './runtime-comparison.ts';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
const commitment = (value: unknown) => hash(JSON.stringify(canonical(value)));
const withoutCommitment = (value: Record<string, unknown>) => {
  const { contentCommitment: _contentCommitment, artifactCommitment: _artifactCommitment, ...projection } = value;
  return projection;
};
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

export const peerRuntimeThroughputPlan = Object.freeze(structuredClone(planData));
export const peerRuntimeThroughputCommitment = (value: unknown) => commitment(value);

export const TOOL_IDS = ['redact-secret', 'flare-redact', 'openredaction'] as const;
export type ToolId = (typeof TOOL_IDS)[number];

/**
 * Renders the exact workload text pii-profile-cost-v1's own candidate report
 * hashes into `workloadCommitment` (benchmarks/evaluation/domains/pii/profile-cost.ts),
 * duplicated rather than imported so this plan never depends on editing that
 * frozen file. Both stay byte-identical as long as
 * `qualification/pii-profile-cost-workloads-v1.json` is unchanged, which this
 * plan requires (`validatePeerRuntimeThroughputPlan`).
 */
export function renderWorkloadText(workloadId: string): string {
  const definition = (piiProfileCostWorkloads.workloads as any[]).find(row => row.id === workloadId);
  if (!definition) throw new Error(`Unknown peer-pii-runtime-throughput workload: ${workloadId}`);
  return `${Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) =>
    definition.lines[index % definition.lines.length]).join('\n')}\n`;
}

export function validatePeerRuntimeThroughputPlan(value: unknown = peerRuntimeThroughputPlan) {
  const plan = structuredClone(value) as any;
  if (!exact(plan, ['schemaVersion', 'id', 'issue', 'supportClaims', 'purpose', 'workloadsRef', 'safety', 'tools', 'sampleProtocol',
      'thresholdPolicy', 'implementationFreeze', 'contentCommitment']) || plan.schemaVersion !== 1 ||
      plan.id !== 'peer-pii-runtime-throughput-v1' || plan.issue !== 429 || plan.supportClaims !== false ||
      !digest(plan.contentCommitment) || plan.contentCommitment !== commitment(withoutCommitment(plan)))
    throw new Error('Invalid peer-pii-runtime-throughput plan identity or commitment');
  validatePiiProfileCostWorkloads();
  if (!exact(plan.workloadsRef, ['id', 'path', 'contentCommitment']) || plan.workloadsRef.id !== 'pii-profile-cost-workloads-v1' ||
      plan.workloadsRef.path !== 'qualification/pii-profile-cost-workloads-v1.json' ||
      plan.workloadsRef.contentCommitment !== piiProfileCostWorkloads.contentCommitment)
    throw new Error('Invalid peer-pii-runtime-throughput workload binding: must reuse pii-profile-cost-workloads-v1 unchanged');
  if (!exact(plan.safety, ['realPersonOrAccountProvenance', 'rawInputPublication', 'evidenceProjection']) ||
      plan.safety.realPersonOrAccountProvenance !== false || plan.safety.rawInputPublication !== 'plan-only' ||
      plan.safety.evidenceProjection !== 'commitment-only') throw new Error('Invalid peer-pii-runtime-throughput safety declaration');
  if (!Array.isArray(plan.tools) || JSON.stringify(plan.tools.map((t: any) => t.id)) !== JSON.stringify(TOOL_IDS))
    throw new Error('Invalid peer-pii-runtime-throughput tool roster');
  for (const tool of plan.tools) {
    if (typeof tool.async !== 'boolean' || typeof tool.call !== 'string' || !tool.call ||
        !['local-source-build', 'published-npm-package'].includes(tool.provenance))
      throw new Error(`Invalid peer-pii-runtime-throughput tool entry: ${tool.id}`);
    if (tool.id === 'redact-secret' && (!exact(tool, ['id', 'package', 'provenance', 'call', 'async', 'piiSelectors']) ||
        tool.package !== '@redact-secret/core' || tool.provenance !== 'local-source-build' || tool.call !== 'scanAndRedact' ||
        tool.async !== false || JSON.stringify(tool.piiSelectors) !== JSON.stringify(['pii:global'])))
      throw new Error('Invalid peer-pii-runtime-throughput redact-secret tool entry');
    if (tool.id === 'flare-redact' && (!exact(tool, ['id', 'package', 'provenance', 'call', 'async', 'options']) ||
        tool.package !== 'flare-redact' || tool.provenance !== 'published-npm-package' || tool.call !== 'redact' || tool.async !== false))
      throw new Error('Invalid peer-pii-runtime-throughput flare-redact tool entry');
    if (tool.id === 'openredaction' && (!exact(tool, ['id', 'package', 'provenance', 'call', 'async', 'options']) ||
        tool.package !== '@openredaction/core' || tool.provenance !== 'published-npm-package' || tool.call !== 'detect' || tool.async !== true))
      throw new Error('Invalid peer-pii-runtime-throughput openredaction tool entry');
  }
  if (!exact(plan.sampleProtocol, ['environment', 'samplesPerCell', 'warmupSamples', 'processIsolation', 'order']) ||
      !Number.isInteger(plan.sampleProtocol.samplesPerCell) || plan.sampleProtocol.samplesPerCell < 10 ||
      !Number.isInteger(plan.sampleProtocol.warmupSamples) || plan.sampleProtocol.warmupSamples < 1)
    throw new Error('Invalid peer-pii-runtime-throughput sample protocol');
  if (plan.thresholdPolicy?.verdict !== 'informational' || Object.keys(plan.thresholdPolicy).length !== 1)
    throw new Error('peer-pii-runtime-throughput must stay informational-only, permanently (see ADR decision 6)');
  const implementationPaths = ['benchmarks/evaluation/domains/pii/peer-runtime-throughput.ts', 'scripts/measure-peer-pii-runtime-throughput.mjs',
    'scripts/peer-pii-runtime-throughput/adapters.mjs', 'tests/peer-pii-runtime-throughput.test.mjs'];
  if (plan.implementationFreeze?.algorithm !== 'sha256-file-bytes' ||
      JSON.stringify(plan.implementationFreeze?.files?.map((row: any) => row.path)) !== JSON.stringify(implementationPaths) ||
      plan.implementationFreeze.files.some((row: any) => !exact(row, ['path', 'sha256']) || !digest(row.sha256)))
    throw new Error('Invalid peer-pii-runtime-throughput implementation freeze');
  return plan;
}

export function validatePeerRuntimeThroughputSample(value: unknown) {
  const sample = structuredClone(value) as any;
  if (!exact(sample, ['redactMs', 'bytesPerSecond']) || !Number.isFinite(sample.redactMs) || sample.redactMs < 0 ||
      !Number.isFinite(sample.bytesPerSecond) || sample.bytesPerSecond <= 0)
    throw new Error('Invalid peer-pii-runtime-throughput sample');
  return sample as { redactMs: number; bytesPerSecond: number };
}

const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];

export function summarizeSamples(samples: readonly { redactMs: number; bytesPerSecond: number }[]) {
  const ms = samples.map(s => s.redactMs), bps = samples.map(s => s.bytesPerSecond);
  return { medianMs: quantile(ms, 0.5), p95Ms: quantile(ms, 0.95), medianBytesPerSecond: quantile(bps, 0.5) };
}

const WORKLOAD_IDS = (piiProfileCostWorkloads.workloads as any[]).map(row => row.id).sort();

export function validatePeerRuntimeThroughputReport(value: unknown) {
  // #562/#563: runtime-comparison-v2 reports (evidence/562) are a different report type with their own plan; v1 reports are untouched.
  if ((value as { reportType?: unknown } | null)?.reportType === 'runtime-comparison') return validateRuntimeComparisonReport(value);
  const plan = validatePeerRuntimeThroughputPlan();
  const report = structuredClone(value) as any;
  // schemaVersion 1 is the frozen pre-Docker snapshot (evidence/429, #429); it stays valid until that snapshot is regenerated
  // from a native amd64 host (#513). Every new report is schemaVersion 2 and must carry the reproducibility identity.
  if (!exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'planCommitment', 'generatedAt', 'runner', 'tools',
      'methodologyNotes', 'observations', 'artifactCommitment']) || ![1, 2].includes(report.schemaVersion) ||
      report.reportType !== 'peer-pii-runtime-throughput' || report.supportClaims !== false ||
      report.planCommitment !== plan.contentCommitment || !Number.isFinite(Date.parse(report.generatedAt)) ||
      !exact(report.runner, report.schemaVersion === 1 ? ['platform', 'arch', 'node'] :
        ['platform', 'arch', 'node', 'cpuModel', 'cpuLimit', 'emulated', 'imageDigest']) || typeof report.runner.node !== 'string' ||
      report.artifactCommitment !== commitment(withoutCommitment(report)))
    throw new Error('Invalid peer-pii-runtime-throughput report identity or commitment');
  if (report.schemaVersion === 2) {
    const redactSecret = Array.isArray(report.tools) ? report.tools.find((t: any) => t?.id === 'redact-secret') : undefined;
    if (typeof report.runner.cpuModel !== 'string' || !report.runner.cpuModel ||
        !(Number.isFinite(report.runner.cpuLimit) && report.runner.cpuLimit > 0) || typeof report.runner.emulated !== 'boolean' ||
        !/^sha256:[a-f0-9]{64}$/.test(report.runner.imageDigest ?? '') || !/^[a-f0-9]{40}$/.test(redactSecret?.provenance?.commit ?? ''))
      throw new Error('peer-pii-runtime-throughput report must record the product commit, image digest and runner details');
  }
  if (!Array.isArray(report.tools) || JSON.stringify(report.tools.map((t: any) => t.id).sort()) !== JSON.stringify([...TOOL_IDS].sort()) ||
      report.tools.some((t: any) => !exact(t, ['id', 'version', 'provenance']) || typeof t.version !== 'string' || !t.version))
    throw new Error('Invalid peer-pii-runtime-throughput report tool roster');
  if (!Array.isArray(report.methodologyNotes) || report.methodologyNotes.length < 2 ||
      report.methodologyNotes.some((n: unknown) => typeof n !== 'string' || !n) ||
      !report.methodologyNotes.some((n: string) => /async|asynchronous|promise/i.test(n)) ||
      !report.methodologyNotes.some((n: string) => /local.source.build|not.*published|main branch/i.test(n)))
    throw new Error('peer-pii-runtime-throughput report must state the async/sync and redact-secret local-build caveats');
  const expectedKeys = plan.tools.flatMap((t: any) => WORKLOAD_IDS.map(w => `${t.id}/${w}`)).sort();
  const actualKeys = report.observations.map((o: any) => `${o.tool}/${o.workload}`).sort();
  if (!Array.isArray(report.observations) || new Set(actualKeys).size !== actualKeys.length || JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys))
    throw new Error('Incomplete peer-pii-runtime-throughput observation matrix');
  for (const observation of report.observations) {
    if (!exact(observation, ['tool', 'workload', 'workloadBytes', 'workloadCommitment', 'samples', 'summary']) ||
        !TOOL_IDS.includes(observation.tool) || !WORKLOAD_IDS.includes(observation.workload))
      throw new Error('Invalid peer-pii-runtime-throughput observation shape');
    const text = renderWorkloadText(observation.workload);
    if (observation.workloadCommitment !== hash(text) || observation.workloadBytes !== new TextEncoder().encode(text).length)
      throw new Error(`Stale peer-pii-runtime-throughput workload for ${observation.tool}/${observation.workload}`);
    if (!Array.isArray(observation.samples) || observation.samples.length < plan.sampleProtocol.samplesPerCell)
      throw new Error(`Insufficient peer-pii-runtime-throughput samples for ${observation.tool}/${observation.workload}`);
    for (const sample of observation.samples) validatePeerRuntimeThroughputSample(sample);
    if (JSON.stringify(observation.summary) !== JSON.stringify(summarizeSamples(observation.samples)))
      throw new Error(`Stale peer-pii-runtime-throughput summary for ${observation.tool}/${observation.workload}`);
  }
  return report;
}

validatePeerRuntimeThroughputPlan();

export type SnapshotGuardInput = { ref: string; pinRef: string; emulated: boolean; outPath: string; root: string };

/**
 * #513: a run may write the committed snapshot directory (`evidence/429/`) only when the addon was built from the
 * commit `benchmarks/pin-manifest.json` pins and the run was not under CPU emulation. Any other output path is a smoke
 * check and is never refused. Returns the refusal reason, or null when the write is allowed.
 */
export function snapshotWriteRefusal({ ref, pinRef, emulated, outPath, root }: SnapshotGuardInput): string | null {
  const relative = outPath.startsWith(root) ? outPath.slice(root.length).replace(/^[\\/]+/, '') : outPath;
  if (!/^evidence[\\/]429[\\/]/.test(relative)) return null;
  if (ref !== pinRef) return `refusing to write ${relative}: product ref ${ref} differs from pin-manifest redactSecretRevision ${pinRef}`;
  if (emulated) return `refusing to write ${relative}: the run was emulated (non-amd64 host), so timings are not comparable`;
  return null;
}
