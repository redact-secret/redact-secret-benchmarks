/**
 * Where each scanner's observation of a run came from (#724): scanned in that run, or taken from an earlier verified run.
 *
 * This is PROVENANCE, not evidence. The engine writes it into the artifact's `non_semantic` block (RunArtifact v1.6: `execution.scanners.<id>.origin` and
 * `origin_reason`, `execution.reuse`), which is excluded from the semantic digest on purpose: a run that reused a scanner's observations and one that scanned
 * it fresh have the same semantic digest. The adapter therefore never lets this module's output reach a count, an outcome, a denominator, a floor or a status;
 * it is carried into the view beside the semantic scope evidence and displayed apart from it. The bytes it is read from are the verified ones: the view job
 * checks every archived artifact against the byte digest `benchmarks/official-runs.json` records, `non_semantic` included.
 *
 * Three states, never two. `fresh` and `reused` are what the artifact says. `not-recorded` is what an artifact says when the run did not offer observations for
 * reuse (the engine writes `origin` only then) and for every artifact of an engine before v1.6: it is NOT read as `fresh`, because nothing in the artifact
 * says so. The reason is the engine's fixed vocabulary (`compatible`, `forced`, `no-recorded-observation`, `not-prepared`, `changed: <field>[, <field>]`); a
 * reason outside it is dropped, so no scanner output and no free text can reach a page through here.
 */
import type { RunArtifact } from './run-artifact.ts';

export type OriginState = 'fresh' | 'reused' | 'not-recorded';

export interface ScannerOrigin {
  scanner: string;
  origin: OriginState;
  /** The engine's fixed-vocabulary reason; null when none was recorded or it is not in the vocabulary. */
  reason: string | null;
}
export interface OriginRecord {
  scanners: ScannerOrigin[];
  /** The earlier observations the run drew on (digests only); null when the run reused nothing or recorded no reuse. */
  reuse: { sourceDigest: string; inputDigest: string } | null;
}

const REASON = /^(compatible|forced|no-recorded-observation|not-prepared|changed: [a-z_]+(, [a-z_]+)*)$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The origin of every scanner of one artifact, sorted by scanner id. Reads only the origin fields of `non_semantic.execution`; nothing else of it. */
export function observationOrigins(artifact: Pick<RunArtifact, 'scanners' | 'non_semantic'>): OriginRecord {
  const execution = object(artifact.non_semantic) && object(artifact.non_semantic.execution) ? artifact.non_semantic.execution : {};
  const perScanner = object(execution.scanners) ? execution.scanners : {};
  const scanners = artifact.scanners.map((run): ScannerOrigin => {
    const entry = perScanner[run.scanner];
    const origin = object(entry) ? entry.origin : undefined;
    const reason = object(entry) && typeof entry.origin_reason === 'string' && REASON.test(entry.origin_reason) ? entry.origin_reason : null;
    if (origin === 'fresh' || origin === 'reused') return { scanner: run.scanner, origin, reason };
    return { scanner: run.scanner, origin: 'not-recorded', reason: null };
  }).sort((a, b) => (a.scanner < b.scanner ? -1 : 1));
  const reuse = object(execution.reuse) && typeof execution.reuse.source_digest === 'string' && DIGEST.test(execution.reuse.source_digest) && typeof execution.reuse.input_digest === 'string' && DIGEST.test(execution.reuse.input_digest)
    ? { sourceDigest: execution.reuse.source_digest, inputDigest: execution.reuse.input_digest }
    : null;
  return { scanners, reuse };
}
