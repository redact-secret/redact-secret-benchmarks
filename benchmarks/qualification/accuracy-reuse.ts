import { canonical, sha256Digest } from './canonical.ts';

/**
 * The accuracy reuse plan (#706, under #704): what a replay may take from an earlier verified ObservationSet and what it must scan fresh,
 * decided before any expensive execution. Spec: docs/specs/accuracy-reuse.md. Decision: docs/decisions/2026-10-05-plan-accuracy-reuse-from-verified-observation-archives-and-let-the-engine-replay.md.
 *
 * The engine (credential-eval ADR 0008) owns the contract and re-verifies every identity when it replays (`run --reuse-observations <set> [--fresh <id>]`).
 * This module only plans: it selects nothing the engine would refuse, verifies the archive's byte digest and receipts, and reports origins, invalidation
 * reasons and missing evidence. It never reads, splices or caches a score, assertion, comparison or qualification input: only observations are reused.
 * Accuracy only: a plan never starts a performance measurement (#709) and an accuracy observation is never a performance claim.
 */
export const REUSE_PLAN_SCHEMA = 'redact-secret-benchmarks/accuracy-reuse-plan/v1';
export const PRODUCT_SCANNER = 'redact-secret';
/** The engine requires two agreeing fresh replays for a newly accepted observation; a reused one must carry that receipt. */
export const MINIMUM_REPLAYS = 2;

/** The identity of a scanner as a run record states it (official-runs.json `runs[].scanners[]`); the engine's ScannerIdentity projected onto it. */
export interface ScannerIdentity {
  version: string | null;
  build?: string | null;
  mode?: string;
  adapter?: { id: string; version: string };
  configurationHash?: string;
  executableSha256?: string | null;
  packageIntegrity?: string | null;
}
const IDENTITY_FIELDS = ['version', 'build', 'mode', 'adapter', 'configurationHash', 'executableSha256', 'packageIntegrity'] as const;

type Component = { kind: string; sha256?: string; integrity?: string };
/** An engine ObservationSet (schemas/observation-set-v1.schema.json at the engine's reuse revision), the parts the planner reads. */
export interface ObservationSetLike {
  schema: string;
  corpus_digest: string;
  measurement?: { input_digest: string; protocol_version: string; restriction?: string | null } | null;
  observations: {
    scanner: { id: string; version: string | null; build?: string | null; mode: string; adapter: { id: string; version: string }; configuration_hash: string; provenance?: { components?: Component[] } | null };
    result: { status: string; replays?: { count: number; agreed: boolean } };
    duration_ms?: number | null;
  }[];
}

export interface Archive {
  /** The set as read, and the SHA-256 digest of its bytes as read from disk. */
  set: ObservationSetLike;
  byteDigest: string;
  /** Provenance only (the evidence release tag or CI run the set came from); never compared with the target. */
  sourceRelease?: string;
}
/** The archive's committed record: the immutable identity a plan must find on disk. */
export interface ArchivePin { path: string; byteDigest: string; sourceRelease?: string }

export interface Target {
  population: string;
  /** Of the bytes the scanners will see, and of the full corpus (which also covers expectations). */
  inputDigest: string;
  corpusDigest: string;
  protocol: string;
  restriction: string | null;
  /** Every scanner of the run, `null` when its identity cannot be resolved on the host (then it runs fresh and is recorded `unavailable`). */
  scanners: Record<string, ScannerIdentity | null>;
}

export type Origin = 'fresh' | 'reused';
export type Reason =
  | 'product-under-test' | 'force-fresh' | 'identity-changed' | 'new-scanner' | 'unavailable' | 'no-archive' | 'fixture-changed'
  | 'unbound-archive' | 'protocol-changed' | 'restriction-changed' | 'compatible';
export interface ScannerPlan {
  scanner: string;
  origin: Origin;
  reason: Reason;
  /** Which identity fields differ, for `identity-changed`. */
  changed: string[];
  /** Original receipt of a reused observation: scans it carries and its recorded (non-semantic) duration. */
  receipt?: { replays: number; durationMs: number | null };
}
export type ChangeKind = 'no-archive' | 'unchanged-inputs' | 'expectations-only' | 'fixture-changed' | 'incompatible-archive';
export interface ReusePlan {
  schema: typeof REUSE_PLAN_SCHEMA;
  population: string;
  verdict: 'plan' | 'refused';
  /** `refused`: corrupt or non-deterministic evidence that must fail, never be worked around. */
  refusals: string[];
  change: ChangeKind;
  /** The documented fallback when whole-population reuse is impossible: a fresh run of the changed population. Shown before execution. */
  fallback: { kind: 'fresh-population'; reason: string } | null;
  forceFresh: boolean;
  /** Whether the engine re-scores the compatible observations against the new corpus without scanning (expectations/labels/accounting only). */
  rescore: boolean;
  /** The measured input identity both sides are compared by (never the evidence release tag). */
  input: { target: string; archive: string | null; equal: boolean };
  /** Source release provenance, kept apart from semantic compatibility: a new tag with the same inputs forces nothing. */
  provenance: { archive: ArchivePin | null; archiveByteDigest: string | null; sourceRelease: string | null };
  scanners: ScannerPlan[];
  /** Observations the engine reports as missing, unmeasured or unresolved; the plan lists what is absent, it does not fill it. */
  missingEvidence: string[];
  /** Scans and runner time not launched, taken from the reused observations' own receipts. Runner-minutes are the source's recorded durations. */
  savings: { scansSaved: number; scannersReused: number; scannersFresh: number; runnerMinutesSaved: number };
  /** Always 0: this lane never starts a performance measurement, and a fixture-only change launches none (#709). */
  performanceMeasurements: 0;
  /** A plan with any reused scanner is an exploratory run; an official run refuses reuse (engine ADR 0008, decision 7). */
  runClass: 'official-eligible' | 'exploratory';
  /** The engine arguments the plan selects; `--reuse-observations` is absent when nothing can be reused. */
  engineArguments: string[];
}

const identityOf = (o: ObservationSetLike['observations'][number]): ScannerIdentity => ({
  version: o.scanner.version, build: o.scanner.build ?? null, mode: o.scanner.mode, adapter: o.scanner.adapter, configurationHash: o.scanner.configuration_hash,
  executableSha256: o.scanner.provenance?.components?.find(c => c.kind === 'executable')?.sha256 ?? null,
  packageIntegrity: o.scanner.provenance?.components?.find(c => c.kind === 'npm-package')?.integrity ?? null,
});

/** The identity fields on which two scanners differ. A field the target does not state is not compared: the engine re-verifies the whole identity. */
export function identityDifferences(archived: ScannerIdentity, target: ScannerIdentity): string[] {
  return IDENTITY_FIELDS.filter(field => {
    const wanted = target[field];
    if (wanted === undefined) return false;
    return canonical(archived[field] ?? null) !== canonical(wanted ?? null);
  });
}

/** Corrupt or untrustworthy archive content: never a fallback, a failure. */
export function archiveProblems(archive: Archive, pin?: ArchivePin): string[] {
  const problems: string[] = [];
  if (pin && archive.byteDigest !== pin.byteDigest) problems.push(`archive bytes have digest ${archive.byteDigest}, the record pins ${pin.byteDigest}`);
  const set = archive.set;
  if (set?.schema !== 'credential-eval/observation-set/v1') problems.push(`archive schema is ${String(set?.schema)}, not credential-eval/observation-set/v1`);
  else if (!Array.isArray(set.observations)) problems.push('archive has no observations');
  else {
    const ids = set.observations.map(o => o.scanner.id);
    if (new Set(ids).size !== ids.length) problems.push('archive observes a scanner more than once');
  }
  return problems;
}

/** A recorded observation of an unchanged scanner must be complete, agreed and replayed enough: the engine refuses anything else. */
function receiptProblem(o: ObservationSetLike['observations'][number]): string | null {
  const r = o.result;
  if (r.status !== 'complete') return `${o.scanner.id} is recorded ${r.status}, not complete`;
  if (!r.replays?.agreed) return `${o.scanner.id} recorded replays that did not agree`;
  if (r.replays.count < MINIMUM_REPLAYS) return `${o.scanner.id} recorded ${r.replays.count} replay(s), a reused observation needs ${MINIMUM_REPLAYS}`;
  return null;
}

export interface PlanOptions {
  /** The immutable archive the registry names; omitted when none is selected. */
  archive?: Archive;
  pin?: ArchivePin;
  target: Target;
  /** Scanners forced fresh (`--fresh <id>`); `all` forces the whole population. */
  forceFresh?: string[] | 'all';
  archivePath?: string;
}

export function planAccuracyReuse({ archive, pin, target, forceFresh = [], archivePath }: PlanOptions): ReusePlan {
  const ids = Object.keys(target.scanners).sort();
  const forced = (id: string) => forceFresh === 'all' || forceFresh.includes(id);
  const refusals: string[] = [];
  const missingEvidence: string[] = [];
  let change: ChangeKind = 'unchanged-inputs';
  let whole: Reason | null = null;
  let fallbackReason: string | null = null;

  if (!archive) {
    change = 'no-archive'; whole = 'no-archive'; fallbackReason = 'no observation archive is selected for this population';
    missingEvidence.push(`no verified observation archive for ${target.population}`);
  } else {
    refusals.push(...archiveProblems(archive, pin));
    const m = archive.set?.measurement;
    if (!refusals.length) {
      if (!m) { change = 'incompatible-archive'; whole = 'unbound-archive'; fallbackReason = 'the archive records no measurement binding (written before engine revision v1.6)'; }
      else if (m.protocol_version !== target.protocol) { change = 'incompatible-archive'; whole = 'protocol-changed'; fallbackReason = `the archive was normalized under ${m.protocol_version}, the run measures ${target.protocol}`; }
      else if (m.input_digest !== target.inputDigest) { change = 'fixture-changed'; whole = 'fixture-changed'; fallbackReason = 'fixture bytes, paths or generated variants changed: a changed population gets a new bound artifact from a fresh accuracy run'; }
      else if ((m.restriction ?? null) !== null && m.restriction !== target.restriction) { change = 'incompatible-archive'; whole = 'restriction-changed'; fallbackReason = 'the archived findings are restricted by a family allowlist this run does not use'; }
      else if (archive.set.corpus_digest !== target.corpusDigest) change = 'expectations-only';
      if (whole) missingEvidence.push(`no compatible observations of ${target.population}: ${fallbackReason}`);
    }
  }

  const archived = new Map((archive?.set?.observations ?? []).map(o => [o.scanner.id, o]));
  const scanners: ScannerPlan[] = ids.map(id => {
    const fresh = (reason: Reason, changed: string[] = []): ScannerPlan => ({ scanner: id, origin: 'fresh', reason, changed });
    if (id === PRODUCT_SCANNER) return fresh('product-under-test');
    if (forced(id)) return fresh('force-fresh');
    if (whole) return fresh(whole);
    const identity = target.scanners[id];
    if (!identity) { missingEvidence.push(`${id} cannot be resolved on this host; it runs fresh and is recorded unavailable`); return fresh('unavailable'); }
    const observation = archived.get(id);
    if (!observation) { missingEvidence.push(`the archive has no observation of ${id}`); return fresh('new-scanner'); }
    const changed = identityDifferences(identityOf(observation), identity);
    if (changed.length) return fresh('identity-changed', changed);
    const problem = receiptProblem(observation);
    if (problem) { refusals.push(problem); return fresh('compatible'); }
    return { scanner: id, origin: 'reused', reason: 'compatible', changed: [], receipt: { replays: observation.result.replays!.count, durationMs: observation.duration_ms ?? null } };
  });

  const reused = scanners.filter(s => s.origin === 'reused');
  const verdict = refusals.length ? 'refused' : 'plan';
  const useArchive = verdict === 'plan' && reused.length > 0;
  return {
    schema: REUSE_PLAN_SCHEMA,
    population: target.population,
    verdict, refusals, change,
    fallback: fallbackReason ? { kind: 'fresh-population', reason: fallbackReason } : null,
    forceFresh: forceFresh === 'all' || forceFresh.length > 0,
    rescore: useArchive && change === 'expectations-only',
    input: { target: target.inputDigest, archive: archive?.set?.measurement?.input_digest ?? null, equal: archive?.set?.measurement?.input_digest === target.inputDigest },
    provenance: { archive: pin ?? null, archiveByteDigest: archive?.byteDigest ?? null, sourceRelease: archive?.sourceRelease ?? pin?.sourceRelease ?? null },
    scanners: verdict === 'refused' ? scanners.map(s => ({ ...s, origin: 'fresh', receipt: undefined })) : scanners,
    missingEvidence,
    savings: verdict === 'refused'
      ? { scansSaved: 0, scannersReused: 0, scannersFresh: ids.length, runnerMinutesSaved: 0 }
      : {
        scansSaved: reused.reduce((n, s) => n + s.receipt!.replays, 0), scannersReused: reused.length, scannersFresh: ids.length - reused.length,
        runnerMinutesSaved: Math.round(reused.reduce((n, s) => n + (s.receipt!.durationMs ?? 0), 0) / 600) / 100,
      },
    performanceMeasurements: 0,
    runClass: useArchive ? 'exploratory' : 'official-eligible',
    engineArguments: useArchive
      ? ['--reuse-observations', archivePath ?? pin?.path ?? '<archive>', ...scanners.filter(s => s.origin === 'fresh' && s.reason !== 'product-under-test').flatMap(s => ['--fresh', s.scanner])]
      : [],
  };
}

/** The input digest of the bytes a scanner is shown, as credential-eval's `corpus::input_digest` defines it: sorted `{path, sha256(content)}`. */
export function inputDigest(cases: { path: string; content: string }[]): string {
  const entries = cases.map(c => ({ path: c.path, sha256: sha256Digest(Buffer.from(c.content, 'utf8')).slice('sha256:'.length) }))
    .sort((a, b) => Buffer.compare(Buffer.from(a.path), Buffer.from(b.path)));
  return sha256Digest(canonical(entries));
}

export function renderReusePlan(plan: ReusePlan): string {
  const lines = [
    `# Accuracy reuse plan: ${plan.population}`, '',
    `Verdict **${plan.verdict}** · change **${plan.change}** · run class **${plan.runClass}** · performance measurements launched **${plan.performanceMeasurements}**`, '',
  ];
  if (plan.refusals.length) lines.push('## Refused', '', ...plan.refusals.map(r => `- ${r}`), '');
  if (plan.fallback) lines.push('## Fallback (shown before execution)', '', `A fresh accuracy run of the whole population: ${plan.fallback.reason}.`, '');
  if (plan.rescore) lines.push('Expectations, labels or accounting changed and the measured inputs did not: compatible observations are re-scored, not rescanned.', '');
  lines.push('## Scanners', '', '| Scanner | Origin | Reason | Changed identity | Receipt |', '| --- | --- | --- | --- | --- |',
    ...plan.scanners.map(s => `| ${s.scanner} | ${s.origin} | ${s.reason} | ${s.changed.join(', ') || '-'} | ${s.receipt ? `${s.receipt.replays} replays${s.receipt.durationMs === null ? '' : `, ${s.receipt.durationMs} ms`}` : '-'} |`), '');
  lines.push('## Measured input identity', '', `- target \`${plan.input.target}\``, `- archive \`${plan.input.archive ?? 'none'}\`` + (plan.input.equal ? ' (equal)' : ''),
    `- source release provenance: ${plan.provenance.sourceRelease ?? 'none'} (provenance only; it never forces a scan)`, '');
  if (plan.missingEvidence.length) lines.push('## Missing evidence', '', ...plan.missingEvidence.map(m => `- ${m}`), '');
  const s = plan.savings;
  lines.push('## Saved', '', `- scans not launched: ${s.scansSaved} (${s.scannersReused} scanner(s) reused, ${s.scannersFresh} fresh)`,
    `- runner-minutes not spent: ${s.runnerMinutesSaved} (the reused observations' recorded durations, non-semantic)`, '');
  return lines.join('\n');
}
