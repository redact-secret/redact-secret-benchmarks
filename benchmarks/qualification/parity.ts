/**
 * Old-versus-new comparison of credential qualification (#607, part of #602).
 *
 * The legacy path (the oracle) and the new path (credential-eval RunArtifacts through the adapter) are compared
 * without trying to make them identical. Every compared value falls in one of three classes:
 *
 *  1. must-equal      values that SHOULD be equal under the same release and peer identities. Equal: nothing to say.
 *                     Unequal: a difference to attribute.
 *  2. expected-structural  a difference whose cause is a named structural change of the split architecture
 *                     (`CAUSES`), recognised by a rule that checks the evidence for it, never assumed.
 *  3. unexplained     a difference no rule attributes. A failure to investigate.
 *
 * This module is pure: it reads no file, clock or ledger, so a test builds both sides synthetically. The IO and the
 * rendering of the committed report are in scripts/build-qualification-parity.ts. It asserts nothing about the
 * product (boundary rule): it states which numbers agree, which differ and why.
 * Spec: docs/specs/qualification-parity.md.
 */
export const PARITY_SCHEMA = 'redact-secret/qualification-parity/v1';

export type Verdict = 'equal' | 'explained' | 'unexplained';
/** `confirmed`: the rule recognises the cause from data both sides carry. `inferred`: narrowed to a pattern, root cause not confirmed with the owner. */
export type Confirmation = 'confirmed' | 'inferred';

export interface Cause { id: string; change: string; confirmation: Confirmation; owner: string }
/** The structural changes that may explain a difference. A difference can be attributed only to one of these. */
export const CAUSES: Cause[] = [
  { id: 'population-separation', change: 'The legacy path pooled the development, regression and policy fixtures of a family in one denominator. The new path measures each population on its own and counts floors from the public evidence snapshot alone (benchmarks/support/population-policy.json); a family\'s axis floors are judged on the union of axis labels across the populations the policy names (axisCoverage), so a pooled COUNT differs and an axis the product\'s other populations carry is covered.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'axis-vocabulary', change: 'The public snapshot names a case group by scenario, not by source context, and has no benign taxonomy, so positive and control axis counts are not the legacy fixture axes. Applies only to a view built without the product axis overlay (population-policy.json axes); with the overlay, an axis difference is attributed to the population or membership cause it checks.', confirmation: 'confirmed', owner: 'benchmarks and credential-evidence' },
  { id: 'methods-not-run', change: 'The qualification view was built without a methods run, so the metamorphic, mutation and differential gates are unmeasured and a family that would be stable is held at provisional (methods.notRun).', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'review-occurrence-identity', change: 'The review queue of the methods run is keyed by canonical occurrence ids and holds the occurrences of every pinned peer, including peers the legacy run never scanned; the committed review ledger is keyed by legacy ids of a three-scanner legacy run. A canonical occurrence id the ledger and its generated mapping (benchmarks/support/public-review-ledger-map.json) do not hold reads unresolved. Recognised only for a view built without that mapping, where no decision can apply; with it, an occurrence of a peer the legacy run never scanned stays unreviewed and is not gate-bearing (population-policy.json methods.differential.peers).', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'policy-corpus-bounded', change: 'The T3 policy route reads the policy corpus alone (a bounded contract), where the legacy path pooled every T3 fixture of the family.', confirmation: 'confirmed', owner: 'product policy' },
  { id: 'legacy-id-rekey', change: 'Legacy fixture ids, ledger ids and disputed-property ids are legacy hashes or slugs; the public snapshot has canonical ids. Stored per-fixture inputs keyed by legacy ids do not resolve until the re-key.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'twin-scope-vocabulary', change: 'A twin control is scoped to its declared family, and a finding of another known family is co-detection, not a flag. The legacy path scoped a twin by the product contract of the positive it mutates (a detector id); the evidence snapshot gives the twin its own family (a taxonomy id), so the twin can belong to another family and the same finding can swap between flagged and co-detected. A cross-provider twin has no family at all in the snapshot, so the engine cannot scope it and reads a finding of another known detector as flagged; recognised from the matched cases (the new twin is flagged with no family, the legacy twin was not). The adapter does not re-score it. Confirmed by the project twin-scope corpus (#602): the same bytes carried with the parent\'s family (twin-scope-regressions, a product regression-corpus addition) are read as co-detected, as the legacy path read them, so the public engine verdict on the unscoped copy stays a difference of the public population and the twin gate reads the project case (population-policy.json twinScope).', confirmation: 'confirmed', owner: 'credential-eval' },
  { id: 'pending-not-scored', change: 'A T0 (pending) non-twin fixture has no scored outcome in credential-eval, so the adapter excludes it from the floor counts; the legacy path counted it as a fixture of its family. A T0 twin is in this cause only when the legacy fixture was scored (the release moved it to an unresolved class later; the legacy path counted it and the new one cannot); when the legacy fixture is T0 too, the legacy path drops it, so neither side counts it.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'canonical-evidence-membership', change: 'The evidence snapshot holds fixtures with no legacy counterpart (intended canonical-evidence change): they count in the new floors and in no legacy count, and their methods-run variants add review occurrences, failed assertions and unresolved differential disagreements no legacy count or ledger decision covers (#680). Recognised for a method figure only when the residual equals, exactly, the unsettled occurrences or failed assertions of the cases with no legacy counterpart; a review occurrence of such a case stays unreviewed until a decision is made for it.', confirmation: 'confirmed', owner: 'credential-evidence' },
  { id: 'family-not-in-accepted-evidence', change: 'A second-wave detector family (registered after the accepted evidence snapshot was cut) has no case in any accepted population: the evidence snapshot, its methods run and the project populations carry none of its fixtures, so the new path has nothing to count, and the legacy path counts the project\'s own fixtures of the family (benchmarks/lib/beta8). Recognised only for a family whose new-side fixture total is 0 and whose populations hold 0 cases; every figure of it is then unmeasured on the new side and the family stays provisional by contract (T3 placeholder) or by the open ruling it names. It is cleared by an evidence snapshot that carries the family, adopted by the owner.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'owner-ledger-settlement', change: 'The repository owner decided (2026-10-05, #698) to settle review occurrences of the accepted run by ledger rows keyed by the canonical occurrence id (scripts/apply-ledger-settlements.ts), only where the same occurrence was proposed by the triage of the previous snapshot and the observation is identical. The legacy ledger holds no decision for those occurrences, so the new path reads more of them settled than the legacy mapping. Recognised only when the residual equals, exactly, the occurrences settled by such rows. Not an independent review.', confirmation: 'confirmed', owner: 'repository owner' },
  { id: 'optional-scanner-not-measured', change: 'An optional scanner of the evaluation contract (benchmarks/support/scanner-roster.json, #763) was left out of the new run on purpose (omit_optional; its default profile takes too long), so the new side has no outcome for it. The view states it in scannerRoster.notMeasured and fabricates no zero; the legacy path scored it.', confirmation: 'confirmed', owner: 'repository owner' },
  { id: 'observation-resolved-by-release', change: 'A legacy review-ledger entry (still open, or closed by the owner in this very class) records a disagreement the published product used to cause (a false alarm on a control, a placeholder read as a secret). The released build no longer reports it: the case is in the evidence and in the methods run, but the methods run holds no occurrence of that case, variant, peer and disagreement, so the generated mapping has nothing to map the entry to. Recognised only when every legacy entry the mapping cannot place is an open entry, or one the owner closed in this class (note ends `Class: <kind>/<peer>/observation-resolved-by-release.`), whose case is joined (no-canonical-occurrence) and their number equals the difference exactly; any other settled legacy decision that loses its occurrence stays unexplained. The entry stays in the ledger either way.', confirmation: 'confirmed', owner: 'repository owner' },
  { id: 'corpus-twin-change', change: 'The evidence release changed a twin (a twin of a seed gained sibling_family, or moved to unresolved), so the mutation or metamorphic assertions that flip the seed to that twin read the changed case (a failed assertion the legacy path never had) and the review occurrences of those seeds are keyed by changed content (no legacy mapping holds them). Recognised only when the failed assertions of the seeds whose own case or twin the release changed (its change report) equal the residual exactly.', confirmation: 'confirmed', owner: 'evidence release' },
  { id: 'engine-twin-scoring', change: 'A twin control the snapshot scopes to its own family was read as co-detected by the legacy path (a finding of another known family) and is read as flagged by the engine (credential-eval alpha.13 and later, ADR 0018), so it is a twin failure no legacy count holds and the mutation assertions that flip its seed to it fail. Recognised only when the family residual equals the count of such twins (and of their seeds failed assertions) exactly.', confirmation: 'confirmed', owner: 'credential-eval engine' },
  { id: 'fixture-attribution', change: 'The legacy path attributed a fixture to its declared contract and targets; the adapter attributes a case to the detectors named by its targets, its family, or the taxonomy family it belongs to and, where the snapshot names none, to the legacy targets the product overlay carries, then to its twin parent (population-policy.json attribution). What remains is a case the legacy path scoped to a family the overlay does not carry (no legacy counterpart) or that the legacy path attributed to a detector the adapter attributes elsewhere.', confirmation: 'inferred', owner: 'benchmarks' },
];
const CAUSE_IDS = new Set(CAUSES.map(c => c.id));

export interface Difference {
  subject: string; field: string; legacy: unknown; next: unknown;
  verdict: 'explained' | 'unexplained'; cause?: string; note?: string;
}
export interface Tally { compared: number; equal: number; explained: number; unexplained: number; byCause: Record<string, number> }
export interface Section { tally: Tally; differences: Difference[] }

const newTally = (): Tally => ({ compared: 0, equal: 0, explained: 0, unexplained: 0, byCause: {} });
/** Key order is not a value: the view is written with keys in byte order and the legacy files in authoring order. */
const ordered = (value: unknown): unknown => Array.isArray(value) ? value.map(ordered) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => [k, ordered(v)])) : value;
const same = (a: unknown, b: unknown) => JSON.stringify(ordered(a)) === JSON.stringify(ordered(b));

class Collector {
  readonly tally = newTally();
  readonly differences: Difference[] = [];
  /** Record one compared value. `attribute` is consulted only when the sides differ. */
  compare(subject: string, field: string, legacy: unknown, next: unknown, attribute?: () => { cause: string; note?: string } | undefined) {
    this.tally.compared++;
    if (same(legacy, next)) { this.tally.equal++; return; }
    this.record(subject, field, legacy, next, attribute?.());
  }
  /** Record a difference found by a rule rather than by a value comparison. */
  record(subject: string, field: string, legacy: unknown, next: unknown, attribution?: { cause: string; note?: string }) {
    if (attribution && !CAUSE_IDS.has(attribution.cause)) throw new Error(`Unknown cause ${attribution.cause}`);
    if (attribution) { this.tally.explained++; this.tally.byCause[attribution.cause] = (this.tally.byCause[attribution.cause] ?? 0) + 1; }
    else this.tally.unexplained++;
    this.differences.push({ subject, field, legacy, next, verdict: attribution ? 'explained' : 'unexplained', ...(attribution ? { cause: attribution.cause, ...(attribution.note ? { note: attribution.note } : {}) } : {}) });
  }
  /** A comparison that cannot be made is neither equal nor different; it is listed so nothing is silent. */
  section(): Section {
    this.differences.sort((a, b) => (a.subject + a.field < b.subject + b.field ? -1 : a.subject + a.field > b.subject + b.field ? 1 : 0));
    return { tally: this.tally, differences: this.differences };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Identity: the same release and peer pins on both sides.

export interface ScannerVersions { [scanner: string]: string | null }
/** Must-equal: the product release and each peer version. A comparison needs equal identities to mean anything. */
export function compareIdentity(legacy: ScannerVersions, next: ScannerVersions, notMeasured: ReadonlySet<string> = new Set()): Section {
  const c = new Collector();
  for (const id of [...new Set([...Object.keys(legacy), ...Object.keys(next)])].sort()) {
    if (!(id in legacy) || !(id in next)) { c.record(id, 'scanner version', id in legacy ? legacy[id] : 'not run', id in next ? next[id] : 'not run', id in legacy && notMeasured.has(id) ? { cause: 'optional-scanner-not-measured', note: `${id} is an optional scanner not measured in the new run (scannerRoster.notMeasured)` } : undefined); c.tally.compared++; continue; }
    c.compare(id, 'scanner version', legacy[id], next[id]);
  }
  return c.section();
}

// ---------------------------------------------------------------------------------------------------------------
// Families: membership, status and the evidence behind it.

/** The axis ids a family's counted cases fall in (the `fixtureProfile.cells` of either path). */
export interface AxisIds { positiveContext: string[]; control: string[]; confusion: string[] }
export interface LegacyFamily {
  family: string; status: string; reasons: string[]; evidenceTier: string | null; evidenceBasis: string | null; qualificationProfile: string | null;
  taxonomyFamilies: string[]; evidence: Record<string, unknown>; axisIds?: AxisIds;
}
export interface PopulationCounts { population: string; role: string; cases: number; pending: number; notMeasured: number; positives: number; benign: number; twinPairs: number }
export interface NextFamily {
  family: string; taxonomyFamilies: string[]; status: { value: string; reasons: string[]; evidenceTier: string | null; evidenceBasis: string | null; qualificationProfile: string | null; methodsNotRun: string[] };
  evidence: Record<string, unknown>; axisIds?: AxisIds;
  /** The redact-secret counts of each population (the adapter's `families[].populations[].scanners[]`), already reduced to the fields below. */
  populations: PopulationCounts[];
}

/** Product-owned facts and verdict inputs: the same overlay and contract feed both paths, so they must agree. */
export const MUST_EQUAL_EVIDENCE = [
  'detectors', 'positiveContractTier', 'hasProviderSource', 'observationCount', 'observationSubjects', 'observationIssuanceDates',
  'corroborationReferences', 'corroborationOwners', 'corroborationClasses', 'unresolvedContradictions', 'boundedContradictions',
  'uncertainty', 'supportedContexts', 'empiricalMode', 'supportsBareValues', 'evidenceBasis',
] as const;
/** Counts that come from measured cases. Equal when one corpus feeds both; a split population explains the rest. */
export const COUNT_EVIDENCE = ['positiveCases', 'totalFixtures', 'benignCases', 'twinPairs', 'contextTwinPairs', 'twinFailures', 'benignFalseAlarms'] as const;
export const AXIS_EVIDENCE = ['positiveAxes', 'controlAxes', 'confusionAxes', 'benignAxes', 'benignAxisIds'] as const;
export const METHOD_EVIDENCE: Record<string, string> = {
  metamorphicCriticalFailures: 'metamorphic', mutationUnresolvedCritical: 'mutation', differentialUnresolvedContractDisagreements: 'differential',
};

/** The stable code of a status reason: the text before the first colon or dash. */
export function reasonCode(reason: string): string { return reason.split(/\s[—-]\s|:/)[0].trim(); }

/** What one population adds to a pooled count, so the legacy pooled number can be rebuilt from the split ones. */
function contribution(field: string, p: PopulationCounts): number | undefined {
  switch (field) {
    case 'totalFixtures': return p.cases - p.pending - p.notMeasured;
    case 'positiveCases': return p.positives;
    case 'benignCases': return p.benign;
    case 'twinPairs': return p.twinPairs;
    default: return undefined;
  }
}

export interface FamilyOptions {
  /** The population whose counts feed floors (role `floors-and-gates`). */
  floorsPopulation: string;
  /**
   * What the matched cases show the legacy counts hold beyond the new floors and the other populations, per family, per
   * cause, per count field (`pending-not-scored`, `twin-scope-vocabulary`, `fixture-attribution`, `canonical-evidence-membership`). A residual is explained only when the
   * amounts sum to it exactly.
   */
  adjustmentsByFamily?: Record<string, Record<string, Partial<Record<string, number>>>>;
  /** The view was built with the product axis overlay: an axis difference is then attributed by comparing axis ids, not assumed to be the snapshot vocabulary. */
  axisOverlay?: boolean;
  /** Per family, the differential review occurrences of the methods run attributed to it, how many of their canonical ids the review ledger holds, and the occurrences per peer. */
  reviewByFamily?: Record<string, ReviewOfFamily>;
}

/** The methods run of one family, apart from the cases the legacy path never had (`unjoined`: no legacy counterpart, so no legacy decision or count can cover them). */
export interface ReviewOfFamily {
  occurrences: number; inLedger: number; byPeer: Record<string, number>;
  /** Gate-peer differential occurrences of the family with no ledger decision (own or mapped) whose case has no legacy counterpart. */
  unsettledUnjoined?: number;
  /** Failed assertions of the reference scanner, by method, on cases that have no legacy counterpart. */
  failuresUnjoined?: Record<string, number>;
  /** Failed assertions of the reference scanner, by method, on seeds whose own case or twin the evidence release changed. */
  failuresChanged?: Record<string, number>;
  /** Failed assertions of the reference scanner, by method, on seeds whose twin the legacy path read as co-detected and the engine reads as flagged. */
  failuresEngine?: Record<string, number>;
}

export interface StatusRow {
  family: string; legacy: string; next: string; verdict: Verdict; causes: string[];
  legacyProfile?: string | null; nextProfile?: string | null;
  /** The causes of the reasons the new path adds. When it is exactly `methods-not-run`, only the unmeasured methods hold the family back. */
  heldBackBy: string[]; unattributedReasons: string[];
}
export interface FamilyReport {
  membership: Section; status: Section; evidence: Section;
  statusRows: StatusRow[];
  /** Families the legacy path calls stable that the new path does not, split by what holds them back. */
  counterfactual: { legacyStable: number; nextStable: number; heldOnlyByMethods: number; heldByMethodsAndOthers: number; heldWithoutMethods: number };
  /** The legacy-stable families the new path does not read stable, by the cause set that holds them back (sorted, joined by ` + `; `unattributed` when a reason has no cause). */
  heldBy: Record<string, number>;
}

/** Which structural cause owns a status reason the new path adds. `undefined` means no rule recognises it. */
export function causeOfReason(code: string, countCause: string | undefined, resolved: { axis?: string; review?: string; overlay?: boolean; method?: Partial<Record<string, string>> } = {}): string | undefined {
  if (/^methods\./.test(code)) return 'methods-not-run';
  if (/^policy\./.test(code) && code !== 'policy.protected-holdout') return 'policy-corpus-bounded';
  if (/PositiveAxes|ControlAxes|positive-axes|benign-axes|benign\.minimumAxes|minimumAxes|^fixtureProfile/.test(code)) return resolved.overlay ? resolved.axis : (resolved.axis ?? 'axis-vocabulary');
  if (/^differential\./.test(code)) return resolved.review;
  const failing = /^(metamorphic|mutation)\./.exec(code);
  if (failing) return resolved.method?.[failing[1]];
  if (/minimumBenignCases|benign\.minimumCases|minimumPositiveCases|minimumTwinPairs|minimumFixtures|^twinFailures$|^benignFalseAlarms$|^benign\.falseAlarms$/.test(code)) return countCause;
  return undefined;
}

export function compareFamilies(legacy: LegacyFamily[], next: NextFamily[], options: FamilyOptions): FamilyReport {
  const membership = new Collector(), status = new Collector(), evidence = new Collector();
  const L = new Map(legacy.map(f => [f.family, f])), N = new Map(next.map(f => [f.family, f]));
  const statusRows: StatusRow[] = [];
  const counter = { legacyStable: 0, nextStable: 0, heldOnlyByMethods: 0, heldByMethodsAndOthers: 0, heldWithoutMethods: 0 };
  const heldBy: Record<string, number> = {};

  for (const id of [...new Set([...L.keys(), ...N.keys()])].sort()) {
    const l = L.get(id), n = N.get(id);
    membership.tally.compared++;
    if (!l || !n) { membership.record(id, 'family', l ? 'present' : 'absent', n ? 'present' : 'absent'); continue; }
    membership.tally.equal++;
    membership.compare(id, 'taxonomyFamilies', [...l.taxonomyFamilies].sort(), [...n.taxonomyFamilies].sort());

    // A family with no case on the new side at all is a family the accepted evidence does not carry (family-not-in-accepted-evidence).
    const notInEvidence = Number(n.evidence.totalFixtures) === 0 && Number(l.evidence.totalFixtures) > 0 && n.populations.every(p => p.cases === 0);
    const ev = (field: string, lv: unknown, nv: unknown, attribute?: () => { cause: string; note?: string } | undefined) => evidence.compare(id, field, lv, nv, () => (notInEvidence ? { cause: 'family-not-in-accepted-evidence', note: `the accepted evidence carries no case of ${id}` } : attribute?.()));
    // Evidence first: the status attribution needs to know whether the counts differ.
    let countCause: string | undefined;
    const floors = n.populations.find(p => p.population === options.floorsPopulation);
    for (const field of MUST_EQUAL_EVIDENCE) ev(field, l.evidence[field], n.evidence[field]);
    for (const field of COUNT_EVIDENCE) {
      ev(field, l.evidence[field], n.evidence[field], () => {
        const legacyValue = l.evidence[field], nextValue = n.evidence[field];
        if (typeof legacyValue !== 'number' || typeof nextValue !== 'number') return undefined;
        if (field === 'twinFailures' || field === 'benignFalseAlarms') {
          // The new path takes the worst gate-bearing population and the legacy path pooled, so only what the matched cases show can explain it.
          const residual = legacyValue - nextValue;
          const parts = Object.entries(options.adjustmentsByFamily?.[id] ?? {}).map(([cause, fields]) => ({ cause, amount: fields[field] ?? 0 })).filter(p => p.amount !== 0);
          if (parts.length && parts.reduce((a, p) => a + p.amount, 0) === residual) return (countCause ??= parts[0].cause, { cause: parts[0].cause, note: `residual ${residual} = ${parts.map(p => `${p.amount} ${p.cause}`).join(' + ')}` });
          return undefined;
        }
        const others = n.populations.filter(p => p.population !== options.floorsPopulation).map(p => contribution(field, p));
        if (others.some(v => v === undefined) || !floors) return undefined;
        const rebuilt = nextValue + (others as number[]).reduce((a, b) => a + b, 0);
        if (rebuilt === legacyValue) return (countCause ??= 'population-separation', { cause: 'population-separation', note: `legacy ${legacyValue} = floors ${nextValue} + other populations ${rebuilt - nextValue}` });
        const residual = legacyValue - rebuilt;
        const parts = Object.entries(options.adjustmentsByFamily?.[id] ?? {}).map(([cause, fields]) => ({ cause, amount: fields[field] ?? 0 })).filter(p => p.amount !== 0);
        if (parts.length && parts.reduce((a, p) => a + p.amount, 0) === residual) return (countCause ??= parts[0].cause, { cause: parts[0].cause, note: `residual ${residual} = ${parts.map(p => `${p.amount} ${p.cause}`).join(' + ')}` });
        return undefined;
      });
    }
    // Axis differences. Without the overlay the snapshot vocabulary explains them. With it, the axis ids on both sides say which kind of
    // difference each is: an id only the new side names comes from a case with no legacy counterpart (the overlay names none for it), and an
    // id only the legacy side names can come from a regression or policy fixture the floors population does not carry.
    let axisCause: string | undefined;
    const axisIdsOf = (side: AxisIds | undefined, field: string) => (!side ? undefined : field === 'positiveAxes' ? side.positiveContext : field === 'confusionAxes' ? side.confusion : side.control);
    const otherPopulationCases = n.populations.filter(p => p.population !== options.floorsPopulation).reduce((a, p) => a + p.cases, 0);
    const moved = (cause: string) => Object.values(options.adjustmentsByFamily?.[id]?.[cause] ?? {}).some(v => v !== 0);
    const attributionShift = moved('fixture-attribution') || moved('twin-scope-vocabulary');
    for (const field of AXIS_EVIDENCE) {
      ev(field, l.evidence[field], n.evidence[field], () => {
        if (!options.axisOverlay) return (axisCause ??= 'axis-vocabulary', { cause: 'axis-vocabulary' });
        const ids = { legacy: axisIdsOf(l.axisIds, field), next: axisIdsOf(n.axisIds, field) };
        if (!ids.legacy || !ids.next) return undefined;
        const extra = ids.next.filter(x => !ids.legacy!.includes(x)), missing = ids.legacy.filter(x => !ids.next!.includes(x));
        if (!extra.length && !missing.length) return undefined;
        // An axis id only the legacy side names is a fixture the floors population does not count: one of the regression or policy populations (the legacy path pooled them), or a pending (T0) fixture the adapter does not score, or one
        // the legacy path attributed to this family and the adapter attributes elsewhere. An id only the new side names is a case with no legacy counterpart, or an attribution move.
        const missingCause = missing.length ? (otherPopulationCases > 0 ? 'population-separation' : moved('pending-not-scored') ? 'pending-not-scored' : attributionShift ? 'fixture-attribution' : undefined) : undefined;
        const extraCause = extra.length ? (moved('canonical-evidence-membership') ? 'canonical-evidence-membership' : attributionShift ? 'fixture-attribution' : undefined) : undefined;
        if ((missing.length && !missingCause) || (extra.length && !extraCause)) return undefined;
        const cause = missingCause ?? extraCause!;
        return (axisCause ??= cause, { cause, note: `${extra.length ? `${extra.length} axis id(s) only on the new side (${extraCause})` : ''}${extra.length && missing.length ? '; ' : ''}${missing.length ? `${missing.length} only on the legacy side (${missingCause})` : ''}` });
      });
    }
    // A method that did not run is unmeasured, never zero: equal numbers do not make the comparison. A method that ran is compared; the
    // differential count is attributed when no canonical occurrence id is in the review ledger (the ledger is keyed by legacy ids).
    let reviewCause: string | undefined;
    const methodCause: Partial<Record<string, string>> = {};
    for (const [field, method] of Object.entries(METHOD_EVIDENCE)) {
      if (n.status.methodsNotRun.includes(method)) {
        evidence.tally.compared++;
        evidence.record(id, field, l.evidence[field], 'not measured', { cause: 'methods-not-run', note: `${method} did not run in the qualification view` });
      } else ev(field, l.evidence[field], n.evidence[field], () => {
        const review = options.reviewByFamily?.[id];
        if (!review) return undefined;
        if (method === 'differential' && review.occurrences > 0 && review.inLedger === 0) {
          const peers = Object.entries(review.byPeer).sort().map(([peer, count]) => `${peer} ${count}`).join(', ');
          return (reviewCause ??= 'review-occurrence-identity', { cause: 'review-occurrence-identity', note: `${review.occurrences} differential occurrence(s) (${peers}), none of whose canonical ids is in the review ledger` });
        }
        // The residual is the methods run of cases with no legacy counterpart: explained only when it equals their unsettled occurrences (differential) or failed assertions (metamorphic, mutation) exactly.
        const residual = Number(n.evidence[field]) - Number(l.evidence[field]);
        const unjoined = method === 'differential' ? review.unsettledUnjoined : review.failuresUnjoined?.[method];
        const changed = method === 'differential' ? 0 : (review.failuresChanged?.[method] ?? 0);
        const engine = method === 'differential' ? 0 : (review.failuresEngine?.[method] ?? 0);
        if (!(residual > 0) || (unjoined ?? 0) + changed + engine !== residual) return undefined;
        if (engine > 0 && changed === 0) {
          methodCause[method] = 'engine-twin-scoring';
          return { cause: 'engine-twin-scoring', note: `residual ${residual} = ${engine} failed ${method} assertion(s) of seeds whose twin the engine now reads as flagged${unjoined ? ` + ${unjoined} of cases with no legacy counterpart` : ''}` };
        }
        if (changed > 0) {
          methodCause[method] = 'corpus-twin-change';
          return { cause: 'corpus-twin-change', note: `residual ${residual} = ${changed} failed ${method} assertion(s) of seeds whose twin the release changed${unjoined ? ` + ${unjoined} of cases with no legacy counterpart` : ''}` };
        }
        methodCause[method] = 'canonical-evidence-membership';
        if (method === 'differential') reviewCause ??= 'canonical-evidence-membership';
        return { cause: 'canonical-evidence-membership', note: `residual ${residual} = ${unjoined} ${method === 'differential' ? 'unsettled differential occurrence(s)' : `failed ${method} assertion(s)`} of cases with no legacy counterpart` };
      });
    }
    ev('policyQualification', l.evidence.policyQualification, n.evidence.policyQualification, () => ({ cause: 'policy-corpus-bounded' }));
    evidence.compare(id, 'evidenceTier', l.evidenceTier, n.status.evidenceTier);

    // Status.
    if (l.status === 'stable') counter.legacyStable++;
    if (n.status.value === 'stable') counter.nextStable++;
    const legacyCodes = new Set(l.reasons.map(reasonCode));
    const added = n.status.reasons.map(reasonCode).filter(code => !legacyCodes.has(code));
    const causes = new Set<string>(), unattributed: string[] = [];
    // A family the accepted evidence does not carry has nothing to count on the new side, so a gate reason the other causes cannot attribute follows from that absence (guarded by notInEvidence: no case on the new side at all).
    for (const code of added) { const cause = causeOfReason(code, countCause, { axis: axisCause, review: reviewCause, overlay: options.axisOverlay, method: methodCause }) ?? (notInEvidence ? 'family-not-in-accepted-evidence' : undefined); if (cause) causes.add(cause); else unattributed.push(code); }
    status.tally.compared++;
    let verdict: Verdict = 'equal';
    if (l.status !== n.status.value || n.status.qualificationProfile !== l.qualificationProfile) {
      const complete = unattributed.length === 0 && causes.size > 0;
      verdict = complete ? 'explained' : 'unexplained';
      const attribution = complete ? { cause: [...causes].sort()[0], note: `new-only reasons: ${[...causes].sort().join(', ')}` } : undefined;
      status.record(id, 'status', `${l.status}${l.qualificationProfile ? `/${l.qualificationProfile}` : ''}`, `${n.status.value}${n.status.qualificationProfile ? `/${n.status.qualificationProfile}` : ''}`, attribution);
      if (l.status === 'stable' && n.status.value !== 'stable') {
        if (causes.size === 1 && causes.has('methods-not-run') && unattributed.length === 0) counter.heldOnlyByMethods++;
        else if (causes.has('methods-not-run')) counter.heldByMethodsAndOthers++;
        else counter.heldWithoutMethods++;
        const key = unattributed.length || !causes.size ? 'unattributed' : [...causes].sort().join(' + ');
        heldBy[key] = (heldBy[key] ?? 0) + 1;
      }
    } else status.tally.equal++;
    statusRows.push({ family: id, legacy: l.status, next: n.status.value, legacyProfile: l.qualificationProfile, nextProfile: n.status.qualificationProfile, verdict, causes: [...causes].sort(), heldBackBy: [...causes].sort(), unattributedReasons: unattributed });
  }
  return { membership: membership.section(), status: status.section(), evidence: evidence.section(), statusRows, counterfactual: counter, heldBy: Object.fromEntries(Object.entries(heldBy).sort()) };
}

// ---------------------------------------------------------------------------------------------------------------
// Per-fixture outcomes.

/** A scanner's normalised result on one case. `observed` is whether it reported anything (findings present); `flagged`/`coDetected` are the verdict on a control. */
export type Normalised =
  | { kind: 'positive'; spans: string[] }
  | { kind: 'control'; observed: boolean; flagged: boolean; coDetected: boolean; twin: boolean }
  | { kind: 'pending' }
  | { kind: 'not-measured' };

export interface CaseSide { key: string; scanners: Record<string, Normalised> }
export interface CasePair { population: string; legacy: CaseSide; next: CaseSide }

export interface OutcomeReport {
  section: Section;
  /** Aggregated differences: how many pairs differ in the same way, with up to three example keys. */
  groups: { scanner: string; population: string; legacy: string; next: string; count: number; verdict: 'explained' | 'unexplained'; cause?: string; examples: string[] }[];
}

const describe = (n: Normalised | undefined): string => {
  if (!n) return 'absent';
  if (n.kind === 'positive') return `positive ${n.spans.join(',')}`;
  if (n.kind === 'control') return `control ${n.flagged ? 'flagged' : n.coDetected ? 'co-detected' : n.observed ? 'observed' : 'clean'}`;
  return n.kind;
};

/** Compare matched cases scanner by scanner. A twin control with a finding on both sides but a different flagged or co-detected verdict is the twin-scope pattern. */
export function compareOutcomes(pairs: CasePair[], notMeasured: ReadonlySet<string> = new Set()): OutcomeReport {
  const c = new Collector();
  const groups = new Map<string, OutcomeReport['groups'][number]>();
  for (const pair of [...pairs].sort((a, b) => (a.next.key < b.next.key ? -1 : 1))) {
    for (const scanner of [...new Set([...Object.keys(pair.legacy.scanners), ...Object.keys(pair.next.scanners)])].sort()) {
      const l = pair.legacy.scanners[scanner], n = pair.next.scanners[scanner];
      c.tally.compared++;
      if (same(l, n)) { c.tally.equal++; continue; }
      let attribution: { cause: string; note?: string } | undefined;
      if (l?.kind === 'control' && n?.kind === 'control' && l.observed && n.observed && l.twin && n.twin && (l.coDetected !== n.coDetected || l.flagged !== n.flagged)) attribution = { cause: 'twin-scope-vocabulary', note: 'finding present on both sides; the flagged and co-detected verdicts differ' };
      // A case the legacy path scored and the evidence now records as T0 (pending, not assertable) has no scored outcome in credential-eval: the legacy path counted it, the new one cannot.
      if (!attribution && (l?.kind === 'positive' || l?.kind === 'control') && n?.kind === 'pending') attribution = { cause: 'pending-not-scored', note: 'scored by the legacy path; the evidence records the case as T0 (pending), which no scanner is scored on' };
      // A scanner the new run left out on purpose and states in the view has no new-side outcome by design, never an unexplained difference.
      if (!attribution && l && !n && notMeasured.has(scanner)) attribution = { cause: 'optional-scanner-not-measured', note: `${scanner} is an optional scanner not measured in the new run (scannerRoster.notMeasured)` };
      const legacy = describe(l), next = describe(n);
      if (attribution) { c.tally.explained++; c.tally.byCause[attribution.cause] = (c.tally.byCause[attribution.cause] ?? 0) + 1; } else c.tally.unexplained++;
      const key = [scanner, pair.population, legacy, next, attribution?.cause ?? 'unexplained'].join('|');
      const group = groups.get(key) ?? { scanner, population: pair.population, legacy, next, count: 0, verdict: attribution ? 'explained' as const : 'unexplained' as const, ...(attribution ? { cause: attribution.cause } : {}), examples: [] };
      group.count++;
      if (group.examples.length < 3) group.examples.push(pair.next.key);
      groups.set(key, group);
    }
  }
  const section: Section = { tally: c.tally, differences: [] };
  return { section, groups: [...groups.values()].sort((a, b) => (`${a.population}|${a.scanner}|${a.legacy}|${a.next}` < `${b.population}|${b.scanner}|${b.legacy}|${b.next}` ? -1 : 1)) };
}

export interface JoinResult { pairs: CasePair[]; unmatchedLegacy: string[]; unmatchedNext: string[]; ambiguous: { legacy: number; next: number }; byTier: number[] }
export type Joinable = CaseSide & { joinKeys: string[] };

/**
 * Join two sides of one population on ordered content keys, most specific first. In each pass a key held by exactly one
 * remaining case on each side is a pair and both leave the pool; anything else waits for a looser key. What no key pairs
 * is counted as unmatched, or ambiguous when its content is shared by several cases. Nothing is guessed.
 */
export function joinByKeys(population: string, legacy: Joinable[], next: Joinable[]): JoinResult {
  let L = [...legacy], N = [...next];
  const pairs: CasePair[] = [], byTier: number[] = [];
  const passes = Math.max(0, ...legacy.map(s => s.joinKeys.length), ...next.map(s => s.joinKeys.length));
  for (let pass = 0; pass < passes; pass++) {
    const group = (side: Joinable[]) => { const m = new Map<string, Joinable[]>(); for (const s of side) { const k = s.joinKeys[pass]; if (k === undefined) continue; const l = m.get(k) ?? []; l.push(s); m.set(k, l); } return m; };
    const lg = group(L), ng = group(N);
    const paired = new Set<Joinable>();
    let count = 0;
    for (const [key, ls] of lg) { const ns = ng.get(key); if (ns && ls.length === 1 && ns.length === 1) { pairs.push({ population, legacy: ls[0], next: ns[0] }); paired.add(ls[0]); paired.add(ns[0]); count++; } }
    byTier.push(count);
    L = L.filter(s => !paired.has(s)); N = N.filter(s => !paired.has(s));
  }
  const contentOf = (s: Joinable) => s.joinKeys[s.joinKeys.length - 1];
  const lc = new Set(L.map(contentOf)), nc = new Set(N.map(contentOf));
  const shared = (s: Joinable, other: Set<string>) => other.has(contentOf(s));
  const ambiguous = { legacy: L.filter(s => shared(s, nc)).length, next: N.filter(s => shared(s, lc)).length };
  return {
    pairs, byTier, ambiguous,
    unmatchedLegacy: L.filter(s => !shared(s, nc)).map(s => s.key).sort(), unmatchedNext: N.filter(s => !shared(s, lc)).map(s => s.key).sort(),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Known-gap inputs.

export interface GapSide { id: string; number?: number; status: string; kind?: string; fixtures: string[] }
export interface GapNext { id: string; number?: number; status: string; kind?: string; fixtures: { fixture: string; matches: { population: string }[] }[] }
export interface GapOptions {
  /** The population a legacy fixture slug belongs to, or `undefined` when its category is in none. */
  populationOf: (fixture: string) => string | undefined;
  /** Whether the legacy run has a row for the slug. */
  inLegacyRun: (fixture: string) => boolean;
  /** Populations whose case ids are the legacy ids (product populations). */
  sharedIdPopulations: string[];
}

export function compareKnownGaps(legacy: GapSide[], next: GapNext[], options: GapOptions): Section {
  const c = new Collector();
  const N = new Map(next.map(g => [g.id, g]));
  for (const l of [...legacy].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const n = N.get(l.id);
    c.tally.compared++;
    if (!n) { c.record(l.id, 'record', 'present', 'absent'); continue; }
    c.tally.equal++;
    c.compare(l.id, 'status', l.status, n.status);
    c.compare(l.id, 'kind', l.kind ?? null, n.kind ?? null);
    c.compare(l.id, 'fixtures', [...l.fixtures].sort(), n.fixtures.map(f => f.fixture).sort());
    for (const f of n.fixtures) {
      if (!options.inLegacyRun(f.fixture)) continue;
      const found = f.matches.length > 0;
      c.compare(`${l.id}/${f.fixture}`, 'matched in a new population', true, found, () => {
        const population = options.populationOf(f.fixture);
        if (population && !options.sharedIdPopulations.includes(population)) return { cause: 'legacy-id-rekey', note: `${population} ids are canonical ids; the legacy slug does not resolve` };
        return undefined;
      });
    }
  }
  for (const id of [...N.keys()].sort()) if (!legacy.some(l => l.id === id)) { c.tally.compared++; c.record(id, 'record', 'absent', 'present'); }
  return c.section();
}

// ---------------------------------------------------------------------------------------------------------------
// The support matrix (#607): the provider x credential-family projection, legacy `eval:matrix` against the view's `supportMatrix`.

/** One matrix entry as either path writes it (benchmarks/support/matrix.ts; benchmarks/qualification/support-matrix.ts). */
export interface MatrixEntry {
  provider: string | null; family: string; familyName: string; status: string; evidenceTier: string | null; evidenceBasis: string; qualificationProfile: string | null;
  providerSource: unknown; corroboratingScanners: string[]; twinCoverage: Record<string, unknown> | null; unresolvedCriticalItems: Record<string, unknown> | null;
  empiricalEvidence: Record<string, unknown> | null; policyQualification: unknown; fixtureProfile: Record<string, unknown> | null; detectors: string[]; reason: string | null;
  profileCoverage: Record<string, unknown> | null;
}
/** What the family comparison already attributed: a matrix value is a projection of that evidence, so it is attributed only through a difference found there. */
export interface MatrixContext { evidence: Section; status: Section; statusRows: StatusRow[] }
export interface Transition { legacy: string; next: string; legacyProfile: string | null; nextProfile: string | null; cause?: string }
export interface DistributionSide { distribution: Record<string, number>; stable: Record<string, number> }

const MATRIX_EVIDENCE_FIELD: Record<string, string> = {
  'twinCoverage.pairs': 'twinPairs', 'twinCoverage.failures': 'twinFailures',
  'unresolvedCriticalItems.metamorphic': 'metamorphicCriticalFailures', 'unresolvedCriticalItems.mutation': 'mutationUnresolvedCritical', 'unresolvedCriticalItems.differential': 'differentialUnresolvedContractDisagreements',
  'empiricalEvidence.observations': 'observationCount', 'empiricalEvidence.subjects': 'observationSubjects', 'empiricalEvidence.issuanceDates': 'observationIssuanceDates',
  'empiricalEvidence.corroborationReferences': 'corroborationReferences', 'empiricalEvidence.corroborationOwners': 'corroborationOwners', 'empiricalEvidence.corroborationClasses': 'corroborationClasses',
  'empiricalEvidence.contradictions': 'unresolvedContradictions', 'empiricalEvidence.boundedContradictions': 'boundedContradictions', 'empiricalEvidence.uncertainty': 'uncertainty',
  'empiricalEvidence.supportedContexts': 'supportedContexts', 'empiricalEvidence.mode': 'empiricalMode', 'empiricalEvidence.supportsBareValues': 'supportsBareValues',
  policyQualification: 'policyQualification', evidenceTier: 'evidenceTier', evidenceBasis: 'evidenceBasis', providerSource: 'hasProviderSource',
};
/** The measured counts and axes a fixture-profile cell is built from. */
const PROFILE_SOURCES: string[] = [...COUNT_EVIDENCE, ...AXIS_EVIDENCE];
const PROFILE_DERIVED = new Set(['cells', 'cellsMet', 'debt', 'requiredButEmptyAxisIds']);
const NESTED = ['twinCoverage', 'unresolvedCriticalItems', 'empiricalEvidence', 'fixtureProfile', 'profileCoverage'];

function leavesOf(entry: MatrixEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(entry)) {
    if (NESTED.includes(key) && value && typeof value === 'object') for (const [k, v] of Object.entries(value)) out[`${key}.${k}`] = v;
    else out[key] = value;
  }
  return out;
}

export function compareSupportMatrix(legacy: MatrixEntry[], next: MatrixEntry[], legacyTotals: DistributionSide, nextTotals: DistributionSide, ctx: MatrixContext): Section {
  const c = new Collector();
  const evidenceDiff = new Map(ctx.evidence.differences.map(d => [`${d.subject}\0${d.field}`, d]));
  const statusDiff = new Map(ctx.status.differences.map(d => [d.subject, d]));
  const rows = new Map(ctx.statusRows.map(r => [r.family, r]));
  type Attribution = { cause: string; note: string } | undefined;
  const through = (detector: string | undefined, fields: string[], viaStatus: boolean): Attribution => {
    if (!detector) return undefined;
    if (viaStatus) { const d = statusDiff.get(detector); if (d?.verdict === 'explained') return { cause: d.cause!, note: `follows the status of ${detector}` }; }
    for (const field of fields) { const d = evidenceDiff.get(`${detector}\0${field}`); if (d?.verdict === 'explained') return { cause: d.cause!, note: `follows evidence.${field} of ${detector}` }; }
    return undefined;
  };
  const L = new Map(legacy.map(e => [e.family, e])), N = new Map(next.map(e => [e.family, e]));
  c.compare('matrix', 'taxonomy families', [...L.keys()].sort(), [...N.keys()].sort());
  const transitions: Transition[] = [];
  for (const id of [...L.keys()].filter(k => N.has(k)).sort()) {
    const l = L.get(id)!, n = N.get(id)!, detector = l.detectors[0] ?? n.detectors[0];
    const row = detector ? rows.get(detector) : undefined;
    const a = leavesOf(l), b = leavesOf(n);
    const causes: Record<string, string | undefined> = {};
    for (const path of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
      c.compare(id, path, a[path], b[path], () => {
        const [group, leaf] = path.split('.');
        let attribution: Attribution;
        if (detector && evidenceDiff.get(`${detector}\0totalFixtures`)?.cause === 'family-not-in-accepted-evidence') attribution = { cause: 'family-not-in-accepted-evidence', note: `the accepted evidence carries no case of ${detector}` };
        else if (path === 'status' || path === 'qualificationProfile') attribution = through(detector, [], true);
        else if (path === 'reason') {
          const codes = (value: unknown) => String(value ?? '').split(' | ').filter(Boolean).map(reasonCode);
          const was = codes(a.reason), now = codes(b.reason);
          const removed = was.filter(x => !now.includes(x)), added = now.filter(x => !was.includes(x));
          // A reason code the new path adds is attributed by the status comparison; a code both name whose figures differ follows a count or axis difference.
          // A policy gate code only the legacy side names is a gate the pooled T3 fixtures failed and the bounded policy corpus does not (policy-corpus-bounded), shown by the policy aggregate differing.
          const policyOnly = (codes: string[]) => codes.length > 0 && codes.every(x => /^policy\./.test(x));
          const policy = through(detector, ['policyQualification'], false);
          if (row && row.unattributedReasons.length === 0 && (removed.length === 0 || (policyOnly(removed) && policy))) {
            if (added.length) {
              const cause = policyOnly(added) && row.causes.includes('policy-corpus-bounded') ? 'policy-corpus-bounded' : row.causes[0];
              if (cause) attribution = { cause, note: `new-only reason(s) ${added.join(', ')}${removed.length ? `; legacy-only ${removed.join(', ')}` : ''}` };
            } else if (removed.length) attribution = { cause: policy!.cause, note: `legacy-only reason(s) ${removed.join(', ')}` };
            else attribution = through(detector, [...PROFILE_SOURCES, 'policyQualification'], false);
          }
        } else if (group === 'profileCoverage' && PROFILE_DERIVED.has(leaf)) attribution = through(detector, PROFILE_SOURCES, true);
        else if (group === 'fixtureProfile') attribution = through(detector, [leaf], false);
        else if (MATRIX_EVIDENCE_FIELD[path]) attribution = through(detector, [MATRIX_EVIDENCE_FIELD[path]], false);
        causes[path] = attribution?.cause;
        return attribution;
      });
    }
    if (l.status !== n.status || l.qualificationProfile !== n.qualificationProfile) transitions.push({ legacy: l.status, next: n.status, legacyProfile: l.qualificationProfile, nextProfile: n.qualificationProfile, cause: causes.status ?? causes.qualificationProfile });
  }
  compareDistribution(c, 'matrix', legacyTotals, nextTotals, transitions);
  return c.section();
}

/**
 * The status counts and the stable counts by route are sums of per-family statuses, so a difference in one is explained only when the
 * family-level status changes that were attributed add up to it exactly (the same rule as a count residual).
 */
function compareDistribution(c: Collector, subject: string, legacy: DistributionSide, next: DistributionSide, transitions: Transition[]) {
  const group = (field: string, l: Record<string, number>, n: Record<string, number>, touches: (t: Transition, key: string) => number) => {
    for (const key of [...new Set([...Object.keys(l), ...Object.keys(n)])].sort()) {
      c.compare(subject, `${field}.${key}`, l[key], n[key], () => {
        const touching = transitions.filter(t => touches(t, key) !== 0);
        if (!touching.length || touching.some(t => !t.cause)) return undefined;
        const expected = transitions.reduce((total, t) => total + touches(t, key), 0);
        if (expected !== (l[key] ?? 0) - (n[key] ?? 0)) return undefined;
        const causes = [...new Set(touching.map(t => t.cause!))].sort();
        return { cause: causes[0], note: `${touching.length} family status change(s) account for the difference (${causes.join(', ')})` };
      });
    }
  };
  group('distribution', legacy.distribution, next.distribution, (t, key) => Number(t.legacy === key) - Number(t.next === key));
  group('stableDistribution', legacy.stable, next.stable, (t, key) => Number(t.legacy === 'stable' && t.legacyProfile === key) - Number(t.next === 'stable' && t.nextProfile === key));
}

/** The page-level numbers of the qualification overview: the family count, the status counts and the stable counts by route. */
export function compareDistributions(legacy: DistributionSide & { familyCount: number }, next: DistributionSide & { familyCount: number }, statusRows: StatusRow[]): Section {
  const c = new Collector();
  c.compare('overview', 'familyCount', legacy.familyCount, next.familyCount);
  const transitions = statusRows.filter(r => r.verdict !== 'equal' || (r.legacyProfile ?? null) !== (r.nextProfile ?? null)).map<Transition>(r => ({ legacy: r.legacy, next: r.next, legacyProfile: r.legacyProfile ?? null, nextProfile: r.nextProfile ?? null, cause: r.verdict === 'explained' ? r.causes[0] : undefined }));
  compareDistribution(c, 'overview', legacy, next, transitions);
  return c.section();
}

// ---------------------------------------------------------------------------------------------------------------
// The review queue and ledger decisions.

/** Per peer, the differential occurrences and how many a decision settles. `null` is a peer the legacy run never scanned, so it holds no legacy entry. */
export type ReviewSide = Record<string, { occurrences: number; settled: number; /** Settled by a ledger row keyed by the canonical occurrence id itself (an owner-decided settlement of the accepted run), not through the legacy mapping. */ ownSettled?: number } | null>;
export function compareReview(legacy: ReviewSide, next: ReviewSide, legacyEntries: { differential: number; mapped: number; /** Open legacy entries whose case is joined but whose occurrence the methods run no longer holds (the caller proves each is open and no-canonical-occurrence). */ resolvedByRelease?: number }, nextMapped: number, unjoinedByPeer: Record<string, number> = {}, changedUnmappedByPeer: Record<string, number> = {}): Section {
  const c = new Collector();
  const resolved = legacyEntries.resolvedByRelease ?? 0;
  c.compare('ledger', 'legacy differential entries, against those mapped to a canonical occurrence', legacyEntries.differential, legacyEntries.mapped, () => (resolved > 0 && legacyEntries.differential - legacyEntries.mapped === resolved ? { cause: 'observation-resolved-by-release', note: `${resolved} open legacy entr(ies) record a disagreement the released build no longer reports` } : undefined));
  // The legacy entries that map to an occurrence of a seed the release changed no longer map: exactly the occurrences of those seeds the mapping cannot hold (peers the legacy run scanned).
  const lostByChange = Object.entries(changedUnmappedByPeer).filter(([peer]) => legacy[peer]).reduce((a, [, n]) => a + n, 0);
  c.compare('ledger', 'legacy entries mapped, against canonical occurrences the mapping settles', legacyEntries.mapped, nextMapped, () => (lostByChange > 0 && legacyEntries.mapped - nextMapped === lostByChange ? { cause: 'corpus-twin-change', note: `${lostByChange} legacy entr(ies) map to occurrences of seeds whose own case or twin the release changed` } : undefined));
  for (const peer of [...new Set([...Object.keys(legacy), ...Object.keys(next)])].sort()) {
    const l = legacy[peer], n = next[peer];
    for (const field of ['occurrences', 'settled'] as const) {
      c.compare(peer, field, l === null ? 'not run' : l?.[field], n?.[field], () => {
        if (l === null) return { cause: 'review-occurrence-identity', note: `${peer} was never scanned by the legacy run, so the legacy ledger holds no entry for it` };
        const residual = (n?.[field] ?? 0) - (l?.[field] ?? 0), unjoined = unjoinedByPeer[peer] ?? 0;
        // Occurrences of cases the legacy path never had hold no legacy entry: explained only when they are exactly the residual of the count, and they are all unsettled.
        if (field === 'settled' && (n?.ownSettled ?? 0) > 0 && residual === n!.ownSettled) return { cause: 'owner-ledger-settlement', note: `${residual} occurrence(s) settled by the owner-decided ledger rows keyed by the accepted run's occurrence ids (not a legacy decision)` };
        const changedUnmapped = changedUnmappedByPeer[peer] ?? 0;
        if (field === 'occurrences' && changedUnmapped > 0 && residual === unjoined + changedUnmapped) return { cause: 'corpus-twin-change', note: `${residual} occurrence(s) = ${unjoined} of cases with no legacy counterpart + ${changedUnmapped} of seeds the release changed (their content changed, so the legacy mapping cannot hold them)` };
        return field === 'occurrences' && unjoined > 0 && residual === unjoined ? { cause: 'canonical-evidence-membership', note: `${unjoined} occurrence(s) of cases with no legacy counterpart` } : undefined;
      });
    }
  }
  return c.section();
}

// ---------------------------------------------------------------------------------------------------------------
// The report.

export interface ParityReport {
  schema: typeof PARITY_SCHEMA;
  identities: Record<string, unknown>;
  causes: Cause[];
  sections: { identity: Section; membership: Section; status: Section; evidence: Section; outcomes: Section; knownGaps: Section; supportMatrix: Section; distribution: Section; review: Section };
  statusRows: StatusRow[];
  /** The two support matrices side by side: taxonomy families and the status counts each path reads. */
  matrix: { taxonomyFamilies: { legacy: number; next: number }; distribution: { legacy: Record<string, number>; next: Record<string, number> }; stableDistribution: { legacy: Record<string, number>; next: Record<string, number> } };
  counterfactual: FamilyReport['counterfactual'];
  heldBy: FamilyReport['heldBy'];
  outcomeGroups: OutcomeReport['groups'];
  joins: Record<string, { byTier: number[]; pairs: number; unmatchedLegacy: number; unmatchedNext: number; ambiguousLegacy: number; ambiguousNext: number }>;
  /** Comparisons that could not be made, with the reason. Never silent. */
  notCompared: { area: string; reason: string }[];
  summary: Tally & { classes: { 'must-equal': number; 'expected-structural': number; unexplained: number } };
  recommendations: string[];
}

export function summarise(sections: ParityReport['sections']): ParityReport['summary'] {
  const total = newTally();
  for (const s of Object.values(sections)) {
    total.compared += s.tally.compared; total.equal += s.tally.equal; total.explained += s.tally.explained; total.unexplained += s.tally.unexplained;
    for (const [k, v] of Object.entries(s.tally.byCause)) total.byCause[k] = (total.byCause[k] ?? 0) + v;
  }
  return { ...total, byCause: Object.fromEntries(Object.entries(total.byCause).sort()), classes: { 'must-equal': total.equal, 'expected-structural': total.explained, unexplained: total.unexplained } };
}

export function renderMarkdown(report: ParityReport): string {
  const lines: string[] = [];
  const t = report.summary;
  lines.push('# Qualification parity: legacy path against the new path', '');
  lines.push('Generated by `npm run qualification:parity` (scripts/build-qualification-parity.ts). Do not edit. The comparison logic is `benchmarks/qualification/parity.ts`; the method and the three classes are in `docs/specs/qualification-parity.md`.', '');
  lines.push('This repository measures and records. This report states which numbers agree, which differ and which structural change causes each difference. It asserts nothing about the product.', '');
  lines.push('## Identities', '');
  for (const [k, v] of Object.entries(report.identities)) lines.push(`- ${k}: ${typeof v === 'string' ? `\`${v}\`` : `\`${JSON.stringify(v)}\``}`);
  lines.push('', '## Summary', '');
  lines.push(`${t.compared} values compared: **${t.equal} equal** (class 1, must-equal, held), **${t.explained} expected-structural** (class 2, each attributed to a cause), **${t.unexplained} unexplained** (class 3, to investigate).`, '');
  lines.push('| Area | Compared | Equal | Expected-structural | Unexplained |', '| --- | ---: | ---: | ---: | ---: |');
  for (const [name, s] of Object.entries(report.sections)) lines.push(`| ${name} | ${s.tally.compared} | ${s.tally.equal} | ${s.tally.explained} | ${s.tally.unexplained} |`);
  lines.push('', '### Differences by cause', '', '| Cause | Differences | Confirmation | Structural change |', '| --- | ---: | --- | --- |');
  for (const cause of report.causes) lines.push(`| \`${cause.id}\` | ${t.byCause[cause.id] ?? 0} | ${cause.confirmation} | ${cause.change} |`);
  lines.push('');
  const cf = report.counterfactual;
  lines.push('## Status', '');
  lines.push(`The legacy path reads ${cf.legacyStable} stable families; the new path reads ${cf.nextStable}. Support status is compared family by family (\`status\` section above); each family the new path holds below the legacy status is attributed to the reasons it adds.`, '');
  lines.push('Of the legacy-stable families the new path does not read stable, by what holds each back:', '');
  const heldTotal = Object.values(report.heldBy ?? {}).reduce((a, b) => a + b, 0);
  if (heldTotal === 0) lines.push('- none.'); else for (const [causes, count] of Object.entries(report.heldBy)) lines.push(`- ${count}: ${causes === 'unattributed' ? '**unattributed** (a reason no rule recognises)' : `\`${causes.split(' + ').join('` + `')}\``}`);
  lines.push('');
  if (cf.heldOnlyByMethods + cf.heldByMethodsAndOthers > 0) lines.push(`${cf.heldOnlyByMethods} of them are held back only by \`methods.notRun\` (the view has no methods run for them), ${cf.heldByMethodsAndOthers} by it and another cause.`, '');
  const differing = report.statusRows.filter(r => r.verdict !== 'equal');
  const byCauseSet = new Map<string, number>();
  for (const r of differing) { const key = `${r.legacy} -> ${r.next} | ${r.causes.join(' + ') || 'no cause'}${r.unattributedReasons.length ? ` | unattributed: ${r.unattributedReasons.join('; ')}` : ''}`; byCauseSet.set(key, (byCauseSet.get(key) ?? 0) + 1); }
  lines.push('| Status change | Causes | Families |', '| --- | --- | ---: |');
  for (const [key, count] of [...byCauseSet].sort()) { const [change, causes, extra] = key.split(' | '); lines.push(`| ${change} | ${causes}${extra ? `; ${extra}` : ''} | ${count} |`); }
  lines.push('');
  const m = report.matrix;
  lines.push('## Support matrix', '');
  lines.push(`The support matrix is the provider x credential-family projection (one entry per taxonomy family) the legacy path writes with \`npm run eval:matrix\`; the new side is the view's \`supportMatrix\`, derived from the view's families and the product taxonomy. ${m.taxonomyFamilies.legacy} taxonomy families on the legacy side, ${m.taxonomyFamilies.next} on the new side. Status counts: legacy \`${JSON.stringify(m.distribution.legacy)}\`, new \`${JSON.stringify(m.distribution.next)}\`; stable by route: legacy \`${JSON.stringify(m.stableDistribution.legacy)}\`, new \`${JSON.stringify(m.stableDistribution.next)}\`. Every leaf of every entry is compared; a difference is attributed only through the difference the family comparison found in the evidence it projects.`, '');
  const grouped = (section: Section) => {
    const byKey = new Map<string, { field: string; cause: string; count: number; examples: string[] }>();
    for (const d of section.differences) {
      const field = d.field.replace(/\.[^.]*$/, '.*').replace(/^(distribution|stableDistribution)\..*$/, '$1.*');
      const key = `${field}|${d.verdict === 'explained' ? d.cause : 'unexplained'}`;
      const g = byKey.get(key) ?? { field, cause: d.verdict === 'explained' ? `\`${d.cause}\`` : '**unexplained**', count: 0, examples: [] };
      g.count++; if (g.examples.length < 3 && !g.examples.includes(`\`${d.subject}\``)) g.examples.push(`\`${d.subject}\``);
      byKey.set(key, g);
    }
    return [...byKey.values()].sort((a, b) => (a.field + a.cause < b.field + b.cause ? -1 : 1));
  };
  const table = (section: Section) => {
    const rows = grouped(section);
    if (!rows.length) { lines.push('No value differs.', ''); return; }
    lines.push('| Field | Cause | Differences | Examples |', '| --- | --- | ---: | --- |');
    for (const g of rows) lines.push(`| ${g.field} | ${g.cause} | ${g.count} | ${g.examples.join(', ')} |`);
    lines.push('');
  };
  table(report.sections.supportMatrix);
  lines.push('## Overview numbers', '', 'The numbers the qualification overview page shows: the family count, the status counts and the stable counts by route (the per-family status, evidence counts and reasons are the `status` and `evidence` sections above).', '');
  table(report.sections.distribution);
  lines.push('## Review queue and ledger', '', 'The differential review occurrences of the methods run against the legacy review ledger, per peer, through the generated mapping: occurrences, and how many a ledger decision settles.', '');
  table(report.sections.review);
  lines.push('## Per-fixture outcomes', '');
  for (const [population, j] of Object.entries(report.joins)) lines.push(`- ${population}: ${j.pairs} cases matched one to one (by key tier: ${j.byTier.join(", ")}), ${j.unmatchedLegacy} legacy-only, ${j.unmatchedNext} new-only, ${j.ambiguousLegacy} legacy and ${j.ambiguousNext} new cases share content with another case and are not compared.`);
  lines.push('');
  if (report.outcomeGroups.length === 0) lines.push('No scanner outcome differs on a matched case.', '');
  else {
    lines.push('| Population | Scanner | Legacy | New | Cases | Verdict | Examples |', '| --- | --- | --- | --- | ---: | --- | --- |');
    for (const g of report.outcomeGroups) lines.push(`| ${g.population} | ${g.scanner} | ${g.legacy} | ${g.next} | ${g.count} | ${g.verdict === 'explained' ? `\`${g.cause}\`` : '**unexplained**'} | ${g.examples.map(e => `\`${e}\``).join(', ')} |`);
    lines.push('');
  }
  lines.push('## Not compared', '');
  if (report.notCompared.length === 0) lines.push('Nothing was left out.'); else for (const n of report.notCompared) lines.push(`- ${n.area}: ${n.reason}`);
  lines.push('', '## Unexplained differences', '');
  const unexplained = Object.entries(report.sections).flatMap(([area, s]) => s.differences.filter(d => d.verdict === 'unexplained').map(d => ({ area, ...d })));
  if (unexplained.length === 0 && !report.outcomeGroups.some(g => g.verdict === 'unexplained')) lines.push('None.');
  else {
    const grouped = new Map<string, { area: string; field: string; count: number; examples: string[] }>();
    for (const d of unexplained) { const key = `${d.area}|${d.field}`; const g = grouped.get(key) ?? { area: d.area, field: d.field, count: 0, examples: [] }; g.count++; if (g.examples.length < 3) g.examples.push(`${d.subject}: ${JSON.stringify(d.legacy)} vs ${JSON.stringify(d.next)}`); grouped.set(key, g); }
    lines.push('| Area | Field | Differences | Examples (legacy vs new) |', '| --- | --- | ---: | --- |');
    for (const g of [...grouped.values()].sort((a, b) => (a.area + a.field < b.area + b.field ? -1 : 1))) lines.push(`| ${g.area} | ${g.field} | ${g.count} | ${g.examples.map(e => `\`${e.replace(/\|/g, '/')}\``).join('; ')} |`);
  }
  lines.push('', '## Recommendations (not applied)', '');
  for (const r of report.recommendations) lines.push(`- ${r}`);
  lines.push('');
  return lines.join('\n');
}
