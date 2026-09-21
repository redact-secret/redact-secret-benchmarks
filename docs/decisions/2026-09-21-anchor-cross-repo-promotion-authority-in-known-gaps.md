# Anchor cross-repo promotion authority in known-gaps.json

Date: 2026-09-21 · Status: accepted

## Context

[Issue #106](https://github.com/redact-secret/redact-secret-benchmarks/issues/106)
follows [#66](https://github.com/redact-secret/redact-secret-benchmarks/issues/66),
which reconciled the three beta.5 findings
([redact-secret/redact-secret#551](https://github.com/redact-secret/redact-secret/issues/551),
[#552](https://github.com/redact-secret/redact-secret/issues/552),
[#553](https://github.com/redact-secret/redact-secret/issues/553)) that reached
product issues without a `benchmarks/known-gaps.json` record. #66 closed
without answering two of its own acceptance criteria and without confirming
whether the product's `conformance/benchmark-regressions.json` needs a
matching check. Left unanswered, the lifecycle
(`docs/decisions/2026-09-18-govern-benchmark-promotion.md`) stays a convention
a careful person follows rather than a check that fails — the same defect
class as #90's dead taxonomy: ground truth existing in one place while a
second place re-derives it by convention.

The two ledgers live in two repositories:
`benchmarks/known-gaps.json` here, `conformance/benchmark-regressions.json` in
`redact-secret/redact-secret`. A bidirectional consistency check needs to know
which side to trust when they disagree, and whether to check the product
ledger's live state or a locally cached copy of it.

This is the same question `docs/decisions/2026-09-17-build-evaluation-engine-now.md`
already answered for the support matrix: *"Stable support-matrix source data
belongs here because support status is a qualification result backed by
evaluation evidence. The main repository may publish that result, but does not
become its source of truth."* `docs/decisions/2026-09-18-govern-benchmark-promotion.md`
already states the same for the promotion lifecycle itself — *"`benchmarks/known-gaps.json`
is the authoritative state record"* — but never extended that statement to the
product-side manifest the lifecycle hands off to, which is the gap #106 closes.

## Decision

`benchmarks/known-gaps.json` is authoritative for the promotion lifecycle,
full stop. `conformance/benchmark-regressions.json` is the product repository's
own record of which canonical fixtures and gates back a promoted finding; this
repository does not own it and does not cache a snapshot of it the way
`benchmarks/detectors.json`/`detector-inventory.json` cache upstream detector
registries. Instead, `scripts/check-promotion-consistency.mjs` (`npm run
promotion:check`) fetches it live via `gh api
repos/redact-secret/redact-secret/contents/conformance/benchmark-regressions.json`
on every run — the same "verify a live pinned copy, don't trust a checked-in
one" pattern `scripts/check-pin-drift.mjs` already uses for commit ancestry —
and checks it *against* `benchmarks/known-gaps.json`, never the reverse. A
product manifest record with no `known-gaps.json` record behind it is a
failure: the product ledger cannot assert a promotion this repository has no
record of reviewing.

The check also confirms every `known-gaps.json` record's product issue is
reachable (`gh issue view`), and fails closed — an issue or manifest record
this repository cannot confirm is treated as absent, never skipped.

## Consequences

- Running this check today against the live product repository fails: two
  manifest records, `sendgrid-generic-key-full-span-promotion` and
  `reference-syntax-literal-secret-controls-promotion` (`benchmarkRecordId`s
  `product-428-sendgrid` and `product-428-reference-syntax`, off
  [redact-secret/redact-secret#428](https://github.com/redact-secret/redact-secret/issues/428)),
  reference no `benchmarks/known-gaps.json` record. This is exactly the bypass
  class #66 fixed for #551–#553, discovered by the guard #106 built for that
  purpose, not a defect in the guard. Reconciling it is follow-up work, not
  part of this decision.
- `benchmarks/detectors.json`/`detector-inventory.json` keep the cached-snapshot
  pattern for upstream detector registries, which need stability and manual
  refresh review; the promotion manifest gets the live-fetch pattern instead,
  because catching a fresh bypass promptly matters more here than shielding CI
  from the product repository's release cadence.
- The product repository remains free to publish or reshape
  `conformance/benchmark-regressions.json` for its own release gating; doing so
  never makes it authoritative for the lifecycle state this repository already
  owns.
