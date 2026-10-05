import type { FamilyCounts, Outcome, RunArtifact, ScannerRun } from './run-artifact.ts';
import { OUTCOMES, emptyCounts, familyCounts } from './run-artifact.ts';

/**
 * Consumer of the engine's scope accounting (credential-eval ADR 0016, contract v1.8; benchmarks #724). The ENGINE classified every retained
 * finding against its reviewed disposition table; this module only reads that accounting, refuses one that does not reconcile to the retained
 * findings, and carries it into the qualification view with the identities needed to read it. It never classifies a finding, never filters
 * RunArtifact findings, never changes a case outcome, a denominator or a floor, and never reads `non_semantic`.
 *
 * Four things stay apart: the native label (what the scanner said), the derived family (the adapter's classification), the reviewed scope
 * (the engine's disposition table, with its reason) and the absence of any of them. An unmapped finding is neither a false positive nor ignored.
 */
export const DISPOSITIONS = ['mapped_credential', 'credential_related_unmapped', 'out_of_scope', 'ambiguous', 'native_label_unavailable', 'unrecognized_label'] as const;
export type Disposition = typeof DISPOSITIONS[number];
export const UNRECOGNIZED_LABEL = '~unrecognized';
/** The first engine whose artifacts can carry `scope_accounting` (contract v1.8). An older engine's artifact is legacy: coverage is unknown, not zero. */
export const SCOPE_ACCOUNTING_FIRST_ENGINE = '0.1.0-alpha.11';
export const SCOPE_ACCOUNTING_VERSION = '1';

export interface EngineLabelAccount { label: string; findings: number; with_family: number; scope?: string; status?: string; reason?: string }
export interface EngineScopeAccounting {
  version: string;
  table: { id: string; package: string; version: string; integrity: string };
  findings: number;
  by_disposition: Record<Disposition, number>;
  multi_label_findings: number;
  conflicting_label_findings: number;
  by_label: EngineLabelAccount[];
}
/** The RunArtifact fields this reader adds to the vendored types: all optional, absent in every artifact of an older engine. */
export interface RetainedFinding { start: number; end: number; family?: string | null; native_labels?: string[] }
export type ScannerRunWithScope = ScannerRun & { findings?: RetainedFinding[]; scope_accounting?: EngineScopeAccounting };

/** `0.1.0-alpha.N` as N, or null for any other version string. The engine's tags are alphas of 0.1.0 while the contract is young. */
export function alphaOf(version: string): number | null {
  const m = /^0\.1\.0-alpha\.(\d+)$/.exec(version);
  return m ? Number(m[1]) : null;
}
const isInteger = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Why an accounting does not reconcile to the findings the artifact retains; empty when it does. Counts are re-read from the findings, nothing is re-classified. */
export function scopeAccountingProblems(run: ScannerRunWithScope): string[] {
  const acc = run.scope_accounting;
  if (!acc) return [];
  const problems: string[] = [];
  const at = `${run.scanner}: scope_accounting`;
  if (acc.version !== SCOPE_ACCOUNTING_VERSION) problems.push(`${at}.version is ${JSON.stringify(acc.version)}, this reader knows ${SCOPE_ACCOUNTING_VERSION}`);
  for (const d of DISPOSITIONS) if (!isInteger(acc.by_disposition?.[d])) problems.push(`${at}.by_disposition.${d} is not a count`);
  const known = new Set<string>(DISPOSITIONS);
  for (const d of Object.keys(acc.by_disposition ?? {})) if (!known.has(d)) problems.push(`${at}.by_disposition has an unknown disposition ${d}`);
  if (problems.length) return problems;
  const total = DISPOSITIONS.reduce((n, d) => n + acc.by_disposition[d], 0);
  if (total !== acc.findings) problems.push(`${at}: dispositions sum to ${total}, findings is ${acc.findings}`);
  const findings = run.findings;
  if (!findings) { problems.push(`${at}: the artifact retains no findings to reconcile against`); return problems; }
  if (findings.length !== acc.findings) problems.push(`${at}: findings is ${acc.findings}, the artifact retains ${findings.length}`);
  let withFamily = 0, unlabeledNoFamily = 0, unrecognizedOnly = 0, multi = 0;
  const perLabel = new Map<string, { findings: number; withFamily: number }>();
  for (const f of findings) {
    const labels = f.native_labels ?? [];
    if (f.family) withFamily++;
    if (!f.family && labels.length === 0) unlabeledNoFamily++;
    if (!f.family && labels.length === 1 && labels[0] === UNRECOGNIZED_LABEL) unrecognizedOnly++;
    if (labels.length > 1) multi++;
    for (const l of labels) {
      const slot = perLabel.get(l) ?? { findings: 0, withFamily: 0 };
      slot.findings++; if (f.family) slot.withFamily++;
      perLabel.set(l, slot);
    }
  }
  const d = acc.by_disposition;
  if (d.mapped_credential !== withFamily) problems.push(`${at}: mapped_credential is ${d.mapped_credential}, ${withFamily} retained findings carry a family`);
  if (d.native_label_unavailable !== unlabeledNoFamily) problems.push(`${at}: native_label_unavailable is ${d.native_label_unavailable}, ${unlabeledNoFamily} retained findings have no label and no family`);
  if (d.unrecognized_label !== unrecognizedOnly) problems.push(`${at}: unrecognized_label is ${d.unrecognized_label}, ${unrecognizedOnly} retained findings carry only the unrecognized marker`);
  if (acc.multi_label_findings !== multi) problems.push(`${at}: multi_label_findings is ${acc.multi_label_findings}, ${multi} retained findings carry several labels`);
  if (acc.conflicting_label_findings > multi) problems.push(`${at}: conflicting_label_findings is ${acc.conflicting_label_findings}, only ${multi} retained findings carry several labels`);
  const labels = [...perLabel.keys()].sort();
  if (acc.by_label.length !== labels.length || acc.by_label.some((x, i) => x.label !== labels[i])) problems.push(`${at}.by_label does not list exactly the labels of the retained findings`);
  else for (const x of acc.by_label) {
    const seen = perLabel.get(x.label)!;
    if (x.findings !== seen.findings || x.with_family !== seen.withFamily) problems.push(`${at}.by_label ${x.label}: ${x.findings}/${x.with_family}, retained findings give ${seen.findings}/${seen.withFamily}`);
  }
  return problems;
}

export type ScopeState = 'accounted' | 'legacy-native-label-unavailable' | 'not-accounted' | 'not-measured';
export interface ScannerProfileIdentity { scanner: string; version: string | null; mode: string; build: string | null; configurationHash: string; adapterVersion: string }
export interface LabelRow { label: string; findings: number; withFamily: number; scope: string | null; status: string | null; reason: string | null }
export interface ScopeEntry {
  scanner: string;
  profile: ScannerProfileIdentity;
  engineVersion: string;
  state: ScopeState;
  /** Findings the artifact retains for the scanner (the denominator every count below reconciles to). Null when the scanner was not measured. */
  retainedFindings: number | null;
  /** Reviewed table and rules the counts were made with. Null unless accounted. */
  classification: { accountingVersion: string; table: EngineScopeAccounting['table'] } | null;
  /** Findings that carry at least one native label. Null unless accounted: a legacy artifact's coverage is unknown, never zero. */
  labelled: number | null;
  /** Counts by disposition. Null unless accounted; never an invented zero. */
  dispositions: Record<Disposition, number> | null;
  multiLabelFindings: number | null;
  conflictingLabelFindings: number | null;
  /** Per native label, sorted by findings (descending) then label. */
  labels: LabelRow[];
  /** Fixed statements about what the counts are and are not. */
  limits: string[];
}

const LIMITS_COMMON = [
  'Counts describe the findings the artifact retains. No finding was removed, relabelled or excluded, and no case outcome, denominator or floor depends on them.',
  'A native type reviewed as not a credential is out of scope for a credential evaluation; it is shown as a diagnostic and is not a credential detection.',
  'An unresolved type is unresolved: it is neither a false positive nor ignored.',
];

/** One scanner's scope entry, read from its retained run. Throws when an accounting that is present does not reconcile. */
export function scopeEntry(artifact: RunArtifact, run: ScannerRunWithScope): ScopeEntry {
  const id = artifact.manifest.scanners.find(s => s.id === run.scanner);
  if (!id) throw new Error(`${run.scanner} has a run but no identity in the manifest`);
  const profile: ScannerProfileIdentity = { scanner: id.id, version: id.version, mode: id.mode, build: id.build ?? null, configurationHash: id.configuration_hash, adapterVersion: id.adapter.version };
  const engineVersion = artifact.manifest.engine.version;
  const base = { scanner: run.scanner, profile, engineVersion, classification: null, labelled: null, dispositions: null, multiLabelFindings: null, conflictingLabelFindings: null, labels: [] as LabelRow[] };
  if (run.status !== 'complete') return { ...base, state: 'not-measured', retainedFindings: null, limits: ['The scanner did not complete, so no finding was retained and nothing is counted: not measured is not zero.'] };
  const retained = run.findings?.length ?? null;
  const acc = run.scope_accounting;
  if (!acc) {
    const n = alphaOf(engineVersion);
    const legacy = n !== null && n < (alphaOf(SCOPE_ACCOUNTING_FIRST_ENGINE) as number);
    return legacy
      ? { ...base, state: 'legacy-native-label-unavailable', retainedFindings: retained, limits: ['This artifact was produced by an engine that did not record native labels or scope accounting. Its findings are legacy historical evidence: nothing is classified retrospectively and unmapped findings are unknown, not zero.', ...LIMITS_COMMON.slice(0, 1)] }
      : { ...base, state: 'not-accounted', retainedFindings: retained, limits: ['The artifact carries no scope accounting: the engine has no reviewed disposition table for this scanner, or its version is not one this reader knows. Unmapped findings are unknown, not zero.', ...LIMITS_COMMON.slice(0, 1)] };
  }
  const problems = scopeAccountingProblems(run);
  if (problems.length) throw new Error(`Scope accounting is refused: ${problems.slice(0, 3).join('; ')}`);
  const withLabel = (run.findings ?? []).filter(f => (f.native_labels ?? []).length > 0).length;
  const labels = acc.by_label.map(l => ({ label: l.label, findings: l.findings, withFamily: l.with_family, scope: l.scope ?? null, status: l.status ?? null, reason: l.reason ?? null }))
    .sort((a, b) => b.findings - a.findings || (a.label < b.label ? -1 : 1));
  return {
    ...base, state: 'accounted', retainedFindings: acc.findings,
    classification: { accountingVersion: acc.version, table: acc.table },
    labelled: withLabel, dispositions: { ...acc.by_disposition },
    multiLabelFindings: acc.multi_label_findings, conflictingLabelFindings: acc.conflicting_label_findings, labels,
    limits: [...LIMITS_COMMON, 'A finding with several native labels is counted once by disposition and once under each label, so label counts can exceed the finding count.'],
  };
}

/** Every scanner of an artifact, sorted by scanner id. */
export function scopeByScanner(artifact: RunArtifact): ScopeEntry[] {
  return (artifact.scanners as ScannerRunWithScope[]).map(run => scopeEntry(artifact, run)).sort((a, b) => (a.scanner < b.scanner ? -1 : 1));
}

/** Plain-run totals of one scanner over every case it scored, summed from per-case counts the engine wrote (no span is re-scored). */
export interface ScannerTotals { outcomes: Record<Outcome, number>; positiveSpans: number; leakedSpans: number; benignCases: number; benignFlagged: number; benignFindings: number; notMeasured: number; pending: number; retainedFindings: number | null }
export function scannerTotals(run: ScannerRunWithScope): ScannerTotals {
  const sum = emptyCounts();
  const outcomes = Object.fromEntries(OUTCOMES.map(o => [o, 0])) as Record<Outcome, number>;
  let leaked = 0, spans = 0;
  for (const c of familyCounts(run).values()) addCounts(sum, c);
  for (const kind of ['must-redact', 'policy'] as const) {
    for (const o of OUTCOMES) outcomes[o] += sum.positives[kind].outcomes[o];
    spans += sum.positives[kind].spans; leaked += sum.positives[kind].leakedSpans;
  }
  return { outcomes, positiveSpans: spans, leakedSpans: leaked, benignCases: sum.benign.cases, benignFlagged: sum.benign.flagged, benignFindings: sum.benign.findings, notMeasured: sum.notMeasured, pending: sum.pending, retainedFindings: run.findings?.length ?? null };
}
function addCounts(into: FamilyCounts, from: FamilyCounts) {
  into.cases += from.cases; into.pending += from.pending; into.notMeasured += from.notMeasured;
  for (const kind of ['must-redact', 'policy'] as const) {
    const a = into.positives[kind], b = from.positives[kind];
    a.cases += b.cases; a.spans += b.spans; a.leakedSpans += b.leakedSpans; a.leakedBytes += b.leakedBytes; a.collateralBytes += b.collateralBytes;
    for (const o of OUTCOMES) a.outcomes[o] += b.outcomes[o];
  }
  into.benign.cases += from.benign.cases; into.benign.flagged += from.benign.flagged; into.benign.findings += from.benign.findings;
  into.twins.pairs += from.twins.pairs; into.twins.discriminated += from.twins.discriminated; into.twins.flagged += from.twins.flagged; into.twins.coDetected += from.twins.coDetected;
}

/**
 * Before/after of a credential profile against the default result of the same scanner on the same population (`delta = profile - default`).
 * Both are separate observations with their own identities; nothing is spliced, excluded or re-scored. The denominators (cases, spans, benign
 * cases) are carried so a reader can see that they did not change.
 */
export interface ProfileEffect {
  population: string;
  default: { scanner: string; configurationHash: string; totals: ScannerTotals };
  profile: { scanner: string; configurationHash: string; totals: ScannerTotals };
  delta: { outcomes: Record<Outcome, number>; benignFlagged: number; benignFindings: number; retainedFindings: number | null };
  denominatorsEqual: boolean;
  note: string;
}
export function profileEffect(population: string, base: { entry: ScopeEntry; run: ScannerRunWithScope }, other: { entry: ScopeEntry; run: ScannerRunWithScope }): ProfileEffect {
  const a = scannerTotals(base.run), b = scannerTotals(other.run);
  const outcomes = Object.fromEntries(OUTCOMES.map(o => [o, b.outcomes[o] - a.outcomes[o]])) as Record<Outcome, number>;
  return {
    population,
    default: { scanner: base.entry.scanner, configurationHash: base.entry.profile.configurationHash, totals: a },
    profile: { scanner: other.entry.scanner, configurationHash: other.entry.profile.configurationHash, totals: b },
    delta: { outcomes, benignFlagged: b.benignFlagged - a.benignFlagged, benignFindings: b.benignFindings - a.benignFindings, retainedFindings: a.retainedFindings === null || b.retainedFindings === null ? null : b.retainedFindings - a.retainedFindings },
    denominatorsEqual: a.positiveSpans === b.positiveSpans && a.benignCases === b.benignCases && a.notMeasured === b.notMeasured && a.pending === b.pending,
    note: 'The profile is a separate scanner configuration, not a speed-up of the default. Both results are kept; the difference is a recorded configuration effect, not a change of any outcome.',
  };
}

/** The declared profiles present in one artifact, each against its default scanner, sorted by profile id. A pair is compared only when both completed. */
export function profileEffectsOf(artifact: RunArtifact, profiles: Record<string, string>, population: string): ProfileEffect[] {
  const runs = new Map((artifact.scanners as ScannerRunWithScope[]).map(r => [r.scanner, r]));
  const entries = new Map(scopeByScanner(artifact).map(e => [e.scanner, e]));
  const out: ProfileEffect[] = [];
  for (const [profile, base] of Object.entries(profiles).sort(([a], [b]) => (a < b ? -1 : 1))) {
    const a = runs.get(base), b = runs.get(profile);
    if (!a || !b || a.status !== 'complete' || b.status !== 'complete') continue;
    out.push(profileEffect(population, { entry: entries.get(base)!, run: a }, { entry: entries.get(profile)!, run: b }));
  }
  return out;
}
