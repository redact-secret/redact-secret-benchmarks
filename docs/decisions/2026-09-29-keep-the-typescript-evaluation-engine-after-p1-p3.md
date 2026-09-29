---
decision_id: decision-keep-the-typescript-evaluation-engine-after-p1-p3
status: accepted
scope: benchmarks
title: Keep the TypeScript evaluation engine; do not start a Rust or WASM kernel after the P1-P3 fixes
decided_at: 2026-09-29
---

# Keep the TypeScript evaluation engine; do not start a Rust or WASM kernel after the P1-P3 fixes

## Context

[#479](https://github.com/redact-secret/redact-secret-benchmarks/issues/479)
proposed rewriting the evaluation engine (`benchmarks/engine`,
`benchmarks/evaluation/**`, `benchmarks/lib/scoring.ts`) in Rust because CI was
slow. It set a decision gate (P4) behind three cheaper phases: remove the
O(n x m) scans (P1, #480), stop `queue:check` re-running the evaluation (P2,
#481), and profile and split `npm test` (P3, #483, commit `94d2805`). The gate
says to reopen the Rust question only if the remaining harness-owned
(non-product) CPU time is still the dominant CI cost **and** a specific,
isolated kernel is shown to be language-bound.

All numbers below are for the published-package mode. No candidate build is
involved, and the peer observations are reused snapshots. The CPU profiles ran
with `trufflehog` 3.97.4 first on `PATH` (the keg on the maintainer machine had
been overwritten with 3.97.9, so the pinned release binary was downloaded), and
neither profile executes a peer binary. Both produced the same distribution as
the issue's baseline, `{"stable":61,"provisional":47,"pending":2,"unsupported":0}`.

## Baseline and after: CI

`validate.yml` on `develop`. Baseline is run
[36563979422](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36563979422)
(`7598bf1`). After is run
[36578889380](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36578889380)
(`94d2805`, the first `develop` run with P1-P3 all merged). Both on
`ubuntu-latest`; one run each, so treat differences under about 5 s as noise.

| Job / step | Baseline | After | Change |
| --- | --- | --- | --- |
| wall clock | 5m22s | 1m24s | -74% |
| `npm test` (one job, 212 s) vs 4 shards, longest | 3m32s | 1m03s (shards 47 s / 16 s / 63 s / 18 s) | -70% |
| `eval -- --scanner=redact-secret` | 1m18s | 31s | -60% |
| `eval:classify` | 2m17s | 36s | -74% |
| `queue:check` | 2m08s | 4s | -97% |
| `pins:check` | 40s | 40s | 0 |
| `promotion:check` | 18s | under 4 s | over -78% |
| billed job-seconds (sum of job durations) | 673 s | 366 s | -46% |

The critical path is now the slowest test shard (`unit-tests (3)`, 74 s job),
then `scanner-comparison` (62 s) and `validate-sources` (59 s). `pins:check`
(50 s job) is the only step that did not move: it is sequential `gh api compare`
calls to the product repo, so it is network-bound, not CPU-bound. In this run it
also failed on unrelated upstream detector drift after `8f97f14d`, which does not
affect its timing.

## Baseline and after: CPU

`node --import tsx --cpu-prof benchmarks/classify-support.ts` (the issue's
method), main thread, on a 10-core macOS machine. The issue's 183 s profile was
a 4-core container, so compare shares, not seconds.

| Location | Baseline self time | After self time | After share |
| --- | --- | --- | --- |
| `benchmarks/lib/scoring.ts` | 58.1 s (31.7%) | 1.01 s | 4.6% |
| `benchmarks/evaluation/substrate/runtime.ts` | 27.9 s (15.3%) | under 0.13 s (not in top 12) | under 1% |
| `.../credential/assertions.ts` | 21.8 s (11.9%) | under 0.13 s | under 1% |
| `.../credential/methods/differential.ts` | 11.8 s (6.5%) | under 0.13 s | under 1% |
| `@redact-secret/core` `scan` (product) | 6.7 s (3.7%) | 2.80 s | 12.7% |
| garbage collection | 9.5 s (5.2%) | 1.05 s | 4.8% |
| `substrate/hash.ts` | not listed | 0.38 s | 1.7% |
| `node:internal` (mostly `structuredClone`, 0.61 s) | not listed | 1.95 s | 8.8% |
| idle (main thread awaiting I/O) | not listed | 11.55 s | 52.3% |
| whole profile | 183 s | 22.1 s wall | |

Summed by owner, after (main thread, wall 22.1 s): idle 11.55 s, product
native core 2.80 s, harness-owned JS 2.73 s, other (loader, Node internals,
ajv) 3.96 s, GC 1.05 s. The `eval -- --scanner=redact-secret` profile, which is
the largest remaining CI step, has the same shape (wall 18.5 s): idle 10.44 s,
core 2.74 s, harness JS 1.63 s, other 3.23 s, GC 0.50 s. Its top harness lines
are `scoring.ts` 0.56 s, `evaluate.ts` 0.26 s, `hash.ts` 0.25 s.

The product scan is now the single largest CPU location, above any harness
file. It is already Rust: `@redact-secret/core` loads the N-API native addon.

The idle half is the main thread waiting on file I/O. `substrate/runtime.ts`
writes every input to a scratch directory one file at a time, and this run
spent 19-20 s of system time in a 28 s wall-clock run (`time`). A separate
microbenchmark of 38,152 sequential small `writeFile` calls took 6.1 s on the
same machine. That attribution is inferred from those two measurements, not
from a tracing tool.

## Options

1. **Start a Rust/WASM kernel now**, for `scoring.ts` span scoring. The kernel
   costs 1.0 s of a 22 s profile (4.6%), and most of that is
   `computeByteBoundaries`, a UTF-8 length walk that a `charCodeAt` loop
   already does in TypeScript. There is nothing left there for a faster
   language to buy, and a kernel would add a build target, a boundary and a
   parity qualification for it.
2. **Rewrite the whole engine in Rust.** Rejected in #479 and unchanged by
   these numbers: the product under test is a Node package, ledger identity
   depends on the hashing and normalisation the TypeScript engine defines
   (#180 moved `stable` from 43 to 5 on a patch bump), and a second engine needs
   full parity qualification against
   `docs/specs/qualification/engine-v1.json` before any published number can come
   from it.
3. **Keep the TypeScript engine, close the gate, and take the remaining cheap
   TypeScript wins only when they earn their cost.**

## Decision

Option 3. The P4 criteria are applied literally, and neither holds:

- **Harness-owned CPU is not the dominant CI cost.** Harness-owned JS is
  2.73 s (12%) of the classify profile and 1.63 s (9%) of the `eval` profile.
  Wall clock is dominated by I/O wait, then the product's own native scan, and
  in CI by the slowest test shard and the network-bound `pins:check`. The
  three P1-P3 fixes removed 74% of CI wall clock and 46% of job-seconds without
  a language change.
- **No isolated kernel is language-bound.** The largest remaining harness
  location is 1.0 s in `scoring.ts` (`computeByteBoundaries` 0.48 s), which is
  an algorithm-shape cost that TypeScript can still shrink. `runtime.ts`,
  `assertions.ts` and `differential.ts` fell from 27.9, 21.8 and 11.8 s to
  below 0.13 s each with no new language.

#479 is closed by this record. No Rust or WASM work is scheduled.

## What would reopen this

Reopen only on new evidence, and scope the work as a kernel, not an engine:

- a profile in which one isolated pure-compute function (for example span
  scoring or corpus hashing) is at least about 25% of harness wall clock **after**
  the I/O and algorithmic fixes below, and a TypeScript rewrite of that function
  does not move it; and
- harness-owned CPU is again the largest share of the slowest CI job.

Scope if reopened: a Rust or WASM kernel behind the existing TypeScript
interface (the function keeps its TypeScript signature and is a drop-in), gated by
a parity qualification against `docs/specs/qualification/engine-v1.json`
proving byte-identical output on the full corpus, with the ledger keys
(`review-ledger.json` ids) unchanged. A kernel that changes any hash or id is a
re-keying event and needs its own record.

## Consequences

- The TypeScript engine stays the only engine. `engine-v1.json` needs no
  change.
- Remaining cheap TypeScript wins, none implemented here. Ordered by expected
  CI effect:
  1. Rebalance the `npm test` shards. Shard times are 47 s / 16 s / 63 s /
     18 s, so the slowest shard (3) sets the wall clock. Splitting by measured
     duration instead of `--test-shard` file order could bring the longest near
     the 36 s mean.
  2. Write `substrate/runtime.ts` scratch inputs concurrently (bounded), or
     hand in-memory inputs to scanners that accept them. Idle is about half of
     both profiles.
  3. Fetch the `pins:check` `gh api compare` calls in parallel or with one
     GraphQL query. It is 40 s, all network, and now the third-longest step.
  4. Replace `structuredClone` (0.61 s) and repeated whole-object hashing in
     `substrate/hash.ts` (0.25-0.38 s) on the hot path with shallow copies and a
     per-input hash cache.
  5. Trim `computeByteBoundaries` (0.48 s) by caching per content string, as
     the issue's probe did.
  6. Share one `npm ci` and build across the `validate-sources`,
     `scanner-comparison` and shard jobs. Setup is 4-5 s per job, so this is
     minor.
- Measurement caveats: one CI run per side, CPU profiles from one machine of a
  different shape than the baseline container, one profile per command. Absolute
  seconds are not comparable across machines. Shares and CI step times are the
  evidence.
