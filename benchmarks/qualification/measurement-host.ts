/**
 * Where and when an official credential run was measured (#620, #621). PROVENANCE, never evidence: nothing here reaches a count, an outcome, a
 * denominator, a floor, a status, a run id, a configuration hash or a semantic digest. Decision:
 * docs/decisions/2026-10-07-record-the-measurement-host-at-execution-and-keep-it-out-of-run-identity.md.
 *
 * Two sources, kept apart because they are verified differently:
 *
 *  - `engineTelemetry(artifact)`: what the engine itself wrote into the RunArtifact's `non_semantic` block (`host`, an OS/architecture string such as
 *    `linux-x86_64`; `started_at` and `finished_at`, RFC 3339). These bytes are the verified ones: the view job checks every archived artifact against
 *    the byte digest `benchmarks/official-runs.json` records. The engine contract (RunArtifact v1) carries nothing else about the host: no OS release, no
 *    CPU model or core count, no Node version and no CI image. That gap is upstream (credential-eval), and is shown as unavailable, never filled in.
 *  - `captureMeasurementHost()`: the facts the benchmark's own driver (`scripts/run-official-credential-eval.ts`) reads from the machine at the moment it
 *    runs the engine, written into the run record next to the artifact and copied by `official-runs:record` into `runs[].measurementHost`. A stage taken
 *    from an earlier run's receipt carries that run's host (or none), never the host of the job that reused it, and a site build never adds one.
 *
 * Every value is a bounded string from a fixed character set, so no path, username, hostname or free text can reach a page through here.
 */

export const MEASUREMENT_HOST_SCHEMA = 'redact-secret-benchmarks/measurement-host/v1';

/** What the engine reported about where and when it ran, from the artifact's `non_semantic` block. `null` fields are not recorded by the artifact. */
export interface EngineTelemetry {
  /** The engine's OS/architecture string (`linux-x86_64`); `null` when absent or not in the expected shape. */
  host: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

/** The host facts the benchmark recorded at measurement execution. */
export interface MeasurementHost {
  schema: typeof MEASUREMENT_HOST_SCHEMA;
  /** When the facts were read: the moment the driver started the engine (UTC, RFC 3339). */
  capturedAt: string;
  /** `os.release()` (the kernel release) and the distribution name from `/etc/os-release` (`null` where there is none, such as macOS). */
  os: { platform: string; arch: string; release: string; name: string | null };
  cpu: { model: string | null; logicalCores: number };
  node: string;
  /** The CI runner image, when the measurement ran on a GitHub-hosted runner; `null` off CI. */
  ci: { provider: 'github-actions'; image: string | null; imageVersion: string | null; runnerEnvironment: string | null } | null;
}

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;
const ENGINE_HOST = /^[a-z0-9_]{1,24}-[a-z0-9_]{1,24}$/;
const TOKEN = /^[A-Za-z0-9._+-]{1,64}$/;
/** Descriptive text (an OS name, a CPU model): letters, digits, spaces and a little punctuation; no slash, so no path. */
const TEXT = /^[A-Za-z0-9 ._()@,+:-]{1,120}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown, re: RegExp): string | null => (typeof v === 'string' && re.test(v) ? v : null);

/** The engine's own host and time stamps of one artifact. Reads only `non_semantic.host`, `started_at` and `finished_at`; anything else is ignored. */
export function engineTelemetry(artifact: { non_semantic: unknown }): EngineTelemetry {
  const n = object(artifact.non_semantic) ? artifact.non_semantic : {};
  return { host: str(n.host, ENGINE_HOST), startedAt: str(n.started_at, RFC3339), finishedAt: str(n.finished_at, RFC3339) };
}

/** `ID` and `NAME`/`PRETTY_NAME` of an `/etc/os-release` file, bounded to the safe text set. */
export function osName(osRelease: string | null): string | null {
  if (!osRelease) return null;
  const field = (key: string): string | null => {
    const line = osRelease.split('\n').find(l => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).replace(/^"|"$/g, '').trim() : null;
  };
  const name = field('PRETTY_NAME') ?? field('NAME');
  return name && TEXT.test(name) ? name : null;
}

export interface HostProbe {
  now: Date;
  env: Record<string, string | undefined>;
  platform: string; arch: string; release: string;
  osRelease: string | null;
  cpus: { model: string }[];
  node: string;
}

/** The host facts of the machine the probe describes. Pure: the driver hands it `node:os`, `process` and `/etc/os-release`. */
export function captureMeasurementHost(probe: HostProbe): MeasurementHost {
  const model = probe.cpus[0]?.model?.replace(/\s+/g, ' ').trim() ?? '';
  const onActions = probe.env.GITHUB_ACTIONS === 'true';
  return {
    schema: MEASUREMENT_HOST_SCHEMA,
    capturedAt: probe.now.toISOString(),
    os: { platform: probe.platform, arch: probe.arch, release: probe.release, name: osName(probe.osRelease) },
    cpu: { model: TEXT.test(model) ? model : null, logicalCores: probe.cpus.length },
    node: probe.node,
    ci: onActions
      ? { provider: 'github-actions', image: str(probe.env.ImageOS, TOKEN), imageVersion: str(probe.env.ImageVersion, TOKEN), runnerEnvironment: str(probe.env.RUNNER_ENVIRONMENT, TOKEN) }
      : null,
  };
}

/** Problems of a recorded host; `[]` when it holds. `at` names the record in the message. */
export function measurementHostProblems(value: unknown, at = 'measurementHost'): string[] {
  if (!object(value)) return [`${at} must be an object`];
  const p: string[] = [];
  const allowed = new Set(['schema', 'capturedAt', 'os', 'cpu', 'node', 'ci']);
  for (const key of Object.keys(value)) if (!allowed.has(key)) p.push(`${at}.${key} is not a host fact`);
  if (value.schema !== MEASUREMENT_HOST_SCHEMA) p.push(`${at}.schema must be ${MEASUREMENT_HOST_SCHEMA}`);
  if (str(value.capturedAt, RFC3339) === null) p.push(`${at}.capturedAt must be an RFC 3339 time`);
  const os = value.os;
  if (!object(os) || !str(os.platform, TOKEN) || !str(os.arch, TOKEN) || !str(os.release, TOKEN) || (os.name !== null && !str(os.name, TEXT))) p.push(`${at}.os needs platform, arch and release tokens and a name or null`);
  const cpu = value.cpu;
  if (!object(cpu) || (cpu.model !== null && !str(cpu.model, TEXT)) || !Number.isInteger(cpu.logicalCores) || (cpu.logicalCores as number) < 1 || (cpu.logicalCores as number) > 1024) p.push(`${at}.cpu needs a model (or null) and a logical core count from 1 to 1024`);
  if (!str(value.node, /^v\d+\.\d+\.\d+$/)) p.push(`${at}.node must be a Node version such as v22.11.0`);
  const ci = value.ci;
  if (ci !== null && (!object(ci) || ci.provider !== 'github-actions' || [ci.image, ci.imageVersion, ci.runnerEnvironment].some(v => v !== null && !str(v, TOKEN)))) p.push(`${at}.ci must be null or a github-actions runner with image, imageVersion and runnerEnvironment tokens (or null)`);
  return p;
}

/** Problems of the engine telemetry as the view carries it. */
export function engineTelemetryProblems(value: unknown, at = 'measurement'): string[] {
  if (!object(value)) return [`${at} must be an object`];
  const p: string[] = [];
  if (value.host !== null && !str(value.host, ENGINE_HOST)) p.push(`${at}.host must be an OS-architecture string or null`);
  for (const key of ['startedAt', 'finishedAt'] as const) if (value[key] !== null && !str(value[key], RFC3339)) p.push(`${at}.${key} must be an RFC 3339 time or null`);
  return p;
}
