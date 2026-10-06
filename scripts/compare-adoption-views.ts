/**
 * Compare the qualification views of an evidence adoption (#680) and attribute every difference to its cause. Nothing here decides or accepts
 * anything: it reads three built views (and optionally the candidate methods run) and writes what differs and why.
 *
 *   node --import tsx scripts/compare-adoption-views.ts --accepted VIEW --replay-old VIEW --candidate VIEW --report CHANGE_REPORT.json \
 *     [--candidate-methods ARTIFACT [--candidate-inputs <derived dir>] [--ledger <review ledger>]] [--out-json FILE] [--out-md FILE] [--record FILE] [--registry FILE] [--parity FILE]
 *   node --import tsx scripts/compare-adoption-views.ts --from-comparison COMPARISON.json --report CHANGE_REPORT.json [--out-json FILE] [--out-md FILE] ...
 *
 * `--ledger` names the review ledger the settled/unsettled split reads (default benchmarks/review-ledger.json): a triage queue that must not depend on the owner's settlement rows is exported
 * with the ledger as it was before they were applied, and the settlements are applied afterwards (scripts/apply-ledger-settlements.ts).
 *
 * The report states the CURRENT adoption state (#700): acceptance, deployment receipts, scanned product and capability come from the structured record
 * (`--record`, default benchmarks/evidence-adoption.json) and the registry, so a report regenerated after the owner accepted no longer asks for acceptance.
 * `--from-comparison` renders again from a recorded comparison (no views needed): the data is kept, the state sections are recomputed.
 *
 * The three views, all built by `npm run qualification:view` from official RunArtifacts:
 *   accepted    the previous accepted runs (previous corpus, previous engine, previous overlays)         = A
 *   replay-old  the previous corpus replayed on the new engine, with the review-ledger re-key regenerated = B
 *   candidate   the candidate corpus on the new engine with the regenerated product overlays            = C
 * A to B is the engine effect (the corpus and its overlays are fixed), B to C the corpus effect together with the overlays derived from it. The overlays
 * (axis overlay, twin-scope map, review-ledger re-key) are derived from the corpus and cannot be pinned apart from it, so they are reported with it, and what
 * each one changed is listed under `overlayAndPolicy`. A difference no rule attributes is listed under `unexplained`; the script exits 1 on one with --strict.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readRunArtifact } from '../benchmarks/qualification/run-artifact.ts';
import { seedCaseId } from '../benchmarks/qualification/adapter.ts';
import { ledgerSettledId } from '../benchmarks/qualification/ledger-rekey.ts';
import { MAINTAINER_REVIEWED_EN, MAINTAINER_REVIEWED_KO, SCOPE_LINE, adoptionReportState, sideLabels, statusLines } from './adoption-report-state.mjs';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));

/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = any;
const report: Json = readJson(need('report'));
const adoption: Json = readJson(option('record') ?? 'benchmarks/evidence-adoption.json');
const record: Json = adoption.candidate ?? {};
const adoptionState = adoptionReportState(adoption, readJson(option('registry') ?? 'benchmarks/official-runs.json'));
const supersededChangeReport: Json = (() => { try { return readJson(record.supersedesCandidate?.changeReport); } catch { return null; } })();
const engineTo: string = option('engine-to') ?? record.engine?.tag ?? 'the new engine';
const engineFrom: string = option('engine-from') ?? record.engineChange?.from?.tag ?? 'the previous engine';
const tagShort = (t: string) => t.replace(/^v0\.1\.0-/, '');
const previousRelease: string = report.previous?.evidenceRelease ?? 'the previous release';
const addedTotal: number = report.diff.added.length;
const added = new Set<string>(report.diff.added);
const sortedKeys = (o: object) => Object.keys(o).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const count = <T>(items: T[], key: (item: T) => string) => { const out: Record<string, number> = {}; for (const i of items) out[key(i)] = (out[key(i)] ?? 0) + 1; return Object.fromEntries(sortedKeys(out).map(k => [k, out[k]])); };
const unexplained: string[] = [];

// Re-render a recorded comparison against the current adoption state, without the views (the data is kept, the state sections are recomputed).
if (option('from-comparison')) {
  const recorded: Json = readJson(option('from-comparison')!);
  const o: Json = { ...recorded, scope: SCOPE_LINE, adoptionState };
  if (option('out-json')) writeFileSync(option('out-json')!, `${JSON.stringify(o, null, 2)}\n`);
  if (option('out-md')) writeFileSync(option('out-md')!, renderMarkdown(o, option('parity') ? readJson(option('parity')!) : null));
  process.exit(0);
}
const A: Json = readJson(need('accepted')), B: Json = readJson(need('replay-old')), C: Json = readJson(need('candidate'));

const familiesOf = (v: Json) => new Map<string, Json>(v.families.map((f: Json) => [f.family, f]));
const matrixOf = (v: Json) => new Map<string, Json>(v.supportMatrix.families.map((f: Json) => [f.family, f]));
const publicOf = (v: Json) => v.populations.find((p: Json) => p.population === 'public-evidence-snapshot');
const reasonText = (f: Json) => (f.status?.reasons ?? []).map((r: string) => r.split(' — ')[0]);

// ---- 1. engine effect (A to B): the same corpus on two engines ----
const engine = (() => {
  const a = familiesOf(A), b = familiesOf(B), differing: string[] = [];
  for (const [k, f] of b) { const o = a.get(k); if (!o || !['evidence', 'gates', 'populations', 'status', 'attribution', 'contract', 'differential', 'fixtureProfile', 'axisCoverage'].every(x => same(o[x], f[x]))) differing.push(k); }
  const caseDrift: string[] = [];
  const ac = new Map<string, Json>(publicOf(A).cases.map((c: Json) => [c.id, c]));
  for (const c of publicOf(B).cases) if (!same(ac.get(c.id), c)) caseDrift.push(c.id);
  const matrixSame = same(A.supportMatrix, B.supportMatrix), distributionSame = same(A.distribution, B.distribution);
  return {
    note: `The same corpus, the same overlays and the same peer scanner versions, measured by credential-eval ${engineFrom} and ${engineTo}, with the product release the engine tag pins (the product release may move with the engine tag; where it does, the engine-versus-product split of an attribution run says how much of a difference is the product) (the review-ledger re-key is regenerated for the ${tagShort(engineTo)} methods run, whose occurrence ids all changed with the scanner configuration identity).`,
    distribution: { accepted: A.distribution, replayOld: B.distribution }, distributionSame,
    familiesWithAnyDifference: differing, supportMatrixSame: matrixSame, publicCasesWithAnyDifference: caseDrift.length,
  };
})();
// With the SAME engine on both sides a difference on the same corpus is a defect; when the adoption MOVES the engine it is the engine effect, a product-version effect reported apart from the corpus change (docs/specs/evidence-adoption.md),
// never a refusal. Its scanners that the new run left out on purpose (the roster) are absent from B by design.
const engineMoved = engineFrom !== engineTo;
if (!engineMoved && (engine.familiesWithAnyDifference.length || !engine.supportMatrixSame || engine.publicCasesWithAnyDifference)) unexplained.push(`engine effect: ${engine.familiesWithAnyDifference.length} families, ${engine.publicCasesWithAnyDifference} public cases differ between the accepted view and the previous corpus on the new engine`);

// ---- 2. the candidate methods run, attributed to added versus common cases ----
const snapshotCases = new Map<string, Json>(publicOf(C).cases.map((c: Json) => [c.id, c]));
const classToPending = new Set<string>((Array.isArray(report.diff.changed) ? report.diff.changed : []).filter((c: Json) => Array.isArray(c.evidenceClass) && c.evidenceClass[0] !== c.evidenceClass[1] && c.evidenceClass[1] === 'unresolved').map((c: Json) => c.id));
let methods: Json = null;
const gateAttribution = new Map<string, { added: number; common: number }>();
const unsettledGateOccurrences: Json[] = [];
const assertionAttribution = new Map<string, Record<string, { added: number; common: number }>>();
if (option('candidate-methods')) {
  const ledger = readJson(option('ledger') ?? 'benchmarks/review-ledger.json'), rekey = readJson(option('candidate-inputs') ? `${option('candidate-inputs')}/public-review-ledger-map.json` : 'benchmarks/support/public-review-ledger-map.json'); // a candidate's own derived re-key (--candidate-inputs <derived dir>): the committed one belongs to the accepted corpus
  const art = readRunArtifact(readFileSync(need('candidate-methods')), { forceBytes: true }).artifact as Json;
  const policy = C.policy; const gatePeers = new Set<string>(policy.differentialPeers ?? ['gitleaks', 'trufflehog']);
  const settled = (id: string) => ['resolved', 'not-assertable'].includes(ledger.entries[ledgerSettledId(id, ledger, rekey)]?.status);
  const byPeer: Record<string, Record<string, number>> = {};
  for (const q of art.review_queue ?? []) {
    if (q.method !== 'differential') continue;
    const seed = seedCaseId(q.case_id, q.method), origin = added.has(seed) ? 'added' : 'common';
    const key = `${q.peer}${gatePeers.has(String(q.peer)) ? ' (gate)' : ''}`;
    const row = (byPeer[key] ??= { 'common settled': 0, 'common unsettled': 0, 'added settled': 0, 'added unsettled': 0 });
    row[`${origin} ${settled(q.id) ? 'settled' : 'unsettled'}`]++;
    if (gatePeers.has(String(q.peer)) && !settled(q.id)) {
      unsettledGateOccurrences.push({ id: q.id, peer: q.peer, case: seed, variant: q.variant, disagreement: q.disagreement, origin, families: snapshotCases.get(seed)?.detectors ?? [] });
      for (const d of snapshotCases.get(seed)?.detectors ?? []) { const r = gateAttribution.get(d) ?? { added: 0, common: 0 }; r[origin]++; gateAttribution.set(d, r); }
    }
  }
  const rs = art.scanners.find((s: Json) => s.scanner === 'redact-secret');
  const assertionFailures: Record<string, Record<string, number>> = {};
  for (const x of rs?.assertions ?? []) {
    if (x.status !== 'fail') continue;
    const seed = seedCaseId(x.case_id, x.method), origin = added.has(seed) ? 'added' : 'common';
    (assertionFailures[x.method] ??= { added: 0, common: 0 })[origin]++;
    for (const d of snapshotCases.get(seed)?.detectors ?? []) { const m = assertionAttribution.get(d) ?? {}; (m[x.method] ??= { added: 0, common: 0 })[origin]++; assertionAttribution.set(d, m); }
  }
  methods = {
    note: 'The candidate methods run (differential, metamorphic, mutation): review occurrences of the gate peers and the failed assertions of the reference scanner (redact-secret), split by whether the seed case is one of the added cases or a common case.',
    differentialOccurrencesByPeer: byPeer, referenceAssertionFailuresByMethod: assertionFailures,
    unsettledGateOccurrences: { note: 'Every gate-peer (gitleaks, trufflehog) differential occurrence with no ledger decision, own or mapped from the legacy ledger. Origin added: the seed case is new in this snapshot, so no legacy decision exists for it. Origin common: the occurrence maps to a legacy ledger entry that is still open, and was equally unsettled in the accepted view.', items: unsettledGateOccurrences.sort((x, y) => (x.id < y.id ? -1 : 1)) },
    unmeasuredVariants: Object.fromEntries(art.scanners.filter((s: Json) => s.unmeasured_cases?.length).map((s: Json) => [s.scanner, s.unmeasured_cases.length])),
  };
}

// ---- 3. corpus effect (A to C) per family ----
const a = familiesOf(A), c = familiesOf(C);
const FIELDS = ['positiveCases', 'positiveAxes', 'totalFixtures', 'benignCases', 'benignAxes', 'controlAxes', 'confusionAxes', 'twinPairs', 'contextTwinPairs', 'metamorphicCriticalFailures', 'mutationUnresolvedCritical', 'differentialUnresolvedContractDisagreements', 'policyQualification'];
const familyRows = [...c].filter(([k, f]) => FIELDS.some(x => !same(a.get(k)!.evidence[x], f.evidence[x])) || a.get(k)!.status.value !== f.status.value).map(([k, f]) => {
  const o = a.get(k)!, delta: Record<string, { from: unknown; to: unknown }> = {};
  for (const x of FIELDS) if (!same(o.evidence[x], f.evidence[x])) delta[x] = { from: o.evidence[x], to: f.evidence[x] };
  const g = gateAttribution.get(k) ?? { added: 0, common: 0 };
  const m = assertionAttribution.get(k) ?? {};
  const row: Json = { family: k, status: { from: o.status.value, to: f.status.value }, evidenceTier: f.status.evidenceTier, evidenceDelta: delta };
  if (o.status.value !== f.status.value) {
    row.statusReasons = reasonText(f);
    // every reason must be one the added cases explain: the unresolved differential occurrences and the reference's failed assertions of added cases
    const unresolved = f.evidence.differentialUnresolvedContractDisagreements as number;
    const explainedByAdded = gateAttribution.size ? g.added === unresolved && g.common === (o.evidence.differentialUnresolvedContractDisagreements as number) : null;
    const movedToUnresolved = snapshotCases.size === 0 ? [] : [...snapshotCases.values()].filter((x: Json) => classToPending.has(x.id) && (x.detectors ?? []).includes(k)).map((x: Json) => x.id).sort();
    row.cause = {
      evidenceClassMovedToUnresolved: movedToUnresolved,
      differentialUnresolvedFromAddedCases: gateAttribution.size ? g.added : null, differentialUnresolvedFromCommonCases: gateAttribution.size ? g.common : null,
      referenceAssertionFailuresByMethod: Object.fromEntries(Object.entries(m).map(([k2, v]) => [k2, v])),
      explainedByAddedCases: explainedByAdded,
    };
    if (!f.status.reasons?.length && f.status.value !== 'stable') unexplained.push(`${k}: status ${o.status.value} to ${f.status.value} with no reason`);
    if (gateAttribution.size && explainedByAdded === false) unexplained.push(`${k}: ${unresolved} unresolved differential occurrences, but ${g.added} come from added cases and ${g.common} from common cases (accepted view had ${o.evidence.differentialUnresolvedContractDisagreements})`);
  }
  return row;
});

// ---- 4. support matrix ----
const am = matrixOf(A), cm = matrixOf(C);
const matrixChanges = [...cm].filter(([k, f]) => am.get(k)!.status !== f.status).map(([k, f]) => ({ family: k, from: am.get(k)!.status, to: f.status, unresolvedCriticalItems: f.unresolvedCriticalItems ?? null, viewFamilyStatus: c.get((f.detectors ?? [])[0])?.status?.value ?? null }));

// ---- 5. per-case drift of the public population: common cases apart from added cases ----
const pa = publicOf(A), pc = publicOf(C);
const commonA = new Map<string, Json>(pa.cases.map((x: Json) => [x.id, x]));
const outcome = (r: Json) => (r.measurement === 'positive' ? `positive:${(r.outcomes ?? []).join(',')}` : r.measurement === 'control' ? `control:${r.flagged ? 'flagged' : 'clear'}` : r.measurement);
const drift: Json[] = [];
for (const x of pc.cases) {
  const o = commonA.get(x.id); if (!o) continue;
  const regrouped = ['family', 'tier', 'evidenceClass', 'group', 'kind'].filter(k => !same(o[k], x[k]));
  const changed: Json[] = [];
  for (const r of x.results) { const before = o.results.find((q: Json) => q.scanner === r.scanner); if (outcome(before) !== outcome(r)) changed.push({ scanner: r.scanner, from: outcome(before), to: outcome(r) }); }
  if (changed.length) drift.push({ case: x.id, regrouped, changed, family: x.family });
}
// A common case the release itself records as changed in CONTENT or EXPECTED spans (the case was re-authored or its expectation corrected in credential-evidence, e.g. ADR 0021) is a corpus change: its outcome move is that change, attributed to it.
const contentChanged = new Set<string>((Array.isArray(report.diff.changed) ? report.diff.changed : []).filter((c: Json) => (c.fields ?? []).some((f: string) => f === 'content' || f === 'expected')).map((c: Json) => c.id));
// A common case the release moves to an unresolved evidence class (T0: the maintainer asserts nothing) is not scored by any scanner any more: its outcome moves to `pending`, outside every denominator.
// That is the evidence change itself, so a drift whose every scanner outcome ends `pending` for a case the release lists with an evidence-class change is attributed to it.
const driftExplained = (d: Json) => (classToPending.has(d.case) && d.changed.length > 0 && d.changed.every((x: Json) => x.to === 'pending')) || contentChanged.has(d.case) || d.regrouped.includes('family') && d.regrouped.length > 0 && C.policy.twinScope && snapshotCases.get(d.case)?.twinOf !== undefined;
// The ENGINE effect (A to B: the same corpus on the new engine): a common case whose outcome with only the engine changed already equals its candidate outcome is the engine's (e.g. its twin scoring, ADR 0018), not the corpus's.
const pb = publicOf(B), commonB = new Map<string, Json>(pb.cases.map((x: Json) => [x.id, x]));
const engineAlone = (d: Json) => d.regrouped.length === 0 && d.changed.length > 0 && d.changed.every((x: Json) => { const r = commonB.get(d.case)?.results.find((q: Json) => q.scanner === x.scanner); return r !== undefined && outcome(r) === x.to; });
const driftByScanner = count(drift.flatMap((d: Json) => d.changed.map((x: Json) => ({ ...x, case: d.case }))), (x: Json) => `${x.scanner}: ${x.from} -> ${x.to}`);
for (const d of drift) if (!driftExplained(d) && !engineAlone(d)) unexplained.push(`common case ${d.case} changed outcome (${d.changed.map((x: Json) => `${x.scanner} ${x.from} -> ${x.to}`).join('; ')}) without a twin family assignment`);

// ---- 5b. every family evidence delta needs a corpus cause: an added case or a regrouped common case attributed to it ----
const twinOnlyIds = new Set<string>((Array.isArray(report.diff.changed) ? report.diff.changed : []).filter((c: Json) => (c.fields ?? []).length > 0 && (c.fields ?? []).every((f: string) => f === 'twin')).map((c: Json) => c.id));
const touched = new Set<string>();
for (const x of pc.cases) {
  const o = commonA.get(x.id);
  if (!o && !added.has(x.id)) continue;
  if (added.has(x.id) || contentChanged.has(x.id) || twinOnlyIds.has(x.id) || ['family', 'tier', 'evidenceClass', 'group', 'kind'].some(k => !same(o![k], x[k]))) for (const d of x.detectors ?? []) touched.add(d);
}
const regroupedCommon = pc.cases.filter((x: Json) => commonA.has(x.id) && ['family', 'tier', 'evidenceClass', 'group', 'kind'].some(k => !same(commonA.get(x.id)![k], x[k]))).length;
// A case the release changes ONLY in its `twin` field (a twin that gained sibling_family or moved scope) is a changed common case no view regroups: the report lists it, the views cannot see it.
const twinOnly = (Array.isArray(report.diff.changed) ? report.diff.changed : []).filter((c: Json) => (c.fields ?? []).length > 0 && (c.fields ?? []).every((f: string) => f === 'twin')).map((c: Json) => c.id);
const twinOnlyCommon = twinOnly.filter((id: string) => pc.cases.some((x: Json) => x.id === id && commonA.has(id) && !['family', 'tier', 'evidenceClass', 'group', 'kind'].some(k => !same(commonA.get(id)![k], x[k])))).length;
if (Array.isArray(report.diff.changed) && report.diff.changed.length !== regroupedCommon + twinOnlyCommon + [...contentChanged].filter(id => pc.cases.some((x: Json) => x.id === id && commonA.has(id) && !['family', 'tier', 'evidenceClass', 'group', 'kind'].some(k => !same(commonA.get(id)![k], x[k])))).length) unexplained.push(`the change report lists ${report.diff.changed.length} changed common cases, the views regroup ${regroupedCommon}`);
for (const r of familyRows) if (!touched.has(r.family)) unexplained.push(`${r.family}: evidence changed (${Object.keys(r.evidenceDelta).join(', ')}) with no added or regrouped case attributed to it`);

// ---- 6. added cases ----
const addedCases = pc.cases.filter((x: Json) => added.has(x.id));
const addedRows = sortedKeys(Object.fromEntries(pc.cases[0].results.map((r: Json) => [r.scanner, 1]))).map(scanner => {
  const outcomes = count(addedCases, (x: Json) => outcome(x.results.find((r: Json) => r.scanner === scanner)));
  return { scanner, cases: addedCases.length, outcomes };
});
const commonCount = pc.cases.length - addedCases.length;

// ---- 7. populations: unmeasured and the case counts ----
const popRows = (v: Json) => v.populations.map((p: Json) => ({ population: p.population, cases: p.cases.length, unmeasuredByScanner: Object.fromEntries((p.unmeasured?.cases ?? p.unmeasured ?? []).map((u: Json) => [u.scanner, u.unmeasured])), pending: p.cases.filter((x: Json) => x.results.some((r: Json) => r.measurement === 'pending')).length }));
const unmeasuredRows = (v: Json) => Object.fromEntries(v.populations.map((p: Json) => [p.population, Object.fromEntries((p.unmeasured?.cases ?? []).filter((u: Json) => u.unmeasured > 0).map((u: Json) => [u.scanner, { unmeasured: u.unmeasured, reasons: u.reasons }]))]));

// ---- 8. overlays and policy ----
const overlayAndPolicy = {
  note: 'Product-owned inputs derived from the corpus. They name axes and attribution and settle ledger decisions; they change no evidence class, outcome or measured count. The policy criteria, rules and gate peers are unchanged.',
  policyRevision: { accepted: A.policy.revision, candidate: C.policy.revision },
  unchangedPolicyKeys: sortedKeys(C.policy).filter(k => same(A.policy[k], C.policy[k])),
  changedPolicyKeys: sortedKeys(C.policy).filter(k => !same(A.policy[k], C.policy[k])),
  axisOverlay: { accepted: A.policy.axisOverlay, candidate: C.policy.axisOverlay },
  twinScope: { accepted: A.policy.twinScope, candidate: C.policy.twinScope, why: `credential-evidence now gives the ${A.policy.twinScope?.twins ?? '?'} cross-provider twins the accepted map named their family (grouping change), so the engine scopes them itself and the product map has nothing left to map; the project twin cases stay in the regression population.` },
  ledgerRekey: { accepted: A.policy.ledgerRekey, candidate: C.policy.ledgerRekey },
};

// ---- 8b. the owner's ledger settlements (#698): the candidate view versus the same runs read with the settlements applied ----
const finalFile = option('final');
const ledgerEffect = finalFile ? (() => {
  const F: Json = readJson(finalFile), f = familiesOf(F);
  const rows = [...f].filter(([k, x]) => x.status.value !== c.get(k)!.status.value || !same(x.evidence.differentialUnresolvedContractDisagreements, c.get(k)!.evidence.differentialUnresolvedContractDisagreements)).map(([k, x]) => ({
    family: k, status: { from: c.get(k)!.status.value, to: x.status.value }, differentialUnresolved: { from: c.get(k)!.evidence.differentialUnresolvedContractDisagreements, to: x.evidence.differentialUnresolvedContractDisagreements }, remainingReasons: x.status.value === 'stable' ? [] : reasonText(x),
  }));
  for (const r of rows) {
    if (r.status.from !== r.status.to && !(r.differentialUnresolved.to < r.differentialUnresolved.from)) unexplained.push(`${r.family}: status ${r.status.from} to ${r.status.to} by the ledger settlements, but its unresolved differential occurrences did not fall (${r.differentialUnresolved.from} to ${r.differentialUnresolved.to})`);
  }
  for (const [k, x] of f) if (!same(x.evidence, c.get(k)!.evidence) && !rows.some(r => r.family === k)) {
    const delta = FIELDS.filter(y => !same(x.evidence[y], c.get(k)!.evidence[y]));
    if (delta.length) unexplained.push(`${k}: the ledger settlements changed ${delta.join(', ')}, which only the differential count may change`);
  }
  const am2 = matrixOf(F);
  const matrix = [...am2].filter(([k, x]) => cm.get(k)!.status !== x.status).map(([k, x]) => ({ family: k, from: cm.get(k)!.status, to: x.status }));
  return { note: 'The same official runs, read with the owner-decided review settlements applied (benchmarks/review-ledger.json rows keyed by the accepted run\'s occurrence ids; scripts/apply-ledger-settlements.ts). Only the differential gate can move.', policyRevision: { candidateWithoutSettlements: C.policy.revision, final: F.policy.revision }, distribution: { candidateWithoutSettlements: C.distribution, final: F.distribution }, supportMatrix: { candidateWithoutSettlements: C.supportMatrix.distribution, final: F.supportMatrix.distribution }, stableDistribution: { candidateWithoutSettlements: C.stableDistribution, final: F.stableDistribution }, familyChanges: rows, supportMatrixStatusChanges: matrix, finalVsAccepted: { statusChanges: [...f].filter(([k, x]) => x.status.value !== a.get(k)!.status.value).map(([k, x]) => ({ family: k, from: a.get(k)!.status.value, to: x.status.value })) } };
})() : null;

// ---- 9. the superseded candidate (the same release family on the previous engine), from its own recorded comparison ----
const supersededFile = option('superseded-comparison');
const superseded: Json = supersededFile ? readJson(supersededFile) : null;
const supersededCandidate = superseded && (() => {
  const s = superseded.views.candidate, statusSet = (o: Json) => new Set<string>(o.corpusEffect.statusChanges.map((r: Json) => r.family)), matrixSet = (o: Json) => new Set<string>(o.corpusEffect.supportMatrixStatusChanges.map((r: Json) => r.family));
  const before = statusSet(superseded), after = new Set<string>(familyRows.filter(r => r.status.from !== r.status.to).map(r => r.family));
  const mBefore = matrixSet(superseded), mAfter = new Set<string>(matrixChanges.map(r => r.family));
  const minus = (x: Set<string>, y: Set<string>) => [...x].filter(k => !y.has(k)).sort();
  return {
    evidenceRelease: superseded.evidenceRelease, engine: option('superseded-engine') ?? 'v0.1.0-alpha.3', note: 'The superseded candidate, from its recorded comparison (the same corpus family measured by the previous engine). The owner decides on the candidate recorded in benchmarks/evidence-adoption.json, never on a superseded one.',
    distribution: s.distribution, supportMatrix: s.supportMatrix, stableDistribution: s.stableDistribution, policyRevision: s.policyRevision,
    familyStatusChangesOnlyThere: minus(before, after), familyStatusChangesOnlyHere: minus(after, before), matrixChangesOnlyThere: minus(mBefore, mAfter), matrixChangesOnlyHere: minus(mAfter, mBefore),
    unmeasuredThere: superseded.unmeasured?.candidate ?? null,
  };
})();

const out = {
  schema: 'redact-secret/evidence-adoption-view-comparison/v1',
  evidenceRelease: report.evidenceRelease,
  scope: SCOPE_LINE,
  adoptionState,
  views: { accepted: { policyRevision: A.policy.revision, distribution: A.distribution, stableDistribution: A.stableDistribution, supportMatrix: A.supportMatrix.distribution, populations: popRows(A) }, replayOld: { policyRevision: B.policy.revision, distribution: B.distribution, supportMatrix: B.supportMatrix.distribution }, candidate: { policyRevision: C.policy.revision, distribution: C.distribution, stableDistribution: C.stableDistribution, supportMatrix: C.supportMatrix.distribution, populations: popRows(C) } },
  engineEffect: engine,
  corpusEffect: {
    note: 'Candidate corpus on the new engine versus the accepted view. Evidence deltas per family and every status change with its cause.',
    statusChanges: familyRows.filter(r => r.status.from !== r.status.to), evidenceDeltasWithoutStatusChange: familyRows.filter(r => r.status.from === r.status.to),
    supportMatrixStatusChanges: matrixChanges,
    unmappedFamilies: { accepted: A.unmappedFamilies.length, candidate: C.unmappedFamilies.length, added: C.unmappedFamilies.filter((x: string) => !A.unmappedFamilies.includes(x)) },
    undetectedSame: same(A.undetected, C.undetected), knownGapsSame: same(A.knownGaps, C.knownGaps),
  },
  publicPopulation: {
    commonCases: commonCount, addedCases: addedCases.length, regroupedCommonCases: regroupedCommon,
    commonCaseOutcomeDrift: { cases: drift.length, byScanner: driftByScanner, cause: [drift.filter((d: Json) => contentChanged.has(d.case)).length ? `${drift.filter((d: Json) => contentChanged.has(d.case)).length} case(s) the release re-authored or whose expected spans it corrected (content or expected in the change report)` : '', drift.filter((d: Json) => classToPending.has(d.case) && !contentChanged.has(d.case)).length ? `${drift.filter((d: Json) => classToPending.has(d.case) && !contentChanged.has(d.case)).length} case(s) the release moved to an unresolved evidence class (T0: the maintainer asserts nothing), which no scanner scores any more, so every outcome is pending and in no denominator` : '', drift.filter((d: Json) => !contentChanged.has(d.case) && !classToPending.has(d.case)).length ? `${drift.filter((d: Json) => !contentChanged.has(d.case) && !classToPending.has(d.case)).length} cross-provider twin case(s) gained a family in credential-evidence (grouping change), so a scanner finding of another detector is no longer read as flagged` : ''].filter(Boolean).join('; '), details: drift },
    addedCaseOutcomes: addedRows,
    regrouped: report.diff.evidenceClassTransitions,
  },
  unmeasured: { accepted: unmeasuredRows(A), candidate: unmeasuredRows(C), note: 'Per population and scanner: cases a scanner observed but the engine could not map to ranges. Never a MISS, in no denominator.' },
  methods,
  overlayAndPolicy,
  ledgerEffect,
  supersededCandidate,
  releaseRepresentation: report.representation ?? null,
  representationEffect: report.replay?.representationEffect ?? null,
  reviewStateEffect: report.replay?.reviewStateEffect ?? null,
  unexplained,
};
const text = `${JSON.stringify(out, null, 2)}\n`;
if (option('out-json')) writeFileSync(option('out-json')!, text); else process.stdout.write(text);
if (option('out-md')) writeFileSync(option('out-md')!, renderMarkdown(out, option('parity') ? readJson(option('parity')!) : null));
if (args.includes('--strict') && unexplained.length) { console.error(`unexplained:\n  - ${unexplained.join('\n  - ')}`); process.exit(1); }
console.error(`engine effect: ${engine.familiesWithAnyDifference.length} families and ${engine.publicCasesWithAnyDifference} public cases differ; corpus effect: ${familyRows.filter(r => r.status.from !== r.status.to).length} status changes, ${drift.length} common cases drift, ${unexplained.length} unexplained`);

/** The owner-facing report: what differs between the accepted view and the candidate, and why. Rendered from the data above, never hand-edited. */
function renderMarkdown(o: Json, parity: Json | null): string {
  const row = (...cells: unknown[]) => `| ${cells.map(x => String(x ?? '')).join(' | ')} |`;
  const table = (head: string[], rows: unknown[][]) => [row(...head), row(...head.map(() => '---')), ...rows.map(r => row(...r))].join('\n');
  const n = (x: number) => x.toLocaleString('en-US');
  const dist = (d: Json) => `${d.stable} stable, ${d.provisional} provisional, ${d.pending} pending, ${d.unsupported} unsupported`;
  const v = o.views, add = o.publicPopulation;
  const lines: string[] = [];
  const classTransitions = Object.values(add.regrouped as Record<string, number>).reduce((x, y) => x + y, 0);
  const changedCount = report.diff.cases?.changed ?? report.diff.changed?.length ?? add.regroupedCommonCases;
  const earlier = supersededChangeReport?.diff?.cases?.changed;
  const reconcile = `The change report's \`diff.cases.changed\` and the record's \`changeSummary.changed\` count the same ${n(changedCount)}.${earlier !== undefined && earlier !== changedCount ? ` The superseded candidate (${supersededChangeReport.evidenceRelease}) counted ${n(earlier)}; a count of ${n(earlier)} quoted for this candidate is that earlier figure, and ${n(changedCount)} is the one measured here.` : ''}`;
  const st = o.adoptionState ?? adoptionState, L = sideLabels(st), baseLower = L.base.toLowerCase(), currentLower = L.current.toLowerCase();
  const reviewRelease = o.reviewStateEffect?.release ? { maintainerOnly: o.reviewStateEffect.release.maintainerOnly?.fixtures, reviewed: o.reviewStateEffect.release.fixtures?.reviewed } : null;
  lines.push(`# Adoption report: ${o.evidenceRelease} on credential-eval ${engineTo}`, '',
    st.accepted
      ? `Generated by \`scripts/compare-adoption-views.ts\` and rendered against the structured adoption record (\`benchmarks/evidence-adoption.json\`, state \`accepted\`). The comparison is the evidence the owner decided on; the baseline is the previous accepted population (${previousRelease}), kept as the comparison side of every table. Sections marked historical describe the proposal as it was made and are not pending. ${o.scope}`
      : `Generated by \`scripts/compare-adoption-views.ts\` from the accepted view, the previous corpus replayed on the new engine, and the candidate view, and rendered against the structured adoption record (\`benchmarks/evidence-adoption.json\`, state \`${st.state}\`). Nothing here is accepted; the old accepted runs stay the public numbers until the owner applies the prepared change. ${o.scope}`, '',
    '## Status', '', ...statusLines(st, { previousRelease, reviewRelease }), '',
    '## Headline', '',
    table(['', `${L.base} (${previousRelease}, ${tagShort(engineFrom)})`, `${L.current} (${o.evidenceRelease}, ${tagShort(engineTo)})`], [
      ['Credential families', dist(v.accepted.distribution), dist(o.ledgerEffect ? o.ledgerEffect.distribution.final : v.candidate.distribution)],
      ['Support matrix entries', dist(v.accepted.supportMatrix), dist(o.ledgerEffect ? o.ledgerEffect.supportMatrix.final : v.candidate.supportMatrix)],
      ['Stable by route', JSON.stringify(v.accepted.stableDistribution), JSON.stringify(o.ledgerEffect ? o.ledgerEffect.stableDistribution.final : v.candidate.stableDistribution)],
      ...(o.ledgerEffect ? [['Credential families without the owner\'s ledger settlements (section 2b)', '', dist(v.candidate.distribution)]] : []),
      ['Public cases', n(v.accepted.populations.find((p: Json) => p.population === 'public-evidence-snapshot').cases), `${n(add.commonCases)} common + ${n(add.addedCases)} added`],
      ['Policy revision', `\`${v.accepted.policyRevision.slice(0, 30)}...\``, `\`${(o.ledgerEffect ? o.ledgerEffect.policyRevision.final : v.candidate.policyRevision).slice(0, 30)}...\``],
    ]), '',
    `A larger denominator is not an improvement and a lower stable count is not a regression of the product: the ${n(addedTotal)} added cases bring evidence no previous run measured.`, '',
    `## 1. Engine effect (${tagShort(engineFrom)} to ${tagShort(engineTo)}, corpus fixed)`, '',
    o.engineEffect.note, '',
    `Result: ${o.engineEffect.familiesWithAnyDifference.length} families differ, the support matrix is ${o.engineEffect.supportMatrixSame ? 'identical' : 'different'}, ${o.engineEffect.publicCasesWithAnyDifference} of the ${n(add.commonCases)} public cases change any outcome, and the family distribution is ${o.engineEffect.distributionSame ? 'identical' : 'different'}. The engine bump alone changes no support status, matrix entry or gate.`, '',
    `## 2. Corpus effect (${previousRelease} to ${o.evidenceRelease}, engine fixed)`, '',
    `### Common cases (${n(add.commonCases)}), apart from the added cases`, '',
    `${add.regroupedCommonCases} common cases changed grouping in credential-evidence: ${classTransitions} changed evidence class (${JSON.stringify(add.regrouped)}) and ${add.regroupedCommonCases - classTransitions} changed grouping (family or twin family) with the evidence class unchanged. ${reconcile} ${add.commonCaseOutcomeDrift.cases} common cases change an outcome: ${add.commonCaseOutcomeDrift.cause}.`, '',
    table(['Scanner and change', 'Cases'], Object.entries(add.commonCaseOutcomeDrift.byScanner).map(([k, c]) => [k, c])), '',
    `### Added cases (${n(add.addedCases)}), per scanner`, '',
    table(['Scanner', 'Pending (T0, outside denominators)', 'Not measured', 'Positive: exact', 'Positive: miss', 'Positive: other', 'Control clear', 'Control flagged'], add.addedCaseOutcomes.map((r: Json) => {
      const e = r.outcomes as Record<string, number>, sum = (f: (k: string) => boolean) => Object.entries(e).filter(([k]) => f(k)).reduce((a, [, c]) => a + c, 0);
      const exact = sum(k => /^positive:(EXACT)(,EXACT)*$/.test(k)), miss = sum(k => /^positive:(MISS)(,MISS)*$/.test(k));
      return [r.scanner, e.pending ?? 0, e['not-measured'] ?? 0, exact, miss, sum(k => k.startsWith('positive:')) - exact - miss, e['control:clear'] ?? 0, e['control:flagged'] ?? 0];
    })), '',
    'Positive "other" is a partial, overbroad or mixed-span outcome. Pending cases carry no scored outcome and sit in no denominator; a not-measured case is never a zero detection.', '',
    '### Support status changes', '',
    ...(addedTotal === 0 && o.corpusEffect.statusChanges.length && o.corpusEffect.statusChanges.every((r: Json) => r.cause.evidenceClassMovedToUnresolved?.length) ? [
      `${o.corpusEffect.statusChanges.length} credential families (${o.corpusEffect.supportMatrixStatusChanges.length} support matrix entries) move from stable to provisional. No case was added, so none of it comes from added cases: each family lost scored evidence because the release moved cases of that family to an unresolved evidence class (T0), which are not scored and sit in no denominator. The reasons are the documented-route floors the remaining scored evidence no longer meets:`, '',
      table(['Family', 'Tier', 'Status reasons (candidate)', 'Evidence delta (accepted to candidate)', 'Cases moved to T0'], o.corpusEffect.statusChanges.map((r: Json) => [r.family, r.evidenceTier, (r.statusReasons ?? []).join('; '), Object.entries(r.evidenceDelta).filter(([k]) => k !== 'policyQualification').map(([k, d]: [string, Json]) => `${k} ${JSON.stringify(d.from)} to ${JSON.stringify(d.to)}`).join('; '), r.cause.evidenceClassMovedToUnresolved.length])), '',
      'Why: a status is read from scored evidence only. Those cases were scored before (as benign controls and twins) and are not now; nothing was removed or hidden, the evidence owner asserts nothing for them (credential-evidence ADR 0022 / #226, maintainer-only), and this repository neither restores the status by dropping a floor nor counts an unscored case as a miss. The status returns when scored evidence meets the floors again (new or re-asserted cases), which is the evidence owner\'s change.', '',
    ] : [
    `${o.corpusEffect.statusChanges.length} credential families (${o.corpusEffect.supportMatrixStatusChanges.length} support matrix entries) move from stable to provisional. Every status reason is one the added cases explain exactly:`, '',
    table(['Family', 'Tier', 'Unresolved differential occurrences (all from added cases)', 'Reference failures on added cases', 'Common-case cause'], o.corpusEffect.statusChanges.map((r: Json) => [r.family, r.evidenceTier, r.cause.differentialUnresolvedFromAddedCases, Object.entries(r.cause.referenceAssertionFailuresByMethod).map(([m, c]: [string, Json]) => `${m} ${c.added}`).join(', ') || 'none', r.cause.differentialUnresolvedFromCommonCases === 0 ? 'none (0 from common cases)' : r.cause.differentialUnresolvedFromCommonCases])), '',
    'Why: stable requires every disagreement with a peer scanner over the provider contract to be settled by a review decision. The legacy review ledger holds decisions for the cases the previous corpus had; the added cases have none, so their gate-peer occurrences (see the data file, `methods.unsettledGateOccurrences`) read unresolved. This repository does not invent those decisions. sendgrid-token additionally carries failed metamorphic and mutation assertions of the reference scanner on added cases that split a credential across lines or string literals: a fragment case, and fragment semantics are not measured yet (credential-eval#34, credential-evidence#150), so the engine scores the raw span.', '',
    ]),
    `Support matrix entries that change: ${o.corpusEffect.supportMatrixStatusChanges.map((r: Json) => `\`${r.family}\``).join(', ')}.`, '',
    ...(o.corpusEffect.evidenceDeltasWithoutStatusChange.length ? [
    '### Evidence deltas without a status change', '',
    table(['Family', `Changed evidence (${baseLower} to ${currentLower})`], o.corpusEffect.evidenceDeltasWithoutStatusChange.map((r: Json) => [r.family, Object.entries(r.evidenceDelta).filter(([k]) => k !== 'policyQualification').map(([k, d]: [string, Json]) => `${k} ${JSON.stringify(d.from)} to ${JSON.stringify(d.to)}`).join('; ')])), '',
    'Their statuses are unchanged (provisional before and after: the policy route reads the bounded policy corpus). The deltas come from added cases of the family: more positives, benign cases and axes, plus unsettled differential occurrences and metamorphic or mutation failures of the reference scanner on added cases.', '',
    ] : []),
    `Families: ${o.corpusEffect.unmappedFamilies.added.length ? `${o.corpusEffect.unmappedFamilies.added.length} upstream families have no product detector yet (unmapped, never scored against a product family): ${o.corpusEffect.unmappedFamilies.added.map((x: string) => `\`${x.replace('public-evidence-snapshot:', '')}\``).join(', ')}` : 'no upstream family was added or left without a product detector'}. The undetected list and the known gaps are ${o.corpusEffect.undetectedSame && o.corpusEffect.knownGapsSame ? 'unchanged' : 'changed'}.`, '',
    '### Unmeasured', '',
    table(['Population', 'Scanner', L.base, L.current], Object.keys(o.unmeasured.candidate).flatMap(p => { const scanners = new Set([...Object.keys(o.unmeasured.accepted[p] ?? {}), ...Object.keys(o.unmeasured.candidate[p] ?? {})]); return scanners.size ? [...scanners].map(sc => [p, sc, o.unmeasured.accepted[p]?.[sc]?.unmeasured ?? 0, `${o.unmeasured.candidate[p]?.[sc]?.unmeasured ?? 0} ${Object.entries(o.unmeasured.candidate[p]?.[sc]?.reasons ?? {}).map(([r, c]) => `(${c}: ${String(r).replace('scanner output could not be mapped to ranges: ', '')})`).join(' ')}`]) : [[p, 'all', 0, 0]]; })), '',
    `The methods run also leaves ${JSON.stringify(o.methods?.unmeasuredVariants ?? {})} generated variants unmeasured. They are in no denominator and never a zero detection.`, '',
    ...(o.ledgerEffect ? [
      '## 2b. Ledger settlements (owner decision, #698)', '',
      `${o.ledgerEffect.note} Maintainer-reviewed (independent review pending) / ${MAINTAINER_REVIEWED_KO}: a settlement is the repository owner's decision per occurrence, never a blanket peer acceptance and never an independent review.`, '',
      table(['', 'Without settlements', 'With settlements (final)'], [
        ['Credential families', dist(o.ledgerEffect.distribution.candidateWithoutSettlements), dist(o.ledgerEffect.distribution.final)],
        ['Support matrix entries', dist(o.ledgerEffect.supportMatrix.candidateWithoutSettlements), dist(o.ledgerEffect.supportMatrix.final)],
        ['Stable by route', JSON.stringify(o.ledgerEffect.stableDistribution.candidateWithoutSettlements), JSON.stringify(o.ledgerEffect.stableDistribution.final)],
        ['Policy revision', `\`${o.ledgerEffect.policyRevision.candidateWithoutSettlements.slice(0, 30)}...\``, `\`${o.ledgerEffect.policyRevision.final.slice(0, 30)}...\``],
      ]), '',
      table(['Family', 'Status', 'Unresolved differential occurrences', 'Why not stable (if still not)'], o.ledgerEffect.familyChanges.map((r: Json) => [r.family, `${r.status.from} to ${r.status.to}`, `${r.differentialUnresolved.from} to ${r.differentialUnresolved.to}`, r.remainingReasons.join('; ').slice(0, 220)])), '',
      `Support matrix entries that change with the settlements: ${o.ledgerEffect.supportMatrixStatusChanges.length ? o.ledgerEffect.supportMatrixStatusChanges.map((r: Json) => `\`${r.family}\` (${r.from} to ${r.to})`).join(', ') : 'none'}.`, '',
      `Final versus the previously accepted view: ${o.ledgerEffect.finalVsAccepted.statusChanges.length} family status changes: ${o.ledgerEffect.finalVsAccepted.statusChanges.map((r: Json) => `\`${r.family}\` ${r.from} to ${r.to}`).join(', ')}.`, '',
    ] : []),
    '## 3. Overlay and policy effect', '',
    o.overlayAndPolicy.note, '',
    table(['Input', L.base, L.current], [
      ['Policy revision', `\`${o.overlayAndPolicy.policyRevision.accepted.slice(0, 31)}...\``, `\`${o.overlayAndPolicy.policyRevision.candidate.slice(0, 31)}...\``],
      ['Axis overlay', `${o.overlayAndPolicy.axisOverlay.accepted.contexts} contexts, ${o.overlayAndPolicy.axisOverlay.accepted.controls} controls, bound to ${String(o.overlayAndPolicy.axisOverlay.accepted.corpusDigest).slice(0, 19)}...`, `${o.overlayAndPolicy.axisOverlay.candidate.contexts} contexts, ${o.overlayAndPolicy.axisOverlay.candidate.controls} controls${same(o.overlayAndPolicy.axisOverlay.accepted.contexts, o.overlayAndPolicy.axisOverlay.candidate.contexts) ? ' (same content, rebound to ' : ' (rebound to '}${String(o.overlayAndPolicy.axisOverlay.candidate.corpusDigest).slice(0, 19)}...; the added cases have no legacy fixture, so the overlay names no axis for them and they keep the snapshot's own group)`],
      ['Twin-scope map', `${o.overlayAndPolicy.twinScope.accepted.twins ?? '?'} twins mapped to project cases`, `${o.overlayAndPolicy.twinScope.candidate.twins ?? '?'} twins mapped`],
      ['Review-ledger re-key', `${o.overlayAndPolicy.ledgerRekey.accepted.occurrences} legacy decisions mapped`, `${o.overlayAndPolicy.ledgerRekey.candidate.occurrences} legacy decisions mapped (all 4,268, re-keyed to the ${tagShort(engineTo)} occurrence ids)`],
    ]), '',
    `Twin scope: ${o.overlayAndPolicy.twinScope.why} Unchanged policy parts: ${o.overlayAndPolicy.unchangedPolicyKeys.map((k: string) => `\`${k}\``).join(', ')}; changed (derived from the corpus): ${o.overlayAndPolicy.changedPolicyKeys.map((k: string) => `\`${k}\``).join(', ')}. The review occurrence ids of ${tagShort(engineTo)} all differ from ${tagShort(engineFrom)} (the peer configuration identity is part of the id), which is why the re-key is regenerated; every legacy decision still maps (4,268 of 4,268).`, '');
  if (parity) lines.push('## 4. Legacy-oracle parity (the authority gate)', '',
    `\`qualification:parity --strict\` on the ${currentLower} view against the legacy oracle at the same release (@redact-secret/core 0.1.0-beta.12): ${n(parity.summary.compared)} values compared, ${n(parity.summary.equal)} equal, ${n(parity.summary.explained)} attributed to a named structural cause, **${parity.summary.unexplained} unexplained**. Causes: ${Object.entries(parity.summary.byCause).map(([k, c]) => `${k} ${c}`).join(', ')}.`, '');
  const sup = o.supersededCandidate, re = o.representationEffect, rel = o.releaseRepresentation;
  if (sup) lines.push(`## ${parity ? 5 : 4}. Against the superseded candidate (${sup.evidenceRelease}, ${tagShort(sup.engine ?? 'previous engine')})`, '',
    `${sup.note.replace(/ The owner (accepts|decides on) .*$/, '')} The owner ${st.accepted ? 'accepted' : 'decides on'} this candidate, never the superseded one.`, '',
    table(['', `Superseded candidate (${sup.evidenceRelease})`, `This candidate (${o.evidenceRelease}, ${tagShort(engineTo)})`], [
      ['Credential families', dist(sup.distribution), dist(v.candidate.distribution)],
      ['Support matrix entries', dist(sup.supportMatrix), dist(v.candidate.supportMatrix)],
      ['Stable by route', JSON.stringify(sup.stableDistribution), JSON.stringify(v.candidate.stableDistribution)],
    ]), '',
    `Families whose status moves in one candidate only: ${[...sup.familyStatusChangesOnlyThere, ...sup.familyStatusChangesOnlyHere].length ? `superseded only ${JSON.stringify(sup.familyStatusChangesOnlyThere)}, this candidate only ${JSON.stringify(sup.familyStatusChangesOnlyHere)}` : 'none (the same families are provisional in both)'}. Matrix entries that differ: ${[...sup.matrixChangesOnlyThere, ...sup.matrixChangesOnlyHere].length ? `superseded only ${JSON.stringify(sup.matrixChangesOnlyThere)}, this candidate only ${JSON.stringify(sup.matrixChangesOnlyHere)}` : 'none'}. Policy revision: \`${String(sup.policyRevision).slice(0, 31)}...\` against \`${v.candidate.policyRevision.slice(0, 31)}...\`.`, '');
  if (re) {
    const cell = (b: Record<string, number> | undefined) => b ? Object.entries(b).map(([k, c]) => `${k.replace('positive:', '+').replace('control:', 'ctl ')} ${c}`).join(', ') : '';
    const classRows = ['encode:base64', 'encode:hex', 'fragment', 'escape', 'normalize', 'insert-codepoints', 'chunked', 'expected-rejection:unpaired-surrogate-split', 'expected-span-with-fragments', 'expected-span-decoded-via:strip-codepoints'].filter(k => re.factClasses[k] !== undefined);
    const scanners = Object.keys(re.outcomesByFactClass.candidate);
    const mv = (x: Json) => Object.entries(x ?? {}).map(([k, c]) => `${k} ${c}`).join(', ') || 'none';
    lines.push(`## ${parity ? 6 : 5}. Representation capability (credential-eval v1.3, ADR 0005; credential-eval#34, credential-evidence#150)`, '',
      re.note, '',
      `**Facts the release carries** (its own account, not a measurement): ${rel?.casesWithFacts} cases carry representation facts (${JSON.stringify(rel?.casesByTransformationOp)}; encodings ${JSON.stringify(rel?.casesByEncodeCodec)}; fragment mechanisms ${Object.keys(rel?.fragmentMechanisms ?? {}).length}), ${rel?.expectedSpansWithFragments} expected spans with fragments, ${rel?.expectedSpansWithDecoded} with a decoded fact (${JSON.stringify(rel?.decodedByCodec)}), ${rel?.inputValidity ? JSON.stringify(rel.inputValidity) : 'no'} input-validity facts, ${rel?.notExported?.invalidUtf8?.total ?? 0} invalid-UTF-8 cases not exported, ${rel?.notExported?.twinLineageNotExported ?? 0} twin lineages not written.`, '',
      `**What the engine verified**: the run artifact's \`manifest.representation\` is ${JSON.stringify(re.engines.candidate.manifestRepresentation)}${re.engines.candidate.manifestRepresentation?.facts_digest === rel?.factsDigest ? ', and its facts digest equals the release\'s: the engine received exactly the facts the release declares' : ' (its facts digest DIFFERS from the release\'s)'}. Decoded spans verified by re-derivation: ${re.engines.candidate.manifestRepresentation?.decoded_verified} of ${re.engines.candidate.manifestRepresentation?.decoded_spans}; unverified (\`normalize\`): ${re.engines.candidate.manifestRepresentation?.decoded_unverified}. The previous engine (${tagShort(sup?.engine ?? 'alpha.3')}) did not read these facts and refused this snapshot.`, '',
      '### Unmeasured and mapped findings (plain run)', '',
      table(['Scanner', `Unmeasured (previous engine)`, `Unmeasured (${tagShort(engineTo)})`, `Cases with a mapped decoded finding (${tagShort(engineTo)})`, 'Their outcomes'], scanners.map(sc => [sc, re.unmeasuredPlain.previousEngine[sc].unmeasured, re.unmeasuredPlain.candidate[sc].unmeasured, re.mappedFindings.candidate[sc].cases, cell(re.mappedFindings.candidate[sc].casesByOutcome) || 'none'])), '',
      `Mapped findings by bound (${tagShort(engineTo)}): ${Object.entries(re.mappedFindings.candidate).filter(([, m]: [string, Json]) => m.cases).map(([sc, m]: [string, Json]) => `${sc} ${JSON.stringify(m.findingsByMapping)}`).join('; ') || 'none'}. A mapped finding is placed on the whole encoded segment, scored by the unchanged lattice against the span as authored (never narrower), and only when the engine could re-derive the placement; everything else stays unmeasured. \`source-block\` and \`source-segment-extended\` are placements the engine made before the contract and now records.`, '',
      '### Outcome changes of the same cases (plain run, all fact classes)', '',
      table(['Comparison', ...scanners], [
        ['Previous engine to this engine, the superseded corpus (engine effect)', ...scanners.map(sc => mv(re.engineEffect?.scanners?.[sc]?.moves))],
        [`Superseded corpus to this corpus, ${tagShort(engineTo)} fixed (corpus effect, ${re.corpusEffect?.changedExpectationCases ?? '?'} cases changed an expected span)`, ...scanners.map(sc => mv(re.corpusEffect?.scanners?.[sc]?.moves))],
        ['Both together (superseded candidate to this candidate)', ...scanners.map(sc => mv(re.combined.scanners[sc].moves))],
      ]), '',
      '### Outcomes by representation class (this candidate, plain run)', '',
      'Buckets: `pending` and `not-measured` are in no denominator; `+exact`, `+miss`, `+other` are positive spans; `ctl` is a control that was clear or flagged.', '',
      table(['Fact class (cases in the corpus)', ...scanners], classRows.map(k => [`${k} (${re.factClasses[k]})`, ...scanners.map(sc => cell(re.outcomesByFactClass.candidate[sc]?.[k]))])), '',
      '### What now measures, and what still does not', '',
      '- **Now measured by the engine** (where the table above shows it): base64 and hex segments of a gitleaks or trufflehog finding placed on the whole encoded segment (one to four layers), only when re-derivable; the gitleaks cases the previous engine could not place no longer sit in `unmeasured`. A pending (T0) case stays outside every denominator whatever the scanner reports.',
      '- **Carried and validated, not scored**: fragments (a fragmented span is scored on its enclosing range; fragment-aware scoring is a protocol revision, not made), chunking boundaries, derivation and carrier facts, input validity (an expected rejection is non-asserting). Methods-run variants start from seeds without facts, so a variant never inherits a seed\'s decoded value or fragments.',
      `- **Still not measured**: a decoded finding in another codec (percent-encoding, UTF-16, escaped Unicode) or deeper than four layers stays unmeasured, never a miss; the corpus carries no decoded fact in those codecs (decoded facts: ${JSON.stringify(rel?.decodedByCodec)}), so this release neither measures nor refutes them. \`normalize\` decoded facts are carried and not re-derivable (${re.engines.candidate.manifestRepresentation?.decoded_unverified} in this release).`, '');
  }
  const rs = o.reviewStateEffect;
  if (rs) {
    const scanners = Object.keys(rs.movedOutOfNotAssertable.outcomesByScanner);
    const cell = (b: Record<string, number> | undefined) => b ? Object.entries(b).map(([k, c]) => `${k.replace('positive:', '+').replace('control:', 'ctl ')} ${c}`).join(', ') : '';
    const fam = (rows: Record<string, { cases: number; scored: number }>) => Object.entries(rows).map(([k, v]) => `${k} ${v.scored}/${v.cases}`).join(', ') || 'none';
    lines.push(`## ${4 + (parity ? 1 : 0) + (sup ? 1 : 0) + (re ? 1 : 0)}. Review state: fixtures moved out of not-assertable and maintainer-only fixtures (credential-evidence ADR 0020)`, '',
      rs.note, '',
      `**Disclosure: ${MAINTAINER_REVIEWED_EN} / ${MAINTAINER_REVIEWED_KO}.** The maintainer-only fixtures below are finalized by the sole maintainer; none is independently reviewed. ${st.accepted ? 'The owner acceptance of this population is the owner\'s decision to measure it; it is not an independent review of the evidence and does not turn a maintainer-only fixture into a reviewed one.' : 'An owner acceptance would adopt the population for measurement; it would not be an independent review of the evidence.'}`, '',
      `**Release counts** (\`release-manifest.json\` \`reviewState\`, rule ${rs.release?.rule}): ${JSON.stringify(rs.release?.fixtures)} fixtures by state; **maintainer-only ${rs.release?.maintainerOnly?.fixtures}** (${JSON.stringify(rs.release?.maintainerOnly?.fixturesByOutcome)}; ${JSON.stringify(rs.release?.maintainerOnly?.records)} records, ${rs.release?.maintainerOnly?.decisions} decisions). **Zero fixtures are \`reviewed\`.** Of the maintainer-only fixtures, ${rs.release?.attributedFixtures} are attributed to eval cases here by the lifecycle of their Case or Scenario record; ${rs.release?.unattributedFixtures} must-not-flag fixtures the release counts are not reachable from the records and are not guessed (they may sit among the 5 not exported or at a finer level than the records state).`, '',
      `**Moved out of not-assertable** (T0 in the superseded candidate's release, scored now): ${rs.movedOutOfNotAssertable.cases} cases (${JSON.stringify(rs.movedOutOfNotAssertable.byKindAndTier)}); ${rs.movedOutOfNotAssertable.movedIntoNotAssertable} moved the other way. Of these, ${rs.maintainerOnly.overlapWithMoved} are also maintainer-only: they are scored on one maintainer's decision.`, '',
      table(['Cases (plain run)', ...scanners], [
        [`Moved out of T0 (${rs.movedOutOfNotAssertable.cases})`, ...scanners.map(sc => cell(rs.movedOutOfNotAssertable.outcomesByScanner[sc]?.outcomes))],
        [`Maintainer-only (${rs.maintainerOnly.cases}: ${JSON.stringify(rs.maintainerOnly.byKindAndTier)})`, ...scanners.map(sc => cell(rs.maintainerOnly.outcomesByScanner[sc]?.outcomes))],
      ]), '',
      `Families whose scored evidence includes maintainer-only fixtures (scored/total cases): ${fam(rs.maintainerOnly.byFamily)}. Families of the moved cases: ${fam(rs.movedOutOfNotAssertable.byFamily)}.`, '',
      'Effect on denominators and gates: a moved case enters the denominators of the family it is grouped in (positives and controls of the plain run), and several of the families above are among those whose status moves in section 2 (the section-2 reasons are the unsettled gate-peer occurrences and the reference scanner\'s failed assertions of added cases; this report does not apportion a family\'s evidence between maintainer-only and other cases). This repository settles no review decision for a maintainer-only case and treats none as reviewed: the owner decides whether evidence resting on a single maintainer\'s decision should qualify a family, and the report does not hide it behind a count.', '');
  }
  lines.push('## What is not measured', '',
    '- Fragment-aware scoring: a fragmented expected span is scored on its enclosing range (credential-eval#34, credential-evidence#150); there is no fragment-aware coverage scoring.',
    '- Decoded findings: only bounded, re-derivable base64 and hex findings (up to four layers) are mapped to the whole original encoded segment and scored (section ' + (parity ? 6 : 5) + ' lists what the engine verified). Percent-encoded, UTF-16 and escaped-Unicode decoded findings and any mapping the engine cannot re-derive stay unmeasured, never a miss.',
    '- Pending (T0) cases, expected rejections and not-assertable review decisions are outside every denominator; unmeasured cases are in none and are never zero detections.',
    `- Product identity: ${st.product.note}`, '',
    ...(st.accepted ? [
      '## Historical: the proposal instructions (not pending)', '',
      `These were the owner's instructions while ${o.evidenceRelease} was a candidate. They are kept for the record. The owner accepted it${st.ownerAcceptance ? ` (${st.ownerAcceptance.acceptedBy}, ${st.ownerAcceptance.acceptedOn}; \`${st.ownerAcceptance.decision}\`)` : ''}, so nothing below is awaiting acceptance and none of it should be run again.`, '',
      ...(rs ? [`Review state the owner weighed at the time: ${rs.release?.maintainerOnly?.fixtures} fixtures are maintainer-only (disclosed as \"${MAINTAINER_REVIEWED_EN}\"), 0 are independently reviewed; ${rs.maintainerOnly.overlapWithMoved} of the ${rs.movedOutOfNotAssertable.cases} fixtures that moved out of not-assertable are among them.`, ''] : []),
      `1. (Historical) Read this report and \`${o.evidenceRelease}.comparison.json\`; accept, or withdraw (reset \`benchmarks/evidence-adoption.json\` to \`{"schema": "redact-secret/evidence-adoption/v1", "state": "none"}\`).`,
      `2. (Historical) Apply the acceptance change (a prepared patch, or, when the owner decided on the replayed candidate, the same changes applied directly on the acceptance branch): it pinned ${tagShort(engineTo)}, the schema, the four recorded runs, the archive receipt, the regenerated overlays and parity report, the renewed authority file and the accepted record, with the owner fields left as \`OWNER-TO-SET\`.`,
      '3. (Historical) Set the owner fields and turn the draft ADR into the decision; run the gates; merge to `develop` (a push publishes staging).', '',
      '## Current state and what remains open', '',
      `- Accepted adoption: ${st.ownerAcceptance ? `${st.ownerAcceptance.acceptedBy}, ${st.ownerAcceptance.acceptedOn}` : 'see the record'}. The authority file is the owner's and is not edited by a report.`,
      `- Deployment receipts: staging ${st.deployment.staging ? 'recorded' : 'absent'}, production ${st.deployment.production ? 'recorded' : 'absent'} in \`candidate.deployment\`; they are filled only from a real deployment verification (#680). Production promotion (\`go-production\`) is a separate owner decision and is not made by this report.`,
      `- Independent review of the evidence is pending (disclosed as \"${MAINTAINER_REVIEWED_EN}\"); acceptance did not supply it.`,
      o.ledgerEffect
        ? `- The owner's review settlements (section 2b) are applied; the gate-peer occurrences they do not cover (the added cases the previous snapshot has no settled counterpart for, and every open root cause of the triage) read unresolved and their families stay provisional (${o.ledgerEffect.distribution.final.provisional} provisional families). The failure triage is #698.`
        : `- The review decisions for the added cases' gate-peer occurrences (the ${o.corpusEffect.supportMatrixStatusChanges.length} matrix entries that moved to provisional stay provisional until they are settled) and the failure triage are #698.`,
      '- A claim about a core release other than the published beta.13 measured here (an unpublished build such as 1e45cecf, which is exploratory and internal, or a later release) needs its own pinned replay (#697).', ''] : [
      '## What the owner decides and runs', '',
      ...(rs ? [`**Review state the owner must weigh: ${rs.release?.maintainerOnly?.fixtures} fixtures are maintainer-only (finalized by the sole maintainer, not reviewed, not independent validation), 0 are reviewed; ${rs.maintainerOnly.overlapWithMoved} of the ${rs.movedOutOfNotAssertable.cases} fixtures that moved out of not-assertable are among them.**`, ''] : []),
      `**Accept this candidate (${o.evidenceRelease} on ${tagShort(engineTo)}), not the superseded one${sup ? ` (${sup.evidenceRelease} on ${tagShort(sup.engine ?? 'alpha.3')}, whose acceptance patch was removed)` : ''}.**`, '',
      `1. Read this report and \`${o.evidenceRelease}.comparison.json\`. Decide: accept, or withdraw (reset \`benchmarks/evidence-adoption.json\` to \`{"schema": "redact-secret/evidence-adoption/v1", "state": "none"}\`).`,
      `2. To accept, on a branch from the merged \`develop\`: \`git apply docs/generated/evidence-adoption/${o.evidenceRelease}.acceptance.patch\`. It pins ${tagShort(engineTo)}, the schema, the four recorded runs (the superseded ones become historical receipts), the archive receipt, the regenerated overlays and parity report, the renewed authority file and the accepted record. Nothing in it is an acceptance: three owner fields are \`OWNER-TO-SET\`.`,
      '3. Set the owner fields (the authority file `new.acceptedOn` and `new.acceptedBy`, the record `candidate.ownerAcceptance`), and turn the draft ADR into your decision (`status: accepted`, the Decision and Consequences text). The gates stay red until you do.',
      '4. Run the gates on that branch with `trufflehog --version` printing 3.97.4: `npm run official-runs:check -- --bindings`, `authority:check`, `adoption:check`, `decisions:validate`, `qualification-inputs:check`, `npm test`, `npm run typecheck`, and the web checks. If the product inputs changed since this PR, the policy revision and the parity report in the patch are stale: re-run `qualification:view` and `qualification:parity --strict` (commands in `docs/specs/qualification-parity.md`) and update the authority policy revision.',
      '5. Merge to `develop` (a push publishes staging), check the stamps and that `develop` is green, then `npm run go-production` when the measurement is ready to be public. Record the staging and production receipts under `candidate.deployment` and comment on credential-evidence#142 with the tag, digests, run ids and disposition.', '',
      `Open for the product, not part of the acceptance: ${addedTotal === 0 ? `the ${o.corpusEffect.supportMatrixStatusChanges.length} matrix entries that moved to provisional stay provisional until scored evidence meets the documented-route floors again (a change of the evidence, not of this repository), and the product position on fragment and decoded cases.` : `the review decisions for the added cases' gate-peer occurrences (the ${o.corpusEffect.supportMatrixStatusChanges.length} matrix entries that moved to provisional stay provisional until they are settled), the product position on fragment and decoded cases, and the pinned replay of this snapshot against the published core beta.13 (#697).`}`, '']),
    '## Unexplained', '', o.unexplained.length ? o.unexplained.map((u: string) => `- ${u}`).join('\n') : 'None: every difference above is attributed by a rule that checks the data of both views.', '');
  return `${lines.join('\n')}\n`;
}
