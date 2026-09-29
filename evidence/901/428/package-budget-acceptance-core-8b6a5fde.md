# #428 / #448: accepted PII package-budget overrun at core `8b6a5fde`

This record carries the beta.11 acceptance of the PII package-size overrun to the re-bound candidate `8b6a5fde52ecb4dfce13f09c7a947062d21483c7` (product `main` after redact-secret#996), with the sizes measured at this commit. It supersedes [`package-budget-acceptance-core-ec9224d9.md`](package-budget-acceptance-core-ec9224d9.md), which stays as intermediate history. It changes no measurement, no budget and no frozen expectation, and it makes no support claim. Mode: candidate build (isolated tarballs from the commit), not the published package.

## Decision

The maintainer accepted the overrun for beta.11 at `1db8ff38` and deferred shrinking to the next version (verbatim decision in the `1db8ff38` record). The acceptance was carried to `8f97f14d`. The Beta.11 orchestrator relayed on 2026-09-29 that the maintainer accepted the Beta.11 package growth, and that the acceptance is re-recorded at each new candidate. #994 and #996 ship in beta.11.

## Numbers

Budget: `qualification/pii-national-id-arrival-v1.json` `operational.packageBytes`, maximum paired increase 32,768 B per package. Paired local build, packed tarball bytes ([`disposition`](core-8b6a5fde52ec/pii-beta11-disposition-v2.json), [`operational`](core-8b6a5fde52ec/pii-beta11-operational-v2.json)).

| Package | Baseline | Candidate | Increase | Over by | At `8f97f14d` | At `ec9224d9` | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| core | 40,554 | 41,901 | +1,347 | none | +1,347 | +1,347 | within |
| node-darwin-arm64 | 589,675 | 649,395 | +59,720 | 26,952 | +46,225 | +66,048 | accepted |
| wasm | 559,573 | 900,829 | +341,256 | 308,488 | +327,676 | +357,892 | accepted |

Against `8f97f14d`, the node tarball is 13.5 KB larger (+2.1%) and the wasm tarball 13.6 KB larger (+1.5%). #996 took back about 6.3 KB and 16.6 KB of the #994 growth.

Raw Wasm in the product's own Artifact qualification runs:

| Build | `8f97f14d` (run 36553444981) | `ec9224d9` (run 36570726765) | `8b6a5fde` (run 36581019627) |
| --- | ---: | ---: | ---: |
| default full | 534,232 | 542,375 | 542,445 |
| default common | 348,254 | 356,406 | 356,476 |
| full `_pii` | 819,740 | 860,700 | 833,741 (+1.7% on `8f97f14d`) |
| common `_pii` | 633,823 | 674,876 | 647,875 (+2.2%) |

gzip-9 of the `_pii` builds: full 305,065 → 318,323 → 310,056; common 243,752 → 256,694 → 248,463. The default builds (+8.2 KB raw from `8f97f14d`) carry no PII code, so that part of the growth is #948/#993 credential work. The `_pii` builds carry about 5.8 KB more than the defaults on top of that, which is the #902 PII code after the #996 reduction.

## Where it is recorded

The mechanism is the #143 ledger `benchmarks/accepted-regressions.json`, where one row accepts one trigger against baseline `0.1.0-beta.8` for one candidate commit. The rows for this commit must come from the credential re-bind: `size/npm/wasm/packed` and `size/npm/node-darwin-arm64/packed`, and for `size-regression-budget` also `size/wasm/full/gzip` and `size/wasm/common/gzip`, each with `candidate.sourceCommit` `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`. When this record was written, those rows did not exist, so the committed [report](core-8b6a5fde52ec/pii-beta11-report-v2.json) still reads `runtime-and-package-cost` and `size-regression-budget` as `not-met`. After the rows are merged, re-derive the report and disposition without measuring again:

```sh
npm run pii:beta11 -- --core-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 \
  --core-repo=<absolute path to a redact-secret clone> --role=final --rescore=true
```

The 32,768 B budget is not relaxed, and no scoring code changed for this record.

## Follow-up

Reducing the wasm and node package sizes remains deferred to the next version.
