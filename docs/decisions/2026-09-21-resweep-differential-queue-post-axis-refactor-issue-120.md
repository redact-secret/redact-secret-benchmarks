# Re-sweep the differential review queue after the #91 axis refactor, and regenerate the pin manifest

Date: 2026-09-21 · Status: accepted · Extends: `2026-09-21-resweep-differential-queue-post-d1-d6-issue-98.md` (D1/D6),
`2026-09-21-resweep-differential-mutation-queue-d7.md` (D7)

## Context

Issue #120: `main`'s CI has been red on every push since PR #96 (issue #91,
"single-source the control axis") merged as `31b2b6f`. Three independent
checks fail. `benchmarks/engine/cases.ts` hashes an entire corpus **category
file** as a case's `sourceHash` (`resweep-differential-queue-post-d1-d6-issue-98.md`
already documented this); #91 edited enough category files that the
differential-method `sourceHash` — and therefore every downstream
`reviewQueue` id, per `hash({case, source, ...entry})` in
`benchmarks/engine/execution.ts` — reshaped again, orphaning rows the #98
sweep had just recorded, the same way D1/D6 orphaned D7's.

## 1. Differential review-queue ledger backlog

Locally (gitleaks `8.30.1`, trufflehog `3.97.5`, matching CI's pinned
gitleaks but not its pinned trufflehog `3.97.4` — the same known gap #98's
own record left open; not re-closed here): **353 differential review-queue
ids** with no `benchmarks/review-ledger.json` row, spanning 35 families.
Zero mutation ids were affected.

### Classification

Every id was checked mechanically against its fixture's authored `expected`
secret span(s) (`benchmarks/engine/model.ts`'s `variant.fixture.expected`)
and the actual byte ranges each side reported
(`reviewQueue[].observations`), reusing exactly D1/D2/D7's established
templates — no new class was invented, and nothing was resolved by assuming
which side was right:

- **306 resolved** as `authored-expectation-correct`: one side's `actual`
  byte-range set equals the corpus's authored `expected` set exactly and the
  other side's does not.
  - **284** `redact-secret-only|peer-only/<peer>/range-matches-corpus`
    (redact-secret 284: gitleaks 122, trufflehog 162; peer-only 15: gitleaks
    11, trufflehog 4) — the peer's disagreement is fully attributable to the
    peer.
  - **6** `range-disagreement/trufflehog/peer-measures-broader-span**`
    (`connection-string`'s six postgres/mongodb bare/quoted/unicode-crlf
    fixtures — trufflehog reports the whole connection string, redact-secret
    matches the corpus's password-only span exactly).
  - **1** `range-disagreement/trufflehog/peer-deduplicates-repeated-value`
    (`digitalocean-token-repeated` — trufflehog reports only the first of
    two authored occurrences; redact-secret matches both exactly).
- **47 stay open**, reusing D1/D6's own two open-only classes verbatim (no
  `decided-operators` marker needed, matching that record's own note that
  the marker applies to `not-assertable` only):
  - **`differential-coverage-gap/<family>`** (39: `pulumi-access-token` 18,
    `terraform-cloud-token` 15, `supabase-management-token` 3,
    `generic-token` 3) — redact-secret reports no finding at all while a
    peer matches the corpus's authored expected span exactly. A candidate
    detector coverage gap, not a peer artifact; per `AGENTS.md`'s boundary
    rule this repository measures and records, it does not fix product
    output, so these are not resolved here.
  - **`differential-boundary-unconfirmed/<family>`** (8: `linear-token` 4,
    `slack-token` 4) — redact-secret flags a span under its own target
    family that the corpus's must-not-flag expectation does not assert.
    Re-verified against this run's own `twin`-method results (not assumed
    from D1/D6): zero `redact-secret` twin-method failures for either
    family, so this does not qualify for `confirmed-boundary-false-positive/<family>`
    (that class requires an independently-failing `authored.twin`
    assertion). Genuinely needs a person.

These 47 open families are the *same* underlying disagreements D1/D6 already
classified — the axis refactor only reshaped their ids — so this record
re-attaches D1/D6's own reasoning rather than re-deriving it, exactly as D1/D6
did for D7's three orphaned `twin-boundary-family-reassignment` entries.

### Result

`npm run queue:check` passes: every current differential review-queue id
resolves against the ledger. `npm run eval:classify`
(run against this record's own state, gitleaks `8.30.1` / trufflehog
`3.97.5`): `{"stable":11,"provisional":33,"pending":2,"unsupported":0}` of
46 families, up from the `stable: 3` figure redact-secret#573/PR #580
published at `a502fdd` (issue #120's own flag that that figure was
provisional pending this sweep). `differential.unresolvedContractDisagreements`
now blocks exactly the 6 families in the 47-entry open set above.

**Known issue, same as D1/D6's:** this sweep ran against local `trufflehog
3.97.5`, not the `3.97.4` `.github/workflows/validate.yml`'s
`scanner-comparison` job pins. If the two versions disagree on any fixture in
this 353-id set, `npm run queue:check` will still find a gap in CI against
the ledger rows added here — re-sweeping against the CI-pinned binary is
tracked as follow-up, not done in this record, matching how D1/D6 left the
same gap.

## 2. Pin-manifest drift

`benchmarks/pin-manifest.json`'s committed `pins.sourceRevision` /
`pins.redactSecretRevision` (`640d204e...`) had drifted from
`benchmarks/detectors.json` / `benchmarks/detector-inventory.json`'s own
`53d728b9...` (issue #120 reported the opposite-looking drift — a
`53d728b9...` committed manifest against a live `640d204...` — at the commit
it was filed against; by `a502fdd` the drift direction had flipped, which is
exactly what an unregenerated manifest looks like as further pin updates
land without a `pins:manifest` re-run). `npm run pins:manifest` regenerated
`benchmarks/pin-manifest.json` against the currently checked-in sources;
`npm run pins:manifest:check` and `tests/pin-manifest.test.mjs` both pass.

## 3. Promotion-manifest gap — not resolved here, blocked on a schema decision

`npm run promotion:check` still fails. The product manifest
(`redact-secret/redact-secret@main:conformance/benchmark-regressions.json`)
carries two records — `sendgrid-generic-key-full-span-promotion`
(`benchmarkRecordId: product-428-sendgrid`) and
`reference-syntax-literal-secret-controls-promotion`
(`benchmarkRecordId: product-428-reference-syntax`) — both citing
`productIssue: https://github.com/redact-secret/redact-secret/issues/428`
(closed), the receiving side of this repo's own issue #16 (also closed;
`tests/regressions.test.mjs` no longer imports `@redact-secret/core`,
confirming the benchmark-side removal already happened). Both records'
`gates` are `pending` (no supported-surface CI evidence, no fixed-candidate
benchmark rerun recorded yet), so the correct target status here is
`promoted`, not `fixed`/`verified`.

Full, reproducible evidence for both was gathered and verified against the
currently-installed candidate (`@redact-secret/core@0.1.0-beta.5`,
`lockHash 12ed54c6...`, matching `product-551`/`552`/`553`'s own candidate
block exactly): all 8 fixtures
(`sendgrid-regressions--{trailing-dash,url-safe}-generic-key`,
`reference-syntax--{api-key,password,dotted-password,quoted-password,client-secret,unicode-crlf}`)
byte-exactly match their authored `expected` span against a live
`redact-secret` scan, confirming the product manifest's own note ("both were
confirmed to already pass against the current detector... closes an
uncovered contract rather than a live regression").

**The blocker:** `benchmarks/lib/promotion.ts`'s `validateKnownGaps` rejects
two `known-gaps.json` records sharing one `number` (`duplicate-product-issue`,
verified empirically against the validator directly, not inferred from
reading it). Issue #428 legitimately promotes two independent findings under
one product issue, which the product manifest reflects as two records — the
only case in the whole product manifest where one `productIssue` backs more
than one record. `checkManifestCrossReference` needs a `known-gaps.json`
record whose `id` equals each manifest record's `benchmarkRecordId`
individually, so this cannot be represented as a single merged
`known-gaps.json` record either: only one `id` could ever match one
`benchmarkRecordId`, leaving the other manifest record's cross-reference
unresolved regardless.

This is a genuine, previously-latent design gap between the product
manifest's one-issue-to-many-records shape and this repo's
one-record-per-product-issue schema invariant — not a data problem this
sweep can backfill correctly. Resolving it needs one of:

- Relax `validateKnownGaps`'s `numbers` uniqueness to allow multiple
  `known-gaps.json` records under one product issue (distinguishing a
  legitimate multi-finding promotion from an accidental duplicate some other
  way, e.g. requiring distinct `promotion.productManifestRecordId` values);
  or
- Ask the product repository to consolidate the two `benchmark-regressions.json`
  records under #428 into one.

Left open pending that decision; `npm run promotion:check` will keep failing
until it is made. `promotion:check:local` (the schema-only, no-`gh` path)
already passes against the unmodified `benchmarks/known-gaps.json` in this
record.

## Explicitly out of scope

- Re-sweeping this record's 353-id classification against CI's pinned
  `trufflehog 3.97.4` (see §1's known issue).
- The product-side fix for `differential-coverage-gap`'s 39 entries and
  `differential-boundary-unconfirmed`'s 8 — candidate product defects or
  missing coverage, a `promote-finding` pass against a `status: "observed"`
  record, not this one.
- The `product-428-sendgrid` / `product-428-reference-syntax` backfill
  itself (§3) — blocked on the schema-vs-manifest decision above.
