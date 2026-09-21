# Re-sweep the differential review queue after D1/D6, and gate against recurrence

Date: 2026-09-21 · Status: accepted · Extends: `2026-09-21-settle-mechanical-mutation-review-classes.md` (D2), `2026-09-21-resweep-differential-mutation-queue-d7.md` (D7)

## Context

Issue #98 asked for a re-run of D2's (#63) mechanical ledger sweep over the
queue ids D1 (#62, 15 fixtures) and D6 (#65, 21 fixtures) generated after
D2's own sweep closed. Its own Step 0 flagged that the numbers it quoted
(from redact-secret/redact-secret#548: 41 families blocked by
`differential.unresolvedContractDisagreements`, 9 by
`mutation.unresolvedCritical`, 493 + ~126 entries) were not re-measured when
the issue was filed and might already be wrong.

They were: `npm run eval:classify` at this branch's base commit
(`c23d81e`, with `gitleaks 8.30.1` pinned) read
`{"stable":2,"provisional":42,"pending":2,"unsupported":0}` of **46**
families — not 42. Between the issue being filed and this sweep, D7
(redact-secret/redact-secret#569, this repo's PR #101) already resolved
716 of the queue ids D1/D6 and its own preceding fixture landings generated,
and PR #102 ("untargeted benign corpus, category F") landed more fixtures
immediately after. The 46-family, 41-blocked-family figure reflects all of
that, not only D1/D6's 36 fixtures — **the issue's framing is superseded,
per its own Step 0 instruction to correct it when the fresh measurement
disagrees.**

## Measurement

Re-running the full differential/mutation queue against the checked-in
`benchmarks/review-ledger.json` (`reviewState`,
`benchmarks/engine/execution.ts`) found:

- **384 differential review-queue ids** with no ledger row at all — genuinely
  unseen by any prior sweep, not merely `open`. Zero were `open`: none of
  D2's 113 pre-existing open entries, nor D7's, recur in the current queue.
- **Zero mutation review-queue ids** with no ledger row. D7 already covers
  the mutation side completely; the `mutation.unresolvedCritical` figure
  that still blocks 10 families (115 total) is entirely genuine
  `mutation.fail` — real `redact-secret` assertion failures on families
  whose detectors are incomplete (`terraform-cloud-token`,
  `pulumi-access-token`, `firebase-server-key`, `supabase-management-token`,
  `openai-token`, `discord-bot-token`, `docker-token`, `generic-token`,
  `linear-token`, `slack-token`) — not a ledger classification question.
  Per `AGENTS.md`'s boundary rule, this repository measures and records; it
  does not fix product output, so these stay out of this record's scope.

### Why previously-resolved ids don't recur

`benchmarks/engine/cases.ts` hashes an entire corpus **category file** as
`sourceHash`, not per-fixture. Editing any one fixture in, say,
`fixtures/sendgrid-regressions/corpus.json` reshapes the differential id of
*every* case sourced from that file — including cases nothing about the edit
touched. Three of D7's own already-resolved `sendgrid-token`
`twin-boundary-family-reassignment` entries (`base62-generic-key-twin`,
`base62-bearer-twin` × 2 peer disagreements) were silently orphaned this way
and reappeared in the 384 as new, unresolved ids. This sweep re-attaches
D7's identical, already-recorded reasoning to the new ids rather than
re-deriving it.

## Classification

Every one of the 384 was checked against its fixture's authored `expected`
secret span(s) and the peer's actual observed range from this run — the same
method D1 and D7 used, not assumed:

- **334** matched one of D7's already-established templates exactly and
  mechanically: `redact-secret-only|peer-only/<peer>/range-matches-corpus`
  (325: `redact-secret-only` 300 across gitleaks/trufflehog, `peer-only` 25 —
  the corpus's own must-redact or must-not-flag expectation, and
  redact-secret's output, agree byte-exactly; the peer's silence or extra
  flag is fully attributable to the peer), `range-disagreement/trufflehog/{peer-measures-broader-span,peer-deduplicates-repeated-value}`
  (7 — redact-secret matches the corpus exactly; the peer's disagreement is
  a verified broader or deduplicated range), `classification-disagreement/trufflehog/documented-composite-mapping`
  (2 — `aws-access-key`'s paired-component fixture, matching the corpus's
  own `formatReason` note).
- **3** matched D7's `twin-boundary-family-reassignment` precedent exactly
  (see above) and reuse its note verbatim.
- **47** did not mechanically verify against any established class and stay
  `open`, each with a recorded reason, under two new open-only classes (no
  `decided-operators` marker needed — that gate applies to `not-assertable`
  only):
  - **`differential-coverage-gap/<family>`** (39: `terraform-cloud-token` 15,
    `pulumi-access-token` 18, `supabase-management-token` 3, `generic-token`
    3) — redact-secret reports no finding at all while a peer matches the
    corpus's authored expected span exactly. A candidate detector coverage
    gap, not a peer artifact; not resolved here per the boundary rule.
  - **`differential-boundary-unconfirmed/<family>`** (8: `linear-token` 4,
    `slack-token` 4) — redact-secret flags a span under its own target
    family that the corpus's must-not-flag expectation does not assert, with
    no corroborating `twin`-method failure recorded for the fixture
    (`twinFailures: 0` for both families), so this does not qualify for the
    existing `confirmed-boundary-false-positive/<family>` class either (that
    class requires an independently-failing `authored.twin` assertion, per
    D2's ADR). Genuinely needs a person.

No entry was resolved to make a gate pass: every `resolved` disposition
above required redact-secret's own output to byte-exactly match the corpus's
authored ground truth first: `expected` at `benchmarks/review-ledger.json`.

## Result

`eval:classify` (`c23d81e` + this sweep):
`{"stable":9,"provisional":35,"pending":2,"unsupported":0}` of 46, up from
`{"stable":2,"provisional":42,"pending":2,"unsupported":0}`.
`differential.unresolvedContractDisagreements` now blocks 6 families (47
entries, exactly the deliberately-open set above) instead of 41 (384).
`mutation.unresolvedCritical` is unchanged at 10 families / 115 — all
pre-existing real assertion failures, untouched by this record.

## Guard against recurrence

`scripts/check-review-queue-coverage.mjs` (`npm run queue:check`) fails CI
if any current review-queue id has no `benchmarks/review-ledger.json` row —
the exact silent-accumulation failure mode this issue described. It needs
the pinned peer scanners, so it runs in the `scanner-comparison` CI job
(`.github/workflows/validate.yml`), alongside the other scanner-dependent
checks. This is issue #98's own suggested "`arrival:check`-style guard": the
next fixture batch that generates untriaged differential ids now fails CI
instead of accumulating invisibly until someone happens to re-run
`eval:classify`.

**Known issue at merge time:** this sweep's own measurement ran against
`trufflehog 3.97.5` on the author's `PATH`, not the `3.97.4` that
`.github/workflows/validate.yml`'s `scanner-comparison` job pins. The two
versions disagree on enough fixtures that the differential review queue
`3.97.4` actually produces in CI is not the same 384-id queue this record
classified, so `npm run queue:check` fails in CI against the ledger rows
added here. The guard is doing exactly what it's for: catching a queue this
record didn't cover. Re-sweeping and classifying against the CI-pinned
`3.97.4` is tracked as follow-up work, not done in this record.

## Explicitly out of scope

- Any product-side detector change. `terraform-cloud-token`,
  `pulumi-access-token`, `supabase-management-token`, and `generic-token`'s
  39 coverage-gap entries, and the 115 genuine `mutation.fail` entries, are
  candidate product defects or missing coverage — a `promote-finding` pass,
  not this record.
- `linear-token` and `slack-token`'s 8 `differential-boundary-unconfirmed`
  entries — these need an authored per-fixture decision on whether the
  identifier-embedding constructs are a genuine boundary over-detection.
- The classification-granularity, `t0-pending-fixture`, and
  `confirmed-boundary-false-positive/<family>` entries D2 already excluded
  from mechanical treatment; none of those appeared in this sweep's 384.
