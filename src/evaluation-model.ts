import Ajv from 'ajv';
import publicSchema from '../schemas/evaluation-public-v1.json';
import qualificationSchema from '../schemas/qualification-report-v1.json';
import holdoutSchema from '../schemas/holdout-report-v1.json';
const ajv = new Ajv({ strict: true });
ajv.addSchema(holdoutSchema); ajv.addSchema(qualificationSchema);
const validPublicReport = ajv.compile(publicSchema);
import type { EvaluationReport, EvaluationCase, Counts, EvidenceRow, QualificationEvidence } from './evaluation-types';
export const METHODS = ['twin', 'benign', 'metamorphic', 'mutation', 'differential', 'holdout'];
export const counts = (): Counts => ({ pass: 0, fail: 0, 'review-required': 0, 'not-measured': 0 });
export function assertionRows(cases: EvaluationCase[]): EvidenceRow[] {
  return cases.flatMap(c => c.assertions.map(a => {
    const v = c.variants.find(v => v.id === (a.variant || a.candidate))!;
    return { caseId: c.id, method: c.method, detector: c.targets.join(', ') || 'unassigned', scanner: a.scanner,
      tier: v.tier, kind: v.kind, type: a.type, operator: v.operator, status: a.status,
      variant: a.variant || a.candidate, baseline: a.baseline, sourceSlug: c.sourceSlug, taxonomy: c.taxonomy,
      property: v.property, effect: v.expectationEffect, contract: v.contractMatch === null ? 'not specified' : String(v.contractMatch),
      overlap: Boolean(a.baseline && c.assertions.some(b => b.scanner === a.scanner && b.status === 'fail' && b.variant && [a.baseline, a.candidate].includes(b.variant))),
      peer: '', disagreement: '' };
  }));
}
export function reviewRows(report: EvaluationReport, cases = report.cases): EvidenceRow[] {
  const selected = new Map(cases.map(c => [c.id, c]));
  return report.reviews.filter(r => selected.has(r.caseId)).map(r => {
    const c = selected.get(r.caseId)!, v = c.variants.find(v => v.id === r.variant)!;
    return { caseId: c.id, method: c.method, detector: c.targets.join(', ') || 'unassigned', scanner: r.peer ? 'redact-secret' : '',
      tier: v.tier, kind: v.kind, type: r.peer ? 'differential disagreement' : 'mutation review-required',
      operator: v.operator, status: 'review-required', variant: r.variant, baseline: '', sourceSlug: c.sourceSlug,
      taxonomy: c.taxonomy, property: v.property, effect: v.expectationEffect,
      contract: v.contractMatch === null ? 'not specified' : String(v.contractMatch), overlap: false, peer: r.peer, disagreement: r.disagreement };
  });
}
export function summarizeEvaluation(cases: EvaluationCase[]) {
  const assertions = counts(), affected = new Set<string>(), reviewed = new Set<string>();
  for (const c of cases) for (const a of c.assertions) {
    assertions[a.status]++;
    if (a.status === 'fail') affected.add(c.id);
    if (a.status === 'review-required') reviewed.add(c.id);
  }
  return { cases: cases.length, variants: cases.reduce((n, c) => n + c.variants.length, 0), assertions,
    affected: affected.size, reviewed: reviewed.size,
    generationErrors: cases.reduce((n, c) => n + c.generation.filter(g => g.status === 'error').length, 0),
    unsupported: cases.reduce((n, c) => n + c.generation.filter(g => g.status === 'unsupported').length, 0) };
}
/** Recompute operator summaries from the same public cases used by explorers. */
export function operatorEvidence(cases: EvaluationCase[]): EvaluationReport['byOperator'] {
  const result: EvaluationReport['byOperator'] = {};
  for (const c of cases) {
    for (const g of c.generation) {
      const bucket = result[g.operator] ??= { generated: 0, unsupported: 0, error: 0, assertions: {} };
      bucket[g.status]++;
    }
    for (const a of c.assertions) {
      const v = c.variants.find(v => v.id === (a.variant || a.candidate))!;
      const b = c.variants.find(v => v.id === a.baseline);
      const bucket = result[v.operator];
      if (!bucket) continue;
      const stratum = b ? `${b.kind}:${b.tier}->${v.kind}:${v.tier}` : `${v.kind}:${v.tier}`;
      const key = `${c.method}/${a.scanner}/${stratum}/${a.type}`;
      (bucket.assertions[key] ??= counts())[a.status]++;
    }
  }
  return result;
}
const canonical = (value: unknown): string => JSON.stringify(value, function(_key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item;
});
/** Reject incompatible/malformed evidence before rendering, including T0 scoring. */
export function evaluationProblem(value: unknown, corpusHashes?: Record<string, string>): string | null {
  try {
    const r = value as EvaluationReport;
    if (r.schemaVersion !== 2 || r.accountingVersion !== '1.1' || r.reportType !== 'evaluation-public' || r.supportClaims !== false) return 'Unsupported evaluation report version';
    if (!validPublicReport(value)) return 'Invalid public evaluation contract';
    if (!r.runId || !Number.isFinite(Date.parse(r.startedAt)) || !Number.isFinite(Date.parse(r.finishedAt)) || Date.parse(r.finishedAt) < Date.parse(r.startedAt)) throw Error();
    if (!r.cases.length || new Set(r.cases.map(c => c.id)).size !== r.cases.length || !r.scanners.length) throw Error();
    const scannerIds = new Set(r.scanners.map(s => s.id));
    if (scannerIds.size !== r.scanners.length || r.scanners.some(s => !['complete','unavailable','error','unsupported','unstable'].includes(s.status))) throw Error();
    for (const c of r.cases) {
      if (!METHODS.slice(0, 5).includes(c.method) || !/^[a-z0-9-]+$/.test(c.id) || !/^[a-z0-9-]+--[a-z0-9-]+$/.test(c.sourceSlug) || !Array.isArray(c.targets)) throw Error();
      const variants = new Map(c.variants.map(v => [v.id, v]));
      if (!variants.size || variants.size !== c.variants.length) throw Error();
      for (const a of c.assertions) {
        const v = variants.get(a.variant || a.candidate), b = a.baseline ? variants.get(a.baseline) : null;
        if (!v || (a.baseline && !b) || !scannerIds.has(a.scanner) || !['pass','fail','review-required','not-measured'].includes(a.status)) throw Error();
        // A scanner that did not complete measured nothing, and says so on every variant.
        if ((r.scanners.find(s => s.id === a.scanner)?.status !== 'complete') !== (a.status === 'not-measured')) throw Error();
        if (a.status !== 'not-measured' && [v, b].some(x => x && (x.tier === 'T0' || x.strategy === 'review-required')) && a.status !== 'review-required') throw Error();
      }
      if (c.method === 'differential' && c.assertions.length) throw Error();
      if (c.generation.some(g => !['generated','unsupported','error'].includes(g.status))) throw Error();
      if (c.findings.some(f => !Number.isInteger(f.count) || f.count < 0 || !variants.has(f.variant))) throw Error();
      if (!Array.isArray(c.comparisons)) throw Error();
    }
    if (new Set(r.reviews.map(x => x.id)).size !== r.reviews.length || r.review.open + r.review.resolved + r.review.notAssertable + r.review.unknown !== r.reviews.length) throw Error();
    for (const q of r.reviews) {
      const c = r.cases.find(c => c.id === q.caseId);
      if (!c || !c.variants.some(v => v.id === q.variant) || !['mutation','differential'].includes(c.method)) throw Error();
      if (c.method === 'mutation' && (q.peer || q.disagreement || !c.variants.some(v => v.id === q.variant && v.strategy === 'review-required'))) throw Error();
      if (c.method === 'differential' && (!q.peer || !q.disagreement || !c.comparisons.some(x => x.peer === q.peer && x.variant === q.variant && x.disagreement === q.disagreement && x.status === 'complete'))) throw Error();
    }
    if (canonical(r.byOperator) !== canonical(operatorEvidence(r.cases))) return 'Operator totals do not match case evidence';
    if (!r.byOperator || !r.provenance || !Object.keys(r.corpusHashes).length) throw Error();
    if (corpusHashes && Object.entries(r.corpusHashes).some(([id, hash]) => corpusHashes[id] !== hash)) return 'Stale evaluation: fixture corpus changed';
    if (r.qualification && (r.qualification.supportClaims !== false || r.qualification.reportType !== 'qualification')) throw Error();
    return null;
  } catch { return 'Missing or invalid evaluation evidence'; }
}

/* ---------- Workbench: review ledger classes (redesign plan section 07) ---------- */
export interface LedgerEntry { status: 'open' | 'resolved' | 'not-assertable'; firstSeenRun: string; resolvedRun?: string; note: string }
export interface ReviewLedgerFile { schemaVersion: number; entries: Record<string, LedgerEntry> }
export interface ReviewClass {
  id: string; label: string; description: string;
  /** The literal `Class:` values of the ledger notes gathered here. */
  rawClasses: string[];
  open: number; resolved: number;
  /** No ground truth is inferable, decided once per operator class (not a per-fixture review). Distinct from `resolved`. */
  'not-assertable': number;
  entries: ({ id: string } & LedgerEntry)[];
}

/** Every ledger note ends in `Class: <value>.`; that value is the reason the entry needs a person. */
export function ledgerClassOf(note: string): string {
  return /Class: (.+?)\.?\s*$/s.exec(note)?.[1] ?? 'unclassified';
}
const GROUPS: { id: string; label: string; description: string; match: (raw: string) => boolean }[] = [
  { id: 't0-fixtures', label: 'T0 fixtures', description: 'No reviewed contract yet', match: raw => raw === 't0-pending-fixture' },
  // #125: the current-queue T0 rows, settled not-assertable under docs/decisions/2026-09-22-settle-differential-disagreements-on-pending-fixtures.md.
  // Its own group, not folded into `t0-fixtures`: a settled class carries no open entries, and that group still holds stale open rows.
  { id: 'pending-fixtures-decided', label: 'Pending fixtures (decided)', description: 'No ground truth is inferable while the fixture is T0', match: raw => raw === 'decision=differential.t0-pending-fixture' },
  // #213: same-span rows where only the peer's family label is coarser, settled not-assertable under
  // docs/decisions/2026-09-24-settle-peer-coarser-classification-disagreements.md; kept apart from the open rows in `other`.
  { id: 'peer-coarser-classification-decided', label: 'Peer-coarser labels (decided)', description: 'Same authored span, only the peer\'s family label is coarser', match: raw => raw === 'decision=differential.peer-coarser-classification' },
  // Beta.8 arrival re-measure: arrival-family rows labelled by the owning shared detector, settled not-assertable under
  // docs/decisions/2026-09-24-settle-arrival-classification-by-owning-detector.md.
  { id: 'arrival-owning-detector-decided', label: 'Arrival labels by owning detector (decided)', description: 'Same authored span, product labels the shared detector that owns the arrival family', match: raw => raw === 'decision=differential.arrival-owning-detector-classification' },
  { id: 'confirmed-defects',label: 'Confirmed defects', description: 'Product issue candidates', match: raw => raw.startsWith('confirmed-') },
];
/** URL-safe id of a ledger class. Operator ids carry dots; paths here never do. */
export function reviewClassId(raw: string): string {
  if (raw.startsWith('operator=')) return raw.slice('operator='.length).replace(/[^a-z0-9]+/g, '-');
  return GROUPS.find(g => g.match(raw))?.id ?? 'other';
}
/** What the operator does, in the ledger's own words: "operator `x` <does this>, which …". */
const operatorEffect = (note: string) => { const m = /operator `[^`]+` (.+?), which/s.exec(note)?.[1]; return m ? m[0].toUpperCase() + m.slice(1) : 'Operator contract broken by construction'; };

/** Group the ledger by the reason an entry needs a person. Counts are tallies of the JSON; nothing is inferred. */
export function reviewClasses(ledger: ReviewLedgerFile): ReviewClass[] {
  const classes = new Map<string, ReviewClass>();
  for (const [id, entry] of Object.entries(ledger.entries)) {
    const raw = ledgerClassOf(entry.note), classId = reviewClassId(raw), group = GROUPS.find(g => g.id === classId);
    let item = classes.get(classId);
    if (!item) classes.set(classId, item = {
      id: classId, rawClasses: [], open: 0, resolved: 0, 'not-assertable': 0, entries: [],
      label: group?.label ?? (raw.startsWith('operator=') ? raw.slice('operator='.length) : 'Other'),
      description: group?.description ?? (raw.startsWith('operator=') ? operatorEffect(entry.note) : 'Classes with no group of their own'),
    });
    if (!item.rawClasses.includes(raw)) item.rawClasses.push(raw);
    item[entry.status]++;
    item.entries.push({ id, ...entry });
  }
  return [...classes.values()].sort((a, b) => b.open - a.open || a.label.localeCompare(b.label));
}

/** A ledger fragment to paste into review-ledger.json through a PR. The UI writes no file. */
export function ledgerSnippet(entries: ({ id: string } & LedgerEntry)[], resolvedRun: string, decision = '<your decision and why>'): string {
  return JSON.stringify(Object.fromEntries(entries.map(({ id, firstSeenRun, note }) => [id, { status: 'resolved', firstSeenRun, resolvedRun, note: `${decision} Class: ${ledgerClassOf(note)}.` }])), null, 2);
}

/* ---------- Workbench: what changed, and why (redesign plan section 08) ---------- */
import candidateSchema from '../schemas/candidate-report-v1.json';
const validCandidate = ajv.compile(candidateSchema);

/** One (fixture, product scanner) observation before and after. Codes are lattice.encodeOutcome strings. */
export interface OutcomePair { slug: string; kind: string; tier: string; section: 'fixed-corpus' | 'expanded-corpus'; before: string | null; after: string | null }
export type ChangeStatus = 'improved' | 'regressed' | 'held' | 'check' | 'policy' | 'new' | 'unscored';
export interface ChangeRow { status: ChangeStatus; label: string; detail: string; before: number | null; after: number; of: number | null; slugs: string[] }
export interface CandidateReport {
  runId: string; finishedAt: string; status: string;
  candidate: { sourceCommit: string; sourceState: string; declaredVersion: string; packageName: string };
  selection: { scope: string; filter: string | null };
  completeness: { selectedFixtures: number; scannedFixtures: number; writtenFixtures: number };
  failures: { phase: string; code: string }[];
  results: { fixtureId: string; corpusSection: 'fixed-corpus' | 'expanded-corpus'; kind: string; tier: string; outcome: string | null; baseline: { version: string; outcome: string | null } }[];
}

export function candidateProblem(value: unknown): string | null {
  if (!validCandidate(value)) return 'Invalid candidate evidence contract';
  return (value as { supportClaims: unknown }).supportClaims === false ? null : 'Candidate evidence must not carry support claims';
}
export const candidatePairs = (report: CandidateReport): OutcomePair[] =>
  report.results.map(r => ({ slug: r.fixtureId, kind: r.kind, tier: r.tier, section: r.corpusSection, before: r.baseline.outcome, after: r.outcome }));

/** A code is exposed when any span leaked, alarmed when a control was flagged. Reads the code; scores nothing. */
const exposed = (code: string | null) => code != null && /PARTIAL|MISS/.test(code);
const alarmed = (code: string | null) => code != null && code.startsWith('flagged');
const count = (pairs: OutcomePair[], test: (code: string | null) => boolean, side: 'before' | 'after') => pairs.filter(p => test(p[side])).length;

/**
 * Only what changed, each with its reason. Totals are printed once per kind so
 * a reader sees the denominator; unchanged rows collapse into one Held line.
 */
export function changeRows(pairs: OutcomePair[]): ChangeRow[] {
  const rows: ChangeRow[] = [];
  const known = pairs.filter(p => p.before != null && p.after != null);
  const scored = known.filter(p => p.tier !== 'T0');
  const moved = (list: OutcomePair[]) => list.filter(p => p.before !== p.after);
  const tally = (list: OutcomePair[], test: typeof exposed, label: string, detail: string) => {
    if (!list.length) return;
    const before = count(list, test, 'before'), after = count(list, test, 'after');
    const status: ChangeStatus = after < before ? 'improved' : after > before ? 'regressed' : 'held';
    rows.push({ status, label, detail, before: before === after ? null : before, after, of: list.length, slugs: moved(list).filter(p => test(p.before) !== test(p.after)).map(p => p.slug) });
  };
  const required = scored.filter(p => p.kind === 'must-redact'), controls = scored.filter(p => p.kind === 'must-not-flag'), policy = scored.filter(p => p.kind === 'policy');
  tally(required, exposed, 'Required secrets left readable', 'must-redact, T1 and T2');
  tally(controls, alarmed, 'False alarms on controls', 'must-not-flag, every tier');
  // Same verdict, different shape: EXACT → COVERED protects either way, but a person should look.
  const sameVerdict = moved([...required, ...controls]).filter(p => exposed(p.before) === exposed(p.after) && alarmed(p.before) === alarmed(p.after));
  const transitions = new Map<string, OutcomePair[]>();
  for (const p of sameVerdict) { const key = `${p.before} → ${p.after}`; transitions.set(key, [...(transitions.get(key) ?? []), p]); }
  for (const [transition, list] of transitions)
    rows.push({ status: 'check', label: transition, detail: 'Same verdict, different ranges', before: null, after: list.length, of: null, slugs: list.map(p => p.slug) });
  const policyMoved = moved(policy);
  if (policyMoved.length) rows.push({ status: 'policy', label: 'Policy rows that changed', detail: 'Project policy (T3): a difference of opinion, not a defect', before: null, after: policyMoved.length, of: policy.length, slugs: policyMoved.map(p => p.slug) });
  const unscoredMoved = moved(known.filter(p => p.tier === 'T0'));
  if (unscoredMoved.length) rows.push({ status: 'unscored', label: 'Pending rows that changed', detail: 'T0: observed, never scored', before: null, after: unscoredMoved.length, of: null, slugs: unscoredMoved.map(p => p.slug) });
  const fresh = pairs.filter(p => p.before == null && p.after != null);
  if (fresh.length) rows.push({ status: 'new', label: 'Rows with no baseline', detail: 'No saved outcome to compare against; not scored as a change', before: null, after: fresh.length, of: null, slugs: fresh.map(p => p.slug) });
  return rows;
}

/* ---------- Workbench: qualification floors (redesign plan section 08) ---------- */
export type GateStatus = 'met' | 'not-met' | 'watch' | 'not-measured';
export interface Gate { id: string; status: GateStatus; label: string; detail: string; value: string }
interface SuiteAccounting { minDenominator: number; replays: number; resolvedRateFloor: Record<string, number>; measurableShareFloor: Record<string, number>; twinCoverageFloor: Record<string, number> }

type PublishedValue = { point: number; bound: number | null; n: number } | string | null | undefined;
/** The slice of a published must-redact / policy / control group the floors read. */
export interface GateGroup { files: number; spans?: number; measurableShare?: PublishedValue; twins?: { pairs: number; positives: number; coverage: PublishedValue } }
const pointOf = (value: PublishedValue) => (value && typeof value === 'object' ? value.point : null);
const floorOf = (floor: Record<string, number>, key: string) => floor[key.split('/')[0]] ?? floor.default;

/**
 * Six floors, each with whether it is met and the actual value.
 * Three are engine reasons stated by the qualification evidence
 * (execution-incomplete, unresolved-assertions, unreviewed-queue). Three are
 * measurement floors from qualification/suite-v1.json, read against the
 * product scanner's published groups. "Met" compares two published numbers;
 * no rate or bound is derived here. Absent evidence is Not measured.
 */
export function qualificationGates(accounting: SuiteAccounting, q: QualificationEvidence | null, groups: Record<string, GateGroup> | null): Gate[] {
  const floors = (floor: Record<string, number>) => Object.entries(floor).map(([k, v]) => `${k} ${v}`).join(', ');
  const nm = (id: string, label: string, detail: string, value = '—'): Gate => ({ id, status: 'not-measured', label, detail, value });
  const gate = (id: string, ok: boolean, label: string, detail: string, value: string): Gate => ({ id, status: ok ? 'met' : 'not-met', label, detail, value });
  const gates: Gate[] = [];

  if (q) {
    const scanners = q.methods?.flatMap(m => m.scanners) ?? q.holdout.scanners;
    const ids = [...new Set(scanners.map(s => s.id))], incomplete = ids.filter(id => scanners.some(s => s.id === id && s.status !== 'complete'));
    const unstable = ids.filter(id => scanners.some(s => s.id === id && s.status === 'unstable'));
    gates.push(gate('scanners', !q.accounting?.reasons.includes('execution-incomplete') && !incomplete.length, 'Scanners complete', `replays ${accounting.replays}, ${unstable.length ? `unstable: ${unstable.join(', ')}` : 'none unstable'}`, `${ids.length - incomplete.length} / ${ids.length}`));
  } else gates.push(nm('scanners', 'Scanners complete', `replays ${accounting.replays}`));

  const scored = Object.entries(groups ?? {}).filter(([key]) => key !== 'pending/T0');
  if (scored.length) {
    const size = ([, g]: [string, GateGroup]) => g.spans ?? g.files;
    const thin = scored.filter(entry => size(entry) < accounting.minDenominator);
    gates.push(gate('min-denominator', !thin.length, 'Min denominator', thin.length ? `below: ${thin.map(([key, g]) => `${key} (${g.spans ?? g.files})`).join(', ')}` : 'scored groups', `${scored.length - thin.length} / ${scored.length} ≥ ${accounting.minDenominator}`));
    const lowest = (read: (g: GateGroup) => number | null, floor: Record<string, number>) => scored
      // A floor of 0 (the policy override) cannot be missed, so it is never the value worth showing.
      .flatMap(([key, g]) => { const point = read(g), limit = floorOf(floor, key); return point == null || limit <= 0 ? [] : [{ key, point, floor: limit }]; })
      .sort((a, b) => (a.point - a.floor) - (b.point - b.floor))[0];
    const share = lowest(g => pointOf(g.measurableShare), accounting.measurableShareFloor);
    gates.push(share ? gate('measurable-share', share.point >= share.floor, 'Measurable share', `lowest margin: ${share.key} · ${floors(accounting.measurableShareFloor)}`, `${share.point.toFixed(3)} ≥ ${share.floor}`) : nm('measurable-share', 'Measurable share', floors(accounting.measurableShareFloor)));
    const twin = lowest(g => (g.twins?.positives ? pointOf(g.twins.coverage) : null), accounting.twinCoverageFloor);
    gates.push(twin ? gate('twin-coverage', twin.point >= twin.floor, 'Twin coverage', `lowest margin: ${twin.key} · ${floors(accounting.twinCoverageFloor)}`, `${twin.point.toFixed(3)} ≥ ${twin.floor}`) : nm('twin-coverage', 'Twin coverage', floors(accounting.twinCoverageFloor)));
  } else {
    gates.push(nm('min-denominator', 'Min denominator', 'no published run summary', `≥ ${accounting.minDenominator}`));
    gates.push(nm('measurable-share', 'Measurable share', floors(accounting.measurableShareFloor), `≥ ${accounting.measurableShareFloor.default}`));
    gates.push(nm('twin-coverage', 'Twin coverage', floors(accounting.twinCoverageFloor), `≥ ${accounting.twinCoverageFloor.default}`));
  }

  if (q?.accounting) {
    const { reasons, unresolvedGroups, review } = q.accounting;
    gates.push(gate('resolved-rate', !reasons.includes('unresolved-assertions'), 'Resolved rate', unresolvedGroups.length ? `${unresolvedGroups.length} group(s) below floor, first: ${unresolvedGroups[0]}` : floors(accounting.resolvedRateFloor), `≥ ${accounting.resolvedRateFloor.default}`));
    const total = review.open + review.resolved + review.notAssertable + review.unknown, n = (v: number) => v.toLocaleString('en-US');
    gates.push({ id: 'ledger', status: review.unknown ? 'not-met' : review.open ? 'watch' : 'met', label: 'Ledger rows for every entry', detail: review.unknown ? `${n(review.unknown)} queue entries have no ledger row` : 'open is a valid state', value: `${n(total)} · ${n(review.open)} open` });
  } else {
    gates.push(nm('resolved-rate', 'Resolved rate', floors(accounting.resolvedRateFloor), `≥ ${accounting.resolvedRateFloor.default}`));
    gates.push(nm('ledger', 'Ledger rows for every entry', 'no qualification evidence with ledger accounting'));
  }
  return gates;
}
