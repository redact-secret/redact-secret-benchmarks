# #428 / #448: accepted PII package-budget overrun at core `1db8ff38`

> **Superseded** for the release decision by [`final-core-8f97f14d.md`](final-core-8f97f14d.md): the Beta.11 candidate moved to core `8f97f14d` (redact-secret #991 and #992). This record stays as history.

This record accepts, for beta.11 only, the PII package-size overrun that [`final-core-1db8ff38.md`](final-core-1db8ff38.md) reported as `not-met`. It records a maintainer decision. It changes no measurement, no budget and no frozen expectation, and it makes no support claim. Mode: candidate build (isolated tarballs from the commit), not the published package.

## Approving decision (verbatim)

Maintainer decision, 2026-09-28/29, relayed by the Beta.11 orchestrator session:

> PII package size over the 32 KB packageBytes budget at candidate 1db8ff3 (node-darwin-arm64 +40,040 B; wasm +311,457 B; core within) is ACCEPTED for this version (beta.11); improvement is deferred to the next version. Do not shrink payloads now.

Scope: exactly candidate `1db8ff38b16e50c51229eb27025452952bf621e1`. A different source commit is judged afresh.

## Numbers

Budget: `qualification/pii-national-id-arrival-v1.json` `operational.packageBytes`, maximum paired increase 32,768 B per package. Paired local build, packed tarball bytes ([`disposition`](core-1db8ff38b16e/pii-beta11-disposition-v2.json), [`operational`](core-1db8ff38b16e/pii-beta11-operational-v2.json)).

| Package | Baseline | Candidate | Increase | Budget | Over by | Result |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| core | 40,554 | 41,650 | +1,096 | 32,768 | none | within |
| node-darwin-arm64 | 589,697 | 629,737 | +40,040 | 32,768 | 7,272 | accepted |
| wasm | 559,573 | 871,030 | +311,457 | 32,768 | 278,689 | accepted |

The node tarball is not reproducible between builds, so its figure is per run (the #143 row measured 629,779 B on another pack of the same commit).

Processing time: no processing-time row was over budget at `1db8ff38` (`evidence/860/1db8ff3-verified/regression-budgets.md`: latency 10 within, 0 regression; initialization 10 within; memory 16 within). No row is recorded for it, by design.

## Reason and benefit

- Reason. The wasm package ships four payloads: default full and common (521,777 and 341,255 B raw, both reject `pii:global` with `PII_SELECTOR_UNAVAILABLE`) plus the two `_pii` builds that carry the frozen v2 identity (redact-secret#937 split). Every build carries the provider detectors added across beta.9 to beta.11. The native addon compiles the PII runtime in by design and carries the same detectors.
- Benefit. A default browser `initialize()` never fetches the PII runtime, and PII selection works on native builds without a separate artifact. Beta.11 adds 13 provider credential detectors.

## Where it is recorded

The mechanism is the #143 ledger, `benchmarks/accepted-regressions.json`, which accepts one trigger, against one baseline, for one candidate commit. Its trigger ids come from `regression-budgets-v1`, so no PII-only trigger can be added there. The two ledger rows for this candidate already cover the same artifact measures:

| Package | Ledger row | Trigger |
| --- | --- | --- |
| wasm | `beta11-npm-wasm-packed-pii-split-and-detectors` | `size/npm/wasm/packed` |
| node-darwin-arm64 | `beta11-npm-node-darwin-arm64-packed-detectors` | `size/npm/node-darwin-arm64/packed` |

Before this change only the wasm row was read by the #428 `runtime-and-package-cost` gate. `b11AcceptedTradeoff` now also reads the `size/npm/node-<platform>/packed` row for this exact commit and platform, for the `nodePacked` byte row, under the same matching rule. The 32,768 B budget is not relaxed: the gate reason still names each overrun and its ledger row, and a different commit or platform is not waived (`tests/pii-beta11.test.mjs`).

This edits scoring code after the freeze at `83adea20`. The freeze lists `beta11-disposition.ts` by hash for provenance; the hash no longer matches, as it did not for the `1127bf91` freeze after `a84c7ed`. The observation and operational evidence are untouched, and the report and disposition are re-derived from them with `--rescore=true`.

## Corrections

- Issue #448's body cites WASM gzip 176,402 (full) and 120,688 (common). The recorded values, in the ledger rows and in the `1db8ff38` regression-budget report, are 179,388 and 122,544 (baselines 137,639 and 100,058). The ledger values stand.
- Issue #448 says `+302 KB` wasm and `+34 KB` node, from the `1127bf9` run. At `1db8ff38` they are +311,457 B and +40,040 B.

## Follow-up

Reducing the wasm and node package sizes is deferred to the next version. Do not shrink payloads for beta.11. Reopening this needs a new candidate, a new freeze and a new epoch.
