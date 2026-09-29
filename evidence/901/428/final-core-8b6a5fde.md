# #428 final public-gate record: core `8b6a5fde`

**All six PII families stay `pending`. Detection outcomes are identical to `8f97f14d` and `ec9224d9`. `profile-cost` stays `not-met`: the bound official candidate run has 172 regression cells and 3 tail-only invalid cells (175 failing), against 162 at `8f97f14d` and 183 at `ec9224d9`.** Of the 23 cells that first failed at `ec9224d9`, 7 are within budget in both official candidate runs at this commit, 6 fail in one run, and 10 fail in both. Eleven cells still fail against `8f97f14d` in both official candidate runs at this commit: five Wasm incremental cells for the narrow `pii:family:us:ssn` selection, one Chromium `pii:global` incremental cell, two Chromium initialize cells and three Node-Wasm RSS cells. A diagnostic run on the CI runners supports the product's JIT warm-up explanation for the `us-ssn-exact` incremental cells. Nothing here is accepted: the remaining cells are listed for the maintainer's decision. The protected partition is unspent and not eligible.

This record re-binds the #428 evidence to the Beta.11 candidate after redact-secret#996. It supersedes [`final-core-ec9224d9.md`](final-core-ec9224d9.md) (intermediate history, the #902 Wasm regression that #996 addresses) and [`final-core-8f97f14d.md`](final-core-8f97f14d.md) for the release decision. It makes no support claim. PII numerators and denominators are the only counts in it. Mode: candidate build (isolated tarballs from the commit, and qualified product run 36581019627 for the CI rows and the official workflow), not the published package.

## Candidate and evidence

- **Source.** `redact-secret/redact-secret` `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`, product `main` after #996. #996 builds the PII vocabulary once per process on first need, skips association when no candidate is established, and shrinks the sort and normalization code. Its output is byte-identical to `ec9224d9`. The version string is still `0.1.0-beta.10`.
- **Artifacts.** Core `467111e2…f74c` (unchanged), node `25959890…c36c`, wasm `61d135ba…6f2d`. CI qualification run 36581019627, inventory `678006f3…f616`.
- **Freeze** [`core-8b6a5fde52ec/pii-beta11-freeze-v2.json`](core-8b6a5fde52ec/pii-beta11-freeze-v2.json), commitment `f79278ae…e412`, committed at `e4e6266` before any scan. Plan set `b11-population-v2`. No PII contract hash changed.
- **Measurement.** [observation](core-8b6a5fde52ec/pii-beta11-observation-v2.json), [operational](core-8b6a5fde52ec/pii-beta11-operational-v2.json), [report](core-8b6a5fde52ec/pii-beta11-report-v2.json) and [disposition](core-8b6a5fde52ec/pii-beta11-disposition-v2.json), measured at `cf9694d`.
- **Parity (#427).** [`../427/mixed-parity-core-8b6a5fde52ec-plan-v2-report-v1.json`](../427/mixed-parity-core-8b6a5fde52ec-plan-v2-report-v1.json), plan v2: six surfaces agree and meet expectations in both selections (16/16 per operation, 574/574 partitions, 606/606 output bytes, 0 values left, 0 range-unit errors; CLI 48/48). With commits and hashes removed, the report and the observation are byte-identical to `8f97f14d`.
- **Peers.** `npm run peers:provision` (trufflehog `3.97.4`, gitleaks `8.30.1`) for parity, freeze and measurement.

## Six-family matrix

Unchanged from `8f97f14d` and `ec9224d9`. With commits and hashes removed, every section of the observation except the timestamps is identical to the `8f97f14d` one.

| Family | Scope | Status | Diagnostic-balanced | Benign-heavy |
| --- | --- | --- | --- | --- |
| network-address | global | pending | 41/41, FA 0/56 | 24/24, FA 0/56 |
| email | global | pending | 44/44, FA 0/42 | 12/12, FA 0/39 |
| payment-card | global | pending | 71/71, FA 0/90 | 13/13, FA 0/42 |
| iban | global | pending | 39/39, FA 0/54 | 5/5, FA 0/45 |
| us-ssn | `us` only | pending | 9/9, FA 0/10 | 7/7, FA 0/22 |
| phone | global (NANP `+1`) | pending | 9/9, FA 0/12 | 7/7, FA 0/27 |

Failed or withheld gates, the same for all six:

- `profile-cost` (not-met);
- `protected-partition` (not-run);
- `runtime-and-package-cost` and `size-regression-budget` (not-met). These two stay not-met until the `8b6a5fde` rows of `benchmarks/accepted-regressions.json` come from the credential re-bind. At `8f97f14d` they were met through that commit's rows.

Every other gate is met, as at `8f97f14d`.

## Package budget (#448)

See [`package-budget-acceptance-core-8b6a5fde.md`](package-budget-acceptance-core-8b6a5fde.md). node-darwin-arm64 is +59,720 B and wasm +341,256 B over the 32,768 B budget; core is within. `_pii` Wasm (CI): full 833,741 B raw / 310,056 B gzip, common 647,875 / 248,463, against 860,700 / 318,323 and 674,876 / 256,694 at `ec9224d9`, and 819,740 / 305,065 and 633,823 / 243,752 at `8f97f14d`.

## Profile cost v2 (official workflow)

The plan [`qualification/pii-profile-cost-v2.json`](../../../qualification/pii-profile-cost-v2.json) is bound to this candidate: qualification run 36581019627, inventory `678006f3…f616`, `benchmarkBaseCommit` `94d28051` on `develop`, commitment `36d408ea…456f`. It was dispatched on ref `beta11/rebind-ec9224d-pii` at head `95bebb85`. No workflow or plan file was edited for measurement.

Runs are listed in [`pii-profile-cost-v2-runs.json`](core-8b6a5fde52ec/pii-profile-cost-v2-runs.json):

| Phase | Run ids |
| --- | --- |
| A/A | 36582918143, 36582922662, 36582927119 |
| freeze | 36584429501 |
| candidate (bound) | 36584501052 |
| size | 36582931734 |
| second candidate (not used) | 36585713241 |

All succeeded. The first candidate run reported three `tail-only-rerun-required` cells, so a second candidate run was dispatched against the same freeze. It reported one such cell and 173 regressions. The first successful run is bound, so no run was chosen by its result. The second is listed under `notUsed` and compared below.

| | `8f97f14d` (9V74) | `ec9224d9` (7763) | `8b6a5fde` bound (Xeon 6973P-C) | `8b6a5fde` second (7763) |
| --- | ---: | ---: | ---: | ---: |
| regression | 162 | 183 | 172 | 173 |
| invalid (tail-only) | 0 | 0 | 3 | 1 |
| within | 342 | 321 | 329 | 330 |
| of the 162 `8f97f14d` cells still failing | 162 | 160 | 157 | 157 |
| failing now, within at `8f97f14d` | — | 23 | 18 | 17 |
| size rows regressing / open | 41 / 38 | 41 / 38 | 41 / 38 (0 covered until the ledger rows land) | same |

### (1) The 23 cells that first failed at `ec9224d9`

Verdicts at `8b6a5fde`, bound run / second run:

| Group | Cells | Within in both | Fail in one | Fail in both |
| --- | ---: | ---: | ---: | ---: |
| Wasm incremental (7) | 7 | 1 (`chromium-wasm/common/us-ssn-exact/multilingual-context`) | 0 | 6 (two node-wasm `full/us-ssn-exact` cells are tail-only invalid in the bound run and regress in the second) |
| Node-Wasm RSS (13) | 13 | 5 | 6 | 2 (`full/beta10-full/validator-heavy` retained, `common/beta10-full/validator-heavy` peak) |
| Chromium initialize (2) | 2 | 0 | 0 | 2 |
| Python retained RSS (1) | 1 | 1 | 0 | 0 |

- **RSS.** On the same CPU model (EPYC 9V74 A/A, PII on both sides), Node-Wasm peak and retained RSS at `8b6a5fde` are within 1 to 3 percent of `8f97f14d` (geometric mean of cell maxima 1.009 to 1.029, range 0.976 to 1.061) and about 2 percent below `ec9224d9`. The official cells compare PII on with PII off and sit at +9 to +16 percent against a 10 percent budget, so they flip between runs. Eleven of the thirteen fail in at most one of the two runs.
- **Chromium initialize.** `full/global/validator-heavy` 1.26 / 1.27 and `full/us-jurisdiction/validator-heavy` 1.33 / 1.41, against 1.22 and 1.24 at `8f97f14d`.
- **Wasm incremental.** See (2). `chromium-wasm/full/global/validator-heavy` incremental also still fails: PII on / PII off 1.44 / 1.32, against 1.14 at `8f97f14d`.

The cells that fail against `8f97f14d` in both `8b6a5fde` runs number 11:

| Cell | Bound | Second |
| --- | ---: | ---: |
| node-wasm/full/us-ssn-exact/validator-heavy · incremental | 1.17 (invalid) | 1.27 |
| node-wasm/full/us-ssn-exact/multilingual-context · incremental | 1.06 (invalid) | 1.22 |
| node-wasm/common/us-ssn-exact/multilingual-context · incremental | 1.31 | 1.26 |
| chromium-wasm/full/us-ssn-exact/validator-heavy · incremental | 1.16 | 1.24 |
| chromium-wasm/full/us-ssn-exact/multilingual-context · incremental | 1.18 | 1.19 |
| chromium-wasm/full/global/validator-heavy · incremental | 1.44 | 1.32 |
| chromium-wasm/full/global/validator-heavy · initialize | 1.26 | 1.27 |
| chromium-wasm/full/us-jurisdiction/validator-heavy · initialize | 1.33 | 1.41 |
| node-wasm/full/us-jurisdiction/validator-heavy · nodeRetainedRss | +10.3% | +15.3% |
| node-wasm/full/beta10-full/validator-heavy · nodeRetainedRss | +16.3% | +13.5% |
| node-wasm/common/beta10-full/validator-heavy · nodePeakRss | +11.7% | +11.2% |

### (2) `us-ssn-exact` Wasm incremental

**Official cells (PII on / PII off, same host).** `node-wasm` full validator-heavy is 0.91 at `8f97f14d`, 1.27 at `ec9224d9` and 1.17 / 1.27 here. Full multilingual-context is 0.91, 1.14 and 1.06 / 1.22. Common multilingual-context is 0.93, 1.45 and 1.31 / 1.26. Chromium full is 0.80 → 1.29 → 1.16 / 1.24 and 0.80 → 1.22 → 1.18 / 1.19. At `8f97f14d` PII-on incremental was *faster* than PII off: the slow (150 ms and more) PII-on whole-input scan ran first in the same process and left the incremental code warm.

**Same CPU, A/A.** A/A runs have PII on both sides. Normalized by the same run's `beta10-full` cell, which removes host speed, narrow-selection incremental cost rose and #996 did not change it:

| Cell (us-ssn-exact incremental / beta10-full incremental) | `8f97f14d` | `ec9224d9` | `8b6a5fde` |
| --- | --- | --- | --- |
| node-wasm full validator-heavy | 0.61–0.62 | 0.89–0.98 | 0.92–0.97 |
| node-wasm common multilingual-context | 0.48–0.49 | 0.79–0.81 | 0.78–0.85 |
| chromium-wasm full multilingual-context | 0.58–0.59 | 1.00–1.04 | 1.02–1.06 |

The absolute PII-on median on EPYC 9V74 for `node-wasm/full/us-ssn-exact/validator-heavy` was 45.5 and 58.6 ms at `8f97f14d` and is 79.7 and 79.6 ms here.

**Diagnostic on the CI runners (not the official protocol, not evidence of record).** Workflow run [36583114408](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36583114408) on the orphan branch `diag/902-jit-settle` ran three jobs: EPYC 9V74, 7763, 7763. It used the #428-frozen local candidate packages, with hashes checked in the job: wasm `b6819bfd…` for `8f97f14d` and `61d135ba…` for `8b6a5fde`. Each measurement is the forced-Wasm Node incremental median, ABBA-interleaved fresh processes, 12 rounds per side, `8b6a5fde` over `8f97f14d`, as ranges over the three hosts:

| Variant | `pii:family:us:ssn` | `pii:global` | PII off |
| --- | --- | --- | --- |
| official sequence (whole-input scan, then incremental) | 1.24–1.42 | 0.84–1.03 | 0.96–1.02 |
| 10 ms settle after the whole-input scan | 1.03–1.11 | 0.76–0.90 | 0.98–1.07 |
| warm second session in the same process | 0.89–1.01 | 0.64–0.72 | 0.93–1.10 |
| no whole-input scan first (cold incremental) | 0.84–0.94 | 0.75–0.85 | 0.89–1.01 |

With no whole-input scan first (cold) or on a warm second session, `8b6a5fde` is faster than `8f97f14d` for `us-ssn-exact`. A 10 ms pause removes most of the gap, leaving 3 to 11 percent. On the CI runners, then, the `us-ssn-exact` slowdown is tied to what runs in the process before the incremental session, not to slower incremental code, which matches the product's JIT warm-up analysis. The diagnostic covers Node-Wasm only. Chromium's `us-ssn-exact` cells move the same way in the official runs, but they were not diagnosed separately. The Chromium `pii:global` full validator-heavy incremental cell is not explained by this: in Node, `pii:global` is faster in every variant.

### (3) Remaining cells for the maintainer's decision

`profileCostGate` is not family-scoped, so today every one of the six families needs all 175 failing cells of the bound run (172 regression, 3 tail-only invalid) and the 41 regressing size rows accepted or fixed. Of those rows, 38 have no #143 trigger. The other 3 (wasm full and common gzip, wasm packed) could be covered by `8b6a5fde` ledger rows. By surface:

| Surface | Whole input | Incremental | Initialize / import | Memory |
| --- | ---: | ---: | ---: | ---: |
| rust-native | 16 | 16 | | |
| node-native | 16 | 16 | | |
| node-wasm | 16 | 16 (2 invalid) | | 11 |
| chromium-wasm | 16 | 13 | 14 initialize, 1 import (invalid) | |
| python | 8 | 8 | | |
| cli | 8 | | | |

A per-family reading (not how the code scores it) counts the cells whose activation includes the family:

- Network-address, email, payment-card, IBAN and phone share the `global`, `us-jurisdiction` and `beta10-full` activations: 132 cells. That is rust 24, node-native 24, node-wasm 32, chromium 34, python 12, cli 6.
- us-ssn uses `us-ssn-exact`, `us-jurisdiction` and `beta10-full`: 130 cells. That is rust 24, node-native 24, node-wasm 32, chromium 32, python 12, cli 6.

The 41 size rows are shared artifacts and belong to every family.

Largest remaining ratios (bound run, PII on / PII off):

| Surface / metric | Cell | Ratio | PII on | PII off |
| --- | --- | ---: | ---: | ---: |
| node-native whole | common/beta10-full/validator-heavy | 30.3 | 46.08 ms | 1.52 ms |
| node-native whole | common/us-jurisdiction/validator-heavy | 29.8 | 46.09 ms | 1.55 ms |
| node-native whole | common/global/validator-heavy | 16.6 | 25.33 ms | 1.53 ms |
| node-native whole | common/us-ssn-exact/validator-heavy | 14.0 | 22.25 ms | 1.59 ms |
| rust-native whole | common/beta10-full/validator-heavy | 4.65 | 7.93 ms | 1.70 ms |
| node-wasm whole | common/beta10-full/validator-heavy | 4.50 | 54.81 ms | 12.19 ms |
| chromium-wasm whole | common/us-jurisdiction/validator-heavy | 4.00 | 51.60 ms | 12.90 ms |
| python whole | full/us-jurisdiction/validator-heavy | 3.59 | 14.23 ms | 3.96 ms |
| rust-native incremental | common/us-jurisdiction/validator-heavy | 3.23 | 10.51 ms | 3.26 ms |
| node-native incremental | common/beta10-full/validator-heavy | 3.21 | 13.67 ms | 4.25 ms |
| node-wasm incremental | common/us-jurisdiction/validator-heavy | 2.31 | 49.34 ms | 21.34 ms |
| chromium-wasm incremental | common/us-jurisdiction/validator-heavy | 2.27 | 45.00 ms | 19.80 ms |
| cli whole | full/us-jurisdiction/validator-heavy | 1.92 | 14.92 ms | 7.77 ms |
| python incremental | full/beta10-full/validator-heavy | 1.79 | 16.87 ms | 9.43 ms |
| chromium-wasm initialize | common/beta10-full/validator-heavy | 1.62 | 11.80 ms | 7.30 ms |
| node-wasm memory | full/beta10-full/validator-heavy retained RSS | +16.3% | +12.8 MiB | |

Whole-input ratios range from 1.12 to 30.3. At `8f97f14d` the largest was 173.9 (338.8 ms against 1.95 ms). On one EPYC 9V74 A/A pair, PII-on whole input is 0.05 to 0.17 of `8f97f14d` on every surface except the CLI (0.67 to 0.88).

## Protected partition

Not run. No custodian corpus is registered, and every epoch is 0/1 with reason `public-gates-failed`, always including `profile-cost`. The protected runner and [`holdout/PII-CUSTODIAN.md`](../../../holdout/PII-CUSTODIAN.md) now name this candidate. `run` refuses every family without spending budget while a public gate is `not-met`.

## Support projection and site copy

No status changes, so nothing was regenerated.
