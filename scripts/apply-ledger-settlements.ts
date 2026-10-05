/**
 * Apply the owner-decided ledger settlements of the #698 triage (owner decision of 2026-10-05, #680) to `benchmarks/review-ledger.json`, keyed by the FINAL
 * occurrence identities of the accepted run, only where the settlement's semantic applicability is demonstrated.
 *
 *   node --import tsx scripts/apply-ledger-settlements.ts --previous-queue <triage-queue of the previous snapshot's replay> --queue <triage-queue of the accepted run> \
 *     --accepted-run <ci run id> --decided-on YYYY-MM-DD --evidence-url <https url> [--out-json <receipt>] [--write] [--check]
 *
 * What is applied. The triage rules (benchmarks/qualification/triage-decisions.ts) propose a ledger settlement for a gate-peer differential occurrence in two
 * cases only: `resolved` when the reference scanner matches the evidence's own expected result exactly and the divergence is the peer's (never by peer
 * acceptance), and `not-assertable` when the case is a T0 pending fixture (decided class differential.t0-pending-fixture). A proposal of the previous
 * snapshot's triage (368 resolved, 30 not-assertable root causes on snapshot-2026.10.04.3) is applied to an occurrence of the accepted run only when the
 * SAME occurrence exists there: equal case, peer, disagreement, variant, method and content digest, equal observed expected spans and actual findings for the
 * reference and the peer, and the accepted run's own triage proposes the same settlement. Anything else (the occurrences of the cases the new snapshot added,
 * an occurrence whose content or expectation changed, a proposal the accepted triage no longer makes) stays an unapplied proposal and reads unresolved.
 *
 * Rows are keyed by the occurrence id of the accepted run (`sha256:<hex>`, the id the adapter looks up first: ledgerSettledId). They carry no independent
 * review: a settlement that rests on a maintainer-only record says so in its note. The legacy rows are never touched. Deterministic and idempotent.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { decideAll } from '../benchmarks/qualification/triage-decisions.ts';

const args = process.argv.slice(2);
const option = (name: string) => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const need = (name: string) => option(name) ?? (() => { throw new Error(`--${name} is required`); })();
const readJson = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
/* eslint-disable @typescript-eslint/no-explicit-any */
type J = any;
const LEDGER = 'benchmarks/review-ledger.json';
const previous: J = readJson(need('previous-queue')), queue: J = readJson(need('queue'));
const run = need('accepted-run'), decidedOn = need('decided-on'), evidenceUrl = need('evidence-url');
if (!/^https:\/\//.test(evidenceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(decidedOn)) throw new Error('--evidence-url must be https and --decided-on YYYY-MM-DD');

const settle = (q: J) => {
  const bySemantic = new Map<string, { occurrenceId: string; proposal: 'resolved' | 'not-assertable'; observed: string; rule: string; basis: string; maintainerOnly: boolean; seed: string }>();
  for (const r of decideAll(q.rootCauses, {})) {
    if (r.kind !== 'gate-peer-differential-unsettled' || !r.decision.ledger || r.decision.ledger.proposal === 'open') continue;
    for (const o of r.occurrences as J[]) {
      const key = [o.case, r.peer, r.disagreement, o.variant, o.method, o.contentDigest].join('|');
      bySemantic.set(key, { occurrenceId: o.occurrenceId, proposal: r.decision.ledger.proposal as 'resolved' | 'not-assertable', observed: JSON.stringify(o.observed), rule: r.decision.rule, basis: r.decision.ledger.basis, maintainerOnly: r.restsOnMaintainerOnlyDecision, seed: r.seedCase });
    }
  }
  return bySemantic;
};
const before = settle(previous), after = settle(queue);
const allGate = (q: J) => q.rootCauses.filter((r: J) => r.kind === 'gate-peer-differential-unsettled').reduce((n: number, r: J) => n + r.occurrences.length, 0);

const applied: Array<{ key: string; previousId: string; id: string; proposal: string; rule: string; case: string }> = [];
const unapplied: Record<string, number> = { 'new-case-or-occurrence (no settled occurrence of the previous snapshot)': 0, 'observation differs from the previous snapshot': 0, 'accepted triage proposes another settlement': 0 };
const entries: Record<string, J> = {};
for (const [key, a] of after) {
  const b = before.get(key);
  if (!b) { unapplied['new-case-or-occurrence (no settled occurrence of the previous snapshot)']++; continue; }
  if (b.observed !== a.observed) { unapplied['observation differs from the previous snapshot']++; continue; }
  if (b.proposal !== a.proposal) { unapplied['accepted triage proposes another settlement']++; continue; }
  const [caseId] = key.split('|');
  const maintainer = a.maintainerOnly ? ' The expectation is a maintainer-only record (ADR 0020), not independently reviewed; this settlement is the repository owner\'s decision, not an independent review.' : '';
  const note = a.proposal === 'resolved'
    ? `Owner-decided settlement (2026-10-05, #680/#698) of the triage rule ${a.rule}: ${a.basis}. Applied to this occurrence of the accepted run because the same occurrence (case, peer, disagreement, variant, content digest, expected spans and findings) was proposed by the triage of the previous snapshot.${maintainer} Class: decision=differential.reference-matches-evidence.`
    : `Owner-decided settlement (2026-10-05, #680/#698): the case is a T0 pending fixture whose release records no assertable expectation. Class: decision=differential.t0-pending-fixture.`;
  entries[a.occurrenceId] = a.proposal === 'resolved'
    ? { status: 'resolved', firstSeenRun: run, resolvedRun: run, resolutionEvidence: { kind: 'historical-adjudication', observedAt: `${decidedOn}T00:00:00Z`, evidenceUrl }, historicalAdjudication: { decidedAt: `${decidedOn}T00:00:00Z`, evidenceUrl, note: `triage rule ${a.rule}; reference exact against the evidence, divergence is the peer's`, runId: run }, note }
    : { status: 'not-assertable', firstSeenRun: run, note };
  applied.push({ key, previousId: b.occurrenceId, id: a.occurrenceId, proposal: a.proposal, rule: a.rule, case: caseId });
}
const byProposal = (m: Map<string, { proposal: string }>) => { const o: Record<string, number> = { resolved: 0, 'not-assertable': 0 }; for (const v of m.values()) o[v.proposal]++; return o; };
const receipt = {
  schema: 'redact-secret/ledger-settlements/v1', decidedOn, acceptedRun: run, evidenceUrl,
  decision: 'The repository owner (Milo Kang) decided on 2026-10-05 to apply the #698 triage settlements, re-keyed to the final occurrence identities only where semantic applicability is demonstrated. Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기): nothing here is an independent review.',
  previousProposals: { occurrences: before.size, byProposal: byProposal(before) },
  acceptedRunProposals: { occurrences: after.size, byProposal: byProposal(after) },
  gateOccurrencesInAcceptedQueue: allGate(queue),
  applied: { occurrences: applied.length, byProposal: applied.reduce((o: Record<string, number>, x) => (o[x.proposal] = (o[x.proposal] ?? 0) + 1, o), {}) },
  unapplied, ids: applied.map(x => ({ case: x.case, previousId: x.previousId, id: x.id, proposal: x.proposal, rule: x.rule })),
};
const ledger = readJson(LEDGER);
const next = { ...ledger, entries: { ...ledger.entries } };
let added = 0, same = 0;
for (const [id, e] of Object.entries(entries).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0))) { if (Object.hasOwn(next.entries, id)) { if (JSON.stringify(next.entries[id]) === JSON.stringify(e)) same++; else throw new Error(`the ledger holds a different row for ${id}`); } else { next.entries[id] = e; added++; } }
if (args.includes('--check')) { if (added) throw new Error(`${added} settlement rows are not in ${LEDGER}`); console.log(`ledger settlements present: ${same} rows`); process.exit(0); }
if (option('out-json')) writeFileSync(option('out-json')!, `${JSON.stringify(receipt, null, 1)}\n`);
if (args.includes('--write')) { writeFileSync(LEDGER, `${JSON.stringify(next, null, 2)}\n`); }
console.log(JSON.stringify({ previousProposals: receipt.previousProposals, acceptedRunProposals: receipt.acceptedRunProposals, applied: receipt.applied, unapplied, rowsAdded: added, rowsAlreadyPresent: same }, null, 1));
