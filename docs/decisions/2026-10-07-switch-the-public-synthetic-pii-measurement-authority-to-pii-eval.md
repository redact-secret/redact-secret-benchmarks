---
decision_id: decision-switch-the-public-synthetic-pii-measurement-authority-to-pii-eval
status: accepted
scope: benchmarks
title: Switch the public/synthetic PII measurement authority to pii-eval, keep the legacy evaluator as the bounded oracle, and leave the protected path pending
decided_at: 2026-10-07
---

# Switch the public/synthetic PII measurement authority to pii-eval, keep the legacy evaluator as the bounded oracle, and leave the protected path pending

## Context

#666, part of #652, after #664 (dual-run parity), #665 (public artifact consumption and publication), #795 (scorer basis, accepted by the owner 2026-10-06) and #796 (the first official public/synthetic execution, run 37559349070).
[The 2026-10-05 decision](2026-10-05-keep-pii-authority-legacy-with-a-measured-exit-and-a-rehearsed-rollback.md) kept the authority `legacy` because five things did not hold: complete membership, an official run, the scorer basis, a rehearsed rollback for the target and an owner acceptance, and because
it modelled the exit as one list that included the protected path. This decision supersedes that one for the public lane. Its mechanism (one committed value, a gate that recomputes the criteria, one reader, a rehearsed rollback, a caller inventory) stands.

What holds now, each recomputed from the tree by `npm run pii:authority:check`: the four populations carry 1,188 of 1,188 memberships under schema 1.4 (156 range-less, reported unresolved); the pinned linux engine replays them byte for byte; the four pins are `official` and the recorded run
(`benchmarks/pii-eval-official-run/`) is a fresh canonical linux-x64 execution; the scorer basis is decided; the caller inventory equals the tree; the rollback is rehearsed against the exact pins. The protected path does not hold, and #666 says it must not block the public cutover.

## Owner decision (recorded, not supplied by the repository)

The repository owner, Milo Kang, answered "승인하고 전환" on 2026-10-07 in the live Claude Code session to: "Record owner approval for #666 and switch the PII public synthetic measurement authority to `new` (pii-eval)?". The answer is posted verbatim at
https://github.com/redact-secret/redact-secret-benchmarks/issues/666#issuecomment-6034993114. It does two things and nothing else:

1. It accepts the verdict of official run 37559349070 (the four official public/synthetic populations, under the scorer basis accepted in #795) as the accepted public/synthetic measurement for the pinned target.
2. It authorises `benchmarks/pii-authority.json` authority `new` for public/synthetic measurement.

It is not an acceptance of protected execution, private audit, product thresholds or support verdicts, or the credential authority. No support verdict, threshold or membership changes with it.

## Decision

1. **Authority model.** PII authority is not one boolean. Recorded in the file as `authorityModel`: public/synthetic measurement is `pii-eval`; product qualification and publication stay `benchmarks` (policy `qualification/pii-v1.json`, thresholds, support status, accepted tradeoffs); protected execution is `private-custodian`
   and private audit is `private-ledger`, both pending and not operational; the legacy TypeScript evaluator is the bounded oracle and rollback source.
2. **The value is `new`, for public/synthetic measurement only**, under `new.authorisation`, which records the owner, the date, the scope `public-synthetic-measurement-authority`, the source (this session and the issue comment above) and the exact frozen target:
   pii-eval `b1c097e40bad456e52f904f626cca00b69c45612`, artifact schema 1.4, engine binary sha256 `24ccae24...ac053`; scanner `@redact-secret/core` `0.1.0-beta.13` (source `401158d0`), package tree digest `36a59622...2a51`; the four populations at the manifest and semantic digests of
   `benchmarks/pii-eval-population-pins.json`; protocol `pii-v1` revision 2; policy `qualification/pii-v1.json` sha256 `02e1e012...df2`; official run 37559349070. The gate compares every one of these with the tree, so a repin, a changed policy or a changed population makes the authorisation stale until the owner authorises again.
3. **Public and protected exit criteria are separate.** Each criterion carries a `scope`. The seven public criteria gate `new`; `protected-path-live` is `protected`, stays unmet, is recorded as `protected.state: pending-not-operational` (the gate keeps that record equal to the computed criterion) and never blocks the public cutover.
   The repository does not fabricate a protected measurement and authorises no protected input, key, host or ledger access.
4. **The flip went through the gate.** `pii:authority:check` accepts `new` only with the authorisation, every public criterion met and every named part unchanged; `web/services/pii-authority.ts` refuses `new` without an authorisation record and never falls back; the Next PII page's "PII authority" row says which source is active, that the
   legacy evaluator is the oracle, and that the protected path is pending. The published support matrix is byte-identical under both values (proved by the rehearsal and by a web test); nothing about a family status changes.
5. **Rollback is rehearsed against the exact frozen identities.** `docs/generated/pii-authority-rehearsal.json` is regenerated: committed `new`, flipped to `legacy`, rolled back, and `new` without its authorisation (refused). The matrix has one sha256 in all four states and the file is restored byte for byte. Rolling back is changing `authority` to `legacy`; nothing is migrated.
6. **The oracle is retained, bounded and reviewed.** The legacy evaluator and the benchmark scorer stay. The oracle period ends when, in addition to this authorisation, the new path has been the authority for at least one further release or candidate measured through both pipelines with the dual-run report regenerated and 0 unexplained
   differences, the rollback has been rehearsed again against that target, and a removal PR lists each file's callers first and is reviewed. Review date 2027-01-02: the owner keeps the oracle or records a new exit. A lapse of time removes nothing.
7. **Nothing is removed now, per file, on evidence.** The caller inventory now records, for each removal candidate, the retained non-test code that reaches it through the import graph (the dual-run `--check` oracle, `registry.ts`, `holdout.ts`, `support*.ts`, the observation scripts, the legacy site source) and `removalDecision`. Every one of the 31 generic-engine
   files and 7 oracle tests is reached by retained code or is the test of such a file, and the removal prerequisite (the further measured release, the repeated rehearsal, the split of the mixed files, a reviewed removal PR) is unmet, so the removal set is empty. This is a decision, recorded by the inventory gate, not a deferral: a file leaves the oracle only when its row says no retained consumer reaches it and the exit holds.
8. **Routine PII measurement stays out of unrelated pull requests, and no required check is weakened.** Unchanged from the 2026-10-05 lane (`PII_MIGRATION` in `scripts/ci-plan.mjs`, `tests/pii-ci-lanes.test.mjs`): pull requests validate committed artifacts, pins and policy (`pii:*:check` in `validate-sources`, the root unit tests); the measurement
   is the dispatch-only official run (`pii-official-run.yml`), the replay and cost workflows, and the push-time publication. The authority file, its gate, the rehearsal and the inventory remain PII migration inputs that do not select the legacy credential oracle.
9. **Documentation points at the active owners.** `docs/specs/pii-authority.md`, `AGENTS.md` and `web/CONVENTIONS.md` state the active authority, the split and the pending protected path.

## Consequences

- The Next PII page says the pii-eval artifacts are the authority for the public/synthetic measurement. Product verdicts are still benchmarks'. #665, #795 and #796 public acceptance is met; #666's public acceptance is met; the protected acceptance of each is tracked in its own issues.
- The protected path (pii-eval #30, private-custodian #71 and #72, private-ledger #9 to #12) is open work. Its readiness will flip `protected-path-live` and `protected.state` through the gate, without touching the public authority.
- A repin of pii-eval, a changed population or a changed policy needs a fresh rehearsal and a fresh owner authorisation.

## Alternatives rejected

- **Wait for the protected path.** #666 says a missing protected path does not prevent the public cutover.
- **Delete the generic engine now.** Retained code still reaches every file and the oracle period has not run.
- **Record the owner decision without the issue comment.** The comment makes it traceable by URL.
- **Flip the credential authority with it.** Independent files; a credential setting is not authorisation for PII.
