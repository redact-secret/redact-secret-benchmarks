# PII dual-run parity acceptance — 2026-10-03

> Update 2026-10-05: the schema 1.2 blocker described below is resolved and the four benchmark populations ran through both engines. The current record is [2026-10-05-pii-eval-population-dual-run.md](2026-10-05-pii-eval-population-dual-run.md). The text below is the 2026-10-03 state, kept as history.

This is the benchmark-owned acceptance record for #664. It is sanitized, contains only public synthetic identities and aggregate counts, and makes no product support claim.

## Result

| Layer | Result | Classification |
| --- | --- | --- |
| Same-observation compatibility protocol | 0 differences across 540 outcome rows, 181 ten-metric comparisons and 660 statistics vectors | accepted compatibility evidence |
| Canonical revision 2 versus oracle | 85 intentional contract revisions, 32 old oracle bugs, 85 compatibility representations, 0 new bugs, 0 unresolved, 0 unexplained | fully classified upstream evidence |
| Deterministic reruns | equal semantic digest at one and four workers and repeated CLI output | accepted |
| Actual benchmark populations | four identities and six plan files frozen; counts and source observations content-pinned | benchmark input accepted |
| Actual benchmark populations through `pii-eval` | not representable in public artifact schema 1.1 because family/view projections and run mode are absent | superseded 2026-10-05: schema 1.2 landed and the populations ran, see [the dual-run report](2026-10-05-pii-eval-population-dual-run.md) |

The first three rows reproduce the pinned TypeScript oracle only under the named compatibility protocol. Canonical revision behavior is separate. The upstream single-population result supports this review but does not substitute for the last two rows.

## Immutable pins and reproduction

All hashes and commits are in `benchmarks/pii-eval-migration.json` and checked by `npm run pii:migration:check`. The exact upstream commands are:

```sh
git clone git@github.com:redact-secret/pii-eval.git
cd pii-eval
git checkout 6157cbc5918b3888c8e84b1884719ea8f3278b36
test "$(shasum -a 256 Cargo.lock | cut -d' ' -f1)" = e646a917c7dc8a5d5f5744bbfc56456661ebeb5505ac18788b7d5262f29a956a
cargo test -p pii-eval-cli --locked --test oracle_parity --test oracle_parity_cli --test oracle_parity_docs --test real_scanner
```

For the real scanner opt-in run, use the handoff's hermetic install command. It pins `@redact-secret/core` 0.1.0-beta.12, its npm integrity and extracted tree digest; do not substitute the current release. The run is public synthetic only.

## Exact additive upstream request

Schema 1.2 needs a closed optional product-projection block whose rows carry `family`, `view` (`oracle-plan`, `qualification-plan`, `diagnostic-balanced`, `benign-heavy-stress`), case/variant counts, method coverage, all ten metric results with integer counts/effective N/interval or withheld reason, and `mode` (`official` or `exploratory`). Each row must remain inside one population artifact and its semantic digest. The consumer tests must reject duplicate family/view rows, absent required views, pooled denominators, unknown modes and a row whose scanner/configuration/activation/candidate/population binding differs from the artifact.

Until that additive contract exists and the four pinned populations are run, #664 is not closed. No threshold, tolerance, case, denominator or population is changed to avoid the blocker.
