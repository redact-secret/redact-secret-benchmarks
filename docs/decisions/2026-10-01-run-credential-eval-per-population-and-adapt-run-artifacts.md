---
decision_id: decision-run-credential-eval-per-population-and-adapt-run-artifacts
status: accepted
scope: benchmarks
title: Run credential-eval officially once per population, and qualify Redact Secret from the artifacts through one adapter
decided_at: 2026-10-01
---

# Run credential-eval officially once per population, and qualify Redact Secret from the artifacts through one adapter

## Context

#604 and #605, part of #602 (the Next data cutover). #603 partitioned the qualification inputs into populations with
their own owner, run class, pin and denominator. credential-eval (private, tag `v0.1.0-alpha.1`) measures one corpus
per run and emits a RunArtifact v1; it never emits a support status. This repository keeps the status rules. The
public evidence snapshot `snapshot-2026.10.01.2` is one input; the product regression and policy corpora are the
others. #603 left two things open: where the run artifacts are recorded, and what the "product policy revision" is.

## Decision

1. **One official run, one artifact, per population.** The public snapshot, the regression corpus and the policy
   corpus are each run through the same engine, the same pinned configuration (`credential-public-v1`) and the same five
   scanners, against the published `@redact-secret/core` 0.1.0-beta.12. Each is its own artifact with its own corpus
   identity. Nothing is concatenated before a run.
2. **Product corpora are content-addressed.** The regression and policy snapshots are projected from the authored
   fixtures (`benchmarks/qualification/population-snapshot.ts`), with the corpus digest as the revision and the tag
   `regression-<12 hex>` / `policy-<12 hex>`, and a release manifest in the shape credential-eval's verifier reads.
   Product policy facts (expected action, conformance flag, context axis) are keyed by case id beside the snapshot and
   never inside it.
3. **Pins live in `benchmarks/official-runs.json`.** The engine tag and commit, the RunArtifact schema digest, each
   scanner's version and executable or package digests, each population's expected evidence identity, and the recorded
   runs. `npm run official-runs:check` checks consistency; with `--bindings` it also rebuilds the product snapshots and
   refuses a stale pin. The run driver refuses before reading any measurement when the engine, a scanner or the
   evidence differs from the registry, runs the engine twice, and accepts the artifact only when every run exits 0,
   validates, binds to its population and has the same semantic digest.
4. **linux-x64 is canonical.** The CI workflow (`official-runs.yml`, dispatch only) produces the canonical artifacts.
   A darwin-arm64 run differs in two executable pins, so in `config_hash` and semantic digest, and is recorded only as
   a local verification, never compared with a linux run.
5. **Run class** follows #603: an artifact is `public` when its engine publication class is `public` and its population
   is publishable, else `internal`. One internal artifact makes the whole qualification view internal. Internal and
   candidate artifacts are never published outside product qualification.
6. **One adapter boundary** (`benchmarks/qualification/adapter.ts`). It validates the schema tag and the schema, binds
   each artifact to its registry identity, builds per-family and per-scanner counts per population, joins product
   contract, taxonomy, empirical, review-ledger and known-gap data, and applies the existing, unchanged
   `classifyFamilySupport`. It never re-scores, never reads `non_semantic` as evidence, and never moves status into
   credential-eval.
7. **Populations combine by role, never by pooling** (`benchmarks/support/population-policy.json`). The public
   snapshot is the `floors-and-gates` population: floors and fixture-profile cells are read from it alone. The
   regression corpus is a `gates` population: a zero-tolerance failure in it blocks stable, and it adds to no floor.
   The policy corpus is the `policy-route` population: it feeds only the T3 policy-qualified route. A zero-tolerance
   gate is evaluated in each gate-bearing population and the classifier receives the worst one, never a sum.
8. **Unmeasured is not zero.** The official configuration runs no methods, so metamorphic, mutation and differential
   gates are unmeasured. A family that would be `stable` is held at `provisional` with the reason `methods.notRun` until
   every required method has run. This is the fail-closed reading of "treat non-measured as not measured".
9. **The product policy revision** is `rs-policy-<adapter version>:sha256:<hex>`: the SHA-256 of the canonical JSON of
   the adapter identity and one digest per benchmark-owned qualification input (status criteria, fixture profiles, the
   policy-qualified profile, empirical observations, taxonomy, the review ledger, the population policy, and the
   contract facts of `assessment.ts`). A JSON input's digest is of its parsed content, so whitespace and key order do
   not move it. Any threshold, route, tier, record or ledger decision moves it; a re-measurement of unchanged inputs does
   not. `supportStatusChanges` entries cite this stamp.
10. **Axes.** The public snapshot carries no benign taxonomy and uses its own group vocabulary. The adapter reads a
    control axis as `taxonomy` else `group`, and a positive context axis as `group`, and excludes pending (T0) cases
    from every cell. This is recorded in the view and is a parity question for #607, not a silent equivalence.
11. **Output** is a deterministic, schema-validated file, `schemas/qualification-view-v1.json`, written by
    `npm run qualification:view` to `public/results/qualification-v1.json` (build-emitted, not committed). #606 reads it.

## Consequences

- Reading status from the new path today yields no `stable` family: the official configuration runs no methods, and the
  public snapshot's group and context axes are not the legacy fixture axes. The legacy path remains the oracle until
  #607 settles parity and #608 cuts over. The view says why per family.
- A change to a regression or policy fixture changes that population's corpus digest. The pin must be refreshed with a
  new official run before the next dispatch; `official-runs:check --bindings` says so.
- CI cost stays at one dispatch-only workflow. The consistency and schema gates run in `validate` and are cheap.

## Rejected

- One pooled run over all corpora: it would hide the origin of a count and give one Wilson bound to a population nobody
  authored (credential-eval `multi-corpus-qualification.md` section 3).
- Running the product corpora with `--methods` to clear the methods gate: it changes `config_hash` and needs the
  legacy-shaped evidence file; that is an engine-configuration decision for #607, not for this adapter.
- Committing the artifacts: 28 MB for the public population. The CI build artifact, with its recorded digests, is the
  immutable store.
- A revision stamp of the benchmark commit: it would change on every unrelated commit and say nothing about what the
  status depends on.
