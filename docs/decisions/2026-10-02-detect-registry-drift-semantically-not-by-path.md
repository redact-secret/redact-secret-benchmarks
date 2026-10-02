---
decision_id: decision-detect-registry-drift-semantically-not-by-path
status: accepted
scope: benchmarks
title: Detect detector-registry drift by comparing the registry, not by path
decided_at: 2026-10-02
---

# Detect detector-registry drift by comparing the registry, not by path

## Context

[Issue #631](https://github.com/redact-secret/redact-secret-benchmarks/issues/631):
`npm run pins:check` failed on `develop` because `crates/secret-scan-core/src/detectors`
changed in product `main` after the pin `4227160c`. The change was 23 files of
Beta.13 performance work in detector implementations (79 product commits).
`detectors/mod.rs`, the file that registers detectors, was not among them, so
the registry the snapshot records was identical at the pin and at `main`.

`benchmarks/detectors.json` records the product's registry: detector ids in
registration order (extracted from the `row("<id>", ...)` entries of
`built_in_detectors()` in `detectors/mod.rs`) and benchmark-authored titles.
`benchmarks/detector-inventory.json` derives its method text and counts from
that registry and records peer registries pinned by tag. Neither records any
detector implementation.

The old gate asked "did any file under `detectors/` change?". That question
has nothing to do with whether the snapshot is stale. It fired on every
implementation-only commit, and clearing it meant a re-pin to a commit the
product had not released, behind a performance run whose size rows breach
budgets that are accepted only per commit (run 37029138990 at `dadfc4ff`: three
size rows and one initialization ratio read REGRESSION). The measured package
stays the published `@redact-secret/core` 0.1.0-beta.12; moving the pin to an
unreleased commit to silence a path check inverts what the pin is for.

## Decision

- `pins:check` compares the registry itself. It reads `detectors/mod.rs` at the
  pinned revision and at product `main`, extracts the ordered id list with the
  same extraction both times (`extractRegistryIds` in `benchmarks/lib/pin-drift.ts`),
  and fails when the lists differ: a detector added, removed, renamed, or
  reordered. The failure names the ids.
- It also fails if `benchmarks/detectors.json` does not list the ids that
  `mod.rs` registers at the pinned revision, so the snapshot is checked against
  its own stated source.
- The extraction fails closed. A missing or empty table, or a line it does not
  recognise, makes the gate fail loudly. A restructured registry is never read
  as "unchanged".
- Every other condition is untouched: registry, inventory, package version and
  performance-criteria pin consistency (#150); the pinned revision being an
  ancestor of `main`; known-gap fix and candidate commits being ancestors of
  `main`; peer registries pinned by tag and checked by `detectors:check`.
- Titles are not in the product registry, so a product-side title change is not
  detectable by this gate. The ids are the product's identity for a detector.

## What the gate guarantees, and what it no longer does

Guaranteed: the snapshot's detector list is the product's registry at the pinned
commit, and that registry has not changed on `main` since.

No longer guaranteed by this gate: that detector implementation changes on
`main` have been performance-evaluated. This amends
[`decision-decouple-pin-freshness-from-pin-consistency`](2026-09-23-decouple-pin-freshness-from-pin-consistency.md),
which kept path-wide detection because detector changes are performance
relevant (the `pattern.rs` regression, `evidence/683/`). That concern is real and
stays, but it was never a registry-snapshot property. It is carried by:

- pin consistency, which still requires an ACCEPTED evaluation at whichever
  commit is pinned (`baseline.verifiedCommit`);
- the performance evaluation and regression budgets at the commit a release is
  cut from, and `release-regression-check` for a candidate;
- a re-pin, which still follows
  [Re-pinning without recalibrating](../specs/performance-acceptance.md#re-pinning-without-recalibrating).

Unreleased product commits are evaluated when someone chooses to pin or release
them, not by the pin-drift job.

## Consequences

- `develop` is green again without pinning an unreleased commit, accepting any
  size regression, or touching a ledger identity, an official run, or the
  policy revision.
- A real registry change on product `main` turns the job red until the snapshot
  is refreshed and the pin re-evaluated, as before.
- The gate reads one file per revision through the contents API, plus the
  existing compare calls. No clone is needed.
- A registry that moves out of `mod.rs`'s `DETECTORS` table fails the gate until
  `extractRegistryIds` is updated.
