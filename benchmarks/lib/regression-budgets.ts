/**
 * Reviewed performance-regression budgets (#143).
 *
 * A budget is a review trigger, not an absolute ceiling: it compares a
 * candidate's measurement with a frozen baseline snapshot and sorts every
 * trigger into one outcome of the decision model:
 *
 *   within-budget         the change is below the trigger's noise-derived threshold
 *   regression            the change breaches it and no accepted tradeoff covers it
 *   accepted-tradeoff     it breaches, and `accepted-regressions.json` records why, with a linked benefit
 *   invalid-measurement   the candidate cannot be judged (wrong profile, too few samples,
 *                         missing metric, or a tail-only change) and must be rerun
 *
 * Dimensions (latency, initialization, memory, size, adapter-overhead) are
 * judged and reported separately and never combined into one score.
 * Detection is reported alongside, never budgeted: a detection change is the
 * benefit side of a tradeoff, not a cost.
 *
 * Thresholds are derived mechanically from recorded variance by
 * `deriveBudgets`, never hand-edited: see docs/specs/regression-budgets.md.
 */
import { createHash } from 'node:crypto';

import type { CompleteAssessment, MemoryCategory } from './performance-schema.ts';

export type Dimension = 'latency' | 'initialization' | 'memory' | 'size' | 'adapter-overhead';
export const DIMENSIONS: readonly Dimension[] = ['latency', 'initialization', 'memory', 'size', 'adapter-overhead'];
export type Verdict = 'within-budget' | 'regression' | 'accepted-tradeoff' | 'invalid-measurement' | 'not-evaluated';

const MEBIBYTE = 1024 * 1024;
const KIBIBYTE = 1024;

/** One measured value, keyed by a stable id, with enough context to judge validity. */
export interface Metric {
  readonly id: string;
  readonly dimension: Dimension;
  readonly profile: string;
  readonly unit: string;
  readonly value: number;
  readonly samples: number;
  /** The robust statistic a tail-sensitive trigger must be corroborated by. */
  readonly corroboration?: { readonly statistic: string; readonly value: number };
  /** Size only: whether the artifact ships in the default bundle or only in an optional module/profile. */
  readonly role?: 'default' | 'optional';
}

export interface Snapshot {
  readonly schemaVersion: '1';
  readonly id: string;
  readonly productVersion: string;
  readonly sourceCommit: string;
  readonly takenAt: string;
  readonly sources: Record<string, unknown>;
  /** Profile identities a candidate must match for each dimension to be comparable. */
  readonly profiles: Record<string, Record<string, string>>;
  readonly metrics: Record<string, Metric>;
  readonly detection?: Record<string, number>;
}

export interface Threshold {
  /** Fraction of the baseline value, e.g. 0.15 for +15%. */
  readonly relative: number;
  /** In the metric's unit; a change must exceed both this and `relative × baseline`. */
  readonly absoluteFloor: number;
}

export interface Trigger {
  readonly id: string;
  readonly dimension: Dimension;
  readonly profile: string;
  readonly metric: string;
  readonly unit: string;
  readonly direction: 'increase';
  readonly baselineValue: number;
  readonly threshold: Threshold;
  readonly corroboration?: { readonly statistic: string; readonly baselineValue: number; readonly threshold: Threshold };
  readonly minimumSamples: number;
  readonly role?: 'default' | 'optional';
  readonly derivation: string;
}

export interface BaselineRecord {
  readonly id: string;
  readonly file: string;
  readonly sha256: string;
  readonly sourceCommit: string;
  readonly promotedAt: string;
  readonly supersedes: string | null;
}

export interface Budgets {
  readonly schemaVersion: '1';
  readonly budgetsId: string;
  readonly reviewStatus: 'proposed' | 'reviewed';
  readonly derivedAt: string;
  readonly baseline: string;
  readonly baselines: readonly BaselineRecord[];
  readonly noise: Record<string, unknown>;
  readonly rules: Record<string, string>;
  readonly triggers: readonly Trigger[];
}

export interface AcceptedRegression {
  readonly id: string;
  readonly triggerId: string;
  readonly baselineId: string;
  readonly candidate: { readonly sourceCommit: string };
  readonly measured: { readonly baseline: number; readonly candidate: number; readonly unit: string };
  readonly rationale: string;
  readonly benefit: { readonly kind: 'detection' | 'safety'; readonly summary: string; readonly links: readonly string[] };
  readonly decidedAt: string;
  readonly decidedBy: string;
}

export interface TriggerResult {
  readonly id: string;
  readonly dimension: Dimension;
  readonly profile: string;
  readonly verdict: Verdict;
  readonly baseline: number;
  readonly candidate: number | null;
  readonly unit: string;
  readonly change: number | null;
  readonly relativeChange: number | null;
  readonly allowedChange: number;
  readonly role?: 'default' | 'optional';
  readonly reason?: string;
  readonly acceptedBy?: string;
}

export interface BudgetReport {
  readonly schemaVersion: '1';
  readonly budgetsId: string;
  readonly baselineId: string;
  readonly candidate: { readonly sourceCommit: string | null; readonly sources: readonly string[] };
  readonly status: 'accepted' | 'regression' | 'invalid-measurement';
  readonly dimensions: Record<Dimension, Record<Verdict, number>>;
  readonly triggers: readonly TriggerResult[];
  readonly detection: { readonly baseline: Record<string, number> | null; readonly candidate: Record<string, number> | null };
}

// ---------------------------------------------------------------------------
// Metric extraction. Each source maps to one or more dimensions and carries
// its own profile identity; nothing here judges.
// ---------------------------------------------------------------------------

/** Nearest-rank median, as the adapter harnesses and core compute it. */
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.5 * sorted.length) - 1]!;
}

/** Nearest-rank p95, as core's summaries compute it. */
function p95(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1]!;
}

/** A B B A A B B A ...: each side runs first in half the rounds, so drift over the job cancels out. */
export function roundOrder(rounds: number): { side: 'baseline' | 'candidate'; round: number }[] {
  const order: { side: 'baseline' | 'candidate'; round: number }[] = [];
  for (let round = 0; round < rounds; round += 1) {
    const sides = round % 2 === 0 ? (['baseline', 'candidate'] as const) : (['candidate', 'baseline'] as const);
    for (const side of sides) order.push({ side, round });
  }
  return order;
}

export interface PairedRatio {
  /** candidate p95 / baseline p95 over all interleaved samples of each side. */
  readonly p95: number;
  /** candidate median / baseline median. */
  readonly median: number;
  /** The in-job baseline statistics, in milliseconds, that absolute floors are scaled by. */
  readonly baselineP95: number;
  readonly baselineMedian: number;
  readonly samples: number;
}

/** Candidate/baseline ratios of the nearest-rank p95 and median, from samples measured in one job. */
export function pairedRatios(baseline: readonly number[], candidate: readonly number[]): PairedRatio {
  if (baseline.length === 0 || candidate.length === 0) throw new Error('regression-budgets:paired-ratio-without-samples');
  return {
    p95: p95(candidate) / p95(baseline),
    median: median(candidate) / median(baseline),
    baselineP95: p95(baseline),
    baselineMedian: median(baseline),
    samples: Math.min(baseline.length, candidate.length),
  };
}

export const LATENCY_PROFILE = 'linux-x64-release';

/** Latency, initialization, memory, and detection from one core `CompleteAssessment` summary. */
export function metricsFromSummary(summary: CompleteAssessment): { metrics: Metric[]; profile: Record<string, string>; detection: Record<string, number> | null } {
  const metrics: Metric[] = [];
  let detection: Record<string, number> | null = null;
  const hosts = new Set<string>();
  for (const run of summary.runs) {
    if (run.status !== 'complete' || run.result === undefined) continue;
    if (run.kind === 'accuracy' && run.result.accuracy !== undefined && detection === null) {
      const { truePositives, falsePositives, falseNegatives, policyMismatches } = run.result.accuracy;
      detection = { truePositives, falsePositives, falseNegatives, policyMismatches };
    }
    const performance = run.result.performance;
    if (run.kind !== 'performance' || performance === undefined) continue;
    hosts.add(`${run.result.provenance.os}|${run.result.provenance.cpu}`);
    const key = `${run.surface}/${run.profileId}`;
    metrics.push({
      id: `latency/${key}/processing-p95`, dimension: 'latency', profile: LATENCY_PROFILE, unit: 'milliseconds',
      value: performance.processing.p95, samples: performance.processing.samples.length,
      corroboration: { statistic: 'processing median', value: performance.processing.median },
    });
    metrics.push({
      id: `initialization/${key}/initialization-p95`, dimension: 'initialization', profile: LATENCY_PROFILE, unit: 'milliseconds',
      value: performance.initialization.p95, samples: performance.initialization.samples.length,
      corroboration: { statistic: 'initialization median', value: performance.initialization.median },
    });
    for (const [category, metric] of Object.entries(performance.memory) as [MemoryCategory, (typeof performance.memory)[MemoryCategory]][]) {
      if (metric.samples.length === 0) continue;
      metrics.push({
        id: `memory/${key}/${category}`, dimension: 'memory', profile: LATENCY_PROFILE, unit: 'bytes',
        value: Math.max(...metric.samples.map(sample => sample.maximumObservedBytes)), samples: metric.samples.length,
      });
    }
  }
  const rustRelease = summary.runs.every(run => run.surface !== 'rust-core' || run.kind !== 'performance' ||
    run.result?.provenance.buildProfile === 'release');
  return {
    metrics,
    profile: {
      os: [...hosts].every(host => host.startsWith('linux')) && hosts.size > 0 ? 'linux' : [...hosts].join(','),
      cpu: [...hosts].every(host => /\|(x86_64|x64)$/.test(host)) && hosts.size > 0 ? 'x86_64' : [...hosts].join(','),
      rustBuildProfile: rustRelease ? 'release' : 'not-release',
      workloadProfilesHash: summary.workloadProfiles?.hash ?? 'missing',
      status: summary.status,
    },
    detection,
  };
}

export const SIZE_PROFILE = 'release-artifacts';

interface OperationalEvidence {
  readonly measurements: {
    readonly artifacts: {
      readonly nativeAddons: readonly { target: string; bytes: number }[];
      readonly pythonWheels: readonly { target: string; bytes: number }[];
      readonly cli: readonly { target: string; bytes: number }[];
      readonly wasm: readonly { profile: string; gzipBytes: number }[];
      readonly npmPackages: readonly { label: string; packedBytes: number }[];
    };
    readonly browserBundle: { readonly totals: { readonly allGzipBytes: number } };
  };
}

/**
 * Artifact sizes from `benchmarks/operational-evidence.json` (#141). The
 * `full` WebAssembly profile is what the default browser entry and the
 * quickstart bundle ship; `common` is an optional subpath export, so its
 * growth is reported as its own, optional row and never hidden in the
 * default bundle's number.
 */
export function metricsFromOperational(evidence: OperationalEvidence): Metric[] {
  const { artifacts, browserBundle } = evidence.measurements;
  const size = (id: string, value: number, role?: 'default' | 'optional'): Metric =>
    ({ id: `size/${id}`, dimension: 'size', profile: SIZE_PROFILE, unit: 'bytes', value, samples: 1, ...(role ? { role } : {}) });
  return [
    ...artifacts.wasm.map(w => size(`wasm/${w.profile}/gzip`, w.gzipBytes, w.profile === 'full' ? 'default' : 'optional')),
    size('browser-bundle/quickstart/gzip', browserBundle.totals.allGzipBytes, 'default'),
    ...artifacts.npmPackages.map(p => size(`npm/${p.label}/packed`, p.packedBytes)),
    ...artifacts.nativeAddons.map(a => size(`node-addon/${a.target}`, a.bytes)),
    ...artifacts.pythonWheels.map(w => size(`python-wheel/${w.target}`, w.bytes)),
    ...artifacts.cli.map(c => size(`cli/${c.target}`, c.bytes)),
  ];
}

/**
 * Output schemas the adapter-overhead dimension reads: the adapters' own
 * harness, and this repository's black-box MCP harness (#281), whose rows
 * have the same shape (modes host / adapter-identity / adapter-core and the
 * derived traversal) under the `mcp-javascript` language.
 */
export const ADAPTER_OVERHEAD_SCHEMAS: readonly string[] = ['redact-secret-adapters/overhead-v1', 'redact-secret-benchmarks/mcp-overhead-v1'];

export interface AdapterOverheadOutput {
  readonly schema: string;
  readonly language: 'javascript' | 'python' | 'mcp-javascript';
  readonly workloads: { readonly digest: string };
  readonly environment: { readonly platform: string; readonly arch: string; readonly cpuModel: string | null; readonly runtime: string };
  readonly method: { readonly quick: boolean; readonly repetitions: number };
  readonly results: readonly {
    readonly host: string; readonly profileId: string;
    readonly scannerCallsPerEvent: number; readonly scannedCodeUnitsPerEvent: number;
    readonly derived: { readonly traversal: number; readonly coreScan: number; readonly adapterOverhead: number };
  }[];
}

/** `node-22`, `cpython-3` — the runtime line, not the patch, identifies the profile. */
function runtimeLine(runtime: string): string {
  const [name, version] = runtime.split('-');
  return name === 'node' ? `node-${version?.split('.')[0]}` : `${name}-${version?.split('.').slice(0, 2).join('.')}`;
}

export function adapterProfileId(output: AdapterOverheadOutput): string {
  const { platform, arch, cpuModel, runtime } = output.environment;
  return `${platform}-${arch}|${cpuModel ?? 'unknown-cpu'}|${runtimeLine(runtime)}`;
}

/**
 * Adapter-attributable metrics from one or more `redact-secret-adapters/overhead-v1`
 * outputs of the same language and profile (one per process). Traversal is the
 * median over processes of each process's median-based traversal; scanner
 * calls and scanned code units per event are deterministic counts. The core's
 * own scan time is deliberately not an adapter metric: it is the latency
 * dimension's, and counting it here would double-count it.
 */
export function metricsFromAdapterOverhead(outputs: readonly AdapterOverheadOutput[]): { metrics: Metric[]; profiles: Record<string, string> } {
  const groups = new Map<string, AdapterOverheadOutput[]>();
  for (const output of outputs) {
    if (!ADAPTER_OVERHEAD_SCHEMAS.includes(output.schema)) throw new Error('regression-budgets:adapter-overhead-schema');
    const profile = adapterProfileId(output);
    groups.set(profile, [...(groups.get(profile) ?? []), output]);
  }
  const metrics: Metric[] = [];
  const profiles: Record<string, string> = {};
  for (const [profile, group] of groups) {
    profiles[group[0]!.language] = profile;
    profiles[`${group[0]!.language}:workloadDigest`] = group[0]!.workloads.digest;
    profiles[`${group[0]!.language}:quick`] = String(group.some(output => output.method.quick));
    // Every (host, workload) row any process measured, not only the first
    // process's: the MCP harness measures each SDK endpoint in its own process.
    const seen = new Map<string, AdapterOverheadOutput['results'][number]>();
    for (const output of group) for (const row of output.results) if (!seen.has(`${row.host}\0${row.profileId}`)) seen.set(`${row.host}\0${row.profileId}`, row);
    for (const first of seen.values()) {
      const measured = group.filter(output => output.results.some(r => r.host === first.host && r.profileId === first.profileId));
      const rows = measured.map(output => output.results.find(r => r.host === first.host && r.profileId === first.profileId)!);
      const repetitions = measured.reduce((sum, output) => sum + output.method.repetitions, 0);
      const key = `adapter/${first.host}/${first.profileId}`;
      metrics.push({ id: `${key}/traversal`, dimension: 'adapter-overhead', profile, unit: 'microseconds-per-event',
        value: median(rows.map(row => row.derived.traversal)), samples: repetitions });
      metrics.push({ id: `${key}/scanner-calls`, dimension: 'adapter-overhead', profile, unit: 'calls-per-event',
        value: first.scannerCallsPerEvent, samples: rows.length });
      metrics.push({ id: `${key}/scanned-code-units`, dimension: 'adapter-overhead', profile, unit: 'code-units-per-event',
        value: first.scannedCodeUnitsPerEvent, samples: rows.length });
    }
  }
  return { metrics, profiles };
}

// ---------------------------------------------------------------------------
// Derivation: thresholds from recorded variance, never hand-picked.
// ---------------------------------------------------------------------------

/** Round a fraction up to the next 5 percentage points. */
export function ceilToFivePercent(fraction: number): number {
  return Math.ceil(Math.round(fraction * 10_000) / 500) * 5 / 100;
}

export interface NoiseInputs {
  /** Max over the committed Linux release-build runs of (p95/median − 1), per `surface/profileId`, per statistic. */
  readonly ciDispersion: { readonly processing: Record<string, number>; readonly initialization: Record<string, number> };
  /** Max over the committed Linux runs of (max/min − 1) of each memory metric, per metric id suffix `surface/profileId/category`. */
  readonly ciMemorySpread: Record<string, number>;
  /** Same-artifact rerun spread of the median, max over surfaces and profiles, per statistic. */
  readonly rerunMedianSpread: { readonly processing: number; readonly initialization: number };
  /** Same-artifact rerun spread of each memory category, max over surfaces and profiles. */
  readonly rerunMemorySpread: number;
  /** Between-process spread and absolute standard deviation of adapter traversal, per `host/profileId`. */
  readonly adapterTraversal: Record<string, { readonly spread: number; readonly standardDeviation: number }>;
}

/** The policy constants the derivation applies; recorded in the budgets file verbatim. */
export const RULES = {
  latency: 'processing p95 must rise by more than ceil5%(max(15%, the row\'s largest CI within-run p95/median dispersion, 2 x the largest same-artifact rerun spread of the median)) and 1 ms; the processing median must corroborate it by rising more than ceil5%(max(10%, 2 x that rerun spread)) and 1 ms, else the change is tail-only and the verdict is invalid-measurement (rerun); at least 5 samples',
  initialization: 'initialization p95 must rise by more than ceil5%(max(50%, the row\'s largest CI dispersion, 2 x the largest rerun spread of the initialization median)) and 2 ms; the initialization median must corroborate it by more than ceil5%(max(25%, 2 x that rerun spread)) and 2 ms; at least 5 samples',
  memory: 'the largest observed sample must rise by more than ceil5%(max(10%, 2 x the larger of the CI cross-run spread and the rerun spread)) and 1 MiB; at least 5 samples',
  size: 'sizes are deterministic (16 bytes observed between two platforms\' builds of one wasm), so the threshold is review policy anchored to release history: 5% (the median of the last releases\' 4.0-10.3% per-release growth), with floors of 4 KiB for compressed WebAssembly and bundles, 4 KiB for npm tarballs, and 16 KiB for native addons, wheels and CLI binaries; the default bundle and optional profiles are separate triggers',
  'adapter-overhead': 'traversal (host+adapter over a finds-nothing scanner, minus host) must rise by more than ceil5%(max(15%, 2 x its between-process spread)) and ceil(3 x its between-process standard deviation, at least 0.5 microseconds); scanner calls and scanned code units per event are deterministic and trigger on any increase; the candidate must match the baseline profile (platform, arch, CPU model, runtime line, workload digest) and have at least 15 repetitions',
} as const satisfies Record<Dimension, string>;

function sizeThreshold(id: string): Threshold {
  if (/^size\/(wasm|browser-bundle)\//.test(id)) return { relative: 0.05, absoluteFloor: 4 * KIBIBYTE };
  if (/^size\/npm\//.test(id)) return { relative: 0.05, absoluteFloor: 4 * KIBIBYTE };
  return { relative: 0.05, absoluteFloor: 16 * KIBIBYTE };
}

function rowKey(id: string): string {
  return id.split('/').slice(1, 3).join('/');
}

export function deriveTriggers(snapshot: Snapshot, noise: NoiseInputs): Trigger[] {
  const triggers: Trigger[] = [];
  for (const metric of Object.values(snapshot.metrics).sort((a, b) => a.id.localeCompare(b.id))) {
    const base = { id: metric.id, dimension: metric.dimension, profile: metric.profile, unit: metric.unit, direction: 'increase' as const,
      baselineValue: metric.value, ...(metric.role ? { role: metric.role } : {}) };
    if (metric.dimension === 'latency' || metric.dimension === 'initialization') {
      const latency = metric.dimension === 'latency';
      const statistic = latency ? 'processing' : 'initialization';
      const rerun = noise.rerunMedianSpread[statistic];
      const dispersion = noise.ciDispersion[statistic][rowKey(metric.id)];
      if (dispersion === undefined) throw new Error(`regression-budgets:no-ci-dispersion:${metric.id}`);
      const floor = latency ? 1 : 2;
      triggers.push({
        ...base,
        metric: `${statistic} p95 over fresh-process samples (nearest rank)`,
        threshold: { relative: ceilToFivePercent(Math.max(latency ? 0.15 : 0.5, dispersion, 2 * rerun)), absoluteFloor: floor },
        corroboration: {
          statistic: `${statistic} median`, baselineValue: metric.corroboration!.value,
          threshold: { relative: ceilToFivePercent(Math.max(latency ? 0.10 : 0.25, 2 * rerun)), absoluteFloor: floor },
        },
        minimumSamples: 5,
        derivation: `CI within-run p95/median dispersion ${(dispersion * 100).toFixed(1)}%; same-artifact rerun median spread ${(rerun * 100).toFixed(1)}%`,
      });
    } else if (metric.dimension === 'memory') {
      const ci = noise.ciMemorySpread[metric.id.slice('memory/'.length)] ?? 0;
      const spread = Math.max(ci, noise.rerunMemorySpread);
      triggers.push({
        ...base, metric: 'largest observed sample', minimumSamples: 5,
        threshold: { relative: ceilToFivePercent(Math.max(0.10, 2 * spread)), absoluteFloor: MEBIBYTE },
        derivation: `CI cross-run spread ${(ci * 100).toFixed(1)}%; same-artifact rerun spread ${(noise.rerunMemorySpread * 100).toFixed(1)}%`,
      });
    } else if (metric.dimension === 'size') {
      triggers.push({ ...base, metric: 'artifact bytes', minimumSamples: 1, threshold: sizeThreshold(metric.id),
        derivation: 'deterministic; release-history policy (see rules.size)' });
    } else {
      const exact = !metric.id.endsWith('/traversal');
      if (exact) {
        triggers.push({ ...base, metric: metric.id.endsWith('/scanner-calls') ? 'scanner calls per event' : 'scanned code units per event',
          minimumSamples: 1, threshold: { relative: 0, absoluteFloor: 0 }, derivation: 'deterministic count: any increase is a trigger' });
      } else {
        const key = metric.id.split('/').slice(1, 3).join('/');
        const observed = noise.adapterTraversal[key];
        if (observed === undefined) throw new Error(`regression-budgets:no-adapter-noise:${metric.id}`);
        triggers.push({
          ...base, metric: 'adapter traversal, median over processes of per-process median difference', minimumSamples: 15,
          threshold: {
            relative: ceilToFivePercent(Math.max(0.15, 2 * observed.spread)),
            absoluteFloor: Math.max(0.5, Math.ceil(3 * observed.standardDeviation * 10) / 10),
          },
          derivation: `between-process spread ${(observed.spread * 100).toFixed(1)}%, standard deviation ${observed.standardDeviation.toFixed(3)} microseconds`,
        });
      }
    }
  }
  return triggers;
}

// ---------------------------------------------------------------------------
// Evaluation.
// ---------------------------------------------------------------------------

export function allowedChange(baseline: number, threshold: Threshold): number {
  return Math.max(threshold.relative * baseline, threshold.absoluteFloor);
}

export interface CandidateMeasurement {
  readonly sourceCommit: string | null;
  readonly sources: readonly string[];
  readonly metrics: Record<string, Metric>;
  /** Per dimension, the candidate's profile identity; a dimension absent here was not measured. */
  readonly profiles: Partial<Record<Dimension, Record<string, string>>>;
  readonly detection?: Record<string, number> | null;
}

/** The baseline's adapter language (`javascript`, `python`) whose profile this trigger belongs to. */
function adapterLanguage(baseline: Snapshot, trigger: Trigger): string | undefined {
  const want = baseline.profiles['adapter-overhead'] ?? {};
  return Object.keys(want).find(key => want[key] === trigger.profile);
}

/** Whether the candidate supplied a source for this trigger's dimension (and, for adapters, its language). */
function supplied(baseline: Snapshot, candidate: CandidateMeasurement, trigger: Trigger): boolean {
  const got = candidate.profiles[trigger.dimension];
  if (got === undefined) return false;
  if (trigger.dimension !== 'adapter-overhead') return true;
  const language = adapterLanguage(baseline, trigger);
  return language !== undefined && got[language] !== undefined;
}

/** Why a candidate's profile cannot be compared with the baseline's for this dimension, or null. */
function profileProblem(dimension: Dimension, baseline: Snapshot, candidate: CandidateMeasurement, trigger: Trigger): string | null {
  const got = candidate.profiles[dimension];
  if (got === undefined) return null;
  if (dimension === 'latency' || dimension === 'initialization' || dimension === 'memory') {
    const want = baseline.profiles.latency!;
    for (const key of ['os', 'cpu', 'rustBuildProfile', 'workloadProfilesHash', 'status']) {
      if (got[key] !== want[key]) return `profile ${key} is ${got[key]}, baseline ${want[key]}`;
    }
    return null;
  }
  if (dimension === 'adapter-overhead') {
    const want = baseline.profiles['adapter-overhead']!;
    const language = adapterLanguage(baseline, trigger);
    if (language === undefined) return 'baseline has no adapter profile for this trigger';
    if (got[language] !== want[language]) return `adapter profile is ${got[language] ?? 'missing'}, baseline ${want[language]}`;
    if (got[`${language}:workloadDigest`] !== want[`${language}:workloadDigest`]) return 'adapter workload digest differs from the baseline';
    if (got[`${language}:quick`] !== 'false') return 'a --quick harness run carries no measurement';
  }
  return null;
}

export function evaluateBudgets(
  budgets: Pick<Budgets, 'budgetsId' | 'triggers'>, baseline: Snapshot, candidate: CandidateMeasurement,
  ledger: readonly AcceptedRegression[],
): BudgetReport {
  const results: TriggerResult[] = [];
  for (const trigger of budgets.triggers) {
    const baselineMetric = baseline.metrics[trigger.id];
    const baselineValue = baselineMetric?.value ?? trigger.baselineValue;
    const allowed = allowedChange(baselineValue, trigger.threshold);
    const common = { id: trigger.id, dimension: trigger.dimension, profile: trigger.profile, baseline: baselineValue, unit: trigger.unit,
      allowedChange: allowed, ...(trigger.role ? { role: trigger.role } : {}) };
    const empty = { candidate: null, change: null, relativeChange: null };
    if (!supplied(baseline, candidate, trigger)) {
      results.push({ ...common, ...empty, verdict: 'not-evaluated', reason: 'no candidate source for this dimension was supplied' });
      continue;
    }
    const problem = profileProblem(trigger.dimension, baseline, candidate, trigger);
    const metric = candidate.metrics[trigger.id];
    if (problem !== null || metric === undefined || metric.samples < trigger.minimumSamples) {
      const reason = problem ?? (metric === undefined ? 'metric missing from the candidate' : `${metric.samples} samples, at least ${trigger.minimumSamples} required`);
      results.push({ ...common, ...empty, candidate: metric?.value ?? null, verdict: 'invalid-measurement', reason });
      continue;
    }
    const change = metric.value - baselineValue;
    const measured = { candidate: metric.value, change, relativeChange: baselineValue === 0 ? null : change / baselineValue };
    if (change <= allowed) {
      results.push({ ...common, ...measured, verdict: 'within-budget' });
      continue;
    }
    if (trigger.corroboration !== undefined) {
      const corroborating = metric.corroboration?.value;
      const corroborationBaseline = baselineMetric?.corroboration?.value ?? trigger.corroboration.baselineValue;
      const corroborated = corroborating !== undefined &&
        corroborating - corroborationBaseline > allowedChange(corroborationBaseline, trigger.corroboration.threshold);
      if (!corroborated) {
        results.push({ ...common, ...measured, verdict: 'invalid-measurement',
          reason: `${trigger.corroboration.statistic} did not corroborate the change: tail-only, rerun before judging` });
        continue;
      }
    }
    const accepted = ledger.find(entry => entry.triggerId === trigger.id && entry.baselineId === baseline.id &&
      entry.candidate.sourceCommit === candidate.sourceCommit);
    results.push(accepted
      ? { ...common, ...measured, verdict: 'accepted-tradeoff', acceptedBy: accepted.id }
      : { ...common, ...measured, verdict: 'regression', reason: 'breach without an accepted tradeoff in benchmarks/accepted-regressions.json' });
  }
  const dimensions = Object.fromEntries(DIMENSIONS.map(dimension => [dimension, Object.fromEntries(
    (['within-budget', 'regression', 'accepted-tradeoff', 'invalid-measurement', 'not-evaluated'] as Verdict[])
      .map(verdict => [verdict, results.filter(r => r.dimension === dimension && r.verdict === verdict).length]),
  )])) as BudgetReport['dimensions'];
  const status = results.some(r => r.verdict === 'regression') ? 'regression'
    : results.some(r => r.verdict === 'invalid-measurement') ? 'invalid-measurement' : 'accepted';
  return {
    schemaVersion: '1', budgetsId: budgets.budgetsId, baselineId: baseline.id,
    candidate: { sourceCommit: candidate.sourceCommit, sources: candidate.sources },
    status, dimensions, triggers: results,
    detection: { baseline: baseline.detection ?? null, candidate: candidate.detection ?? null },
  };
}

/** Exit code the CLI uses: 0 accepted, 1 a measured regression, 2 a measurement that cannot be judged. */
export function exitCodeFor(report: BudgetReport): 0 | 1 | 2 {
  return report.status === 'regression' ? 1 : report.status === 'invalid-measurement' ? 2 : 0;
}

export function renderReportMarkdown(report: BudgetReport): string {
  const pct = (x: number | null) => (x === null ? '—' : `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`);
  const lines = [
    `# Regression budgets: ${report.status.toUpperCase()}`,
    '',
    `Budgets \`${report.budgetsId}\` against baseline \`${report.baselineId}\`; candidate \`${report.candidate.sourceCommit ?? 'unknown'}\`.`,
    'Each dimension is judged on its own; no score combines them.',
    '',
    '| Dimension | within budget | regression | accepted tradeoff | invalid measurement | not evaluated |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    ...DIMENSIONS.map(d => {
      const c = report.dimensions[d];
      return `| ${d} | ${c['within-budget']} | ${c.regression} | ${c['accepted-tradeoff']} | ${c['invalid-measurement']} | ${c['not-evaluated']} |`;
    }),
    '',
    '## Triggers that need attention',
    '',
    '| Trigger | Verdict | Baseline | Candidate | Change | Allowed | Note |',
    '| --- | --- | ---: | ---: | ---: | ---: | --- |',
    ...report.triggers.filter(t => t.verdict !== 'within-budget' && t.verdict !== 'not-evaluated').map(t =>
      `| \`${t.id}\`${t.role ? ` (${t.role})` : ''} | ${t.verdict} | ${t.baseline} | ${t.candidate ?? '—'} | ${pct(t.relativeChange)} | ${t.allowedChange.toFixed(3)} ${t.unit} | ${t.acceptedBy ?? t.reason ?? ''} |`),
    '',
  ];
  if (report.detection.baseline || report.detection.candidate) {
    lines.push('## Detection (reported, not budgeted)', '', `Baseline ${JSON.stringify(report.detection.baseline)}; candidate ${JSON.stringify(report.detection.candidate)}.`, '');
  }
  return `${lines.join('\n')}\n`;
}

// ---------------------------------------------------------------------------
// Integrity: the ledger, and the rule that a breach never disappears through
// baseline replacement.
// ---------------------------------------------------------------------------

const BENEFIT_LINK = /^https:\/\/github\.com\/redact-secret\/[A-Za-z0-9_.-]+\/(issues|pull)\/\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[0-9a-f]{40}$/;

export function ledgerProblems(ledger: readonly AcceptedRegression[], triggerIds: ReadonlySet<string>): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const entry of ledger) {
    const at = `accepted-regressions ${entry.id ?? '(no id)'}`;
    if (!entry.id || ids.has(entry.id)) problems.push(`${at}: id missing or repeated`);
    ids.add(entry.id);
    if (!triggerIds.has(entry.triggerId)) problems.push(`${at}: unknown trigger ${entry.triggerId}`);
    if (!SHA.test(entry.candidate?.sourceCommit ?? '')) problems.push(`${at}: candidate.sourceCommit must be a 40-hex commit`);
    if (typeof entry.measured?.baseline !== 'number' || typeof entry.measured?.candidate !== 'number' || !entry.measured.unit) {
      problems.push(`${at}: the original measurement (baseline, candidate, unit) must be retained`);
    }
    if (typeof entry.rationale !== 'string' || entry.rationale.trim().length < 40) problems.push(`${at}: rationale must explain the tradeoff (40 characters or more)`);
    if (!['detection', 'safety'].includes(entry.benefit?.kind) || !entry.benefit?.summary) problems.push(`${at}: benefit must name a detection or safety gain`);
    if (!Array.isArray(entry.benefit?.links) || entry.benefit.links.length === 0 || !entry.benefit.links.every(link => BENEFIT_LINK.test(link))) {
      problems.push(`${at}: benefit.links must link at least one redact-secret issue or pull request`);
    }
    if (!DATE.test(entry.decidedAt ?? '') || !entry.decidedBy) problems.push(`${at}: decidedAt and decidedBy are required`);
  }
  return problems;
}

export function sha256OfText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Candidate measurement built from a stored snapshot, so a baseline promotion is evaluated like any candidate. */
export function candidateFromSnapshot(snapshot: Snapshot): CandidateMeasurement {
  const profiles: Partial<Record<Dimension, Record<string, string>>> = {};
  const has = (dimension: Dimension) => Object.values(snapshot.metrics).some(metric => metric.dimension === dimension);
  for (const dimension of DIMENSIONS) {
    if (!has(dimension)) continue;
    profiles[dimension] = dimension === 'size' ? {} : dimension === 'adapter-overhead'
      ? snapshot.profiles['adapter-overhead']! : snapshot.profiles.latency!;
  }
  return { sourceCommit: snapshot.sourceCommit, sources: [`baseline ${snapshot.id}`], metrics: snapshot.metrics, profiles, detection: snapshot.detection ?? null };
}

/**
 * Checks the baseline history: every snapshot file is unchanged since it was
 * recorded, the current baseline is the newest record, and every promotion
 * of a new baseline over an older one either stayed within budget or has
 * each breach covered by an accepted tradeoff for exactly that promotion.
 * Replacing a baseline therefore never erases a breach: the breach has to be
 * accepted, with its original measurement, before the new baseline is valid.
 */
export function historyProblems(
  budgets: Pick<Budgets, 'budgetsId' | 'baseline' | 'baselines' | 'triggers'>, readSnapshot: (file: string) => string,
  ledger: readonly AcceptedRegression[],
): string[] {
  const problems: string[] = [];
  const byId = new Map(budgets.baselines.map(record => [record.id, record]));
  if (budgets.baselines.at(-1)?.id !== budgets.baseline) problems.push(`the current baseline ${budgets.baseline} is not the newest history record`);
  const snapshots = new Map<string, Snapshot>();
  for (const record of budgets.baselines) {
    const text = readSnapshot(record.file);
    if (sha256OfText(text) !== record.sha256) problems.push(`baseline ${record.id}: ${record.file} changed since it was recorded (sha256 mismatch)`);
    const snapshot = JSON.parse(text) as Snapshot;
    if (snapshot.id !== record.id || snapshot.sourceCommit !== record.sourceCommit) problems.push(`baseline ${record.id}: snapshot identity differs from its record`);
    snapshots.set(record.id, snapshot);
  }
  for (const record of budgets.baselines) {
    if (record.supersedes === null) continue;
    const previous = snapshots.get(record.supersedes);
    if (previous === undefined || !byId.has(record.supersedes)) {
      problems.push(`baseline ${record.id}: supersedes unknown baseline ${record.supersedes}`);
      continue;
    }
    const report = evaluateBudgets(budgets, previous, candidateFromSnapshot(snapshots.get(record.id)!), ledger);
    for (const result of report.triggers) {
      if (result.verdict === 'regression') {
        problems.push(`baseline ${record.id} replaced ${record.supersedes} over an unaccepted breach of ${result.id} (${result.baseline} -> ${result.candidate} ${result.unit})`);
      } else if (result.verdict === 'invalid-measurement') {
        problems.push(`baseline ${record.id} cannot be compared with ${record.supersedes} on ${result.id}: ${result.reason}`);
      }
    }
  }
  return problems;
}
