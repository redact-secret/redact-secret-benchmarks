# #428 final public-gate record: core `1db8ff38`

**All six PII families stay `pending`.** Every public gate that is not about cost passes on the exact final candidate, including the #451 `net-p-port-suffix` case in the network-address populations. Two cost gates block promotion, and the protected partition is unspent.

This record adds files next to [`final-core-1127bf91.md`](final-core-1127bf91.md), which it supersedes for the release decision, and edits no earlier evidence. It makes no support claim. PII numerators and denominators are the only counts in it, and no credential count is merged into them. Mode: candidate build (isolated tarballs from the commit), not the published package.

## Candidate and evidence

- **Source.** `redact-secret/redact-secret` `1db8ff38b16e50c51229eb27025452952bf621e1` (merge of #958 on top of `1127bf91`: #950 performance work, #936, #949). The version string is still `0.1.0-beta.10`; no beta.11 release exists.
- **Artifact set** `8106c9ad…b1e3`. Core `4681ad42…d29a1`, node `771a63eb…9903b`, wasm `af063366…b1a1`.
- **Freeze** [`core-1db8ff38b16e/pii-beta11-freeze-v2.json`](core-1db8ff38b16e/pii-beta11-freeze-v2.json), commitment `df31dec8…9d84b`, committed at `83adea20` before any scan. Plan set `b11-population-v2`.
- **Measurement.** [observation](core-1db8ff38b16e/pii-beta11-observation-v2.json), [operational](core-1db8ff38b16e/pii-beta11-operational-v2.json), [report](core-1db8ff38b16e/pii-beta11-report-v2.json) (`37b0a8cc…c1add`) and [disposition](core-1db8ff38b16e/pii-beta11-disposition-v2.json). `tests/pii-beta11.test.mjs` re-derives the report and disposition.
- **Parity (#427).** [`../427/mixed-parity-core-1db8ff38b16e-plan-v2-report-v1.json`](../427/mixed-parity-core-1db8ff38b16e-plan-v2-report-v1.json): Node addon, Node Wasm, browser Wasm (Chrome 154), Python, Rust and CLI all agree and meet expectations in both selections (16/16 per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors). PII-off leaves credential output unchanged.
- **Peers.** Peer binaries came from `npm run peers:provision` (trufflehog `3.97.4`, gitleaks `8.30.1`, read-only directory first on `PATH`). The harness does not read peer scanners.

## Six-family matrix

Profile `pii-v1`, context `pii-context/v2` (en, ko). Cells read sensitive detected, then false alarms over non-sensitive plus not-established cases (reviewed view, Node addon, `pii:global`+`pii:us`).

| Family | Scope | Status | Failed or withheld gates | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- | --- |
| network-address | global | pending | runtime-and-package-cost (not-met), profile-cost (unresolved), protected-partition (not-run) | 41/41, FA 0/56 | 24/24, FA 0/56 |
| email | global | pending | same three | 44/44, FA 0/42 | 12/12, FA 0/39 |
| payment-card | global | pending | same three | 71/71, FA 0/90 | 13/13, FA 0/42 |
| iban | global | pending | same three | 39/39, FA 0/54 | 5/5, FA 0/45 |
| us-ssn | `us` only | pending | same three | 9/9, FA 0/10 | 7/7, FA 0/22 |
| phone | global (NANP `+1`) | pending | same three | 9/9, FA 0/12 | 7/7, FA 0/27 |

Every other gate is met for all six: exact-candidate binding, activation-v2, PII-off invariance, oracle-plan stream, identity-only classification, source/artifact equivalence, cross-surface determinism, both populations, no-regression, mass resolved, authored-truth agreement, contract-fixture discrepancy, cross-surface output, default-wasm-excludes-pii, size-regression-budget (every regressing row is covered by the #143 accepted-tradeoff ledger), trusted accounting source and independent evidence. Runtime medians pass on every surface.

## Package budget (`qualification/pii-national-id-arrival-v1.json` `packageBytes`, 32,768 B per package)

**Not met at `1db8ff38`.** Paired local build, packed tarball bytes, baseline to candidate:

| Package | Baseline | Candidate | Increase | Budget | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| core | 40,554 | 41,650 | +1,096 | 32,768 | within |
| node-darwin-arm64 | 589,697 | 629,737 | +40,040 | 32,768 | **over by 7,272** |
| wasm | 559,573 | 871,030 | +311,457 | 32,768 | over; the #143 ledger accepts it (`beta11-npm-wasm-packed-pii-split-and-detectors`), the 32 KB budget is not relaxed |

The node tarball is not reproducible between builds, so the node figure is per run. The wasm package now carries four payloads: default full and common (521,777 and 341,255 B raw, both reject `pii:global` with `PII_SELECTOR_UNAVAILABLE`), plus the two `_pii` builds that activate the frozen v2 identity.

## Protected partition

Not run, and no custodian corpus exists for any family. Every family is eligible except for cost alone and stays unspent at 0/1 with reason `public-gates-failed: runtime-and-package-cost, profile-cost`. Nothing here is a pass. Epoch commitments are in the freeze.

## Support projection and site copy

No status changes, so nothing was regenerated: all six families remain `pending` in `pii-support-matrix-v2`.

## To unblock

1. Dispatch the official `pii-profile-cost-v2` workflow on a pushed ref that contains this record and its `qualification/pii-profile-cost-v2.json` binding, then bind its runs and rescore (`--rescore=true`). If the plan's `benchmarkBaseCommit` needs to name a commit on the merged line, re-point it first.
2. Product decision on the node and wasm package budgets: reduce the packages, or amend the budget in a reviewed change. A new candidate needs a new freeze and epoch.
3. The maintainer or custodian registers a protected corpus (at least 20 cases per family, 120 total) for the global families.
