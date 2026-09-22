# Settle differential disagreements on pending fixtures, and sweep the candidate-keyed differential queue (#125)

Date: 2026-09-22 · Extends: [`resweep-differential-queue-against-pinned-trufflehog.md`](../2026-09-21/resweep-differential-queue-against-pinned-trufflehog.md),
[`resweep-differential-queue-post-axis-refactor-issue-120.md`](../2026-09-21/resweep-differential-queue-post-axis-refactor-issue-120.md) (#120/#122),
[`2026-09-21-settle-mechanical-mutation-review-classes.md`](../../decisions/2026-09-21-settle-mechanical-mutation-review-classes.md) (D7), [`2026-09-21-clear-digitalocean-benign-axis-diversity.md`](../../decisions/2026-09-21-clear-digitalocean-benign-axis-diversity.md) (#105)

This is a measurement report, not a decision record (#135): it is the
evidence behind the one policy §4 settled. That policy's authoritative
record is
[`docs/decisions/2026-09-22-settle-differential-disagreements-on-pending-fixtures.md`](../../decisions/2026-09-22-settle-differential-disagreements-on-pending-fixtures.md).

## Context

Issue #125 measured, under redact-secret#572's four conditions, that 15 of
the 17 T1 + `providerSource` families were blocked only by
`differential.unresolvedContractDisagreements` — 173 disagreements in total —
and that #122's 383 `open` ledger rows had not moved that count at all. It
asked for a per-entry triage of the 173, one new benign axis for
`aws-access-key`, `github-token` and `slack-token`, and a check of whether
#122's rows and the 173 are even the same population.

## Measurement

Every number below comes from a run of this repository's own engine
(`runEvaluation`, the function `npm run eval:classify` calls) under the same
four conditions the issue used, with `trufflehog --version` and
`gitleaks version` printed immediately before each run:

| | |
| --- | --- |
| Product | redact-secret `main` @ `8838b91e99d822420a644c0e487bdd3a217c904d`, clean |
| Candidate artifacts | built by `scripts/measure-candidate.sh` from that commit: core SHA-256 `a8f7abedfff82b41f33264ff5e7f31326f8280b818d66644139a8a6ddd233ed7`, wasm `bb28b62f45c896ca3ff0c2724141ba602703cc687759455ede1a3f6406d6495c` (both identical to the issue's), node `42c9db065f1c965ff53c6f8b19489a33f591f7aadc436cf93ea1851666b7749b` (a native build; the issue's own node hash differs for the same reason) |
| Peer scanners | gitleaks 8.30.1, trufflehog 3.97.4 (`/opt/homebrew/Cellar/trufflehog/3.97.4/bin` first on `PATH`; this machine's default is 3.97.5) |
| Baseline runs | benchmarks `main` @ `3117e69676d0ff422e45f626fa277a29fa96d33d`, clean: candidate `1c9d5fdd-d959-4023-9b24-6a0b98db47ca`, published-package `6b7b9497-0c2e-47a6-8326-92a427aa807a` |
| Sweep runs | this branch @ `4a4fa69f63822e3dfc7a6d0de7b54d732cee34a0` (the three benign controls below committed, ledger untouched), clean: candidate `f0fb2bb8-e106-4915-8b08-279bc26c5f94`, published-package `080e35d1-daf8-44da-9faf-557903115017` |

The baseline candidate run reproduces the issue exactly: 3,317 cases,
distribution `{"stable":2,"provisional":42,"pending":2,"unsupported":0}`,
and 173 unresolved differential ids across the same 15 families at the same
per-family counts (`slack-token` 32, `sendgrid-token` 28, `private-key` 20,
`stripe-token` 20, `vault-token` 18, `aws-access-key` 13,
`supabase-management-token` 9, `shopify-token` 6, `terraform-cloud-token` 6,
`github-token` 5, `digitalocean-token` 4, `jwt` 4, `pypi-token` 4,
`cloudflare-token` 3, `pulumi-access-token` 1).

## 1. #122's rows and the 173 are disjoint populations

The mismatch the issue flagged is real, and it is a keying difference, not a
counting error. A differential review-queue id is
`hash({ case, source, ...entry })` (`benchmarks/engine/execution.ts`), and
`entry.evidence.tools` carries each scanner's `mode` and `configuration`.
`eval:classify --candidate-*` substitutes a `redact-secret` scanner whose
`mode` is `Candidate build · isolated npm tarballs with overrides` and whose
configuration is `scanners/candidate.mjs`'s `candidateConfiguration`; the
default path runs `Published npm package · default detectors` with
`adapterVersion: 2`. Same fixture, same findings, different id.

Measured at `3117e69`:

- The candidate queue (528 ids) and the published-package queue (532 ids)
  share **0** ids.
- All **173** unresolved ids in the candidate run have **no ledger row at
  all**. None is an `open` row.
- Of the ledger's 383 `open` rows, **0** appear in the candidate queue,
  **107** in the published-package queue (the 47 `differential-coverage-gap`
  / `differential-boundary-unconfirmed` rows and 60 `t0-pending-fixture`
  rows #120/#122 recorded), and the remaining 276 are stale ids from earlier
  re-keyings that no current queue produces.

So #122 made no progress toward the 173 because it never touched them: it
keyed against the published package, and the issue's gate reads the candidate
build. The ledger already holds candidate-keyed rows — 85 of the candidate
queue's ids were `resolved` by the D7 sweep (`firstSeenRun c5c87dc1`) — so
recording the candidate keying is established practice, not a new one.

## 2. The candidate build is not the published package

`8838b91e` behaves differently from the `0.1.0-beta.5` the default path
installs, and the queue shows it. Recorded here as observation; nothing is
asserted about product output (`AGENTS.md` boundary rule):

- The 39 `differential-coverage-gap` rows (`pulumi-access-token`,
  `terraform-cloud-token`, `supabase-management-token`, `generic-token`) and
  the 8 `differential-boundary-unconfirmed` rows (`linear-token`,
  `slack-token`) that the published package still produces do **not** occur
  in the candidate queue: the candidate reports those spans, byte-exact
  against the corpus, or stays silent where the corpus asserts nothing.
- The candidate reports a finding on 30 T0 fixtures the published package is
  silent on (`stripe-token` `sk_org_`/`whsec_`, `slack-token` `xwfp-`,
  `linear-token` `lin_oauth_`, every `vercel-token` and `supabase-token`
  shape), producing 60 `redact-secret-only` disagreements, 18 of them in the
  issue's 15 families (`stripe-token` 12, `slack-token` 6). Those fixtures
  are `pending` by the corpus's own #45 re-check (redact-secret#512/#513) or
  because the family's contract is T0.

## 3. Classification of the 173 (and the rest of both queues)

Every id was checked mechanically the way D1/D2/D7/#98/#120 did it: the
fixture's authored `expected` secret span(s) (`benchmarks/engine/model.ts`
`secrets()`), redact-secret's observed byte ranges, the peer's, the fixture's
tier, and for twins whether the same fixture's own `twin`-method assertion
fails in the same run. A `resolved` row requires redact-secret's own output to
match the authored span set byte-exactly first; the disagreement is then
attributable to the peer. Every resolved note reuses an established class's
text verbatim (the four `twin-boundary-family-reassignment` rows reuse the
ledger's own notes for the identical fixtures and mutation); no class was
invented for a resolved row.

The issue's 173 (candidate run, 15 families):

| disposition | class | count |
| --- | --- | --- |
| resolved | `redact-secret-only/trufflehog/range-matches-corpus` | 75 |
| resolved | `redact-secret-only/gitleaks/range-matches-corpus` | 35 |
| resolved | `peer-only/trufflehog/range-matches-corpus` | 22 |
| resolved | `range-disagreement/trufflehog/peer-narrower-boundary` | 10 |
| resolved | `peer-only/gitleaks/range-matches-corpus` | 8 |
| resolved | `classification-disagreement/trufflehog/documented-composite-mapping` | 2 |
| resolved | `redact-secret-only/trufflehog/twin-boundary-family-reassignment` | 2 |
| resolved | `range-disagreement/trufflehog/peer-deduplicates-repeated-value` | 1 |
| not-assertable | `decision=differential.t0-pending-fixture` (§4) | 18 |

The whole candidate queue at `4a4fa69` (443 ids without a row): 383 resolved
(195 + 110 `redact-secret-only`, 38 + 11 `peer-only`, 12
`peer-measures-broader-span`, 10 `peer-narrower-boundary`, 1
`peer-deduplicates-repeated-value`, 2 `documented-composite-mapping`, 2 + 2
`twin-boundary-family-reassignment`) and 60 not-assertable under §4. Zero
rows fall in an open-only class.

The published-package queue at `4a4fa69` (353 ids without a row, every one
re-keyed by the `detector-coverage.mjs` edit below — the same mechanism
#105/#120 documented): 246 resolved (132 + 92 `redact-secret-only`, 4 + 11
`peer-only`, 6 `peer-measures-broader-span`, 1
`peer-deduplicates-repeated-value`), 60 not-assertable under §4, and 47
`open` — the identical 39 coverage-gap and 8 boundary-unconfirmed rows
#98/#120/#122 recorded, reusing their notes verbatim. They stay open: the
published package still has the gap, and this repository does not fix product
output.

## 4. Differential disagreements on pending fixtures are not assertable

D2 and the pinned-trufflehog sweep kept `t0-pending-fixture` rows `open`
"pending fixture review". That was the right call while the rows were
gitleaks/trufflehog artifacts a person might one day adjudicate. It is the
wrong state for what these rows are: a fixture whose assessment is `pending`
carries no reviewed expectation, is excluded from comparative scores, and
records in its own reason exactly which external evidence (a provider grammar,
a pinned-tool corroboration) would let someone review it. Nobody can settle a
redact-secret/peer disagreement over such a fixture from inside this
repository, because the corpus itself declines to say who is right. An `open`
row that can never be closed here is exactly the case `not-assertable` was
introduced for (D7: "a person decided, per class, that no ground truth is
inferable" — distinct from `resolved`, never folded into it).

The gate rationale for `differential.unresolvedContractDisagreements` ("the
contract itself may be wrong") does not reach these rows either: a T0 fixture
asserts no contract, so a disagreement over it is not evidence about the
family's reviewed contract one way or the other.

Decision (recorded authoritatively in the ADR linked above):

- A differential review-queue entry whose fixture assessment is tier T0 is
  recorded `not-assertable` under `Class: decision=differential.t0-pending-fixture`.
  The note names the fixture and family so the pending reason can be looked
  up; it settles nothing about either side's output. The workbench shows the
  class as its own group, `Pending fixtures (decided)`, beside `T0 fixtures`
  (`src/evaluation-model.ts`): a settled class carries no open entries, and
  the `T0 fixtures` group still holds the stale open rows below.
- Applied to the 120 current-queue T0 rows (60 candidate-keyed, 60
  published-package-keyed; both peers × 30 fixtures). The 129 stale
  `open · t0-pending-fixture` rows no current queue produces are left as they
  were: their fixtures' tiers cannot be re-verified from a run, and every
  earlier sweep left stale ids alone too.
- If a pending fixture is later reviewed (a contract or control rule lands),
  its source hash changes, its ids re-key, and the next sweep adjudicates the
  new rows against the new ground truth. Nothing here pre-decides that.

## 5. Benign axes for `aws-access-key`, `github-token`, `slack-token`

All three carried `near-miss` (`prefix-only`, `short-body`) and `placeholder`
(`mask`) only. `fixtures/generated/detector-coverage.mjs` gains one
`reference` control each — `AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}`,
`GITHUB_TOKEN=${GITHUB_TOKEN}`, `SLACK_BOT_TOKEN=${SLACK_BOT_TOKEN}` — the
exact template #93 applied to `gitlab-token`/`npm-token` and #105 to
`digitalocean-token`. The axis is derived by `controlAxis` from the
`reference` id suffix, not hand-labelled; `tests/benign-axes.test.mjs` pins
the result. No positive, contract or ground truth changed;
`benchmarks/pin-manifest.json` was regenerated for the corpus hash.

## Result

Recomputing `unresolved()` over the sweep runs' queues against this record's
ledger: the candidate queue (`f0fb2bb8`) has **0** unresolved differential ids
in any family; the published-package queue (`080e35d1`) has exactly the 47
open rows above (`pulumi-access-token` 18, `terraform-cloud-token` 15,
`supabase-management-token` 3, `generic-token` 3, `linear-token` 4,
`slack-token` 4). Ledger: 4,582 → 5,378 entries (3,510 resolved, 1,438
not-assertable, 430 open — 383 of them the pre-existing rows, 47 the
re-keyed open classes).

### Final `eval:classify` runs (this record's committed state, `aa0330f9d6b8a2a7fe85bc3b2254ffbe17ff8bb5`, clean)

Both runs used the issue's own command shape; `trufflehog --version` printed
`3.97.4` from `/opt/homebrew/Cellar/trufflehog/3.97.4/bin/trufflehog` and
`gitleaks version` printed `8.30.1` immediately before they started
(2026-09-22T11:46:17Z). 3,329 cases / 8,779 variants, 46 families (12 cases
more than the issue's run: the three new controls × their four methods).

| run | mode | runId | distribution |
| --- | --- | --- | --- |
| candidate (#572 conditions; product `8838b91e`, core `a8f7abed…`, node `42c9db06…`, wasm `bb28b62f…`) | `--candidate-*` | `90a9a47a-d890-4e47-81e9-7cbafb0d63ec` | `{"stable":17,"provisional":27,"pending":2,"unsupported":0}` |
| published package `0.1.0-beta.5` | default | `0e826091-901a-4397-a8dd-ea51e8a0f947` | `{"stable":13,"provisional":31,"pending":2,"unsupported":0}` |

In the candidate run **all 17 T1 + `providerSource` families are `stable`**
with empty `reasons`, up from 2 (`gitlab-token`, `npm-token`) in the issue's
run and this record's baseline: `differentialUnresolvedContractDisagreements`
is 0 for every one of them, and `aws-access-key`, `github-token` and
`slack-token` each read `benignAxes: 3` (`near-miss`, `placeholder`,
`reference`). The 27 `provisional` families are all outside the issue's
scope (T2/T3 contracts, or T1 families blocked on other floors before this
record).

In the published-package run 13 of the 17 are `stable`; the four that are
not — `pulumi-access-token`, `terraform-cloud-token`,
`supabase-management-token`, `slack-token` — fail `twinFailures` /
`metamorphic.criticalFailures` / `mutation.unresolvedCritical` /
`benign.falseAlarms` as well as the 47 open differential rows: those are the
published package's own gaps, which §2 shows the candidate build no longer
has, and which this record does not adjudicate.

`npm run queue:check` (published-package keying, the CI job's mode) passes
against this ledger. `npm run ledger:decisions:check` (renamed from
`decisions:validate` by #135), `npm run fixtures:check`,
`npm run pins:manifest:check`, `npm run typecheck` and the unit suite
(354/354) pass.

## Explicitly out of scope

- Any product-side change. The published package's 47 open rows are promotion
  candidates (`promote-finding`), and the candidate's new T0 findings are
  product news for redact-secret#512/#513, not assertions made here.
- Reviewing the pending fixtures themselves (`sk_org_`, `whsec_`, `xwfp-`,
  `lin_oauth_`, `vercel-token`, `supabase-token`): a contract decision with
  its own provider evidence, per #45.
- Pruning the 276 stale `open` ledger rows no current queue produces.
