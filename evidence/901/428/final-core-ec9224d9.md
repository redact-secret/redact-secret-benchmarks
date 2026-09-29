# #428 final public-gate record: core `ec9224d9`

> **Superseded** for the release decision by [`final-core-8b6a5fde.md`](final-core-8b6a5fde.md): redact-secret#996 addressed the #902 Wasm regression recorded here, and the Beta.11 candidate moved to core `8b6a5fde`. This record stays as intermediate history.

**All six PII families stay `pending`. Detection outcomes are identical to `8f97f14d`. `profile-cost` stays `not-met`, and it is worse than at `8f97f14d` on the Wasm surfaces: 183 of 640 cells regress, against 162.** Whole-input PII cost fell 7 to 20 times on every surface (#902), but no whole-input cell reached its budget, and 23 cells that were within budget at `8f97f14d` now regress. They are Wasm incremental time, Node-Wasm peak and retained RSS, and Chromium initialize. Under the maintainer's rule that any regression is fixed, this record reports them and does not accept them. The protected partition is unspent and not eligible.

This record re-binds the #428 evidence to the new Beta.11 candidate. It supersedes [`final-core-8f97f14d.md`](final-core-8f97f14d.md) and [`package-budget-acceptance-core-8f97f14d.md`](package-budget-acceptance-core-8f97f14d.md) for the release decision, and edits no earlier evidence beyond a superseded note at their top. It makes no support claim. PII numerators and denominators are the only counts in it. Mode: candidate build (isolated tarballs from the commit, and qualified product run 36570726765 for the CI rows and the official workflow), not the published package.

## Candidate and evidence

- **Source.** `redact-secret/redact-secret` `ec9224d9743066fe73d6e61e9843ef52bd853833`, product `main` after #994 (#948 provider-named fallback, #993 non-secret exclusions, #902 linear PII context association, #896 scripts and docs). The version string is still `0.1.0-beta.10`.
- **Artifacts.** Core `467111e2…f74c` (unchanged from `8f97f14d`), node `74a7f661…6caf`, wasm `c3f54788…7d78`. CI qualification run 36570726765, inventory `8da107cd…d986`.
- **Freeze** [`core-ec9224d97430/pii-beta11-freeze-v2.json`](core-ec9224d97430/pii-beta11-freeze-v2.json), commitment `237f8ea6…c8dc`, committed at `fb3433d` before any scan. Plan set `b11-population-v2`, as before. No PII contract hash changed from `8f97f14d`; only sizes, artifact hashes, the crate tree and the epoch commitments differ.
- **Measurement.** [observation](core-ec9224d97430/pii-beta11-observation-v2.json), [operational](core-ec9224d97430/pii-beta11-operational-v2.json), [report](core-ec9224d97430/pii-beta11-report-v2.json) and [disposition](core-ec9224d97430/pii-beta11-disposition-v2.json), measured at `8926f5d`.
- **Parity (#427).** [`../427/mixed-parity-core-ec9224d97430-plan-v2-report-v1.json`](../427/mixed-parity-core-ec9224d97430-plan-v2-report-v1.json), plan v2: Node addon, Node Wasm, browser Wasm (Chrome 154), Python, Rust and CLI all agree and meet expectations in both selections (16/16 per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors; CLI 48/48). PII-off leaves credential output unchanged. With commits and hashes removed, the report and the observation are byte-identical to the `8f97f14d` ones.
- **Peers.** `npm run peers:provision` (trufflehog `3.97.4`, gitleaks `8.30.1`, read-only `.peer-bin` first on `PATH`) for the parity, freeze and measurement. The harness does not read peer scanners.

## Six-family matrix

Profile `pii-v1`, context `pii-context/v2` (en, ko). Cells: sensitive detected, then false alarms over non-sensitive plus not-established cases (reviewed view, Node addon, `pii:global`+`pii:us`). Unchanged from `8f97f14d`.

| Family | Scope | Status | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- |
| network-address | global | pending | 41/41, FA 0/56 | 24/24, FA 0/56 |
| email | global | pending | 44/44, FA 0/42 | 12/12, FA 0/39 |
| payment-card | global | pending | 71/71, FA 0/90 | 13/13, FA 0/42 |
| iban | global | pending | 39/39, FA 0/54 | 5/5, FA 0/45 |
| us-ssn | `us` only | pending | 9/9, FA 0/10 | 7/7, FA 0/22 |
| phone | global (NANP `+1`) | pending | 9/9, FA 0/12 | 7/7, FA 0/27 |

Failed or withheld gates, the same for all six: `profile-cost` (not-met), `protected-partition` (not-run), and, until the `ec9224d9` rows of `benchmarks/accepted-regressions.json` are merged from the credential re-bind, `runtime-and-package-cost` and `size-regression-budget` (not-met). At `8f97f14d` those last two were met through that commit's ledger rows, so they are pending bookkeeping, not a change of outcome. Every other gate is met for all six, the same list as at `8f97f14d`.

## Comparison with `8f97f14d`

- **Outcomes.** Every section of the observation except the timestamps (every case of the oracle plan, both populations and the identity seam, on every lane, plus the credential accounting) is identical to the `8f97f14d` observation once commits and artifact hashes are removed. No family gained or lost a detection, a false alarm or a span. #948 and #993 change credential output only, and no PII case or mixed-parity credential target moved.
- **Gates.** The met list matches `8f97f14d` for all six families. The not-met list adds the two ledger-bound cost gates until the credential re-bind merges.

## Package budget (#448)

Re-recorded in [`package-budget-acceptance-core-ec9224d9.md`](package-budget-acceptance-core-ec9224d9.md): node-darwin-arm64 +66,048 B and wasm +357,892 B over the 32,768 B `packageBytes` budget (+19,823 B and +30,216 B more than at `8f97f14d`); core within. The `_pii` Wasm builds grew about 41 KB raw each (+5.0% full, +6.5% common), about 32.8 KB more than the default builds.

## Profile cost v2 (official workflow)

Plan [`qualification/pii-profile-cost-v2.json`](../../../qualification/pii-profile-cost-v2.json) bound to this candidate (qualification run 36570726765, inventory `8da107cd…d986`, `benchmarkBaseCommit` `7598bf13` on `develop`), commitment `b2d70d27…e86a`. Dispatched on ref `beta11/rebind-ec9224d-pii` at head `41c4760d`; no workflow file was edited. Runs ([`pii-profile-cost-v2-runs.json`](core-ec9224d97430/pii-profile-cost-v2-runs.json)): A/A 36573058748, 36573062171, 36573066459; freeze 36574462251; candidate 36574535156; size 36573070782. All succeeded. Every report carries the plan commitment and this source commit. The workflow provisions pinned trufflehog 3.97.4 itself.

| Gate | `8f97f14d` | `ec9224d9` |
| --- | --- | --- |
| runtime/memory verdict | regression: 162 of 640 cells, 342 within, 136 n/a | regression: 183 of 640 cells, 321 within, 136 n/a, 0 invalid |
| of the 162 `8f97f14d` regression cells | | 160 still regress, 2 now within (both memory cells, within noise of the budget) |
| newly regressing | | 23 cells |
| size vs pre-PII `f26dee26` | 41 regressing rows, 3 covered by the ledger, 38 open | the same 41 rows regress, none changed verdict; 0 covered until the `ec9224d9` ledger rows merge (3 coverable, 38 open) |
| profile-cost | not-met | not-met |

Regressing cells by surface: rust-native 32, node-native 32, node-wasm 46, chromium-wasm 47, python 18, cli 8. By metric: whole-input 80 (every whole-input cell), incremental 72, memory 16, initialize 15.

### Whole input: 7 to 20 times faster, still over budget

Geometric mean of the PII-on whole-input median, `ec9224d9` over `8f97f14d`, on the same CPU (A/A runs 36573066459 and 36554838004, both AMD EPYC 7763): rust 0.053, node native 0.111, node Wasm 0.146, Chromium 0.144, Python 0.068, CLI 0.643. The budget compares PII on with PII off in the same artifact (+10 percent median), and PII off takes 1.9 to 25 ms, so every whole-input cell still regresses. Largest remaining ratios (candidate run 36574535156):

| Cell | PII on | PII off | Ratio | At `8f97f14d` |
| --- | ---: | ---: | ---: | ---: |
| node-native/common/us-jurisdiction/validator-heavy | 72.16 ms | 1.90 ms | 37.9 | 173.7 (339.0 / 1.95 ms) |
| node-native/common/beta10-full/validator-heavy | 72.13 ms | 1.91 ms | 37.8 | 173.9 (338.8 / 1.95 ms) |
| node-native/common/global/validator-heavy | 39.02 ms | 1.91 ms | 20.5 | 121.8 |
| node-native/common/us-ssn-exact/validator-heavy | 35.15 ms | 1.91 ms | 18.4 | 40.3 |
| node-native/full/beta10-full/validator-heavy | 75.00 ms | 4.82 ms | 15.6 | 67.6 |
| node-wasm/common/beta10-full/validator-heavy | 80.17 ms | 17.53 ms | 4.6 | 41.8 |
| rust-native/common/beta10-full/validator-heavy | 9.80 ms | 2.20 ms | 4.5 | 150.8 (305.7 / 2.03 ms) |
| chromium-wasm/common/beta10-full/validator-heavy | 75.40 ms | 18.70 ms | 4.0 | 40.8 |

The Node addon is now the outlier: the same `validator-heavy` workload takes 9.8 ms in Rust and 72 ms through the addon with `pii:us`.

### The 23 newly regressing cells (a regression against `8f97f14d`)

- **Wasm incremental, 7 cells.** node-wasm `full/us-ssn-exact` (validator-heavy, multilingual-context) and `common/us-ssn-exact/multilingual-context`; chromium-wasm `full/global/validator-heavy`, `full/us-ssn-exact` (both workloads), `common/us-ssn-exact/multilingual-context`. Example: `chromium-wasm/full/us-ssn-exact/validator-heavy` PII on 86.4 ms against PII off 67.2 ms (ratio 1.29, was 0.80).
- **Node-Wasm RSS, 13 cells** (`nodePeakRss` or `nodeRetainedRss`, PII on against PII off, budget +10 percent): now +10.1 to +15.9 percent (+8.2 to +12.7 MB), was +4.3 to +9.7 percent. Python `full/us-jurisdiction/validator-heavy` `processRetainedRss` +10.2 percent (was +9.3).
- **Chromium initialize, 2 cells** (`full/global` and `full/us-jurisdiction`, validator-heavy): ratios 1.31 and 1.26, were 1.22 and 1.24. These sit at the edge of the budget.

The Wasm incremental change is not runner noise. The candidate runs used different CPUs (`8f97f14d` on EPYC 9V74, `ec9224d9` on EPYC 7763), so the comparison uses the A/A runs on the same EPYC 7763 (PII on both sides, 24 samples per cell):

| Cell (PII-on incremental median) | `8f97f14d` | `ec9224d9` | Ratio |
| --- | ---: | ---: | ---: |
| chromium-wasm/full/us-ssn-exact/validator-heavy | 53.6 ms | 90.6 ms | 1.69 |
| chromium-wasm/common/us-ssn-exact/multilingual-context | 35.2 ms | 54.0 ms | 1.53 |
| chromium-wasm/full/us-ssn-exact/multilingual-context | 58.9 ms | 85.2 ms | 1.45 |
| node-wasm/full/us-ssn-exact/validator-heavy | 67.4 ms | 94.4 ms | 1.40 |
| node-wasm/common/us-ssn-exact/multilingual-context | 42.7 ms | 59.3 ms | 1.39 |
| chromium-wasm/full/global/validator-heavy | 73.9 ms | 94.2 ms | 1.27 |

Native incremental got faster over the same hosts (geometric mean 0.62 rust, 0.68 node native, 0.68 Python), and Wasm `us-jurisdiction`/`beta10-full` incremental got 8 to 15 percent faster. After #902, Wasm incremental time is roughly the same (about 60 to 100 ms) for every selection, so the narrow `pii:family:us:ssn` and `pii:global` selections lost the lead they had. Suspected product cause: the #902 per-line context association (redact-secret `a0836266`) does work in the incremental Wasm path that no longer scales with the active families. A local paired check (macOS arm64 Node, forced Wasm, same adapter and workloads, ABBA fresh processes, 20 rounds) shows the same direction but smaller: `us-ssn-exact` incremental +5 and +9 percent, `global` and `beta10-full` 12 and 34 percent faster. The CI x64 hosts show it much more strongly.

### What `profile-cost: met` would need, per family

`profileCostGate` is not family-scoped: one regression cell or one open size row fails the gate for all six families. Today each of the six families needs the maintainer to accept, or the product to fix, all 183 cells and 38 open size rows, plus the 3 rows the `ec9224d9` ledger entries would cover.

If the gate were read per family (not how the code scores it today; a reading for the decision only), the cells whose activation includes the family are:

| Family | Profiles | Cells | rust-native | node-native | node-wasm | chromium-wasm | python | cli |
| --- | --- | ---: | --- | --- | --- | --- | --- | --- |
| network-address, email, payment-card, iban, phone | `global`, `us-jurisdiction`, `beta10-full` | 137 (126 at `8f97f14d`) | whole 12, incr 12 | whole 12, incr 12 | whole 12, incr 12, mem 9 | whole 12, incr 12, init 12 | whole 6, incr 6, mem 2 | whole 6 |
| us-ssn | `us-ssn-exact`, `us-jurisdiction`, `beta10-full` | 139 (122 at `8f97f14d`) | whole 12, incr 12 | whole 12, incr 12 | whole 12, incr 12, mem 12 | whole 12, incr 12, init 11 | whole 6, incr 6, mem 2 | whole 6 |

The 41 regressing size rows are shared artifacts: every CLI binary, Node addon and Python wheel, the crate, the npm `node` and `wasm` packages, the default `full` and `common` Wasm in every compression, and the browser bundles. Under either reading they belong to every family.

## Protected partition

Not run. No custodian corpus is registered for any family, and the partition stays unspent: every epoch is 0/1, with reason `public-gates-failed`, always including `profile-cost`. Epoch commitments are in the freeze. The protected runner and the custodian guide ([`holdout/PII-CUSTODIAN.md`](../../../holdout/PII-CUSTODIAN.md)) now name this candidate. `run` refuses every family without spending budget while a public gate is `not-met`.

## Support projection and site copy

No status changes, so nothing was regenerated: all six families remain `pending` in `pii-support-matrix-v2`.
