# PII authority, the measured exit and the rollback (#666)

Status: benchmark-side record. This document measures and records; it asserts no product output and never writes an owner acceptance on the owner's behalf. Decisions:
[`2026-10-07 switch the public/synthetic PII measurement authority to pii-eval`](../decisions/2026-10-07-switch-the-public-synthetic-pii-measurement-authority-to-pii-eval.md) (active) and
[`2026-10-05 keep legacy with a measured exit`](../decisions/2026-10-05-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback.md) (the mechanism; its value is superseded for the public lane).
The credential analogue is [`qualification-cutover.md`](qualification-cutover.md); the two are independent.

## Who is the authority for what

PII authority is not one global boolean. `authorityModel` in the file records the owners; `protected` records the protected path's readiness.

| Class | Owner | State |
| --- | --- | --- |
| Public/synthetic measurement | `pii-eval` | the committed value `new` (owner authorisation recorded 2026-10-07, public/synthetic scope only) |
| Product qualification and publication (thresholds, support status, accepted tradeoffs, policy `qualification/pii-v1.json`) | `benchmarks` | unchanged by the switch; no verdict, threshold or membership moved |
| Protected execution/delivery | `private-custodian` | pending, not operational (`protected.state`, criterion `protected-path-live` unmet) |
| Private audit/operational ledger | `private-ledger` | pending, not operational |
| Legacy TypeScript evaluator | `benchmarks` (bounded oracle and rollback source) | retained until the oracle exit; review 2027-01-02 |

## The one value

`benchmarks/pii-authority.json` holds `authority: "legacy" | "new"`, validated by `schemas/pii-authority-v1.json` and `npm run pii:authority:check` (a `validate-sources` step). A credential authority setting is not authorisation for PII:
neither file names the other and no credential reader reads this one.

| Value | Meaning |
| --- | --- |
| `legacy` | the benchmark scorer (`b11ScoreTable`) over the frozen Beta.11 and Beta.13 evidence and the `b11-population-v2` plans is the authority; the pii-eval measurement is shown beside it as exploratory evidence and decides nothing |
| `new` (committed) | the `pii-eval` artifacts are the authority for the public/synthetic measurement, under `new.authorisation`; the legacy evaluator is the bounded oracle; the protected path is pending and does not gate it |

`new` is accepted only with `new.authorisation` (owner, date, scope `public-synthetic-measurement-authority`, source with the issue-comment URL of the owner's words, an accepted decision, engine commit, policy digest, each population's semantic and manifest digest, engine binary digest, scanner package tree digest, protocol, artifact schema and the official run id),
only while every PUBLIC exit criterion is met and every named part equals the tree. A repin, a policy change or a changed population makes it stale until the owner authorises again in a reviewed commit. The gate refuses `new` with no authorisation, and so does the Next service (`web/services/pii-authority.ts`); under `new` the page never falls back to the legacy evaluation.

## Readers

`web/services/pii-authority.ts` is the only reader in the app; `loadPiiEvaluation` carries its stamp (authority, legacy source, unmet criteria, who decides, review date) to `/evaluation/pii/` as the last row of the first status group ("PII authority"), so the page keeps its shape. The gate fails on any other file that names `benchmarks/pii-authority.json`
(`PII_AUTHORITY_READERS` in `benchmarks/evaluation/domains/pii/authority.ts`). A new reader is a decision. Web tests choose the authority by an overlay root (`web/tests/unit/overlay.ts` pins `legacy` unless a test chooses), so the suite means the same whichever value is committed.

## Exit criteria

Each criterion has a scope. The seven `public` criteria gate the public/synthetic cutover. `protected-path-live` is `protected`: it gates only the protected path, is tracked in its own issues (pii-eval #30, private-custodian #71 and #72, private-ledger #9 to #12), is recorded as `protected.state: pending-not-operational`, and never blocks the public measurement.
Each `computed` criterion is recomputed from the committed tree by `pii:authority:check` and must equal the recorded state; `owner` criteria are decisions the repository never records for the owner (`owner-accepted-verdict` is `met` exactly when `new.authorisation` is recorded, and the gate checks that).

| Criterion | Scope | Basis | Evidence | At this record |
| --- | --- | --- | --- | --- |
| `population-dual-run-complete` | public | computed | `benchmarks/pii-eval-migration.json` acceptance is `accepted` | met: schema 1.4 carries 1,188 of 1,188 memberships (156 range-less, reported `unresolved`) |
| `linux-engine-replay-equal` | public | computed | `benchmarks/pii-eval-population-dual-run/linux-replay.json`, pinned binary | met (run 37552998602) |
| `official-mode-measurement` | public | computed | every pin is `official` and the recorded run holds (`benchmarks/pii-eval-official-run/`, `scripts/lib/pii-official-record.mjs`) | met: run 37559349070 |
| `legacy-callers-inventoried` | public | computed | `docs/generated/pii-legacy-inventory.json` equals the tree | met |
| `rollback-rehearsed-for-target` | public | computed | `docs/generated/pii-authority-rehearsal.json` for the pinned identities | met |
| `scorer-basis-decided` | public | owner | [`pii-scorer-basis.md`](pii-scorer-basis.md) | met: accepted 2026-10-06 (#795 comment 6028908779) |
| `owner-accepted-verdict` | public | owner | accepted decision and `new.authorisation` | met: owner Milo Kang, 2026-10-07, [#666 comment 6034993114](https://github.com/redact-secret/redact-secret-benchmarks/issues/666#issuecomment-6034993114); public/synthetic scope only |
| `protected-path-live` | protected | computed | migration record `protectedPath.state: live-verified` and a live artifact consumed | unmet: no custodian catalog, transport or production v2 key; pending |

## The oracle period and who decides

The legacy PII measurement stays the oracle. The owner decides the exit. It ends when `new` has been authorised (done), the new path has been the authority for at least one further release or candidate measured through both pipelines with the dual-run report regenerated and 0 unexplained differences, the rollback was rehearsed again against it,
and a removal PR lists each legacy file's callers first and is reviewed. Review date 2027-01-02: the owner keeps the oracle or records a new exit. A lapse of time removes nothing. At the switch no legacy file was removed: the inventory records, per file, the retained code that reaches it and `removalDecision`.

## Rollback

Rolling back is changing `authority` to `legacy`: no data is migrated and nothing is restored. `npm run pii:authority:rehearse` (`scripts/rehearse-pii-authority-rollback.mjs`, working tree only, restores the file's own bytes, never run by a publishing workflow) runs committed, flipped, rolled-back, and `new` without its authorisation: it rebuilds the PII support publication (the reviewed protected route and the
five bound pii-eval artifacts) and runs the gate in each state. The record `docs/generated/pii-authority-rehearsal.json` shows the publication byte-identical in every state, the gate accepting `legacy` and the authorised `new`, `new` refused without an authorisation, and the file restored byte for byte.
The rehearsal is against the pinned engine commit and population digests; a repin makes it stale (criterion unmet) until it is repeated. `web/tests/unit/pii-authority.test.ts` and `domains-services.test.ts` show the same on the evaluation the pages read (everything but the stamp is byte-equal under both values, and the rollback restores it). Under `new`, a build with no published support artifact reads the pii-eval measurement from the committed durable copies the pins name (the new pipeline's own input, product unbound), never from the legacy evaluation.

## Caller inventory

`node scripts/pii-legacy-inventory.mjs [--write|--check]` (`npm run pii:legacy-inventory[:check]`) writes `docs/generated/pii-legacy-inventory.json`: 67 files in five groups, from the upstream ownership map accepted at pii-eval `212d500`.

| Group | Files | Disposition | Owner after retirement | Prerequisite |
| --- | --- | --- | --- | --- |
| generic engine (`accounting`, `methods/*`, `types`, schemas, ...) | 31 | removal candidate | `pii-eval` (Rust reimplementation; the TypeScript is the oracle) | authority `new` for a bounded period, every criterion met, a removal PR that repoints each external caller |
| oracle behaviour tests | 7 | removal candidate | `pii-eval` (its parity vectors) | removed with the file each tests, never before |
| mixed split (`profile`, `qualification`, `populations`, `holdout*`, `candidate.mjs`, ...) | 15 | split, then decide | benchmarks keeps the verdict, `pii-eval` the neutral calculation | a reviewed split recorded before any line moves |
| benchmark scorer (`beta11-*`) | 4 | retain until criterion | benchmarks | `population-dual-run-complete` and `scorer-basis-decided` |
| product policy (support, bindings, consumers, publication) | 10 | retain | benchmarks | none: never removal candidates |

The gate compares the candidates and the callers that would block a removal (not test callers). Each entry also carries `retention.removalDecision` and the retained (non-candidate, non-test) code that reaches it through the import graph. At the 2026-10-07 switch all 31 generic-engine files are reached by retained code (the dual-run oracle, `registry.ts`, `holdout.ts`, `support*.ts`, the observation scripts, the legacy site source) and the 7 tests belong to them, so `removalReview.removed` is empty: the oracle period has not run.

## CI lanes

Repetitive PII measurement is not run for unrelated pull requests, and no required check is weaker for it. `scripts/ci-plan.mjs` (`PII_MIGRATION`) does not select the legacy oracle for a change to only the PII migration tooling and data; the PII oracle domain code, the product policy and the PII publication code remain legacy inputs.
Routine PII measurement is the dispatch-only official run (`pii-official-run.yml`), the replay and cost workflows and the push-time publication; a pull request validates committed artifacts, pins and policy. Every PII gate runs in `validate-sources` on every change; the root unit tests (every PII test) run on every change; the site is built for a PII data change. The measurement workflows (`pii-profile-cost*`, `peer-pii-runtime-throughput`, `pii-population-replay`) are dispatch-only; `publish-site.yml` measures the populations on a push. `tests/pii-ci-lanes.test.mjs` holds this.

## Commands

```sh
npm run pii:authority:check          # the value, the criteria recomputed from the tree, the readers
npm run pii:legacy-inventory:check   # the caller inventory equals the tree
npm run pii:authority:rehearse       # rehearse the rollback (working tree only); add -- --write to record
npm run pii:migration:check          # the dual-run record, the linux replay receipt and the pins
npm run pii:population:replay -- --engine=<pii-eval binary>   # replay the four populations (CI: pii-population-replay.yml)
```
