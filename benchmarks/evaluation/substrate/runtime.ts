import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export interface RuntimeInput { id: string; path: string; content: string }
export interface RuntimeFinding { path: string; start: number; end: number; family?: string; action?: string }
export interface RuntimeScanner<TRaw extends RuntimeFinding = RuntimeFinding> {
  id: string; mode: string; configuration?: Record<string, unknown>;
  capabilities?: { ranges: boolean; classification: boolean };
  version(directory: string): Promise<string>;
  scan(directory: string, inputs: RuntimeInput[]): Promise<TRaw[]>;
}
export type RuntimeObservationProvenance =
  | { source: 'fresh'; observedAt: string; sourceRunId: string }
  | { source: 'snapshot'; observedAt: string; sourceRunId: string; snapshotDigest: string; inputDigest: string };
export type RuntimeObservation<TFinding extends RuntimeFinding = RuntimeFinding> = {
  id: string; version: string | null; mode: string; configuration?: Record<string, unknown>; configurationHash?: string;
} & (
  { status: 'complete'; findings: TFinding[]; durationMs: number; replays: { count: number; agreed: boolean; divergentPaths?: string[] }; observation?: RuntimeObservationProvenance } |
  { status: 'unsupported' | 'unavailable' | 'error'; message: string; findings?: never; observation?: RuntimeObservationProvenance } |
  { status: 'unstable'; message: string; findings: []; replays: { count: number; agreed: boolean; divergentPaths?: string[] }; observation?: RuntimeObservationProvenance }
);

const tuples = (findings: RuntimeFinding[], identity: (value: unknown) => string) => findings
  // Compare the complete normalized finding. Domain fields beyond ranges/family/action
  // are evidence too and must not be allowed to vary between stability replays.
  .map(finding => JSON.stringify([finding.path, identity(finding)]))
  .sort();

export async function executeRuntime<
  TInput extends RuntimeInput,
  TRaw extends RuntimeFinding,
  TFinding extends RuntimeFinding,
>(options: {
  inputs: TInput[];
  scanners: RuntimeScanner<TRaw>[];
  reusedObservations?: RuntimeObservation<TFinding>[];
  runId: string;
  replays: number;
  scratchParent?: string;
  onProgress?: (message: string) => void;
  identity: (value: unknown) => string;
  normalizeFinding: (finding: TRaw, scanner: RuntimeScanner<TRaw>) => TFinding;
  validateFindings: (findings: RuntimeFinding[]) => void;
  captureObservations?: (inputs: TInput[], observations: RuntimeObservation<TFinding>[]) => Promise<void>;
}) {
  const { inputs, scanners, runId, replays, identity, normalizeFinding, validateFindings } = options;
  const onProgress = options.onProgress ?? (() => {});
  const reused = structuredClone(options.reusedObservations ?? []);
  const allIds = [...scanners.map(scanner => scanner.id), ...reused.map(scanner => scanner.id)];
  if (!allIds.length || new Set(allIds).size !== allIds.length) throw new Error('Empty or duplicate scanner selection');
  const startedAt = new Date().toISOString();
  for (const observation of reused) {
    if (observation.status !== 'complete' || observation.observation?.source !== 'snapshot' ||
        observation.findings.some(finding => !inputs.some(input => input.path === finding.path) || finding.start < 0 || finding.end <= finding.start ||
          finding.end > Buffer.byteLength(inputs.find(input => input.path === finding.path)!.content)))
      throw new Error('Invalid reused peer observation');
    validateFindings(observation.findings);
    onProgress(`${observation.id}: reused snapshot ${observation.observation.snapshotDigest}`);
  }
  const observations: RuntimeObservation<TFinding>[] = [];
  const scratch = await mkdtemp(path.join(options.scratchParent ?? tmpdir(), 'secret-evaluation-'));
  try {
    for (const input of inputs) {
      const target = path.join(scratch, input.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, input.content, { mode: 0o600 });
    }
    for (const scanner of scanners) {
      let version = null;
      const configuration = scanner.configuration ?? { mode: scanner.mode ?? 'unspecified' };
      const metadata = { id: scanner.id, mode: scanner.mode, configuration, configurationHash: identity(configuration) };
      const start = performance.now();
      if (scanner.capabilities?.ranges === false) {
        observations.push({ ...metadata, version, status: 'unsupported', message: 'Adapter does not support source byte ranges.' });
        onProgress(`${scanner.id}: unsupported`);
        continue;
      }
      try {
        version = await scanner.version(scratch);
        const replayed: TFinding[][] = [];
        for (let replay = 0; replay < replays; replay++) {
          const raw = await scanner.scan(scratch, inputs.map(({ id, path: inputPath, content }) => ({ id, path: inputPath, content })));
          validateFindings(raw);
          replayed.push(raw.map(finding => normalizeFinding(finding, scanner)));
        }
        const [first, ...rest] = replayed.map(findings => tuples(findings, identity));
        const divergent = new Set<string>();
        for (const other of rest) for (const tuple of [...first.filter(value => !other.includes(value)), ...other.filter(value => !first.includes(value))])
          divergent.add(JSON.parse(tuple)[0]);
        if (divergent.size) observations.push({ ...metadata, version, status: 'unstable', findings: [],
          message: 'Replays over identical input disagreed; findings discarded and raw output suppressed.',
          replays: { count: replayed.length, agreed: false, divergentPaths: [...divergent].sort() } });
        else observations.push({ ...metadata, version, status: 'complete', findings: replayed[0],
          durationMs: Math.round(performance.now() - start), replays: { count: replayed.length, agreed: true },
          observation: { source: 'fresh', observedAt: startedAt, sourceRunId: runId } });
      } catch (error) {
        observations.push({ ...metadata, version,
          status: error instanceof Error && error.message === 'unavailable' ? 'unavailable' : 'error',
          message: 'Scanner unavailable or execution/normalization failed; raw output suppressed.' });
      }
      onProgress(`${scanner.id}: ${observations.at(-1)!.status}`);
    }
    observations.push(...reused);
    if (options.captureObservations) await options.captureObservations(inputs, observations);
    return { startedAt, observations };
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
