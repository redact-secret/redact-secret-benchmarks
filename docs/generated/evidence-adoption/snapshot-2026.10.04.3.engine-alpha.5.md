# Engine candidate: credential-eval v0.1.0-alpha.5 measuring @redact-secret/core 0.1.0-beta.13 on snapshot-2026.10.04.3 (#697, #698)

**Candidate. Nothing is accepted.** The evidence bytes are the accepted adoption's (manifest `sha256:690ed573...0da8`, corpus `sha256:fdce9df7...9e8f`, 6,449 cases), the peers (gitleaks 8.30.1, TruffleHog 3.97.4), platform (linux-x64) and method settings are unchanged. The accepted alpha.4 + beta.12 runs, the active registry, the authority file and the public numbers are untouched. No owner acceptance is recorded, no deployment receipt exists (production is on hold), and this candidate does not replace the accepted state until the owner decides.

**Maintainer-reviewed (independent review pending) / 메인테이너 검토 (독립 검토 대기).** 96 fixtures are maintainer-only, 0 independently reviewed, 73 cases newly scored (71 positives, 2 controls). 274 of 778 root causes rest on a seed case the release attributes to a maintainer-only record. Owner acceptance of this candidate would not be an independent evidence review.

## What was scanned

| | Engine | Product build | Run |
| --- | --- | --- | --- |
| Accepted (A) | credential-eval v0.1.0-alpha.4 | `@redact-secret/core` 0.1.0-beta.12 | CI 37202404479 |
| Attribution (B) | v0.1.0-alpha.5 (c1802a6b) | 0.1.0-beta.12 (`credential-public-v1.core-beta.12.json`, `adapters/node-core-beta.12`) | CI 37220850850 |
| Candidate (C) | v0.1.0-alpha.5 | **0.1.0-beta.13** (registry integrity `sha512-qZkqRN7C...gMJQ==`, installed tree digest in the artifact) | CI 37220835061 |

Each of B and C: regression, policy, public plain and public methods (differential, metamorphic, mutation), two engine runs each with equal semantic digests (determinism verified), every scanner complete. Replay revision `61695124` (transient branch: the reviewed tooling plus the engine and product pins only; the pins are `engine-alpha.5/replay-pins.patch`). Archives: releases `official-runs-37220835061` and `attribution-runs-37220850850`. Digests, config hashes and revisions per artifact: `engine-alpha.5/replay.json`.

## Comparison (by semantic key; `scripts/compare-replay-effects.ts`)

| Step | Effect | Plain populations (3) | Methods |
| --- | --- | --- | --- |
| A to B | engine + configuration (alpha.4 to alpha.5, config pin gains integrity) | 2 leaves each: `manifest/engine/version`, `config_hash`; 0 outcome differences | same 2 leaves; 0 assertion, review-occurrence or variant differences |
| B to C | product (beta.12 to beta.13) | 14 identity leaves each (version, integrity, tree and lockfile digests, `config_hash`); 0 outcome differences | 14 identity leaves plus the 6,829 occurrence ids that carry the product identity; 0 differences by semantic key |
| A to C | total | identity only | identity only |

No case, outcome, assertion, review occurrence (matched by case, peer, property, variant) or family status differs. Unexplained differences: **0**. The qualification views (CI-built, derived inputs) differ only in artifact identity, policy revision and the re-key digest: 135 families, 116 stable, 18 provisional, 1 pending, no family changes status. So the newly observed failures are neither an engine, a configuration nor a beta.12 to beta.13 effect, in plain, methods, policy and regression. Claims about beta.13 here are about the scanned release `@redact-secret/core 0.1.0-beta.13` with the recorded integrity; the beta.12 receipts stay as they are.

## Triage (#698; `engine-alpha.5/triage.json`, rules in `benchmarks/qualification/triage-decisions.ts`)

778 root causes (1,194 occurrences), queue re-exported from the beta.13 replay (same 778; 15 common-case gate-peer occurrences included).

| Classification | Root causes |
| --- | --- |
| in-contract product bug (amqp userinfo quote; core #1201, PR #1202, fixed on the unpublished candidate, not released) | 4 (1 miss + 3 assertion) |
| unsupported-feature scope (encoded carriers #491, fragmented credentials ADR; provisional scope reading for carriers with no declared product family) | 294 |
| justified peer divergence (the reference matches the evidence's expected result exactly; the peer differs) | 368 |
| not assertable (T0 pending; decided class `differential.t0-pending-fixture`) | 30 |
| open (linked core classification request, redact-secret#1203) | 82 |

No expectation-correction or representation-limitation root cause is claimed. The 82 open: 4 flagged controls, 2 service-account key partials, their assertions and gate occurrences, and 7 gate occurrences where the reference itself deviates; all linked to #1203.

## Core fix re-verification (PR #1202, merge 0ecf3e59, unpublished)

Built as an unpublished candidate (npm pack of core, darwin-arm64 addon and wasm; never published) and replayed on the same snapshot (credential-eval alpha.5, exploratory class, product scanner only, plain run) beside published beta.13 on the same machine: exactly one of 6,449 cases differs, `generic-connection-grammar-authored--amqp-uri-all-sub-delimiters` MISS to EXACT 14-31; none regressed (93 failing cases on beta.13, 92 on the candidate). Methods were not replayed on the candidate, so no gate or status effect is claimed. Details: `engine-alpha.5/candidate-effect.json`.

## Review ledger and statuses

The review ledger is not edited, as in the previous adoption: a settlement is a decision and a restored status rests on maintainer-only and project-policy evidence. `triage.md` lists, per product family, how many unresolved gate occurrences the evidence supports settling (for example github-token 88 of 88, npm-token 32 of 32, gitlab-token 31 of 31, connection-string 21 of 21) as proposals only. **No status is restored; the 18 provisional families stay provisional**, and sendgrid-token also keeps its metamorphic and mutation failures (scope facts above).

## What the owner decides

1. Whether to accept this candidate (engine alpha.5, beta.13 pin) as the measured state. The evidence supports accepting it as an identity change: nothing moves.
2. Whether to turn the ledger proposals into rows (which would restore statuses on maintainer-only and project-policy evidence).
3. Product scope statements for the open families (#1203, #622).
4. Production stays on hold.
