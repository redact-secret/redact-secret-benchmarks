/**
 * The cost-aware execution plan and the performance cell register (#709, docs/specs/execution-plan.md). A dry run: it starts no scan, no measurement and no job.
 *
 *   node --import tsx scripts/plan-execution.ts plan --axis <accuracy|performance|both> [--base <git ref> | --files a,b,c] [--lane official|diagnostic]
 *     [--platform linux-x64] [--accuracy-plan <reuse-plan.json>]... [--force-fresh <id,id|all>] [--controlled-comparison] [--out <dir>] [--strict]
 *   node --import tsx scripts/plan-execution.ts register --measurement <id> --plan <qualification/plan.json> --artifact <path>[:<setting>]... [--check]
 *
 * `--axis` has no default: `both` is an explicit choice. `plan` writes execution-plan.{json,md} (and prints the markdown); `--strict` exits 3 when the plan needs a
 * decision. `register` adds or refreshes the cells of one recorded performance artifact in benchmarks/performance-cells.json (identity from the artifact and the
 * plan it names, refused unless the artifact's planCommitment is that plan's); `--check` verifies the register without writing.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonical, sha256Digest } from '../benchmarks/qualification/canonical.ts';
import {
  CELLS_SCHEMA, Telemetry, identityDigest, planExecution, renderExecutionPlan,
  type Axis, type CellIdentity, type CellsManifest, type PerformanceCell, type SubjectIdentity,
} from '../benchmarks/qualification/execution-plan.ts';

const root = new URL('..', import.meta.url).pathname;
const read = (file: string) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));
const args = process.argv.slice(2);
const command = args[0];
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const repeated = (name: string) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
const fail = (message: string): never => { console.error(`execution plan refused: ${message}`); process.exit(4); };
const CELLS_FILE = 'benchmarks/performance-cells.json';

interface ToolEntry { id: string; version: string; provenance: { kind: string; package?: string; commit?: string; piiActivation?: string } }
interface PlanFile { id: string; contentCommitment: string; tools: { id: string; package: string }[]; sampleProtocol: Record<string, unknown>; generator?: unknown; workloads?: { id: string }[]; workloadsRef?: { path: string }; settings?: { id: string; activation: string }[] }

/** Workload definitions of a measurement plan: inline (v2) or in the referenced workloads file (v1). */
function workloadsOf(plan: PlanFile): { generator: unknown; workloads: { id: string }[] } {
  if (plan.workloads) return { generator: plan.generator, workloads: plan.workloads };
  const ref = read(plan.workloadsRef!.path) as { generator: unknown; workloads: { id: string }[] };
  return { generator: ref.generator, workloads: ref.workloads };
}
const workloadDigest = (plan: PlanFile, workload: string) => {
  const found = workloadsOf(plan).workloads.find(w => w.id === workload);
  return found ? sha256Digest(canonical(found)) : null;
};
const protocolDigest = (plan: PlanFile) => sha256Digest(canonical({ sampleProtocol: plan.sampleProtocol, generator: workloadsOf(plan).generator }));

function register() {
  const measurement = option('measurement') ?? fail('--measurement is required');
  const planFile = option('plan') ?? fail('--plan is required');
  const plan = read(planFile) as PlanFile;
  const manifest: CellsManifest = existsSync(path.join(root, CELLS_FILE)) ? read(CELLS_FILE) : { schema: CELLS_SCHEMA, measurements: [], cells: [] };
  const entries = repeated('artifact').map(spec => { const [file, setting] = spec.split(':'); return { file, setting: setting ?? null }; });
  if (!entries.length) fail('--artifact is required');
  const cells: PerformanceCell[] = [];
  for (const { file, setting } of entries) {
    const bytes = readFileSync(path.join(root, file));
    const artifact = JSON.parse(bytes.toString('utf8')) as { planCommitment: string; artifactCommitment: string; generatedAt: string; runner: { platform: string; arch: string; cpuModel: string; imageDigest?: string }; tools: ToolEntry[]; observations: { tool: string; workload: string; samples: unknown[] }[] };
    if (artifact.planCommitment !== plan.contentCommitment) fail(`${file} was measured under plan ${artifact.planCommitment}, ${planFile} is ${plan.contentCommitment}: a plan that changed since cannot vouch for it`);
    const settingDef = setting ? plan.settings?.find(s => s.id === setting) : undefined;
    if (setting && !settingDef) fail(`${planFile} has no setting ${setting}`);
    for (const obs of artifact.observations) {
      const tool = artifact.tools.find(t => t.id === obs.tool) ?? fail(`${file}: no tool ${obs.tool}`);
      const pkg = plan.tools.find(t => t.id === obs.tool)?.package ?? tool.provenance.package ?? fail(`${planFile}: no package for ${obs.tool}`);
      const digest = workloadDigest(plan, obs.workload) ?? fail(`${planFile} defines no workload ${obs.workload}`);
      const subject: SubjectIdentity = { id: tool.id, version: tool.version, package: pkg, kind: tool.provenance.kind, commit: tool.provenance.commit ?? null, activation: tool.provenance.piiActivation ?? null };
      const identity: CellIdentity = { subject, workloadDigest: digest, protocolDigest: protocolDigest(plan) };
      cells.push({
        id: `${measurement}/${setting ?? 'default'}/${obs.tool}/${obs.workload}`, measurement, setting, subject: obs.tool, workload: obs.workload, identity, identityDigest: identityDigest(identity),
        artifact: { path: file, byteDigest: sha256Digest(bytes), artifactCommitment: artifact.artifactCommitment, measuredAt: artifact.generatedAt, host: { platform: artifact.runner.platform, arch: artifact.runner.arch, cpuModel: artifact.runner.cpuModel, imageDigest: artifact.runner.imageDigest ?? null }, observations: obs.samples.length },
      });
    }
  }
  const merged: CellsManifest = {
    schema: CELLS_SCHEMA,
    measurements: [...manifest.measurements.filter(m => m.id !== measurement), { id: measurement, plan: planFile, granularity: 'measurement', jobKey: entries.some(e => e.setting) ? 'measurement+setting' : 'measurement' }].sort((a, b) => (a.id < b.id ? -1 : 1)),
    cells: [...manifest.cells.filter(c => !cells.some(n => n.id === c.id)), ...cells].sort((a, b) => (a.id < b.id ? -1 : 1)),
  };
  const text = `${JSON.stringify(merged, null, 2)}\n`;
  if (args.includes('--check')) { if (text !== readFileSync(path.join(root, CELLS_FILE), 'utf8')) fail(`${CELLS_FILE} does not match its artifacts and plans`); console.log(`${CELLS_FILE} matches (${merged.cells.length} cells)`); return; }
  writeFileSync(path.join(root, CELLS_FILE), text);
  console.log(`registered ${cells.length} cells of ${measurement} (${merged.cells.length} in total)`);
}

function plan() {
  const axis = option('axis') as Axis | undefined;
  if (axis !== 'accuracy' && axis !== 'performance' && axis !== 'both') fail('--axis must be accuracy, performance or both (no default: both is an explicit choice)');
  const lane = option('lane') ?? 'official';
  if (lane !== 'official' && lane !== 'diagnostic') fail('--lane must be official or diagnostic');
  const platform = option('platform') ?? 'linux-x64';

  const base = option('base');
  const files = option('files') !== undefined ? option('files')!.split(',').filter(Boolean)
    : execFileSync('git', ['diff', '--name-only', `${base ?? 'origin/develop'}...HEAD`], { encoding: 'utf8', cwd: root }).split('\n').filter(Boolean);

  const registry = read('benchmarks/official-runs.json');
  let baseRegistry: { scanners: { id: string }[] } | undefined;
  if (base) { try { baseRegistry = JSON.parse(execFileSync('git', ['show', `${base}:benchmarks/official-runs.json`], { encoding: 'utf8', cwd: root })); } catch { baseRegistry = undefined; } }
  const changedScanners = baseRegistry ? registry.scanners.filter((s: { id: string }) => JSON.stringify(s) !== JSON.stringify(baseRegistry!.scanners.find(b => b.id === s.id))).map((s: { id: string }) => s.id) : [];

  const force = option('force-fresh');
  const forceFresh = force === 'all' ? 'all' as const : force ? force.split(',') : [];
  const telemetryFile = path.join(root, 'benchmarks/execution-telemetry.json');
  const telemetry = new Telemetry(existsSync(telemetryFile) ? JSON.parse(readFileSync(telemetryFile, 'utf8')) : null);
  const manifest: CellsManifest = existsSync(path.join(root, CELLS_FILE)) ? read(CELLS_FILE) : { schema: CELLS_SCHEMA, measurements: [], cells: [] };
  const pkg = read('package.json') as { dependencies: Record<string, string> };
  const pinManifest = read('benchmarks/pin-manifest.json') as { pins: { redactSecretRevision: string } };
  const plans = new Map(manifest.measurements.map(m => [m.id, read(m.plan) as PlanFile]));

  const invalidArtifacts = [...new Set(manifest.cells.map(c => c.artifact))].filter(a => !existsSync(path.join(root, a.path)) || sha256Digest(readFileSync(path.join(root, a.path))) !== a.byteDigest).map(a => a.path);
  const current = (cell: PerformanceCell): CellIdentity | null => {
    const measurementPlan = plans.get(cell.measurement);
    const digest = measurementPlan ? workloadDigest(measurementPlan, cell.workload) : null;
    const version = pkg.dependencies[cell.identity.subject.package];
    if (!measurementPlan || !digest || !version) return null;
    const product = cell.subject === 'redact-secret';
    const settingDef = cell.setting ? measurementPlan.settings?.find(s => s.id === cell.setting) : undefined;
    return {
      subject: {
        id: cell.subject, version, package: cell.identity.subject.package, kind: 'published-npm-package',
        commit: product ? pinManifest.pins.redactSecretRevision : null,
        // A setting's activation is the plan's; a plan without settings records the activation it ran with, which it cannot change by itself.
        activation: product ? (settingDef?.activation ?? cell.identity.subject.activation) : null,
      },
      workloadDigest: digest, protocolDigest: protocolDigest(measurementPlan),
    };
  };
  const invocationsPerCell = (measurement: string) => { const p = plans.get(measurement); const s = p?.sampleProtocol as { samplesPerCell?: number; warmupSamples?: number } | undefined; return s?.samplesPerCell === undefined ? null : s.samplesPerCell + (s.warmupSamples ?? 0); };

  const reusePlans = repeated('accuracy-plan').map(file => JSON.parse(readFileSync(file, 'utf8')));
  const axes = read('benchmarks/execution-axes.json');
  const result = planExecution({
    axis, files, axes,
    accuracy: { registry, platform, changedScanners, product: 'redact-secret', lane, reusePlans, forceFresh, telemetry, engineRunsFor: population => (population === 'public-evidence-snapshot' ? 4 : 2) },
    performance: { manifest, current, forceFresh, controlledComparison: args.includes('--controlled-comparison'), invocationsPerCell, telemetry, invalidArtifacts },
  });
  const markdown = renderExecutionPlan(result);
  const out = option('out');
  if (out) { mkdirSync(out, { recursive: true }); writeFileSync(path.join(out, 'execution-plan.json'), `${JSON.stringify(result, null, 2)}\n`); writeFileSync(path.join(out, 'execution-plan.md'), markdown); }
  process.stdout.write(markdown);
  if (args.includes('--strict') && result.verdict === 'needs-decision') process.exit(3);
}

if (command === 'register') register();
else if (command === 'plan') plan();
else fail('Usage: plan-execution.ts <plan|register> ...');
