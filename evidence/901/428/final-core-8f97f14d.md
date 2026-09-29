# #428 final public-gate record: core `8f97f14d`

**All six PII families stay `pending`, with exactly the disposition they had at `1db8ff38`.** Every public gate except `profile-cost` passes on the exact final candidate. `profile-cost` is `not-met` on the official Linux workflow, as it was at `1db8ff38`. The protected partition is unspent and not eligible.

This record re-binds the #428 evidence to the new Beta.11 candidate. It supersedes [`final-core-1db8ff38.md`](final-core-1db8ff38.md), [`profile-cost-v2-core-1db8ff38.md`](profile-cost-v2-core-1db8ff38.md) and [`package-budget-acceptance-core-1db8ff38.md`](package-budget-acceptance-core-1db8ff38.md) for the release decision, and edits no earlier evidence beyond a superseded note at their top. It makes no support claim. PII numerators and denominators are the only counts in it. Mode: candidate build (isolated tarballs from the commit, and qualified product run 36553444981 for the CI rows and the official workflow), not the published package.

## Candidate and evidence

- **Source.** `redact-secret/redact-secret` `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`, product `main` after #991 (the #980 performance backlog: #981 to #986) and #992 (#990: streamed output equals the whole-input scan on the #985 partition gaps). The version string is still `0.1.0-beta.10`; no beta.11 release exists.
- **Artifact set** `699ca0eb…f534`. Core `467111e2…f74c`, node `4cf90bba…2927`, wasm `b6819bfd…1e966`. CI qualification run 36553444981, inventory `6118d148…197e`.
- **Freeze** [`core-8f97f14d97d7/pii-beta11-freeze-v2.json`](core-8f97f14d97d7/pii-beta11-freeze-v2.json), commitment `cf50196d…67cc`, committed at `aad71e0c` before any scan. Plan set `b11-population-v2`, the same as at `1db8ff38`. The freeze records two changed product contract hashes: `docs/contracts/pii/phone-v1.md` (one clarifying sentence from #990: a word marker `ext`/`x` at a line end is an empty extension) and `docs/specs/contextual-detection.md` (three #990 rows on credential detectors).
- **Measurement.** [observation](core-8f97f14d97d7/pii-beta11-observation-v2.json), [operational](core-8f97f14d97d7/pii-beta11-operational-v2.json), [report](core-8f97f14d97d7/pii-beta11-report-v2.json) and [disposition](core-8f97f14d97d7/pii-beta11-disposition-v2.json). `tests/pii-beta11.test.mjs` re-derives the report and disposition.
- **Parity (#427).** [`../427/mixed-parity-core-8f97f14d97d7-plan-v2-report-v1.json`](../427/mixed-parity-core-8f97f14d97d7-plan-v2-report-v1.json), plan v2: Node addon, Node Wasm, browser Wasm (Chrome 154), Python, Rust and CLI all agree and meet expectations in both selections (16/16 per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors; CLI 48/48). PII-off leaves credential output unchanged. Apart from commits and artifact hashes, the report is identical to the `1db8ff38` one.
- **Peers.** `npm run peers:provision` (trufflehog `3.97.4`, gitleaks `8.30.1`, read-only `.peer-bin` first on `PATH`) for the freeze and measurement. The harness does not read peer scanners.

## Six-family matrix

Profile `pii-v1`, context `pii-context/v2` (en, ko). Cells: sensitive detected, then false alarms over non-sensitive plus not-established cases (reviewed view, Node addon, `pii:global`+`pii:us`).

| Family | Scope | Status | Failed or withheld gates | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- | --- |
| network-address | global | pending | profile-cost (not-met), protected-partition (not-run) | 41/41, FA 0/56 | 24/24, FA 0/56 |
| email | global | pending | same two | 44/44, FA 0/42 | 12/12, FA 0/39 |
| payment-card | global | pending | same two | 71/71, FA 0/90 | 13/13, FA 0/42 |
| iban | global | pending | same two | 39/39, FA 0/54 | 5/5, FA 0/45 |
| us-ssn | `us` only | pending | same two | 9/9, FA 0/10 | 7/7, FA 0/22 |
| phone | global (NANP `+1`) | pending | same two | 9/9, FA 0/12 | 7/7, FA 0/27 |

Every other gate is met for all six, the same list as at `1db8ff38`: exact-candidate binding, activation-v2, PII-off invariance, oracle-plan stream, identity-only classification, source/artifact equivalence, cross-surface determinism, both populations, no-regression, mass resolved, authored-truth agreement, contract-fixture discrepancy, cross-surface output, default-wasm-excludes-pii, runtime-and-package-cost (package overrun accepted, below), size-regression-budget (every regressing #143 row covered by an `8f97f14d` ledger row) and trusted accounting source and independent evidence.

## Comparison with `1db8ff38`, family by family

- **Outcomes.** The `families` section of the observation (every case of the oracle plan, both populations and the identity seam, on every lane) is identical to the `1db8ff38` observation once commits and artifact hashes are removed. No family gained or lost a detection, a false alarm or a span.
- **Phone.** The intended #990 change (a word marker `ext` or `x` at a line end is an empty extension on both paths, and a lone `\r` ends a line) changes no case in the frozen phone plans, populations or the #427 mixed documents. Phone stays 14/14 oracle, 9/9 and 7/7, with no false alarm.
- **Gates.** The met and failed gate lists match the `1db8ff38` final disposition (after its profile-cost binding) exactly for all six families. No gate that passed at `1db8ff38` fails here.
- **Before the ledger rows.** Scored against `develop` alone, before the `8f97f14d` rows of `benchmarks/accepted-regressions.json` (credential re-bind branch `beta11/rebind-8f97f14-credentials`, merged here), `size-regression-budget` and `runtime-and-package-cost` read `not-met`, because the ledger names one candidate commit per row. The committed report is the rescore with those rows.

## Package budget (#448)

Re-recorded at this commit in [`package-budget-acceptance-core-8f97f14d.md`](package-budget-acceptance-core-8f97f14d.md): node-darwin-arm64 +46,225 B and wasm +327,676 B over the 32,768 B `packageBytes` budget, accepted through the `8f97f14d` ledger rows; core within.

## Profile cost v2 (official workflow)

Plan [`qualification/pii-profile-cost-v2.json`](../../../qualification/pii-profile-cost-v2.json) bound to this candidate (qualification run 36553444981, inventory `6118d148…197e`, `benchmarkBaseCommit` `e4bb1dd9` on `develop`), commitment `96fc24b1…a612`. Dispatched on ref `beta11/rebind-8f97f14-pii` at head `58a9abe5`; no workflow file was edited. Runs ([`pii-profile-cost-v2-runs.json`](core-8f97f14d97d7/pii-profile-cost-v2-runs.json)): A/A 36554838004, 36554846120, 36554853290; freeze 36557434273; candidate 36557492406; size 36554861842. All succeeded, and every report carries the plan commitment and this source commit. The workflow provisions pinned trufflehog 3.97.4 itself.

| Gate | `1db8ff38` | `8f97f14d` |
| --- | --- | --- |
| runtime/memory verdict | regression: 162 of 640 cells regress, 342 within, 136 n/a, 0 invalid | regression: 162 of 640 regress, 342 within, 136 n/a, 0 invalid |
| size vs pre-PII `f26dee26` | 41 regressing rows, 3 covered by the ledger, 38 open | the same 41 rows, the same 3 covered, the same 38 open; no row changed verdict |
| profile-cost | not-met | not-met |

Regressing cells by surface: rust-native 32, node-native 32, node-wasm 31, chromium-wasm 41, python 18, cli 8. By metric: whole-input 80, incremental 65, initialize 13, memory 4. Six cells changed verdict in each direction (three initialize cells in Chromium and three peak-RSS cells now regress; six others no longer do), which is run-to-run spread.

The activation-cost cells compare PII on against PII off in the same artifact. The PII-on processing time itself did not grow. Geometric mean of PII-on medians, `8f97f14d` over `1db8ff38`, per surface: whole input 0.94 (rust), 0.96 (node native), 0.98 (node Wasm), 1.02 (Chromium), 0.91 (Python), 0.40 (CLI); incremental 0.47 to 0.66. The activation ratios grew because PII-off got faster (#980 cut PII-off whole-input time by about 40 to 75 percent), so the largest ratio is now 173.9 (`node-native/common/beta10-full/validator-heavy` whole input, PII on 338.8 ms against PII off 1.95 ms), up from 147.5. The only whole-input cell where PII-on is more than 5 percent slower is `node-native/common/us-ssn-exact/validator-heavy` (69.9 to 79.1 ms). The same workload is faster on every other surface. Initialize medians rose by the same amount with PII on and off (node native +11 percent, rust +0.02 ms), so that change is not PII activation cost.

The open size rows and the activation-cost regressions are the same maintainer decision as at `1db8ff38`, which this record does not make.

## Protected partition

Not run. No custodian corpus is registered for any family, and the partition stays unspent: every epoch is 0/1, with reason `public-gates-failed: profile-cost`. Epoch commitments are in the freeze.

## Support projection and site copy

No status changes, so nothing was regenerated: all six families remain `pending` in `pii-support-matrix-v2`.
