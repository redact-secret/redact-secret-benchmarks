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
import { once, readJson, readJsonIfPresent } from './repo';

export const RUNTIME_SNAPSHOT = 'evidence/429/peer-pii-runtime-throughput.json';

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

export interface PeerRuntime {
  tools: RuntimeTool[];
  workloads: RuntimeWorkload[];
  warmupSamples: number;
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

    const tools: RuntimeTool[] = plan.tools.map(t => {
      const seen = valid?.tools.find(s => s.id === t.id);
      return {
        id: t.id, package: t.package, call: t.call, async: t.async, piiSelectors: t.piiSelectors ?? [],
        ...(seen ? { version: seen.version, buildKind: seen.provenance.kind, ...(seen.provenance.piiActivation ? { piiActivation: seen.provenance.piiActivation } : {}) } : {}),
      };
    });
    return { tools, workloads, warmupSamples: plan.sampleProtocol.warmupSamples, measurement };
  });
}
