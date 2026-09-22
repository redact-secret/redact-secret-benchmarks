---
decision_id: decision-settle-differential-disagreements-on-pending-fixtures
status: accepted
scope: benchmarks
title: Settle differential disagreements on pending fixtures as not-assertable
decided_at: 2026-09-22
---

# Settle differential disagreements on pending fixtures as not-assertable

Extends: [`2026-09-21-settle-mechanical-mutation-review-classes.md`](2026-09-21-settle-mechanical-mutation-review-classes.md) (D7),
[`2026-09-21-clear-digitalocean-benign-axis-diversity.md`](2026-09-21-clear-digitalocean-benign-axis-diversity.md) (#105)

## Context

[Issue #125](https://github.com/redact-secret/redact-secret-benchmarks/issues/125)
measured that 173 differential disagreements across 15 T1 + `providerSource`
families were blocked only by `differential.unresolvedContractDisagreements`,
18 of them against fixtures whose own assessment is tier T0 (pending). The
full measurement — run identities, classification of all 173 ids, the
resweeps it extends, and the benign-axis additions it made alongside this
decision — is recorded in
[`docs/reports/2026-09-22/settle-differential-disagreements-on-pending-fixtures.md`](../reports/2026-09-22/settle-differential-disagreements-on-pending-fixtures.md);
this record states only the policy that report's §4 decided.

D2 and the pinned-trufflehog sweep kept `t0-pending-fixture` rows `open`,
"pending fixture review". That was the right call while the rows were
gitleaks/trufflehog artifacts a person might one day adjudicate. It is the
wrong state for what these rows are: a fixture whose assessment is `pending`
carries no reviewed expectation, is excluded from comparative scores, and
records in its own reason exactly which external evidence (a provider
grammar, a pinned-tool corroboration) would let someone review it. Nobody
can settle a redact-secret/peer disagreement over such a fixture from inside
this repository, because the corpus itself declines to say who is right. An
`open` row that can never be closed here is exactly the case
`not-assertable` was introduced for (D7: "a person decided, per class, that
no ground truth is inferable" — distinct from `resolved`, never folded into
it).

The gate rationale for `differential.unresolvedContractDisagreements` ("the
contract itself may be wrong") does not reach these rows either: a T0
fixture asserts no contract, so a disagreement over it is not evidence about
the family's reviewed contract one way or the other.

## Decision

- A differential review-queue entry whose fixture assessment is tier T0 is
  recorded `not-assertable` under `Class: decision=differential.t0-pending-fixture`.
  The note names the fixture and family so the pending reason can be looked
  up; it settles nothing about either side's output.
- The class is recorded in `benchmarks/ledger-decisions.json`, which
  `scripts/check-ledger-decisions.mjs` reads instead of scanning ADR bodies
  for a marker comment (#135). One decision per id, same rule as before.
- Applied to the 120 current-queue T0 rows (60 candidate-keyed, 60
  published-package-keyed; both peers × 30 fixtures). The 129 stale
  `open · t0-pending-fixture` rows no current queue produces are left as
  they were: their fixtures' tiers cannot be re-verified from a run, and
  every earlier sweep left stale ids alone too.
- If a pending fixture is later reviewed (a contract or control rule
  lands), its source hash changes, its ids re-key, and the next sweep
  adjudicates the new rows against the new ground truth. Nothing here
  pre-decides that.

## Consequences

The workbench shows this class as its own group, `Pending fixtures
(decided)`, beside `T0 fixtures` (`src/evaluation-model.ts`): a settled
class carries no open entries, and the `T0 fixtures` group still holds the
stale open rows.

## Explicitly out of scope

- Reviewing the pending fixtures themselves (`sk_org_`, `whsec_`, `xwfp-`,
  `lin_oauth_`, `vercel-token`, `supabase-token`): a contract decision with
  its own provider evidence, per #45.
- Any product-side change. The published package's still-open differential
  rows are promotion candidates (`promote-finding`), not assertions made
  here.
