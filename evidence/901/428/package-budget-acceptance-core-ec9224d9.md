# #428 / #448: accepted PII package-budget overrun at core `ec9224d9`

This record carries the beta.11 acceptance of the PII package-size overrun from [`package-budget-acceptance-core-8f97f14d.md`](package-budget-acceptance-core-8f97f14d.md) to the re-bound candidate `ec9224d9743066fe73d6e61e9843ef52bd853833` (product `main` after redact-secret#994), with the sizes measured at this commit. It changes no measurement, no budget and no frozen expectation, and it makes no support claim. Mode: candidate build (isolated tarballs from the commit), not the published package.

## Decision

The maintainer accepted the overrun for beta.11 at `1db8ff38` and deferred shrinking to the next version (verbatim decision in the `1db8ff38` record); the acceptance was carried to `8f97f14d`. For this candidate the Beta.11 orchestrator relayed on 2026-09-29 that the maintainer accepted the Beta.11 package growth and that the acceptance is re-recorded at the new candidate. PR #994 (#948, #993, #902, #896) ships in beta.11 by maintainer decision.

## Numbers

Budget: `qualification/pii-national-id-arrival-v1.json` `operational.packageBytes`, maximum paired increase 32,768 B per package. Paired local build, packed tarball bytes ([`disposition`](core-ec9224d97430/pii-beta11-disposition-v2.json), [`operational`](core-ec9224d97430/pii-beta11-operational-v2.json)).

| Package | Baseline | Candidate | Increase | Over by | At `8f97f14d` (increase) | Change | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| core | 40,554 | 41,901 | +1,347 | none | +1,347 | 0 | within |
| node-darwin-arm64 | 589,675 | 655,723 | +66,048 | 33,280 | +46,225 | +19,823 | accepted |
| wasm | 559,573 | 917,465 | +357,892 | 325,124 | +327,676 | +30,216 | accepted |

On the candidate side the node tarball grew 3.1 percent (635,901 to 655,723 B) and the wasm tarball 3.4 percent (887,249 to 917,465 B). This step is larger than the #991/#992 step (1.0 and 1.9 percent).

Where the Wasm growth comes from: raw Wasm in the product's own Artifact qualification runs.

| Build | `8f97f14d` (run 36553444981) | `ec9224d9` (run 36570726765) | Change |
| --- | ---: | ---: | ---: |
| default full | 534,232 | 542,375 | +8,143 (+1.5%) |
| default common | 348,254 | 356,406 | +8,152 (+2.3%) |
| full `_pii` | 819,740 | 860,700 | +40,960 (+5.0%) |
| common `_pii` | 633,823 | 674,876 | +41,053 (+6.5%) |

gzip-9 of the default builds went from 184,422 to 187,248 B (full, +1.5%) and 125,295 to 127,661 B (common, +1.9%). The default builds carry no PII code, so their +8.1 KB is the credential work (#948 provider-named fallback, #993 non-secret exclusions). The `_pii` builds grew about 32.8 KB more than the defaults; that extra is PII-only code, which in this range is #902 (per-line linear PII context association). This attribution is by subtraction, not by a per-PR build.

## Where it is recorded

As before, the mechanism is the #143 ledger `benchmarks/accepted-regressions.json`, where one row accepts one trigger against baseline `0.1.0-beta.8` for one candidate commit. The rows for this commit come from the credential re-bind (`beta11/rebind-ec9224d-credentials`):

| Package | Ledger row | Trigger |
| --- | --- | --- |
| wasm | `beta11-ec9224d-npm-wasm-packed` (expected id) | `size/npm/wasm/packed` |
| node-darwin-arm64 | `beta11-ec9224d-npm-node-darwin-arm64-packed` (expected id) | `size/npm/node-darwin-arm64/packed` |

When this record was written, that branch had not yet added `ec9224d9` rows, so the committed [report](core-ec9224d97430/pii-beta11-report-v2.json) still reads `runtime-and-package-cost` and `size-regression-budget` as `not-met`. After those rows are merged, re-derive the report and disposition without measuring again:

```sh
npm run pii:beta11 -- --core-commit=ec9224d9743066fe73d6e61e9843ef52bd853833 \
  --core-repo=<absolute path to a redact-secret clone> --role=final --rescore=true
```

`b11AcceptedTradeoff` reads the rows unchanged. The 32,768 B budget is not relaxed: the gate reason still names each overrun and its ledger row. No scoring code changed for this record.

## Follow-up

Reducing the wasm and node package sizes remains deferred to the next version.
