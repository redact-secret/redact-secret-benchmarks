import { executeRuntime, type RuntimeFinding, type RuntimeInput, type RuntimeObservation, type RuntimeScanner } from './runtime.ts';

/**
 * Domain-neutral evaluation orchestration. A domain prepares semantic cases and
 * supplies finding validation/normalization; the substrate only runs inputs and
 * returns observations to the domain composer.
 */
export async function executeDomainEvaluation<
  TPrepared extends { inputs: TInput[] },
  TInput extends RuntimeInput,
  TRaw extends RuntimeFinding,
  TFinding extends RuntimeFinding,
  TOutput,
>(options: {
  prepare: () => TPrepared;
  scanners: RuntimeScanner<TRaw>[];
  reusedObservations?: RuntimeObservation<TFinding>[];
  runId: string;
  replays: number;
  scratchParent?: string;
  onProgress?: (message: string) => void;
  identity: (value: unknown) => string;
  normalizeFinding: (finding: TRaw, scanner: RuntimeScanner<TRaw>) => TFinding;
  validateFindings: (findings: RuntimeFinding[], prepared: TPrepared) => void;
  captureObservations?: (inputs: TInput[], observations: RuntimeObservation<TFinding>[]) => Promise<void>;
  compose: (prepared: TPrepared, runtime: { startedAt: string; observations: RuntimeObservation<TFinding>[] }) => TOutput | Promise<TOutput>;
}) {
  const prepared = options.prepare();
  const runtime = await executeRuntime<TInput, TRaw, TFinding>({
    inputs: prepared.inputs,
    scanners: options.scanners,
    reusedObservations: options.reusedObservations,
    runId: options.runId,
    replays: options.replays,
    scratchParent: options.scratchParent,
    onProgress: options.onProgress,
    identity: options.identity,
    normalizeFinding: options.normalizeFinding,
    validateFindings: findings => options.validateFindings(findings, prepared),
    captureObservations: options.captureObservations,
  });
  return options.compose(prepared, runtime);
}
