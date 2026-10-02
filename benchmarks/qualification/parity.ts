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
  { id: 'population-separation', change: 'The legacy path pooled the development, regression and policy fixtures of a family in one denominator. The new path measures each population on its own and reads floors from the public evidence snapshot alone (benchmarks/support/population-policy.json).', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'axis-vocabulary', change: 'The public snapshot names a case group by scenario, not by source context, and has no benign taxonomy, so positive and control axis counts are not the legacy fixture axes. Applies only to a view built without the product axis overlay (population-policy.json axes); with the overlay, an axis difference is attributed to the population or membership cause it checks.', confirmation: 'confirmed', owner: 'benchmarks and credential-evidence' },
  { id: 'methods-not-run', change: 'The qualification view was built without a methods run, so the metamorphic, mutation and differential gates are unmeasured and a family that would be stable is held at provisional (methods.notRun).', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'review-occurrence-identity', change: 'The review queue of the methods run is keyed by canonical occurrence ids and holds the occurrences of every pinned peer, including peers the legacy run never scanned; the committed review ledger is keyed by legacy ids of a three-scanner legacy run. A canonical occurrence id absent from the ledger reads unresolved, so a differential disagreement cannot read settled until the ledger is re-keyed and the peer set is decided.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'policy-corpus-bounded', change: 'The T3 policy route reads the policy corpus alone (a bounded contract), where the legacy path pooled every T3 fixture of the family.', confirmation: 'confirmed', owner: 'product policy' },
  { id: 'legacy-id-rekey', change: 'Legacy fixture ids, ledger ids and disputed-property ids are legacy hashes or slugs; the public snapshot has canonical ids. Stored per-fixture inputs keyed by legacy ids do not resolve until the re-key.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'twin-scope-vocabulary', change: 'A twin control is scoped to its declared family, and a finding of another known family is co-detection, not a flag. The legacy path scoped a twin by the product contract of the positive it mutates (a detector id); the evidence snapshot gives the twin its own family (a taxonomy id), so the twin can belong to another family and the same finding can swap between flagged and co-detected.', confirmation: 'inferred', owner: 'credential-eval' },
  { id: 'pending-not-scored', change: 'A T0 (pending) non-twin fixture has no scored outcome in credential-eval, so the adapter excludes it from the floor counts; the legacy path counted it as a fixture of its family. A T0 twin is not in this cause: the legacy path drops T0 twins, so neither side counts it.', confirmation: 'confirmed', owner: 'benchmarks' },
  { id: 'canonical-evidence-membership', change: 'The evidence snapshot holds fixtures with no legacy counterpart (intended canonical-evidence change): they count in the new floors and in no legacy count.', confirmation: 'confirmed', owner: 'credential-evidence' },
  { id: 'fixture-attribution', change: 'The legacy path attributed a fixture to its declared contract and targets; the adapter attributes a case to the detectors named by its targets, its family, or the taxonomy family it belongs to.', confirmation: 'inferred', owner: 'benchmarks' },
];
const CAUSE_IDS = new Set(CAUSES.map(c => c.id));

export interface Difference {
  subject: string; field: string; legacy: unknown; next: unknown;
  verdict: 'explained' | 'unexplained'; cause?: string; note?: string;
}
export interface Tally { compared: number; equal: number; explained: number; unexplained: number; byCause: Record<string, number> }
export interface Section { tally: Tally; differences: Difference[] }

const newTally = (): Tally => ({ compared: 0, equal: 0, explained: 0, unexplained: 0, byCause: {} });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

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
export function compareIdentity(legacy: ScannerVersions, next: ScannerVersions): Section {
  const c = new Collector();
  for (const id of [...new Set([...Object.keys(legacy), ...Object.keys(next)])].sort()) {
    if (!(id in legacy) || !(id in next)) { c.record(id, 'scanner version', id in legacy ? legacy[id] : 'not run', id in next ? next[id] : 'not run', undefined); c.tally.compared++; continue; }
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
  reviewByFamily?: Record<string, { occurrences: number; inLedger: number; byPeer: Record<string, number> }>;
}

export interface StatusRow {
  family: string; legacy: string; next: string; verdict: Verdict; causes: string[];
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
export function causeOfReason(code: string, countCause: string | undefined, resolved: { axis?: string; review?: string; overlay?: boolean } = {}): string | undefined {
  if (/^methods\./.test(code)) return 'methods-not-run';
  if (/^differential\./.test(code)) return resolved.review;
  if (/PositiveAxes|ControlAxes|positive-axes|benign-axes|benign\.minimumAxes|minimumAxes|^fixtureProfile/.test(code)) return resolved.overlay ? resolved.axis : (resolved.axis ?? 'axis-vocabulary');
  if (/^policy\./.test(code) && code !== 'policy.protected-holdout') return 'policy-corpus-bounded';
  if (/minimumBenignCases|benign\.minimumCases|minimumPositiveCases|minimumTwinPairs|minimumFixtures/.test(code)) return countCause;
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

    // Evidence first: the status attribution needs to know whether the counts differ.
    let countCause: string | undefined;
    const floors = n.populations.find(p => p.population === options.floorsPopulation);
    for (const field of MUST_EQUAL_EVIDENCE) evidence.compare(id, field, l.evidence[field], n.evidence[field]);
    for (const field of COUNT_EVIDENCE) {
      evidence.compare(id, field, l.evidence[field], n.evidence[field], () => {
        const legacyValue = l.evidence[field], nextValue = n.evidence[field];
        if (typeof legacyValue !== 'number' || typeof nextValue !== 'number') return undefined;
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
      evidence.compare(id, field, l.evidence[field], n.evidence[field], () => {
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
    for (const [field, method] of Object.entries(METHOD_EVIDENCE)) {
      if (n.status.methodsNotRun.includes(method)) {
        evidence.tally.compared++;
        evidence.record(id, field, l.evidence[field], 'not measured', { cause: 'methods-not-run', note: `${method} did not run in the qualification view` });
      } else evidence.compare(id, field, l.evidence[field], n.evidence[field], () => {
        const review = options.reviewByFamily?.[id];
        if (method !== 'differential' || !review || review.occurrences === 0 || review.inLedger !== 0) return undefined;
        const peers = Object.entries(review.byPeer).sort().map(([peer, count]) => `${peer} ${count}`).join(', ');
        return (reviewCause ??= 'review-occurrence-identity', { cause: 'review-occurrence-identity', note: `${review.occurrences} differential occurrence(s) (${peers}), none of whose canonical ids is in the review ledger` });
      });
    }
    evidence.compare(id, 'policyQualification', l.evidence.policyQualification, n.evidence.policyQualification, () => ({ cause: 'policy-corpus-bounded' }));
    evidence.compare(id, 'evidenceTier', l.evidenceTier, n.status.evidenceTier);

    // Status.
    if (l.status === 'stable') counter.legacyStable++;
    if (n.status.value === 'stable') counter.nextStable++;
    const legacyCodes = new Set(l.reasons.map(reasonCode));
    const added = n.status.reasons.map(reasonCode).filter(code => !legacyCodes.has(code));
    const causes = new Set<string>(), unattributed: string[] = [];
    for (const code of added) { const cause = causeOfReason(code, countCause, { axis: axisCause, review: reviewCause, overlay: options.axisOverlay }); if (cause) causes.add(cause); else unattributed.push(code); }
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
    statusRows.push({ family: id, legacy: l.status, next: n.status.value, verdict, causes: [...causes].sort(), heldBackBy: [...causes].sort(), unattributedReasons: unattributed });
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
export function compareOutcomes(pairs: CasePair[]): OutcomeReport {
  const c = new Collector();
  const groups = new Map<string, OutcomeReport['groups'][number]>();
  for (const pair of [...pairs].sort((a, b) => (a.next.key < b.next.key ? -1 : 1))) {
    for (const scanner of [...new Set([...Object.keys(pair.legacy.scanners), ...Object.keys(pair.next.scanners)])].sort()) {
      const l = pair.legacy.scanners[scanner], n = pair.next.scanners[scanner];
      c.tally.compared++;
      if (same(l, n)) { c.tally.equal++; continue; }
      let attribution: { cause: string; note?: string } | undefined;
      if (l?.kind === 'control' && n?.kind === 'control' && l.observed && n.observed && l.twin && n.twin && (l.coDetected !== n.coDetected || l.flagged !== n.flagged)) attribution = { cause: 'twin-scope-vocabulary', note: 'finding present on both sides; the flagged and co-detected verdicts differ' };
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
// The report.

export interface ParityReport {
  schema: typeof PARITY_SCHEMA;
  identities: Record<string, unknown>;
  causes: Cause[];
  sections: { identity: Section; membership: Section; status: Section; evidence: Section; outcomes: Section; knownGaps: Section };
  statusRows: StatusRow[];
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
