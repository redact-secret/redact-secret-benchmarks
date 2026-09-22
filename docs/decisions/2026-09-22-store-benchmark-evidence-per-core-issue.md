---
decision_id: decision-store-benchmark-evidence-per-core-issue
status: accepted
scope: benchmarks
title: Store benchmark measurement evidence per core issue under `evidence/`
decided_at: 2026-09-22
---

# Store benchmark measurement evidence per core issue under `evidence/`

## Context

[redact-secret-benchmarks#134](https://github.com/redact-secret/redact-secret-benchmarks/issues/134),
part of [#132](https://github.com/redact-secret/redact-secret-benchmarks/issues/132).
[redact-secret's DS0](https://github.com/redact-secret/redact-secret/blob/main/docs/decisions/2026-09-22-decide-artifact-taxonomy-spec-routing-and-evidence-placement.md)
(#592) placed "final evidence, benchmark measurement — a benchmark or scanner
run produced it" in this repository, "per
[`decision-govern-benchmark-regression-promotion`](2026-09-18-govern-benchmark-promotion.md)."
That decision already says raw scanner output "stays in benchmark evidence
storage" and that a durable evidence link must carry candidate identity,
lockfile hash, corpus hash, command, scanner configuration/version, run ID,
result status, and fixture outcomes — but it never names where "benchmark
evidence storage" is. Nothing else does either:

- 16 of `redact-secret`'s 31 `docs/audits/evidence/<issue>/` folders reference
  this repository, TruffleHog/Gitleaks, the pin manifest, or the review
  ledger — `evidence/548`'s "stable 2/46" line and `evidence/367`'s 85 KB twin
  baseline are core-repo copies of benchmark-owned measurement, not core's own
  release-blocking regression evidence.
- The shape this decision needs already exists ad hoc: `docs/reports/beta-5/results.md`'s
  "Provenance" table and "Reproduce" section (candidate commit, artifact
  hashes, benchmark commit, corpus hash, run ID, scanner, the exact
  `benchmark:candidate` invocation) is exactly the durable evidence link
  `2026-09-18-govern-benchmark-promotion.md` requires — it is just filed
  under a beta-version report, not addressable by the core issue it gates
  (redact-secret#376), and not the form a later gate (e.g. this repository's
  own `known-gaps.json` reaching `verified`) can point at uniformly.
- `release-regression-check` (the skill that produces exactly this evidence
  shape today) defaults its output to `results-output/`, which is
  git-ignored and disappears with the run.

## Decision

`evidence/<core-issue-number>/README.md` — see [`evidence/README.md`](../../evidence/README.md)
for the full contract — is the durable, committed location for benchmark
measurement evidence tied to one `redact-secret/redact-secret` issue. It
supplies exactly the fields `2026-09-18-govern-benchmark-promotion.md`
already requires (source revisions, pinned scanner versions, the command, a
one-line result), naming the location that decision left open. The
`redact-secret` repository's own evidence archive keeps only a permalink to
this file plus that one-line result — never a copy of the underlying
measurement — matching DS0's "final evidence, benchmark measurement" row and
its permalink rule.

`evidence/376/README.md` is the reference example, drawn from the
already-committed, already-verified `docs/reports/beta-5/results.md` gate for
[redact-secret#376](https://github.com/redact-secret/redact-secret/issues/376).
Its full narrative stays in `docs/reports/beta-5/`, unmoved; the new file adds
only the addressable, contract-complete summary a core-side stub or a later
gate can link to directly.

Applied forward only. No existing file moves as part of this decision:
`redact-secret`'s existing `docs/audits/evidence/<issue>/` folders are that
repository's own DS3/DS4 to resolve against the taxonomy DS0 already recorded
(hash-pinned files there do not move), and nothing under this repository's
own `docs/reports/` is relocated either — `evidence/<issue>/` is additive, not
a migration target for content that already has a home.

## Consequences

- `release-regression-check` and any other producer of this evidence shape
  should write (or link) its durable copy into `evidence/<core-issue>/` going
  forward instead of leaving it only in git-ignored `results-output/`; that
  skill's own SKILL.md is updated separately to reflect this, not by editing
  this decision later.
- A `known-gaps.json` record reaching `verified` now has a fixed place to
  point its "benchmark rerun evidence against that exact fixed candidate" at,
  rather than inventing a path per record.
- `docs/decisions/2026-09-18-govern-benchmark-promotion.md` is not
  edited by this decision — it stays the authority on *what* the evidence
  link must contain and the promotion lifecycle it backs; this decision only
  fixes *where* that link resolves.
