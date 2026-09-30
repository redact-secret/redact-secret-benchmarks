// #562 / #563: the runtime comparison plan revision (runtime-comparison-v2) and the report a run of it writes.
//
// It sits beside peer-pii-runtime-throughput-v1 (#429), never over it: that plan, its two workloads and
// evidence/429 stay byte-identical because the existing site reads them. This revision adds what v1 could not
// record: the value each line carries and its expected kind, a third real-looking-values PII workload, three
// credential workloads, the three redact-secret settings, and the outcome each tool produced for each line.
// Outcomes are recorded, never graded (AGENTS.md Boundary rule): nothing here says a result is right or wrong.
//
// Credential inputs are never committed as literals (scripts/check-fixture-storage.mjs): a credential value is a
// prefix plus generated segments, rendered from a seed at run time, and any value that reaches a recorded outcome
// is replaced by its index first.
import planData from '../../../../qualification/runtime-comparison-v2.json' with { type: 'json' };
import peerPlan from '../../../../qualification/peer-pii-runtime-throughput-v1.json' with { type: 'json' };
import { piiProfileCostWorkloads } from './profile-cost.ts';
import { hash } from '../../substrate/hash.ts';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ?
  Object.fromEntries(Object.entries(value).filter(([, child]) => child !== undefined).sort(([a], [b]) => a.localeCompare(b))
    .map(([key, child]) => [key, canonical(child)])) : value;
export const runtimeComparisonCommitment = (value: unknown) => hash(JSON.stringify(canonical(value)));
const withoutCommitment = (value: Record<string, unknown>) => {
  const { contentCommitment: _contentCommitment, artifactCommitment: _artifactCommitment, ...projection } = value;
  return projection;
};
const digest = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const exact = (value: unknown, keys: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());

// Small helpers repeated from peer-runtime-throughput.ts, which imports this module to accept these reports, so
// importing it back would be a cycle. The v1 measurement contract they express is checked, not changed, here.
const TOOL_IDS = ['redact-secret', 'flare-redact', 'openredaction'] as const;
const renderWorkloadText = (workloadId: string) => {
  const definition = (piiProfileCostWorkloads.workloads as any[]).find(row => row.id === workloadId);
  return `${Array.from({ length: piiProfileCostWorkloads.generator.lineCount }, (_, index) => definition.lines[index % definition.lines.length]).join('\n')}\n`;
};
const quantile = (values: number[], q: number) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * q) - 1)];
export const summarizeSamples = (samples: readonly { redactMs: number; bytesPerSecond: number }[]) => ({
  medianMs: quantile(samples.map(s => s.redactMs), 0.5), p95Ms: quantile(samples.map(s => s.redactMs), 0.95), medianBytesPerSecond: quantile(samples.map(s => s.bytesPerSecond), 0.5),
});
const validatePeerRuntimeThroughputSample = (sample: any) => {
  if (!exact(sample, ['redactMs', 'bytesPerSecond']) || !Number.isFinite(sample.redactMs) || sample.redactMs < 0 ||
      !Number.isFinite(sample.bytesPerSecond) || sample.bytesPerSecond <= 0) throw new Error('Invalid runtime-comparison sample');
};

export const runtimeComparisonPlan = Object.freeze(structuredClone(planData));

export const SETTING_IDS = ['default', 'pii-global', 'pii-global-us'] as const;
export type SettingId = (typeof SETTING_IDS)[number];
export const DOMAINS = ['pii', 'credentials'] as const;
export const REPLACEMENT_LIMIT = 64;

const ALPHABETS: Record<string, string> = {
  digits: '0123456789',
  hex: '0123456789abcdef',
  'lower-alnum': 'abcdefghijklmnopqrstuvwxyz0123456789',
  'upper-alnum': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  alnum: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
  base64url: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
};

export interface PlanValue { kind: string; family?: string; literal?: string; segments?: ({ literal: string } | { alphabet: string; length: number })[] }
export interface PlanLine { label: string; template: string; values: PlanValue[] }
export interface PlanWorkload { id: string; domain: (typeof DOMAINS)[number]; question: string; description: string; reuses?: string; lines: PlanLine[] }

// mulberry32 over a 32-bit seed taken from a hash: deterministic, dependency free, not for security.
function random(seed: string) {
  let state = parseInt(hash(seed).slice(0, 8), 16) >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function renderValue(value: PlanValue, seed: string): string {
  if (typeof value.literal === 'string') return value.literal;
  const next = random(seed);
  return (value.segments ?? []).map(segment => 'literal' in segment ? segment.literal :
    Array.from({ length: segment.length }, () => ALPHABETS[segment.alphabet][Math.floor(next() * ALPHABETS[segment.alphabet].length)]).join('')).join('');
}

/** One distinct line of a workload: the text, and the value each `{n}` slot carries, in slot order. */
export function renderLine(workload: PlanWorkload, index: number): { text: string; values: string[] } {
  const line = workload.lines[index];
  const values = line.values.map((value, slot) => renderValue(value, `${runtimeComparisonPlan.id}/${workload.id}/${index}/${slot}`));
  return { text: line.template.replace(/\{(\d)\}/g, (_, slot) => values[Number(slot)]), values };
}

export const runtimeWorkloads = (plan: { workloads: PlanWorkload[] } = runtimeComparisonPlan as any): PlanWorkload[] => plan.workloads;

/** The text a run times: the workload's distinct lines cycled to `generator.lineCount` lines, LF-terminated, as v1 does. */
export function renderRuntimeComparisonWorkload(workloadId: string, plan: any = runtimeComparisonPlan): string {
  const workload = (plan.workloads as PlanWorkload[]).find(row => row.id === workloadId);
  if (!workload) throw new Error(`Unknown runtime-comparison workload: ${workloadId}`);
  const lines = workload.lines.map((_, index) => renderLine(workload, index).text);
  return `${Array.from({ length: plan.generator.lineCount }, (_, index) => lines[index % lines.length]).join('\n')}\n`;
}

/** Which of a line's values are gone from its output, and the text that replaced them (values themselves never stored). */
export function describeLineOutcome(input: string, output: string, values: string[]) {
  const changed = output !== input;
  const valuesHidden = values.filter(value => !output.includes(value)).length;
  let prefix = 0;
  while (prefix < input.length && prefix < output.length && input[prefix] === output[prefix]) prefix++;
  let suffix = 0;
  while (suffix < input.length - prefix && suffix < output.length - prefix && input[input.length - 1 - suffix] === output[output.length - 1 - suffix]) suffix++;
  let replacement = changed ? output.slice(prefix, output.length - suffix) : '';
  values.forEach((value, slot) => { if (value) replacement = replacement.split(value).join(`{${slot}}`); });
  return { changed, valuesHidden, replacement: replacement.length > REPLACEMENT_LIMIT ? `${replacement.slice(0, REPLACEMENT_LIMIT - 1)}…` : replacement };
}

export function validateRuntimeComparisonPlan(value: unknown = runtimeComparisonPlan) {
  const plan = structuredClone(value) as any;
  if (!exact(plan, ['schemaVersion', 'id', 'issues', 'supportClaims', 'purpose', 'extends', 'safety', 'settings', 'tools', 'sampleProtocol',
      'generator', 'outcomeDefinition', 'workloads', 'thresholdPolicy', 'contentCommitment']) || plan.schemaVersion !== 1 ||
      plan.id !== 'runtime-comparison-v2' || plan.supportClaims !== false ||
      !digest(plan.contentCommitment) || plan.contentCommitment !== runtimeComparisonCommitment(withoutCommitment(plan)))
    throw new Error('Invalid runtime-comparison plan identity or commitment');
  if (!exact(plan.extends, ['id', 'path', 'contentCommitment']) || plan.extends.id !== peerPlan.id ||
      plan.extends.path !== 'qualification/peer-pii-runtime-throughput-v1.json' || plan.extends.contentCommitment !== peerPlan.contentCommitment)
    throw new Error('runtime-comparison plan must extend peer-pii-runtime-throughput-v1 by its commitment, without editing it');
  if (!exact(plan.safety, ['realPersonOrAccountProvenance', 'credentialInputs', 'evidenceProjection']) ||
      plan.safety.realPersonOrAccountProvenance !== false || plan.safety.credentialInputs !== 'generated-at-run-time' ||
      plan.safety.evidenceProjection !== 'outcome-with-values-replaced-by-index')
    throw new Error('Invalid runtime-comparison safety declaration');
  if (!Array.isArray(plan.settings) || JSON.stringify(plan.settings.map((s: any) => s.id)) !== JSON.stringify(SETTING_IDS) ||
      plan.settings.some((s: any) => !exact(s, ['id', 'label', 'sub', 'selectors']) || !Array.isArray(s.selectors)) ||
      JSON.stringify(plan.settings.map((s: any) => s.selectors)) !== JSON.stringify([[], ['pii:global'], ['pii:global', 'pii:us']]))
    throw new Error('Invalid runtime-comparison settings: default, pii:global, pii:global plus pii:us');
  if (JSON.stringify(plan.tools?.map((t: any) => t.id)) !== JSON.stringify(TOOL_IDS) ||
      plan.tools.some((t: any, i: number) => !exact(t, ['id', 'package', 'call', 'async']) ||
        t.package !== peerPlan.tools[i].package || t.call !== peerPlan.tools[i].call || t.async !== peerPlan.tools[i].async))
    throw new Error('runtime-comparison tools must be the v1 roster, packages and calls unchanged');
  if (JSON.stringify(plan.sampleProtocol) !== JSON.stringify({ samplesPerCell: peerPlan.sampleProtocol.samplesPerCell, warmupSamples: peerPlan.sampleProtocol.warmupSamples,
      processIsolation: 'one-process-per-setting-tools-in-process', order: 'round-robin-per-tool' }))
    throw new Error('runtime-comparison sample protocol must keep the v1 sample and warmup counts');
  if (!exact(plan.generator, ['algorithm', 'lineCount', 'lineSeparator']) || plan.generator.algorithm !== 'repeat-lines-v1' ||
      plan.generator.lineCount !== piiProfileCostWorkloads.generator.lineCount || plan.generator.lineSeparator !== 'LF')
    throw new Error('runtime-comparison generator must be the v1 repeat-lines generator with the same line count');
  if (plan.thresholdPolicy?.verdict !== 'informational' || Object.keys(plan.thresholdPolicy).length !== 1)
    throw new Error('runtime-comparison must stay informational-only, permanently');
  if (!exact(plan.outcomeDefinition, ['changed', 'valuesHidden', 'replacement']) || Object.values(plan.outcomeDefinition).some(v => typeof v !== 'string' || !v))
    throw new Error('runtime-comparison must define each recorded outcome field');
  const ids = plan.workloads?.map((w: any) => w.id);
  if (!Array.isArray(ids) || new Set(ids).size !== ids.length || JSON.stringify(ids.filter((_: string, i: number) => plan.workloads[i].domain === 'pii')) !==
      JSON.stringify(['real-looking-values', 'validator-heavy', 'multilingual-context']) ||
      JSON.stringify(ids.filter((_: string, i: number) => plan.workloads[i].domain === 'credentials')) !== JSON.stringify(['credentials-real', 'credentials-fake', 'credentials-context']))
    throw new Error('runtime-comparison workloads: three PII (real-looking, fake, context) then three credential (real, fake, context)');
  for (const workload of plan.workloads as PlanWorkload[]) {
    if (!exact(workload, workload.reuses ? ['id', 'domain', 'question', 'description', 'reuses', 'lines'] : ['id', 'domain', 'question', 'description', 'lines']) ||
        !DOMAINS.includes(workload.domain) || !workload.question || !workload.description || !Array.isArray(workload.lines) || workload.lines.length < 1)
      throw new Error(`Invalid runtime-comparison workload: ${workload.id}`);
    workload.lines.forEach((line, index) => {
      if (!exact(line, ['label', 'template', 'values']) || !line.label || !line.template || !Array.isArray(line.values) || line.values.length < 1)
        throw new Error(`Invalid runtime-comparison line ${workload.id}/${index}`);
      line.values.forEach((entry, slot) => {
        const keys = Object.keys(entry).filter(k => k !== 'family').sort().join();
        if (typeof entry.kind !== 'string' || !entry.kind || (keys !== 'kind,literal' && keys !== 'kind,segments') ||
            (entry.family !== undefined && !/^pii:[a-z]+:[a-z-]+$/.test(entry.family)) ||
            (workload.domain === 'credentials') !== (entry.family === undefined) ||
            (entry.segments && !entry.segments.every(s => 'literal' in s ? typeof s.literal === 'string' : ALPHABETS[s.alphabet] && Number.isInteger(s.length) && s.length > 0)))
          throw new Error(`Invalid runtime-comparison value ${workload.id}/${index}/${slot}`);
        if (!line.template.includes(`{${slot}}`)) throw new Error(`runtime-comparison line ${workload.id}/${index} does not place value ${slot}`);
      });
    });
    if (workload.reuses) {
      const original = (piiProfileCostWorkloads.workloads as any[]).find(row => row.id === workload.reuses);
      if (workload.reuses !== workload.id || !original || renderRuntimeComparisonWorkload(workload.id, plan) !== renderWorkloadText(workload.id))
        throw new Error(`runtime-comparison workload ${workload.id} must render byte-identically to the v1 workload it reuses`);
    }
  }
  return plan;
}

const EXPECTED = (plan: any) => (plan.workloads as PlanWorkload[]).map(w => ({ id: w.id, lines: w.lines.length, values: w.lines.map(l => l.values.length) }));

export function validateRuntimeComparisonReport(value: unknown) {
  const plan = validateRuntimeComparisonPlan();
  const report = structuredClone(value) as any;
  if (!exact(report, ['schemaVersion', 'reportType', 'supportClaims', 'planCommitment', 'setting', 'generatedAt', 'runner', 'tools',
      'methodologyNotes', 'observations', 'outcomes', 'artifactCommitment']) || report.schemaVersion !== 1 ||
      report.reportType !== 'runtime-comparison' || report.supportClaims !== false || report.planCommitment !== plan.contentCommitment ||
      !Number.isFinite(Date.parse(report.generatedAt)) || !digest(report.artifactCommitment) || report.artifactCommitment !== runtimeComparisonCommitment(withoutCommitment(report)))
    throw new Error('Invalid runtime-comparison report identity or commitment');
  if (!exact(report.runner, ['platform', 'arch', 'node', 'cpuModel', 'cpuLimit', 'emulated', 'imageDigest']) || typeof report.runner.node !== 'string' ||
      typeof report.runner.cpuModel !== 'string' || !report.runner.cpuModel || !(Number.isFinite(report.runner.cpuLimit) && report.runner.cpuLimit > 0) ||
      typeof report.runner.emulated !== 'boolean' || !/^sha256:[a-f0-9]{64}$/.test(report.runner.imageDigest ?? ''))
    throw new Error('runtime-comparison report must record the runner details and image digest');
  const planSetting = plan.settings.find((s: any) => s.id === report.setting?.id);
  if (!planSetting || !exact(report.setting, ['id', 'selectors', 'activation', 'families']) || JSON.stringify(report.setting.selectors) !== JSON.stringify(planSetting.selectors) ||
      typeof report.setting.activation !== 'string' || !Array.isArray(report.setting.families) ||
      !report.setting.activation.includes(`selectors=${planSetting.selectors.length ? planSetting.selectors.join(',') : 'off'};`) ||
      report.setting.activation !== `credentials=full;selectors=${planSetting.selectors.length ? planSetting.selectors.join(',') : 'off'};families=${report.setting.families.join(',')};vocabulary=${report.setting.activation.split('vocabulary=')[1]}`)
    throw new Error('runtime-comparison report setting does not match the plan or its activation identity');
  const redactSecret = Array.isArray(report.tools) ? report.tools.find((t: any) => t?.id === 'redact-secret') : undefined;
  if (JSON.stringify(report.tools?.map((t: any) => t.id).sort()) !== JSON.stringify([...TOOL_IDS].sort()) ||
      report.tools.some((t: any) => !exact(t, ['id', 'version', 'provenance']) || typeof t.version !== 'string' || !t.version) ||
      !/^[a-f0-9]{40}$/.test(redactSecret?.provenance?.commit ?? ''))
    throw new Error('runtime-comparison report tool roster must be the three tools with versions and the product commit');
  if (!Array.isArray(report.methodologyNotes) || report.methodologyNotes.length < 3 || report.methodologyNotes.some((n: unknown) => typeof n !== 'string' || !n) ||
      !report.methodologyNotes.some((n: string) => /async|asynchronous|promise/i.test(n)) || !report.methodologyNotes.some((n: string) => /local.source.build|not.*published|main branch/i.test(n)))
    throw new Error('runtime-comparison report must state the async/sync and redact-secret local-build caveats');

  const keys = plan.tools.flatMap((t: any) => plan.workloads.map((w: any) => `${t.id}/${w.id}`)).sort();
  const observed = (list: any) => (Array.isArray(list) ? list : []).map((o: any) => `${o.tool}/${o.workload}`).sort();
  if (new Set(observed(report.observations)).size !== keys.length || JSON.stringify(observed(report.observations)) !== JSON.stringify(keys))
    throw new Error('Incomplete runtime-comparison observation matrix');
  for (const observation of report.observations) {
    if (!exact(observation, ['tool', 'workload', 'workloadBytes', 'workloadCommitment', 'samples', 'summary']))
      throw new Error('Invalid runtime-comparison observation shape');
    const text = renderRuntimeComparisonWorkload(observation.workload);
    if (observation.workloadCommitment !== hash(text) || observation.workloadBytes !== new TextEncoder().encode(text).length)
      throw new Error(`Stale runtime-comparison workload for ${observation.tool}/${observation.workload}`);
    if (!Array.isArray(observation.samples) || observation.samples.length < plan.sampleProtocol.samplesPerCell)
      throw new Error(`Insufficient runtime-comparison samples for ${observation.tool}/${observation.workload}`);
    for (const sample of observation.samples) validatePeerRuntimeThroughputSample(sample);
    if (JSON.stringify(observation.summary) !== JSON.stringify(summarizeSamples(observation.samples)))
      throw new Error(`Stale runtime-comparison summary for ${observation.tool}/${observation.workload}`);
  }

  if (new Set(observed(report.outcomes)).size !== keys.length || JSON.stringify(observed(report.outcomes)) !== JSON.stringify(keys))
    throw new Error('Incomplete runtime-comparison outcome matrix');
  const shape = EXPECTED(plan);
  for (const outcome of report.outcomes) {
    const expected = shape.find(w => w.id === outcome.workload);
    if (!exact(outcome, ['tool', 'workload', 'lines']) || !expected || !Array.isArray(outcome.lines) || outcome.lines.length !== expected.lines)
      throw new Error(`Invalid runtime-comparison outcome for ${outcome.tool}/${outcome.workload}`);
    outcome.lines.forEach((line: any, index: number) => {
      if (!exact(line, ['changed', 'valuesHidden', 'replacement']) || typeof line.changed !== 'boolean' || !Number.isInteger(line.valuesHidden) ||
          line.valuesHidden < 0 || line.valuesHidden > expected.values[index] || typeof line.replacement !== 'string' || line.replacement.length > REPLACEMENT_LIMIT ||
          (!line.changed && (line.valuesHidden !== 0 || line.replacement !== '')))
        throw new Error(`Invalid runtime-comparison outcome line ${outcome.tool}/${outcome.workload}/${index}`);
    });
  }
  return report;
}

validateRuntimeComparisonPlan();

export type WriteGuardInput = { ref: string; pinRef: string; emulated: boolean; outPath: string; root: string };

/**
 * The #513 rule for evidence/429, applied to evidence/562: a run may write the committed directory only when the add-on
 * was built from the commit `benchmarks/pin-manifest.json` pins and the run was not under CPU emulation. Any other path
 * is a smoke check and is never refused. Returns the refusal reason, or null.
 */
export function runtimeComparisonWriteRefusal({ ref, pinRef, emulated, outPath, root }: WriteGuardInput): string | null {
  const relative = outPath.startsWith(root) ? outPath.slice(root.length).replace(/^[\\/]+/, '') : outPath;
  if (!/^evidence[\\/]562[\\/]/.test(relative)) return null;
  if (ref !== pinRef) return `refusing to write ${relative}: product ref ${ref} differs from pin-manifest redactSecretRevision ${pinRef}`;
  if (emulated) return `refusing to write ${relative}: the run was emulated (non-amd64 host), so timings are not comparable`;
  return null;
}
