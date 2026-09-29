# #428 / #448: accepted PII package-budget overrun at core `8f97f14d`

> **Superseded** for the release decision by [`package-budget-acceptance-core-ec9224d9.md`](package-budget-acceptance-core-ec9224d9.md) and [`final-core-ec9224d9.md`](final-core-ec9224d9.md): the Beta.11 candidate moved to core `ec9224d9` (redact-secret #994). This record stays as history.

This record carries the beta.11 acceptance of the PII package-size overrun from [`package-budget-acceptance-core-1db8ff38.md`](package-budget-acceptance-core-1db8ff38.md) to the re-bound candidate `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`, with the sizes measured at this commit. It changes no measurement, no budget and no frozen expectation, and it makes no support claim. Mode: candidate build (isolated tarballs from the commit), not the published package.

## Decision

The maintainer accepted the overrun for beta.11 at `1db8ff38` and deferred shrinking to the next version (verbatim decision in the `1db8ff38` record). For the re-bound candidate, the Beta.11 orchestrator relayed on 2026-09-29: re-record the acceptance at the new candidate with the new measured sizes, which are expected to differ slightly (#983 grew the release Wasm about 1 percent), and report instead of accepting if the overrun grew materially beyond that. Both product PRs after `1db8ff38` (#991 and #992) ship in beta.11 by maintainer decision.

## Numbers

Budget: `qualification/pii-national-id-arrival-v1.json` `operational.packageBytes`, maximum paired increase 32,768 B per package. Paired local build, packed tarball bytes ([`disposition`](core-8f97f14d97d7/pii-beta11-disposition-v2.json), [`operational`](core-8f97f14d97d7/pii-beta11-operational-v2.json)).

| Package | Baseline | Candidate | Increase | Over by | At `1db8ff38` (increase) | Change | Result |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| core | 40,554 | 41,901 | +1,347 | none | +1,096 | +251 | within |
| node-darwin-arm64 | 589,676 | 635,901 | +46,225 | 13,457 | +40,040 | +6,185 | accepted |
| wasm | 559,573 | 887,249 | +327,676 | 294,908 | +311,457 | +16,219 | accepted |

The node baseline tarball is not reproducible between builds (589,697 B at `1db8ff38`, 589,676 B here). On the candidate side the node tarball grew 1.0 percent (629,737 to 635,901 B) and the wasm tarball 1.9 percent (871,030 to 887,249 B).

Where the Wasm growth comes from: raw Wasm in the product's own Artifact qualification runs.

| Build | `1db8ff38` (run 36480272622) | `37a1dcd7`, #991 (run 36547279124) | `8f97f14d`, #992 (run 36553444981) |
| --- | ---: | ---: | ---: |
| default full | 521,777 | 530,850 (+1.7%) | 534,232 (+0.6%) |
| default common | 341,247 | 347,370 (+1.8%) | 348,254 (+0.3%) |
| full `_pii` | 807,866 | 816,291 (+1.0%) | 819,740 (+0.4%) |
| common `_pii` | 627,322 | 632,871 (+0.9%) | 633,823 (+0.2%) |

`04b3e212`, the product commit before #991, has the same Wasm as `1db8ff38`. gzip-9 of the default builds went from 179,388 to 184,422 B (full, +2.8%) and 122,544 to 125,295 B (common, +2.2%). Over the two PRs the growth is somewhat larger than the "about 1 percent" in the relayed decision. All of it comes from the two approved PRs (#991 about 1.7 percent, #992 about 0.5 percent of raw), and no new payload was added. This record treats that as the expected slight change and carries the acceptance. **The orchestrator should confirm this reading.** If it does not, reverting this record and the two ledger rows below returns `runtime-and-package-cost` to `not-met`.

Processing time: see `evidence/860/8f97f14-verified/regression-budgets.md` on the credential re-bind branch. The PII runtime medians of the paired local build pass on every surface ([report](core-8f97f14d97d7/pii-beta11-report-v2.json) `cost.runtimeComparisons`).

## Where it is recorded

As at `1db8ff38`, the mechanism is the #143 ledger `benchmarks/accepted-regressions.json`, where one row accepts one trigger against baseline `0.1.0-beta.8` for one candidate commit. The rows for this commit come from the credential re-bind (`beta11/rebind-8f97f14-credentials`, commit `9b60041`, merged into this branch):

| Package | Ledger row | Trigger |
| --- | --- | --- |
| wasm | `beta11-8f97f14-npm-wasm-packed` | `size/npm/wasm/packed` |
| node-darwin-arm64 | `beta11-8f97f14-npm-node-darwin-arm64-packed` | `size/npm/node-darwin-arm64/packed` |

`b11AcceptedTradeoff` reads them unchanged. The 32,768 B budget is not relaxed: the gate reason still names each overrun and its ledger row. No scoring code changed for this record.

## Follow-up

Reducing the wasm and node package sizes remains deferred to the next version.
