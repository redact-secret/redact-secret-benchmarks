import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { canonical, parseKeepingNumbers, sha256Digest } from './canonical.ts';

/**
 * A consumer of credential-eval RunArtifact v1 (#605). It reads the artifact only through its published schema
 * (schemas/credential-eval-run-artifact-v1.json, vendored from credential-eval tag v0.1.0-alpha.3): it imports no
 * credential-eval code, never re-scores a case and never reads `non_semantic` as evidence
 * (credential-eval docs/qualification-boundary.md section 4).
 */
export const RUN_ARTIFACT_SCHEMA_TAG = 'credential-eval/run-artifact/v1';
export const RUN_ARTIFACT_SCHEMA_PATH = new URL('../../schemas/credential-eval-run-artifact-v1.json', import.meta.url);

export type Outcome = 'EXACT' | 'COVERED' | 'OVERBROAD' | 'PARTIAL' | 'MISS';
export type Measurement =
  | { type: 'positive'; span_outcomes: Outcome[]; leaked_bytes: number; collateral_bytes: number }
  | { type: 'control'; flagged: boolean; findings: number; co_detected?: boolean }
  | { type: 'pending' }
  | { type: 'not-measured'; status?: string };
export interface ObservedFinding { start: number; end: number; family?: string | null; action?: string | null }
export interface CaseResult {
  case_id: string; path: string; kind: 'must-redact' | 'must-not-flag' | 'policy'; tier: 'T0' | 'T1' | 'T2' | 'T3'; group: string;
  family?: string | null; targets?: string[]; taxonomy?: string | null; evidence_class?: string | null;
  twin_of?: string | null; twin_mutation_kind?: string | null;
  expected: { start: number; end: number; role: string; envelope?: { start: number; end: number } }[]; actual: ObservedFinding[]; measurement: Measurement;
}
export interface ScannerIdentity {
  id: string; version: string | null; mode: string; adapter: { id: string; version: string }; configuration_hash: string;
  build?: 'released' | 'candidate' | null; provenance?: { network?: string; components?: { kind: string; name: string; version?: string; sha256?: string; integrity?: string }[] } | null;
}
export interface Assertion { case_id: string; method: string; assertion: string; status: string; [key: string]: unknown }
/** Completeness report (RunArtifact v1.2): cases a `complete` scanner could not map to ranges. They are in no denominator and never a miss. */
export interface UnmeasuredCase { case_id: string; reason: string }
export interface ScannerRun {
  scanner: string; status: string; cases: CaseResult[]; assertions?: Assertion[]; unmeasured_cases?: UnmeasuredCase[];
  aggregates: { groups: Record<string, unknown>; by_target?: Record<string, unknown>; resolution?: Record<string, unknown> };
  replays?: { count: number; agreed?: boolean } | null;
}
export interface ReviewOccurrence { id: string; case_id: string; method: string; [key: string]: unknown }
export interface RunArtifact {
  schema: string;
  manifest: {
    engine: { name: string; version: string }; protocol_version: string;
    evidence: { source: string; revision: string; evidence_schema: string; corpus_digest: string; release?: { tag: string; manifest_digest: string } | null };
    config_hash: string; run_class?: 'official' | 'exploratory'; publication?: 'public' | 'internal';
    methods: { id: string; version: string }[]; scanners: ScannerIdentity[]; accounting?: unknown;
  };
  scanners: ScannerRun[]; review_queue?: ReviewOccurrence[]; non_semantic: unknown;
}

let compiled: ReturnType<Ajv2020['compile']> | undefined;
function validator() {
  if (compiled) return compiled;
  const text = readFileSync(RUN_ARTIFACT_SCHEMA_PATH, 'utf8');
  const ajv = new Ajv2020({ strict: true, allErrors: false });
  // The schema is generated from Rust types and names numeric formats (`uint32`, `double`); they carry no string check.
  for (const [, format] of text.matchAll(/"format":\s*"([^"]+)"/g)) if (!ajv.formats[format]) ajv.addFormat(format, true);
  compiled = ajv.compile(JSON.parse(text));
  return compiled;
}

export function runArtifactSchemaDigest(): string { return sha256Digest(readFileSync(RUN_ARTIFACT_SCHEMA_PATH)); }

export interface ReadArtifact { artifact: RunArtifact; artifactDigest: string; semanticDigest: string }

/** Semantic digest as the engine computes it: canonical JSON of the artifact with `non_semantic` cleared to its default `{}`. */
export function semanticDigestOf(text: string): string {
  const raw = parseKeepingNumbers(text) as Record<string, unknown>;
  raw.non_semantic = {};
  return sha256Digest(canonical(raw));
}

/** Check the schema tag first, then validate the whole document; refuse anything unknown (consumer obligation 1). */
export function readRunArtifact(bytes: Buffer): ReadArtifact {
  const text = bytes.toString('utf8');
  const artifact = JSON.parse(text) as RunArtifact;
  if (artifact?.schema !== RUN_ARTIFACT_SCHEMA_TAG) throw new Error(`Unsupported run artifact schema tag; expected ${RUN_ARTIFACT_SCHEMA_TAG}`);
  const validate = validator();
  if (!validate(artifact)) {
    const first = (validate.errors ?? []).slice(0, 3).map(e => `${e.instancePath || '/'} ${e.message}`).join('; ');
    throw new Error(`Run artifact does not match the v1 schema: ${first}`);
  }
  return { artifact, artifactDigest: sha256Digest(bytes), semanticDigest: semanticDigestOf(text) };
}

/** What a population registry pins about the evidence an artifact must name (credential-eval multi-corpus-qualification.md section 6, rule 2). */
export interface EvidencePin {
  source: string; revision: string; evidenceSchema: string; corpusDigest: string; release: { tag: string; manifestDigest: string };
}

/** Problems that stop an artifact from being accepted for a population; empty when it is accepted. Never skipped silently. */
export function bindingProblems(artifact: RunArtifact, pin: EvidencePin, options: { engineVersion?: string; protocol?: string; configHash?: string | null } = {}): string[] {
  const problems: string[] = [];
  const m = artifact.manifest, e = m.evidence;
  if (m.run_class !== 'official') problems.push(`run_class is ${m.run_class ?? 'absent'}, qualification reads official artifacts only`);
  if (!m.publication) problems.push('publication is absent; a pre-v1.1 artifact is internal and exploratory');
  if (e.source !== pin.source) problems.push(`evidence.source ${e.source} differs from the pinned ${pin.source}`);
  if (e.revision !== pin.revision) problems.push(`evidence.revision ${e.revision} differs from the pinned ${pin.revision}`);
  if (e.evidence_schema !== pin.evidenceSchema) problems.push(`evidence.evidence_schema ${e.evidence_schema} differs from the pinned ${pin.evidenceSchema}`);
  if (e.corpus_digest !== pin.corpusDigest) problems.push(`evidence.corpus_digest ${e.corpus_digest} differs from the pinned ${pin.corpusDigest}`);
  if (e.release?.tag !== pin.release.tag || e.release?.manifest_digest !== pin.release.manifestDigest) problems.push('evidence.release differs from the pinned release tag and manifest digest');
  if (options.engineVersion && m.engine.version !== options.engineVersion) problems.push(`engine ${m.engine.version} differs from the pinned ${options.engineVersion}`);
  if (options.protocol && m.protocol_version !== options.protocol) problems.push(`protocol ${m.protocol_version} differs from the pinned ${options.protocol}`);
  if (options.configHash && m.config_hash !== options.configHash) problems.push(`config_hash ${m.config_hash} differs from the pinned ${options.configHash}`);
  for (const run of artifact.scanners) if (run.status !== 'complete') problems.push(`scanner ${run.scanner} is ${run.status}; a non-complete scanner is not measured`);
  for (const id of m.scanners) if (id.version === null) problems.push(`scanner ${id.id} reports no version`);
  return problems;
}

/** Counts of one scanner's cases for one family, summed from per-case fields (credential-eval qualification-boundary.md section 4.1). Nothing is recomputed from ranges. */
export interface PositiveCounts { cases: number; spans: number; outcomes: Record<Outcome, number>; leakedSpans: number; leakedBytes: number; collateralBytes: number }
export interface FamilyCounts {
  cases: number; pending: number; notMeasured: number;
  positives: { 'must-redact': PositiveCounts; policy: PositiveCounts };
  benign: { cases: number; flagged: number; findings: number };
  twins: { pairs: number; discriminated: number; flagged: number; coDetected: number };
}
export const OUTCOMES: Outcome[] = ['EXACT', 'COVERED', 'OVERBROAD', 'PARTIAL', 'MISS'];
const LEAKING = new Set<Outcome>(['PARTIAL', 'MISS']);
const ACCEPTABLE = new Set<Outcome>(['EXACT', 'COVERED']);
export const UNASSIGNED = '(no-family)';

const emptyPositive = (): PositiveCounts => ({ cases: 0, spans: 0, outcomes: Object.fromEntries(OUTCOMES.map(o => [o, 0])) as Record<Outcome, number>, leakedSpans: 0, leakedBytes: 0, collateralBytes: 0 });
export const emptyCounts = (): FamilyCounts => ({
  cases: 0, pending: 0, notMeasured: 0,
  positives: { 'must-redact': emptyPositive(), policy: emptyPositive() },
  benign: { cases: 0, flagged: 0, findings: 0 },
  twins: { pairs: 0, discriminated: 0, flagged: 0, coDetected: 0 },
});

/** Add one case to `counts`. `byId` resolves a twin's positive within the same scanner run. */
export function countCase(counts: FamilyCounts, c: CaseResult, byId: Map<string, CaseResult>) {
  counts.cases++;
  const m = c.measurement;
  switch (m.type) {
    case 'pending': counts.pending++; return;
    case 'not-measured': counts.notMeasured++; return;
    case 'positive': {
      const p = counts.positives[c.kind === 'policy' ? 'policy' : 'must-redact'];
      p.cases++; p.spans += m.span_outcomes.length;
      for (const outcome of m.span_outcomes) { p.outcomes[outcome]++; if (LEAKING.has(outcome)) p.leakedSpans++; }
      p.leakedBytes += m.leaked_bytes; p.collateralBytes += m.collateral_bytes;
      return;
    }
    case 'control': {
      if (!c.twin_of) { counts.benign.cases++; if (m.flagged) counts.benign.flagged++; counts.benign.findings += m.findings; return; }
      const positive = byId.get(c.twin_of)?.measurement;
      if (positive?.type !== 'positive') return; // a pair is scored only when its positive was
      counts.twins.pairs++;
      if (m.flagged) counts.twins.flagged++;
      if (m.co_detected) counts.twins.coDetected++;
      if (!m.flagged && positive.span_outcomes.every(o => ACCEPTABLE.has(o))) counts.twins.discriminated++;
      return;
    }
  }
}

export const byId = (run: ScannerRun) => new Map(run.cases.map(c => [c.case_id, c]));

/** The family view of one scanner run, keyed by the case's own `family` (a case with none reads `(no-family)`). */
export function familyCounts(run: ScannerRun): Map<string, FamilyCounts> {
  const out = new Map<string, FamilyCounts>(), index = byId(run);
  for (const c of run.cases) {
    const key = c.family ?? UNASSIGNED;
    if (!out.has(key)) out.set(key, emptyCounts());
    countCase(out.get(key)!, c, index);
  }
  return out;
}

/** Per scanner, how many cases (or, in a methods artifact, generated variants) it could not measure, and why. Absent `unmeasured_cases` is zero. Never read as zero detections. */
export function unmeasuredByScanner(artifact: RunArtifact): { scanner: string; unmeasured: number; reasons: Record<string, number> }[] {
  return artifact.scanners.map(run => {
    const reasons: Record<string, number> = {};
    for (const u of run.unmeasured_cases ?? []) reasons[u.reason] = (reasons[u.reason] ?? 0) + 1;
    return { scanner: run.scanner, unmeasured: run.unmeasured_cases?.length ?? 0, reasons: Object.fromEntries(Object.entries(reasons).sort(([a], [b]) => (a < b ? -1 : 1))) };
  }).sort((a, b) => (a.scanner < b.scanner ? -1 : 1));
}
