/**
 * The cost-aware execution plan (#709, docs/specs/execution-plan.md): one dry-run that says, per axis and per scanner, what would be measured fresh, what is
 * reused from which recorded source, and what is unmeasured, with the reason, the expected jobs and engine invocations, and runner-minutes only where telemetry exists.
 *
 * Accuracy and performance are separate axes with separate identities. A change is classified by `benchmarks/execution-axes.json`; the performance axis then
 * decides by IDENTITY (the recorded cell's subject, workload definition and protocol against what the repository pins now), never by what changed, so a
 * fixture-only, label-only or view-only change cannot select a performance job. The planner reads and starts nothing: it launches no scan and no measurement,
 * and it never reads a score.
 *
 * Mixed origins stay visible: a reused performance cell is an independent historical measurement (its measuredAt, host and source artifact are carried), never
 * "same-run", and the plan never derives a comparative ranking or a latency direction from it.
 */
import { canonical, sha256Digest } from './canonical.ts';

export const EXECUTION_PLAN_SCHEMA = 'redact-secret-benchmarks/execution-plan/v1';
export const CELLS_SCHEMA = 'redact-secret-benchmarks/performance-cells/v1';

export type Axis = 'accuracy' | 'performance' | 'both';
export type ChangeKind = 'accuracy-fixtures' | 'accuracy-expectations' | 'scanner-pin' | 'performance-workload' | 'measurement-code' | 'execution-tooling' | 'evidence-record' | 'view-docs' | 'unclassified';

// ---------------------------------------------------------------- change classification

export interface AxesRules { rules: { kind: Exclude<ChangeKind, 'unclassified'>; globs: string[] }[] }

const globRegex = (glob: string) =>
  new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '\u0001').replace(/\*\*/g, '\u0002').replace(/\*/g, '[^/]*').replace(/\u0001/g, '(?:.*/)?').replace(/\u0002/g, '.*')}$`);

export function classifyChanges(files: string[], axes: AxesRules): { kinds: Partial<Record<ChangeKind, string[]>>; unclassified: string[] } {
  const compiled = axes.rules.map(rule => ({ kind: rule.kind, patterns: rule.globs.map(globRegex) }));
  const kinds: Partial<Record<ChangeKind, string[]>> = {};
  const unclassified: string[] = [];
  for (const file of [...files].sort()) {
    const hit = compiled.find(rule => rule.patterns.some(pattern => pattern.test(file)));
    if (!hit) { unclassified.push(file); continue; }
    (kinds[hit.kind] ??= []).push(file);
  }
  return { kinds, unclassified };
}

// ---------------------------------------------------------------- performance identity

export interface SubjectIdentity { id: string; version: string; package: string; kind: string; commit: string | null; activation: string | null }
export interface CellIdentity { subject: SubjectIdentity; workloadDigest: string; protocolDigest: string }
export interface PerformanceCell {
  id: string;
  measurement: string;
  setting: string | null;
  subject: string;
  workload: string;
  identity: CellIdentity;
  identityDigest: string;
  artifact: { path: string; byteDigest: string; artifactCommitment: string; measuredAt: string; host: { platform: string; arch: string; cpuModel: string; imageDigest: string | null }; observations: number };
}
export interface MeasurementEntry {
  id: string;
  plan: string;
  /** One engine/harness job measures every subject of the measurement (the repository's harness interleaves them in one process), so a fresh cell runs the others too. */
  granularity: 'measurement';
  jobKey: 'measurement' | 'measurement+setting';
  /** The workflow that runs this measurement and its inputs: the performance axis is dispatched there, never from the accuracy lane. */
  dispatch?: { workflow: string; inputs: Record<string, string> };
}
export interface CellsManifest { schema: typeof CELLS_SCHEMA; measurements: MeasurementEntry[]; cells: PerformanceCell[] }

export const identityDigest = (identity: CellIdentity) => sha256Digest(canonical(identity));

/** What the repository pins now for one cell, resolved by the caller from the plan, package.json and the pin manifest. */
export type CurrentIdentity = (cell: PerformanceCell) => CellIdentity | null;

export function identityDifferences(recorded: CellIdentity, current: CellIdentity): string[] {
  const out: string[] = [];
  for (const key of ['id', 'version', 'package', 'kind', 'commit', 'activation'] as const)
    if (recorded.subject[key] !== current.subject[key]) out.push(`subject.${key}`);
  if (recorded.workloadDigest !== current.workloadDigest) out.push('workload');
  if (recorded.protocolDigest !== current.protocolDigest) out.push('protocol');
  return out;
}

export type PerformanceReason = 'no-performance-input-changed' | 'unchanged-identity' | 'identity-changed' | 'force-fresh' | 'controlled-comparison' | 'run-with-measurement' | 'no-stored-result' | 'stored-result-invalid';
export interface PerformanceCellPlan {
  cell: string;
  measurement: string;
  setting: string | null;
  subject: string;
  workload: string;
  origin: 'reuse' | 'fresh';
  reason: PerformanceReason;
  /** The identity fields that differ, for `identity-changed`. */
  changed: string[];
  /** For a reused cell: where the independent historical measurement came from. Never "same-run". */
  source?: { artifact: string; byteDigest: string; measuredAt: string; host: { platform: string; arch: string; cpuModel: string }; identity: string };
  /** For a fresh cell the harness runs only because it measures the whole measurement (not because this cell is invalid). */
  harnessForced?: true;
}
export interface PerformanceJobPlan { job: string; measurement: string; setting: string | null; subjects: string[]; engineInvocations: number | null; runnerMinutes: number | null }

export interface PerformanceInputs {
  manifest: CellsManifest;
  current: CurrentIdentity;
  /** Cell ids, subject ids, measurement ids or 'all'. An explicit request: it may run peers. */
  forceFresh?: string[] | 'all';
  /** An explicit controlled A/B comparison: every subject of the affected measurement is measured fresh in the same run. */
  controlledComparison?: boolean;
  /** Invocations of one cell (samples plus warmups), by measurement id, when the plan's protocol is known. */
  invocationsPerCell?: (measurement: string) => number | null;
  telemetry?: Telemetry;
  /**
   * Whether this change touches a performance input (a scanner pin, a workload or measurement code) or the axis was asked for by name. When false, nothing is
   * scheduled: a cell whose identity is already stale is a standing fact, not something this change caused, and is only counted (request the performance axis to plan it).
   */
  triggered?: boolean;
  /** Recorded artifacts that are missing, unreadable or whose bytes differ from their recorded digest. */
  invalidArtifacts?: string[];
}

export interface PerformancePlan {
  cells: PerformanceCellPlan[];
  jobs: PerformanceJobPlan[];
  /** Subjects that would run in a job only because the harness measures a whole measurement; they are reported, never hidden. */
  peerProcesses: number;
  decisions: string[];
  missingEvidence: string[];
}

export function planPerformance(inputs: PerformanceInputs): PerformancePlan {
  const force = inputs.forceFresh ?? [];
  const forced = (cell: PerformanceCell) => force === 'all' || force.includes(cell.id) || force.includes(cell.subject) || force.includes(cell.measurement);
  const missingEvidence: string[] = [];
  const decisions: string[] = [];
  const invalid = new Set(inputs.invalidArtifacts ?? []);

  if (inputs.triggered === false) {
    let stale = 0;
    const cells = inputs.manifest.cells.map((cell): PerformanceCellPlan => {
      const current = inputs.current(cell);
      if (!current || identityDifferences(cell.identity, current).length) stale += 1;
      return {
        cell: cell.id, measurement: cell.measurement, setting: cell.setting, subject: cell.subject, workload: cell.workload, changed: [], origin: 'reuse', reason: 'no-performance-input-changed',
        source: { artifact: cell.artifact.path, byteDigest: cell.artifact.byteDigest, measuredAt: cell.artifact.measuredAt, host: { platform: cell.artifact.host.platform, arch: cell.artifact.host.arch, cpuModel: cell.artifact.host.cpuModel }, identity: cell.identityDigest },
      };
    });
    return { cells, jobs: [], peerProcesses: 0, decisions: [], missingEvidence: stale ? [`${stale} performance cell(s) already have a stale identity; this change touches no performance input, so none is scheduled (plan --axis performance to see them)`] : [] };
  }

  const first = inputs.manifest.cells.map((cell): PerformanceCellPlan => {
    const base = { cell: cell.id, measurement: cell.measurement, setting: cell.setting, subject: cell.subject, workload: cell.workload, changed: [] as string[] };
    if (invalid.has(cell.artifact.path)) { missingEvidence.push(`${cell.artifact.path} is missing or differs from its recorded digest; ${cell.id} cannot be reused`); return { ...base, origin: 'fresh', reason: 'stored-result-invalid' }; }
    if (forced(cell)) return { ...base, origin: 'fresh', reason: 'force-fresh' };
    const current = inputs.current(cell);
    if (!current) { missingEvidence.push(`${cell.id}: the repository pins no current identity for this cell`); return { ...base, origin: 'fresh', reason: 'no-stored-result' }; }
    const changed = identityDifferences(cell.identity, current);
    if (changed.length) return { ...base, origin: 'fresh', reason: 'identity-changed', changed };
    return {
      ...base, origin: 'reuse', reason: 'unchanged-identity',
      source: { artifact: cell.artifact.path, byteDigest: cell.artifact.byteDigest, measuredAt: cell.artifact.measuredAt, host: { platform: cell.artifact.host.platform, arch: cell.artifact.host.arch, cpuModel: cell.artifact.host.cpuModel }, identity: cell.identityDigest },
    };
  });

  // The harness measures every subject of one job (measurement, or measurement + setting) together. A fresh cell therefore starts the others of its job
  // unless the maintainer explicitly asked for that (a controlled comparison or a force-fresh that names them): that is a decision, never a silent fan-out.
  const jobKey = (c: { measurement: string; setting: string | null }) => {
    const entry = inputs.manifest.measurements.find(m => m.id === c.measurement);
    return entry?.jobKey === 'measurement+setting' && c.setting ? `${c.measurement}/${c.setting}` : c.measurement;
  };
  const byJob = new Map<string, PerformanceCellPlan[]>();
  for (const cell of first) byJob.set(jobKey(cell), [...(byJob.get(jobKey(cell)) ?? []), cell]);

  const plans: PerformanceCellPlan[] = [];
  const jobs: PerformanceJobPlan[] = [];
  let peerProcesses = 0;
  for (const [job, cells] of byJob) {
    const fresh = cells.filter(c => c.origin === 'fresh');
    if (!fresh.length) { plans.push(...cells); continue; }
    const subjects = [...new Set(cells.map(c => c.subject))];
    const freshSubjects = new Set(fresh.map(c => c.subject));
    const explicit = inputs.controlledComparison || force === 'all' || fresh.every(c => c.reason === 'force-fresh');
    const others = subjects.filter(s => !freshSubjects.has(s));
    if (others.length && !explicit) {
      // Reuse stays reuse; the cells the harness would also run are named and wait for a decision, so no peer process is scheduled here.
      decisions.push(`${job}: ${[...freshSubjects].join(', ')} changed, and the harness measures ${subjects.join(', ')} together. Running it would execute ${others.join(', ')} as well. Request a controlled comparison (all subjects fresh, same run) or add subject support to the harness; nothing is scheduled.`);
      plans.push(...cells);
      continue;
    }
    const perCell = inputs.invocationsPerCell?.(cells[0].measurement) ?? null;
    const all = cells.map(c => (c.origin === 'fresh' ? c : { ...c, origin: 'fresh' as const, reason: (inputs.controlledComparison ? 'controlled-comparison' : 'run-with-measurement') as PerformanceReason, harnessForced: true as const, source: undefined }));
    plans.push(...all);
    peerProcesses += cells.filter(c => c.origin === 'reuse').length;
    jobs.push({ job, measurement: cells[0].measurement, setting: cells[0].setting, subjects, engineInvocations: perCell === null ? null : perCell * cells.length, runnerMinutes: inputs.telemetry?.minutesFor(`performance:${job}`) ?? null });
  }
  return { cells: plans, jobs, peerProcesses, decisions, missingEvidence };
}

// ---------------------------------------------------------------- accuracy

export interface RegistryLike {
  scanners: { id: string }[];
  populations: { id: string }[];
  runs: { id: string; population: string; platform: string; kind?: string; artifact: { byteDigest: string } }[];
}
export interface ReusePlanLike { population: string; verdict: 'plan' | 'refused'; scanners: { scanner: string; origin: 'fresh' | 'reused'; reason: string }[]; rescore: boolean; missingEvidence: string[]; refusals: string[] }
export type AccuracyReason =
  | 'unchanged-inputs' | 'product-under-test' | 'identity-changed' | 'fixture-changed' | 'expectations-changed' | 'force-fresh' | 'official-lane-measures-every-scanner' | 'no-reuse-plan' | 'compatible-observation' | 'rescored';
export interface AccuracyScannerPlan { scanner: string; origin: 'reuse' | 'fresh' | 'rescore'; reason: AccuracyReason; source?: string }
export interface AccuracyPopulationPlan { population: string; action: 'reuse-recorded-run' | 'fresh' | 'rescore'; scanners: AccuracyScannerPlan[]; engineRuns: number; runnerMinutes: number | null }

export interface AccuracyInputs {
  registry: RegistryLike;
  platform: string;
  kinds: Partial<Record<ChangeKind, string[]>>;
  /** Scanner ids whose registry pin differs from the base (the caller diffs the registry files). */
  changedScanners: string[];
  product: string;
  lane: 'official' | 'diagnostic';
  reusePlans?: ReusePlanLike[];
  forceFresh?: string[] | 'all';
  /** Engine runs a fresh population job makes (two repeats; the public population adds two methods runs). */
  engineRunsFor: (population: string) => number;
  telemetry?: Telemetry;
}
export interface AccuracyPlan { populations: AccuracyPopulationPlan[]; decisions: string[]; missingEvidence: string[] }

export function planAccuracy(inputs: AccuracyInputs): AccuracyPlan {
  const { kinds, registry } = inputs;
  const fixtures = Boolean(kinds['accuracy-fixtures']?.length);
  const expectations = Boolean(kinds['accuracy-expectations']?.length);
  const pins = inputs.changedScanners.length > 0 || Boolean(kinds['scanner-pin']?.length);
  const force = inputs.forceFresh ?? [];
  const forcedScanner = (id: string) => force === 'all' || force.includes(id);
  const decisions: string[] = [];
  const missingEvidence: string[] = [];
  const ids = registry.scanners.map(s => s.id).sort();

  const populations = registry.populations.map(({ id: population }): AccuracyPopulationPlan => {
    const recorded = registry.runs.find(r => r.population === population && r.platform === inputs.platform && r.kind !== 'methods');
    const source = recorded ? `official run ${recorded.id} (${recorded.artifact.byteDigest})` : undefined;
    const reusePlan = inputs.reusePlans?.find(p => p.population === population);
    const anyForced = ids.some(forcedScanner);
    if (!fixtures && !expectations && !pins && !anyForced) {
      if (!recorded) missingEvidence.push(`${population} has no recorded official run on ${inputs.platform}`);
      return { population, action: 'reuse-recorded-run', scanners: ids.map(scanner => ({ scanner, origin: 'reuse', reason: 'unchanged-inputs', source })), engineRuns: 0, runnerMinutes: 0 };
    }
    const scanners = ids.map((scanner): AccuracyScannerPlan => {
      if (forcedScanner(scanner)) return { scanner, origin: 'fresh', reason: 'force-fresh' };
      if (scanner === inputs.product) return { scanner, origin: 'fresh', reason: 'product-under-test' };
      if (inputs.lane === 'official') return { scanner, origin: 'fresh', reason: 'official-lane-measures-every-scanner' };
      // The diagnostic lane may reuse verified observations under credential-eval ADR 0008 (#706); the plan only repeats what that plan says.
      const mine = reusePlan?.scanners.find(s => s.scanner === scanner);
      if (!reusePlan || reusePlan.verdict === 'refused' || !mine) return { scanner, origin: 'fresh', reason: 'no-reuse-plan' };
      if (mine.origin === 'reused') return { scanner, origin: reusePlan.rescore ? 'rescore' : 'reuse', reason: reusePlan.rescore ? 'rescored' : 'compatible-observation', source: 'verified observation archive (#706)' };
      return { scanner, origin: 'fresh', reason: inputs.changedScanners.includes(scanner) ? 'identity-changed' : fixtures ? 'fixture-changed' : 'no-reuse-plan' };
    });
    if (!reusePlan && inputs.lane === 'diagnostic') missingEvidence.push(`${population}: no #706 reuse plan was given, so every peer is planned fresh (cache miss)`);
    if (reusePlan?.refusals.length) decisions.push(`${population}: the #706 reuse plan was refused (${reusePlan.refusals.join('; ')}); the archive must be fixed, it is not worked around`);
    for (const note of reusePlan?.missingEvidence ?? []) missingEvidence.push(`${population}: ${note}`);
    const freshCount = scanners.filter(s => s.origin === 'fresh').length;
    const rescoreOnly = freshCount === 0 && scanners.some(s => s.origin === 'rescore');
    const action = freshCount > 0 ? 'fresh' : rescoreOnly ? 'rescore' : 'reuse-recorded-run';
    return {
      population, action, scanners,
      engineRuns: freshCount > 0 ? inputs.engineRunsFor(population) : 0,
      runnerMinutes: freshCount > 0 ? (inputs.telemetry?.minutesFor(`official-run:${population}`) ?? null) : 0,
    };
  });
  return { populations, decisions, missingEvidence };
}

// ---------------------------------------------------------------- telemetry

export interface TelemetryFile { schema: string; jobs: Record<string, { runnerMinutes: number; runs: { run: number; minutes: number }[] }> }
export class Telemetry {
  constructor(private readonly file: TelemetryFile | null) {}
  /** The recorded runner-minutes of one job kind, or null: unknown stays unknown. */
  minutesFor(key: string): number | null { return this.file?.jobs[key]?.runnerMinutes ?? null; }
}

// ---------------------------------------------------------------- the whole plan

export interface ExecutionPlanInputs {
  axis: Axis;
  files: string[];
  axes: AxesRules;
  accuracy?: Omit<AccuracyInputs, 'kinds'>;
  performance?: PerformanceInputs;
}

export interface DispatchStep { axis: 'accuracy' | 'performance'; workflow: string; inputs: Record<string, string>; command: string; covers: string[] }

export interface ExecutionPlan {
  schema: typeof EXECUTION_PLAN_SCHEMA;
  axis: Axis;
  verdict: 'plan' | 'needs-decision';
  change: { files: number; kinds: Partial<Record<ChangeKind, string[]>>; unclassified: string[] };
  accuracy: AccuracyPlan | null;
  performance: PerformancePlan | null;
  /** The separate dispatches that run exactly what this plan schedules, one per axis job; empty while a decision is open or nothing is scheduled. */
  dispatch: DispatchStep[];
  decisions: string[];
  missingEvidence: string[];
  counts: {
    accuracy: { executed: number; reused: number; rescored: number; jobs: number; engineRuns: number };
    performance: { executed: number; reused: number; jobs: number; engineInvocations: number | null; peerProcesses: number };
    runnerMinutes: { known: number; unknownJobs: number };
  };
}

export function planExecution(inputs: ExecutionPlanInputs): ExecutionPlan {
  const { kinds, unclassified } = classifyChanges(inputs.files, inputs.axes);
  const decisions: string[] = [];
  if (unclassified.length) decisions.push(`no rule in benchmarks/execution-axes.json classifies ${unclassified.join(', ')}; add a rule or name the axis. Nothing is guessed, so nothing is scheduled for them.`);

  const accuracy = inputs.axis !== 'performance' && inputs.accuracy ? planAccuracy({ ...inputs.accuracy, kinds }) : null;
  const performanceTouched = Boolean(kinds['scanner-pin']?.length || kinds['performance-workload']?.length || kinds['measurement-code']?.length);
  const forcedPerf = inputs.performance?.forceFresh === 'all' || (inputs.performance?.forceFresh?.length ?? 0) > 0 || inputs.performance?.controlledComparison === true;
  const performance = inputs.axis !== 'accuracy' && inputs.performance
    ? planPerformance({ ...inputs.performance, triggered: inputs.axis === 'performance' || performanceTouched || forcedPerf })
    : null;
  decisions.push(...(accuracy?.decisions ?? []), ...(performance?.decisions ?? []));

  const accuracyJobs = accuracy?.populations.filter(p => p.action === 'fresh') ?? [];
  const perfJobs = performance?.jobs ?? [];
  const cellsFresh = performance?.cells.filter(c => c.origin === 'fresh') ?? [];
  const scannerFresh = accuracy?.populations.flatMap(p => p.scanners).filter(s => s.origin === 'fresh').length ?? 0;
  const invocations = perfJobs.map(j => j.engineInvocations);
  const minutes = [...accuracyJobs.map(p => p.runnerMinutes), ...perfJobs.map(j => j.runnerMinutes)];

  const dispatch: DispatchStep[] = [];
  if (!decisions.length) {
    const cmd = (workflow: string, ins: Record<string, string>) => `gh workflow run ${workflow} --ref <branch>${Object.entries(ins).map(([k, v]) => ` -f ${k}=${v}`).join('')}`;
    if (accuracyJobs.length) {
      const ins = { mode: inputs.accuracy?.lane === 'diagnostic' ? 'diagnostic' : 'full' };
      dispatch.push({ axis: 'accuracy', workflow: 'official-runs.yml', inputs: ins, command: cmd('official-runs.yml', ins), covers: accuracyJobs.map(p => p.population) });
    }
    for (const job of perfJobs) {
      const entry = inputs.performance?.manifest.measurements.find(m => m.id === job.measurement);
      if (entry?.dispatch) dispatch.push({ axis: 'performance', workflow: entry.dispatch.workflow, inputs: entry.dispatch.inputs, command: cmd(entry.dispatch.workflow, entry.dispatch.inputs), covers: [job.job] });
    }
  }

  return {
    schema: EXECUTION_PLAN_SCHEMA,
    axis: inputs.axis,
    verdict: decisions.length ? 'needs-decision' : 'plan',
    change: { files: inputs.files.length, kinds, unclassified },
    accuracy, performance, dispatch,
    decisions,
    missingEvidence: [...(accuracy?.missingEvidence ?? []), ...(performance?.missingEvidence ?? [])],
    counts: {
      accuracy: {
        executed: scannerFresh,
        reused: accuracy?.populations.flatMap(p => p.scanners).filter(s => s.origin === 'reuse').length ?? 0,
        rescored: accuracy?.populations.flatMap(p => p.scanners).filter(s => s.origin === 'rescore').length ?? 0,
        jobs: accuracyJobs.length, engineRuns: accuracyJobs.reduce((n, p) => n + p.engineRuns, 0),
      },
      performance: {
        executed: cellsFresh.length, reused: performance?.cells.filter(c => c.origin === 'reuse').length ?? 0, jobs: perfJobs.length,
        engineInvocations: invocations.length === 0 ? 0 : invocations.some(n => n === null) ? null : invocations.reduce<number>((n, v) => n + (v ?? 0), 0),
        peerProcesses: performance?.peerProcesses ?? 0,
      },
      runnerMinutes: { known: Math.round(minutes.reduce<number>((n, m) => n + (m ?? 0), 0) * 100) / 100, unknownJobs: minutes.filter(m => m === null).length },
    },
  };
}

export function renderExecutionPlan(plan: ExecutionPlan): string {
  const lines = [`## Execution plan (${plan.axis}): ${plan.verdict}`, '', 'A dry run: nothing below has been started.', ''];
  lines.push(`Changed files: ${plan.change.files}. ${Object.entries(plan.change.kinds).map(([k, f]) => `${k} ${f!.length}`).join(', ') || 'none'}${plan.change.unclassified.length ? `, unclassified ${plan.change.unclassified.length}` : ''}.`, '');
  const c = plan.counts;
  lines.push('| | Executed | Reused | Re-scored | Jobs | Engine runs / invocations | Peer processes |', '| --- | ---: | ---: | ---: | ---: | ---: | ---: |');
  if (plan.accuracy) lines.push(`| Accuracy (scanner x population) | ${c.accuracy.executed} | ${c.accuracy.reused} | ${c.accuracy.rescored} | ${c.accuracy.jobs} | ${c.accuracy.engineRuns} | n/a |`);
  if (plan.performance) lines.push(`| Performance (cells) | ${c.performance.executed} | ${c.performance.reused} | n/a | ${c.performance.jobs} | ${c.performance.engineInvocations ?? 'unknown'} | ${c.performance.peerProcesses} |`);
  lines.push('', `Runner-minutes (historical telemetry): ${c.runnerMinutes.known} known${c.runnerMinutes.unknownJobs ? `, ${c.runnerMinutes.unknownJobs} job(s) unknown` : ''}. Reported apart from wall-clock latency.`, '');
  if (plan.dispatch.length) lines.push('### Dispatch (separate workflows, one per axis)', '', ...plan.dispatch.map(d => `- ${d.axis}: \`${d.command}\` (${d.covers.join(', ')})`), '');
  if (plan.decisions.length) lines.push('### Decisions needed', '', ...plan.decisions.map(d => `- ${d}`), '');
  if (plan.accuracy) {
    lines.push('### Accuracy', '', '| Population | Action | Scanner | Origin | Reason |', '| --- | --- | --- | --- | --- |');
    for (const p of plan.accuracy.populations) for (const s of p.scanners) lines.push(`| ${p.population} | ${p.action} | ${s.scanner} | ${s.origin} | ${s.reason}${s.source ? ` (${s.source})` : ''} |`);
    lines.push('');
  }
  if (plan.performance) {
    lines.push('### Performance', '', '| Cell | Origin | Reason | Source (independent historical measurement) |', '| --- | --- | --- | --- |');
    for (const x of plan.performance.cells) lines.push(`| ${x.cell} | ${x.origin} | ${x.reason}${x.changed.length ? ` (${x.changed.join(', ')})` : ''}${x.harnessForced ? ' (harness)' : ''} | ${x.source ? `${x.source.artifact}, measured ${x.source.measuredAt} on ${x.source.host.platform}-${x.source.host.arch} ${x.source.host.cpuModel}` : ''} |`);
    lines.push('', 'Reused cells are independent historical measurements. They are not same-run results and imply no faster/slower direction.', '');
  }
  if (plan.missingEvidence.length) lines.push('### Missing evidence', '', ...plan.missingEvidence.map(m => `- ${m}`), '');
  return `${lines.join('\n')}\n`;
}
