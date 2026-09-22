# Re-sweep the differential review queue against the CI-pinned TruffleHog, and record the #428 promotion split

Date: 2026-09-21 · Status: accepted · Extends: `2026-09-21-resweep-differential-queue-post-d1-d6-issue-98.md` (#98), `2026-09-21-resweep-differential-mutation-queue-d7.md` (D7), `2026-09-21-anchor-cross-repo-promotion-authority-in-known-gaps.md` (#106)

## Context

`main` has failed `Validate benchmark sources` on every push since PR #96,
for three independent reasons that this record and its sibling commits
close:

1. **`scanner-comparison` → `npm run queue:check`: 449 differential
   review-queue ids with no `benchmarks/review-ledger.json` row.** #98's own
   record flagged this at merge time: its sweep classified the queue that
   `trufflehog 3.97.5` on the author's `PATH` produces, not the `3.97.4`
   that `.github/workflows/validate.yml` pins and `qualification/suite-v1.json`
   records. Differential ids hash tool versions, so every trufflehog-peer
   id the CI job generates was unseen. The gitleaks side (8.30.1 in both
   places) had also accumulated new ids from the fixture batches that
   landed after #98 (#99–#119: untargeted benign corpus, DigitalOcean,
   PyPI macaroons, D1 stable-family fixtures, `detector-coverage.mjs`
   reshapes), each of which re-keys every differential id sourced from the
   edited category file (`cases.ts` hashes the whole file as `sourceHash`).
2. **`validate` → `npm test`: `benchmarks/pin-manifest.json` stale** after
   #118 moved `detector-inventory.json`'s `redactSecretRevision` without
   regenerating the manifest. Fixed by `npm run pins:manifest` in its own
   commit; no decision involved.
3. **`pin-drift` → `npm run promotion:check`: two product manifest records
   (`sendgrid-generic-key-full-span-promotion`,
   `reference-syntax-literal-secret-controls-promotion`, both off
   redact-secret/redact-secret#428) with no `known-gaps.json` record.** #106's
   record named this as follow-up work.

## Measurement

The queue was regenerated locally with the pinned binaries — `gitleaks
8.30.1`, and `trufflehog 3.97.4` downloaded from its release distribution
and checksum-verified, exactly as the CI job installs it — and diffed
against the checked-in ledger: **449 unknown ids**, matching the CI run
(`35671737383`) byte for byte. 254 are trufflehog-peer, 195 gitleaks-peer.
Zero mutation ids were unknown; D7 and #98 still cover that side fully.

## Classification

Every one of the 449 was checked mechanically against its fixture's
authored `expected` secret span(s) (`benchmarks/engine/model.ts`'s
`secrets()`), redact-secret's own observed range, the peer's observed
range, the fixture's tier, and (for must-not-flag controls) whether the
fixture's own `twin`-method assertions fail in the same run — the same
method D1, D7 and #98 used. No new class was introduced; every entry reuses
an established class's note verbatim, or an established open-only
template with this entry's own peer, family and span filled in.

| disposition | class | count |
| --- | --- | --- |
| resolved | `redact-secret-only/trufflehog/range-matches-corpus` | 174 |
| resolved | `redact-secret-only/gitleaks/range-matches-corpus` | 92 |
| resolved | `peer-only/trufflehog/range-matches-corpus` | 38 |
| resolved | `peer-only/gitleaks/range-matches-corpus` | 11 |
| resolved | `range-disagreement/trufflehog/peer-measures-broader-span` | 12 |
| resolved | `range-disagreement/trufflehog/peer-narrower-boundary` | 10 |
| resolved | `range-disagreement/trufflehog/peer-deduplicates-repeated-value` | 1 |
| resolved | `classification-disagreement/trufflehog/documented-composite-mapping` | 2 |
| resolved | `classification-disagreement/trufflehog/twin-boundary-family-reassignment` | 2 |
| open | `t0-pending-fixture` | 60 |
| open | `differential-coverage-gap/pulumi-access-token` | 18 |
| open | `differential-coverage-gap/terraform-cloud-token` | 15 |
| open | `differential-coverage-gap/supabase-management-token` | 3 |
| open | `differential-coverage-gap/generic-token` | 3 |
| open | `differential-boundary-unconfirmed/linear-token` | 4 |
| open | `differential-boundary-unconfirmed/slack-token` | 4 |

Every `resolved` row required redact-secret's own output to match the
corpus's authored ground truth byte-exactly first; the disagreement is then
attributable to the peer (silence, a broader or trailing-byte-shorter
range, deduplication, or a family split the fixture's own `formatReason`
anticipates). The ten `peer-narrower-boundary` rows are the
`sendgrid-regressions` `trailing-dash-*` fixtures: trufflehog stops one
byte before the trailing `-` that the corpus's span (and redact-secret)
includes — the exact property #428 promoted. The two
`twin-boundary-family-reassignment` rows are D7's `base62-generic-key-twin`
and `base62-bearer-twin`, re-keyed a second time by a `sendgrid-regressions`
source-hash change and re-attached to D7's identical reasoning, as #98 did.

The 60 `t0-pending-fixture` rows are `stripe-token`'s `shape-5-*` fixtures
under both peers: the fixture tier is T0, so no ground truth exists to
adjudicate against, and the precedent from D2 keeps them open pending
fixture review rather than resolving them on the strength of an unreviewed
expectation. The 39 `differential-coverage-gap` rows and 8
`differential-boundary-unconfirmed` rows stay open under #98's two
open-only classes for the same families #98 already named; nothing here
is a new product finding.

No corpus ground truth, fixture, contract or product code changed. Only
`benchmarks/review-ledger.json` moved: 3,938 → 4,387 entries (2,708
resolved, 1,318 not-assertable, 361 open).

## The #428 promotion split

redact-secret/redact-secret#428 promoted two assertions out of this repo's
former `tests/regressions.test.mjs` (benchmarks #16), and the product side
recorded them as **two** manifest records, one per property, per its own
split-by-property intake rule. `validateKnownGaps` rejected any second
record for the same product issue (`duplicate-product-issue`, #106's
"no duplicate issue" criterion), so the lifecycle could not carry the
split at all — the guard was catching a shape the schema had never
considered, not a bypass.

Decision: a product issue may back more than one `known-gaps.json` record
**only** when each record hands off to a different
`promotion.productManifestRecordId`. Two records for one issue without
that distinction remain `duplicate-product-issue`. `product-428-sendgrid`
and `product-428-reference-syntax` land at `status: "promoted"` (observed
2026-09-18 when #428 and benchmarks #16 were filed; reviewed and promoted
2026-09-19 with product PR #437, merge commit `18d49cdf`). Their `evidence`
rows carry the current corpus hashes and the published `0.1.0-beta.5`
findings for the eight fixtures, which match the authored spans exactly:
these are uncovered contracts, as the product records already say, not
live regressions. Gate closure (`fixed`/`verified`) stays with the product
repository's own evidence, as for every other record.

## Result

`npm run queue:check`, `npm run decisions:validate` and `npm run
promotion:check` (live, against the product repository) pass locally with
the pinned scanners. `npm run eval:classify` with the pinned scanners now
reads:

`{"stable":10,"provisional":34,"pending":2,"unsupported":0}` of 46, up from
`{"stable":3,"provisional":41,"pending":2,"unsupported":0}` before the sweep.
`differential.unresolvedContractDisagreements` now blocks 7 families instead
of 36 — `pulumi-access-token`, `terraform-cloud-token`,
`supabase-management-token` and `generic-token` (the open coverage-gap
rows), `linear-token` and `slack-token` (the open boundary rows), and
`stripe-token` (T0 `shape-5` fixtures pending review) — plus the two
already-`pending` T0 families. The seven newly `stable` families
(`cloudflare-token`, `digitalocean-token`, `jwt`, `private-key`,
`pypi-token`, `shopify-token`, `vault-token`) each had every other floor
already met; only untriaged peer-attributable ids were holding them.

## Explicitly out of scope

- Any product-side detector change; the open `differential-coverage-gap`
  and `differential-boundary-unconfirmed` rows are promotion candidates,
  not resolved findings (`AGENTS.md` boundary rule).
- `qualification/suite-v1.json` still pins `redact-secret 0.1.0-beta.4`
  while `package.json` installs `0.1.0-beta.5`; `eval:classify` runs the
  installed package and does not record which. Deciding whether to
  re-qualify the suite at beta.5 is a separate decision.
- A local-toolchain guard that makes `queue:check` refuse a peer binary
  whose version differs from the suite pin, so the #98 mismatch cannot
  recur silently, is worth its own change.
