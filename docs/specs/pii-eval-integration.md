# PII evaluator ownership and integration contract

Status: benchmark-side acceptance for #661–#665. This document records measurement; it does not switch PII authority or assert product output.

## Ownership

| Owner | Owns | Does not own here |
| --- | --- | --- |
| `pii-eval` | Scanner-neutral cases, variants, findings, observations, two outcome axes, seven methods, ten `pii-v1` metrics, accounting, replay and versioned artifacts | Product populations, thresholds, support status, release decisions or protected authorization |
| benchmarks | Product populations and immutable pins, activation acceptance, candidate/release binding, thresholds, support decisions, publication and UI | A second generic PII engine or protected corpus access |
| private-custodian | Protected authorization, budgets, isolation, execution, signing, disclosure, freshness and revocation | Product thresholds or support verdicts |
| private-ledger | Private policy/audit export and validation at its reviewed custodian compatibility pin | A benchmark CI data source or public review ledger |

The file-level upstream inventory is accepted from `pii-eval` commit `6157cbc5918b3888c8e84b1884719ea8f3278b36`, `docs/migration/ownership-map.md`. Generic code stays in the legacy tree as the compatibility oracle until #666; it is not copied into a new benchmark engine. Product policy remains in `qualification/pii-v1.json`, `benchmarks/evaluation/domains/pii/{profile,qualification,support,support-v2,product-binding,protected-support-binding}.ts`, the product population plans, publication scripts and UI.

## Frozen identities

The machine-checked record is [`benchmarks/pii-eval-migration.json`](../../benchmarks/pii-eval-migration.json). It pins:

- oracle `4b846967346505baca11e0b98cab1475fbce6773` and `pii-eval` source `6157cbc5918b3888c8e84b1884719ea8f3278b36`;
- schema `pii-eval.public-synthetic-artifact` 1.1; canonical `pii-v1` revision 2 and compatibility revision 1;
- all seven method versions and ten metrics through the upstream handoff, with mechanics `minDenominator=4`, `replays=2`, `z=1.96`, precision 6;
- `redact-secret-core-node` adapter 1.0.0, normalization 1, scanner package 0.1.0-beta.12, fixed parameters and activation selectors `pii:global`, `pii:us` with their digests;
- current custodian and ledger source revisions reviewed for this integration.

The benchmark population source is the six-family `b11-population-v2` plan set. `oracle-plan`, `qualification-plan`, `diagnostic-balanced` and `benign-heavy-stress` remain distinct. Their six plan files, exact candidate report and observation are content-pinned; `npm run pii:migration:check` refuses drift.

## Acceptance and remaining work

The upstream compatibility run is accepted as scanner-neutral evidence: 37 cases, 54 variants, 540 outcomes, 181 metric comparisons and 660 statistics vectors have zero compatibility differences and zero unexplained canonical differences. Canonical differences remain classified as intentional revision, legacy bug or compatibility representation; thresholds, cases and denominators were not changed.

That run is not benchmark population acceptance. The benchmark record separately freezes 146 oracle-plan, 266 qualification-plan, 477 diagnostic-balanced and 299 benign-heavy-stress cases from the Beta.13 candidate report. Schema 1.1 cannot carry those view identities or per-family projections, so a four-population `pii-eval` dual run cannot yet be represented without inventing a mapping. #664 therefore remains blocked on the additive schema request in the parity report, while ownership/contracts are accepted and the independent consumer work proceeds.

Protected evidence is never read from private-ledger. The benchmark consumer accepts only bounded canonical custodian envelopes with signed v2 destination binding and a valid current feed. A signature establishes origin and integrity, not independent ground truth; the projection's configuration is not signed because the projection contract does not contain it.

## Commands

```sh
npm run pii:migration:check
npm test -- --test-name-pattern='PII migration'

# At the pinned pii-eval checkout, scanner-free parity evidence:
cargo test -p pii-eval-cli --locked --test oracle_parity --test oracle_parity_cli --test oracle_parity_docs --test real_scanner

# A local immutable engine build when cross-repository artifact access is unavailable:
cargo build --release --locked
shasum -a 256 Cargo.lock target/release/pii-eval
```

Cross-repository Actions artifacts require an explicit token or GitHub App installation with `actions:read` on the private `pii-eval` repository; another repository's `GITHUB_TOKEN` is insufficient. No credential or access setting is created by this integration.
