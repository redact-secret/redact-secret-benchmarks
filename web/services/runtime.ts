/**
 * The peer runtime comparison, read from what the repository commits: the plan
 * (`qualification/peer-pii-runtime-throughput-v1.json`), the workloads it reuses
 * (`qualification/pii-profile-cost-workloads-v1.json`) and the frozen snapshot
 * (`evidence/429/peer-pii-runtime-throughput.json`).
 *
 * The snapshot is validated with the same function the existing site's tests use
 * (`validatePeerRuntimeThroughputReport`: it re-renders each workload, checks the
 * commitments and recomputes every summary from the samples). A snapshot that
 * fails is never read; the page says so. An absent snapshot is "not published".
 *
 * Nothing is derived here beyond joining the plan to the snapshot in plan order.
 */
import { validatePeerRuntimeThroughputReport } from '../../benchmarks/evaluation/domains/pii/peer-runtime-throughput';
import { runtimeComparisonPlan, validateRuntimeComparisonPlan } from '../../benchmarks/evaluation/domains/pii/runtime-comparison';
import { once, readJson, readJsonIfPresent } from './repo';

export const RUNTIME_SNAPSHOT = 'evidence/429/peer-pii-runtime-throughput.json';
/** #562/#563: one report per redact-secret setting, from `qualification/runtime-comparison-v2.json`. */
export const COMPARISON_SNAPSHOT = (settingId: string): string => `evidence/562/runtime-comparison-${settingId}.json`;

interface PlanTool { id: string; package: string; provenance: string; call: string; async: boolean; piiSelectors?: string[] }
interface Plan { tools: PlanTool[]; sampleProtocol: { samplesPerCell: number; warmupSamples: number } }
interface WorkloadFile { generator: { lineCount: number }; workloads: { id: string; purpose: string; lines: string[] }[] }
interface Snapshot {
  schemaVersion: number;
  generatedAt: string;
  runner: { platform: string; arch: string; node: string };
  tools: { id: string; version: string; provenance: { kind: string; piiActivation?: string; commit?: string } }[];
  methodologyNotes: string[];
  observations: { tool: string; workload: string; workloadBytes: number; samples: unknown[]; summary: { medianMs: number; p95Ms: number; medianBytesPerSecond: number } }[];
  artifactCommitment: string;
}

/** A tool of the plan, in plan order, with what the snapshot recorded for it (absent when there is no snapshot). */
export interface RuntimeTool {
  id: string;
  package: string;
  call: string;
  async: boolean;
  piiSelectors: string[];
  /** From the snapshot. */
  version?: string;
  buildKind?: string;
  /** How redact-secret's PII was switched on, as the snapshot recorded it. */
  piiActivation?: string;
}

export interface RuntimeWorkload {
  id: string;
  purpose: string;
  /** Distinct lines the text cycles through. */
  distinctLines: number;
  /** Lines in the generated text. */
  lineCount: number;
}

export interface RuntimeObservation {
  tool: string;
  workload: string;
  workloadBytes: number;
  medianMs: number;
  p95Ms: number;
  medianBytesPerSecond: number;
  /** The fastest and slowest single call of the cell, from the validated samples (v2 reports only). */
  minMs?: number;
  maxMs?: number;
  /** Timed calls in the cell. */
  samples?: number;
}

export interface RuntimeMeasurement {
  generatedAt: string;
  runner: { platform: string; arch: string; node: string };
  methodologyNotes: string[];
  observations: RuntimeObservation[];
  /** The fewest samples any cell holds. */
  samplesPerCell: number;
  commitment: string;
  path: string;
}

/** A line of a comparison workload: what the plan says it carries. The text itself is never read here. */
export interface ComparisonLine {
  label: string;
  /** One entry per value the line carries, with the PII family that has to be on for it (absent for a credential). */
  values: { kind: string; family?: string }[];
}

export interface ComparisonWorkload {
  id: string;
  domain: 'pii' | 'credentials';
  question: string;
  description: string;
  lines: ComparisonLine[];
}

export interface ComparisonOutcome {
  changed: boolean;
  valuesHidden: number;
  replacement: string;
}

/** One measured setting's report, reduced to what the page shows. */
export interface ComparisonRun {
  generatedAt: string;
  runner: { platform: string; arch: string; node: string; cpuModel: string; cpuLimit: number };
  tools: { id: string; version: string; buildKind: string }[];
  /** PII families the setting switched on, as the add-on reported them. */
  families: string[];
  activation: string;
  methodologyNotes: string[];
  observations: RuntimeObservation[];
  /** Keyed `tool/workload`, one entry per plan line in plan order. */
  outcomes: Record<string, ComparisonOutcome[]>;
  samplesPerCell: number;
  commitment: string;
  path: string;
}

export interface ComparisonSetting {
  id: string;
  label: string;
  sub: string;
  selectors: string[];
  run:
    | ({ state: 'measured' } & ComparisonRun)
    | { state: 'not-published'; reason: string }
    | { state: 'invalid'; reason: string };
}

export interface RuntimeComparison {
  planId: string;
  /** Number of lines each workload's text is cycled to. */
  lineCount: number;
  workloads: ComparisonWorkload[];
  settings: ComparisonSetting[];
}

export interface PeerRuntime {
  tools: RuntimeTool[];
  workloads: RuntimeWorkload[];
  warmupSamples: number;
  /** Absent only for a `PeerRuntime` built without the v2 plan (a unit test's synthetic data). */
  comparison?: RuntimeComparison;
  measurement:
    | ({ state: 'measured' } & RuntimeMeasurement)
    | { state: 'not-published'; reason: string }
    | { state: 'invalid'; reason: string };
}

export function loadPeerRuntime(): Promise<PeerRuntime> {
  return once('peer-runtime', async () => {
    const [plan, workloadFile, snapshot] = await Promise.all([
      readJson<Plan>('qualification/peer-pii-runtime-throughput-v1.json'),
      readJson<WorkloadFile>('qualification/pii-profile-cost-workloads-v1.json'),
      readJsonIfPresent<Snapshot>(RUNTIME_SNAPSHOT),
    ]);
    const workloads: RuntimeWorkload[] = workloadFile.workloads.map(w => ({
      id: w.id, purpose: w.purpose, distinctLines: w.lines.length, lineCount: workloadFile.generator.lineCount,
    }));

    let measurement: PeerRuntime['measurement'];
    let valid: Snapshot | undefined;
    if (!snapshot) {
      measurement = { state: 'not-published', reason: `${RUNTIME_SNAPSHOT} is absent: no runtime comparison has been committed.` };
    } else {
      try {
        valid = validatePeerRuntimeThroughputReport(snapshot) as Snapshot;
        measurement = {
          state: 'measured',
          generatedAt: valid.generatedAt,
          runner: { platform: valid.runner.platform, arch: valid.runner.arch, node: valid.runner.node },
          methodologyNotes: valid.methodologyNotes,
          observations: valid.observations.map(o => ({ tool: o.tool, workload: o.workload, workloadBytes: o.workloadBytes, ...o.summary })),
          samplesPerCell: Math.min(...valid.observations.map(o => o.samples.length)),
          commitment: valid.artifactCommitment,
          path: RUNTIME_SNAPSHOT,
        };
      } catch (error) {
        valid = undefined;
        measurement = { state: 'invalid', reason: `${RUNTIME_SNAPSHOT} did not validate: ${(error as Error).message}.` };
      }
    }

    const comparison = await loadComparison();
    // The v2 run is the newer of the two on the same pins: prefer its versions, keep v1's for a page that has no v2 run.
    const newest = comparison.settings.find(s => s.id === 'pii-global' && s.run.state === 'measured')?.run as ({ state: 'measured' } & ComparisonRun) | undefined;
    const tools: RuntimeTool[] = plan.tools.map(t => {
      const fresh = newest?.tools.find(s => s.id === t.id);
      if (fresh) return { id: t.id, package: t.package, call: t.call, async: t.async, piiSelectors: t.piiSelectors ?? [], version: fresh.version, buildKind: fresh.buildKind, ...(t.id === 'redact-secret' ? { piiActivation: newest!.activation } : {}) };
      const seen = valid?.tools.find(s => s.id === t.id);
      return {
        id: t.id, package: t.package, call: t.call, async: t.async, piiSelectors: t.piiSelectors ?? [],
        ...(seen ? { version: seen.version, buildKind: seen.provenance.kind, ...(seen.provenance.piiActivation ? { piiActivation: seen.provenance.piiActivation } : {}) } : {}),
      };
    });
    return { tools, workloads, warmupSamples: plan.sampleProtocol.warmupSamples, comparison, measurement };
  });
}

interface ComparisonReport {
  generatedAt: string;
  runner: { platform: string; arch: string; node: string; cpuModel: string; cpuLimit: number };
  setting: { families: string[]; activation: string };
  tools: { id: string; version: string; provenance: { kind: string } }[];
  methodologyNotes: string[];
  observations: { tool: string; workload: string; workloadBytes: number; samples: { redactMs: number }[]; summary: { medianMs: number; p95Ms: number; medianBytesPerSecond: number } }[];
  outcomes: { tool: string; workload: string; lines: ComparisonOutcome[] }[];
  artifactCommitment: string;
}

/** The v2 plan and each setting's report. A report that fails validation is never read; the panel says so. */
async function loadComparison(): Promise<RuntimeComparison> {
  const plan = validateRuntimeComparisonPlan(runtimeComparisonPlan);
  const settings: ComparisonSetting[] = [];
  for (const s of plan.settings as { id: string; label: string; sub: string; selectors: string[] }[]) {
    const path = COMPARISON_SNAPSHOT(s.id);
    const found = await readJsonIfPresent<unknown>(path);
    let run: ComparisonSetting['run'];
    if (!found) {
      run = { state: 'not-published', reason: `${path} is absent: this setting has not been measured.` };
    } else {
      try {
        const report = validatePeerRuntimeThroughputReport(found) as ComparisonReport;
        run = {
          state: 'measured',
          generatedAt: report.generatedAt,
          runner: { platform: report.runner.platform, arch: report.runner.arch, node: report.runner.node, cpuModel: report.runner.cpuModel, cpuLimit: report.runner.cpuLimit },
          tools: report.tools.map(t => ({ id: t.id, version: t.version, buildKind: t.provenance.kind })),
          families: report.setting.families,
          activation: report.setting.activation,
          methodologyNotes: report.methodologyNotes,
          observations: report.observations.map(o => ({
            tool: o.tool, workload: o.workload, workloadBytes: o.workloadBytes, ...o.summary,
            minMs: Math.min(...o.samples.map(x => x.redactMs)), maxMs: Math.max(...o.samples.map(x => x.redactMs)), samples: o.samples.length,
          })),
          outcomes: Object.fromEntries(report.outcomes.map(o => [`${o.tool}/${o.workload}`, o.lines])),
          samplesPerCell: Math.min(...report.observations.map(o => o.samples.length)),
          commitment: report.artifactCommitment,
          path,
        };
      } catch (error) {
        run = { state: 'invalid', reason: `${path} did not validate: ${(error as Error).message}.` };
      }
    }
    settings.push({ id: s.id, label: s.label, sub: s.sub, selectors: s.selectors, run });
  }
  return {
    planId: plan.id,
    lineCount: plan.generator.lineCount,
    workloads: (plan.workloads as { id: string; domain: 'pii' | 'credentials'; question: string; description: string; lines: { label: string; values: { kind: string; family?: string }[] }[] }[]).map(w => ({
      id: w.id, domain: w.domain, question: w.question, description: w.description,
      lines: w.lines.map(l => ({ label: l.label, values: l.values.map(v => ({ kind: v.kind, ...(v.family ? { family: v.family } : {}) })) })),
    })),
    settings,
  };
}
