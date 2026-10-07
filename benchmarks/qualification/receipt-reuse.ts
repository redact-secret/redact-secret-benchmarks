/**
 * Reuse of a successful measurement receipt on a retry (#707).
 *
 * A receipt is the accepted output of one official stage of an earlier run of the same workflow: artifact.json plus the run-record.json the driver wrote beside
 * it. A retry of a failed run reuses a receipt instead of repeating the engine runs, so a failed methods step does not repeat a plain measurement that already
 * passed its determinism check. This is not the view-only reuse_run_id and not the observation reuse of the candidate replay (accuracy-reuse.ts).
 *
 * The check here is the identity of the receipt. The artifact is still read and bound to the current pins by the driver (bindingProblems), exactly as a fresh
 * artifact is, so a receipt that is not compatible is never accepted: the driver reports why and measures fresh.
 */
export interface ReceiptExpectation {
  population: string;
  platform: string;
  methods: boolean;
  engineRevision: string;
  runs: number;
  candidateId: string | null;
  attributionId: string | null;
  evidenceTag: string | null;
  /** The scanners this stage measures (#763): a receipt of another scanner set (with or without an optional scanner) is another measurement. */
  scannerIds?: string[];
  /** The configuration and the opted-in optional scanners of this stage's scanner selection (#812). A receipt that records a selection must hold exactly it: a retry never turns an optional scanner on or off, and a receipt measured under another configuration is another measurement. */
  scannerSelection?: { configFile: string; includedOptionalScanners: string[] };
  /** The registry's pinned methods selection and evaluation, for a methods receipt. */
  methodsRun?: { methods: string[]; reference: string; seed: string; evidenceDigest: string };
}

interface ReceiptRecord {
  schema?: string; population?: string; platform?: string; kind?: string; methods?: string[];
  engine?: { revision?: string };
  artifact?: { digest?: string };
  determinism?: { runs?: number; semanticDigestsEqual?: boolean };
  productCandidate?: { id?: string }; attribution?: { id?: string }; evidenceOverride?: { tag?: string };
  scanners?: { id?: string }[];
  scannerSelection?: { configFile?: string; includedOptionalScanners?: string[] };
  omittedOptionalScanners?: string[];
  evaluation?: { reference?: string; seed?: string; evidenceDigest?: string };
}

export function receiptProblems(record: ReceiptRecord, artifactDigest: string, want: ReceiptExpectation): string[] {
  const problems: string[] = [];
  if (record.schema !== 'redact-secret-benchmarks/official-run-record/v1') problems.push('the record is not an official run record');
  if (record.population !== want.population) problems.push(`the receipt is of ${record.population}, not ${want.population}`);
  if (record.platform !== want.platform) problems.push(`the receipt is of ${record.platform}, not ${want.platform}`);
  if ((record.kind === 'methods') !== want.methods) problems.push(`the receipt is a ${record.kind === 'methods' ? 'methods' : 'plain'} run, this stage is a ${want.methods ? 'methods' : 'plain'} run`);
  if (record.engine?.revision !== want.engineRevision) problems.push(`the receipt was measured on engine ${record.engine?.revision}, this run uses ${want.engineRevision}`);
  if (record.artifact?.digest !== artifactDigest) problems.push('artifact.json does not match the digest its record names');
  if (record.determinism?.semanticDigestsEqual !== true || (record.determinism?.runs ?? 0) < want.runs) problems.push(`the receipt passed a determinism check of ${record.determinism?.runs ?? 0} run(s), this stage needs ${want.runs}`);
  if ((record.productCandidate?.id ?? null) !== want.candidateId) problems.push('the receipt is of a different product candidate');
  if ((record.attribution?.id ?? null) !== want.attributionId) problems.push('the receipt is of a different attribution run');
  if ((record.evidenceOverride?.tag ?? null) !== want.evidenceTag) problems.push('the receipt is of a different evidence release');
  if (want.scannerIds) {
    const had = (record.scanners ?? []).map(s => s.id ?? '').sort().join(',');
    if (had !== [...want.scannerIds].sort().join(',')) problems.push(`the receipt measured the scanners ${had || 'none recorded'}, this run measures ${[...want.scannerIds].sort().join(',')}`);
  }
  if (want.scannerSelection) {
    // A record of an earlier workflow names no selection; its scanner set (checked above) is then its whole identity. A record that does name one must agree.
    const had = record.scannerSelection;
    if (had) {
      if (had.configFile !== want.scannerSelection.configFile) problems.push(`the receipt was measured under configuration ${had.configFile ?? 'none recorded'}, this run uses ${want.scannerSelection.configFile}`);
      const hadIncluded = [...(had.includedOptionalScanners ?? [])].sort().join(','), wantIncluded = [...want.scannerSelection.includedOptionalScanners].sort().join(',');
      if (hadIncluded !== wantIncluded) problems.push(`the receipt opted in to the optional scanners [${hadIncluded}], this run opts in to [${wantIncluded}]: a retry never turns an optional scanner on or off`);
    }
  }
  if (want.methods && want.methodsRun) {
    if ([...(record.methods ?? [])].sort().join(',') !== [...want.methodsRun.methods].sort().join(',')) problems.push('the receipt ran a different methods selection');
    const e = record.evaluation;
    if (e?.reference !== want.methodsRun.reference || e?.seed !== want.methodsRun.seed || e?.evidenceDigest !== want.methodsRun.evidenceDigest) problems.push('the receipt used a different evaluation reference, seed or evidence');
  }
  return problems;
}
