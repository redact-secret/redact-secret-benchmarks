# PII authority, the measured exit and the rollback (#666)

Status: benchmark-side record. This document measures and records; it asserts no product output and writes no owner acceptance. Decision:
[`docs/decisions/2026-10-05-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback.md`](../decisions/2026-10-05-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback.md).
The credential analogue is [`qualification-cutover.md`](qualification-cutover.md); the two are independent.

## The one value

`benchmarks/pii-authority.json` holds `authority: "legacy" | "new"`, validated by `schemas/pii-authority-v1.json` and `npm run pii:authority:check` (a `validate-sources` step). A credential authority setting is not authorisation for PII:
neither file names the other and no credential reader reads this one.

| Value | Authority | The pii-eval measurement |
| --- | --- | --- |
| `legacy` (committed) | the benchmark scorer (`b11ScoreTable`) over the frozen Beta.11 and Beta.13 evidence and the `b11-population-v2` plans, under `qualification/pii-v1.json` | validated, published and shown beside it as exploratory evidence; decides nothing |
| `new` | the `pii-eval` artifacts, under an owner authorisation recorded in the file | the source of record; the legacy pipeline stays as the oracle |

`new` is accepted only with `new.authorisation` (release or candidate, date, who accepted, an accepted decision, engine commit, policy digest, each population's semantic digest) and only while every exit criterion is met and nothing it names has changed. A repin, a policy change or a changed
population makes it stale until it is authorised again in a reviewed commit. The gate refuses `new` with no authorisation, and so does the Next service (`web/services/pii-authority.ts`); under `new` the page never falls back to the legacy evaluation.

## Readers

`web/services/pii-authority.ts` is the only reader in the app; `loadPiiEvaluation` carries its stamp (authority, legacy source, unmet criteria, who decides, review date) to `/evaluation/pii/` as the last row of the first status group ("PII authority"), so the page keeps its shape. The gate fails on any other file that names `benchmarks/pii-authority.json`
(`PII_AUTHORITY_READERS` in `benchmarks/evaluation/domains/pii/authority.ts`). A new reader is a decision. Web tests choose the authority by an overlay root (`web/tests/unit/overlay.ts` pins `legacy` unless a test chooses), so the suite means the same whichever value is committed.

## Exit criteria

Each `computed` criterion is recomputed from the committed tree by `pii:authority:check` and must equal the recorded state; `owner` criteria are decisions the repository never records for the owner.

| Criterion | Basis | Evidence | At this record |
| --- | --- | --- | --- |
| `population-dual-run-complete` | computed | `benchmarks/pii-eval-migration.json` acceptance is `accepted` (an engine contract states `not-established`, or the owner drops those memberships) | unmet: 156 of 1,188 case memberships not representable |
| `linux-engine-replay-equal` | computed | `benchmarks/pii-eval-population-dual-run/linux-replay.json`, `canonical: true`, pinned binary | met (run 37350920750) |
| `official-mode-measurement` | computed | every population pin has `projection.mode: official` | unmet: all exploratory |
| `protected-path-live` | computed | migration record `protectedPath.state: live-verified` and a live artifact consumed | unmet: no custodian catalog, transport or production v2 key |
| `legacy-callers-inventoried` | computed | `docs/generated/pii-legacy-inventory.json` equals the tree | met |
| `rollback-rehearsed-for-target` | computed | `docs/generated/pii-authority-rehearsal.json` for the pinned engine and population digests | met |
| `scorer-basis-decided` | owner | which scorer defines the metric values: `b11ScoreTable` or `pii-v1` accounting (different scorers; numbers not compared) | unmet: no decision |
| `owner-accepted-verdict` | owner | accepted decision and `new.authorisation` for an explicitly frozen release or candidate | unmet: `authorisation` is null |

## The oracle period and who decides

The legacy PII measurement stays the oracle. The owner of this repository decides the exit. It ends when `new` has been authorised for a frozen target, that target was measured through both pipelines with the dual-run report regenerated and 0 unexplained differences, the rollback was rehearsed again against it,
and a removal PR lists each legacy file's callers first and is reviewed. Review date 2027-01-02: the owner keeps the oracle or records a new exit. A lapse of time removes nothing, and this repository removes no legacy PII code before the exit.

## Rollback

Rolling back is changing `authority` to `legacy`: no data is migrated and nothing is restored. `npm run pii:authority:rehearse` (`scripts/rehearse-pii-authority-rollback.mjs`, working tree only, restores the file's own bytes, never run by a publishing workflow) flips the value, rebuilds the PII support publication (the reviewed protected route and the
five bound pii-eval artifacts) and runs the gate under each value. The record `docs/generated/pii-authority-rehearsal.json` shows the publication byte-identical under both values and across the rollback, `new` refused without an authorisation, and the file restored byte for byte.
The rehearsal is against the pinned engine commit and population digests; a repin makes it stale (criterion unmet) until it is repeated. `web/tests/unit/pii-authority.test.ts` shows the same on the evaluation the pages read.

## Caller inventory

`node scripts/pii-legacy-inventory.mjs [--write|--check]` (`npm run pii:legacy-inventory[:check]`) writes `docs/generated/pii-legacy-inventory.json`: 67 files in five groups, from the upstream ownership map accepted at pii-eval `212d500`.

| Group | Files | Disposition | Owner after retirement | Prerequisite |
| --- | --- | --- | --- | --- |
| generic engine (`accounting`, `methods/*`, `types`, schemas, ...) | 31 | removal candidate | `pii-eval` (Rust reimplementation; the TypeScript is the oracle) | authority `new` for a bounded period, every criterion met, a removal PR that repoints each external caller |
| oracle behaviour tests | 7 | removal candidate | `pii-eval` (its parity vectors) | removed with the file each tests, never before |
| mixed split (`profile`, `qualification`, `populations`, `holdout*`, `candidate.mjs`, ...) | 15 | split, then decide | benchmarks keeps the verdict, `pii-eval` the neutral calculation | a reviewed split recorded before any line moves |
| benchmark scorer (`beta11-*`) | 4 | retain until criterion | benchmarks | `population-dual-run-complete` and `scorer-basis-decided` |
| product policy (support, bindings, consumers, publication) | 10 | retain | benchmarks | none: never removal candidates |

The gate compares the candidates and the callers that would block a removal (not test callers).

## CI lanes

Repetitive PII measurement is not run for unrelated pull requests, and no required check is weaker for it. `scripts/ci-plan.mjs` (`PII_MIGRATION`) does not select the legacy oracle for a change to only the PII migration tooling and data; the PII oracle domain code, the product policy and the PII publication code remain legacy inputs.
Every PII gate runs in `validate-sources` on every change; the root unit tests (every PII test) run on every change; the site is built for a PII data change. The measurement workflows (`pii-profile-cost*`, `peer-pii-runtime-throughput`, `pii-population-replay`) are dispatch-only; `publish-site.yml` measures the populations on a push. `tests/pii-ci-lanes.test.mjs` holds this.

## Commands

```sh
npm run pii:authority:check          # the value, the criteria recomputed from the tree, the readers
npm run pii:legacy-inventory:check   # the caller inventory equals the tree
npm run pii:authority:rehearse       # rehearse the rollback (working tree only); add -- --write to record
npm run pii:migration:check          # the dual-run record, the linux replay receipt and the pins
npm run pii:population:replay -- --engine=<pii-eval binary>   # replay the four populations (CI: pii-population-replay.yml)
```
