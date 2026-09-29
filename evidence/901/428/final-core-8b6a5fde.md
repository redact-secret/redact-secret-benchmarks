# #428 final public-gate record: core `8b6a5fde`

**After the protected runs, network-address, email, payment-card, iban and phone are `provisional` and us-ssn stays `pending` ([below](#protected-partition-and-six-family-disposition-after-the-acceptance)). Detection outcomes are identical to `8f97f14d` and `ec9224d9`. The report scores `profile-cost` `not-met`: the bound official candidate run has 172 regression cells and 3 tail-only invalid cells (175 failing), against 162 at `8f97f14d` and 183 at `ec9224d9`. On 2026-09-29 the maintainer accepted every failing cell and the 38 open size rows as a tradeoff ([below](#maintainer-acceptance-of-the-profile-cost-cells)). The Chromium diagnostic found no PII-on absolute-time regression against `8f97f14d`, so nothing is excluded from that acceptance. With it, every public gate of all six families counts as met, and each family is eligible for its protected run. The custodian then sealed and ran the protected corpus once per family.**

Of the 23 cells that first failed at `ec9224d9`, 7 are within budget in both official candidate runs at this commit, 6 fail in one run, and 10 fail in both. The paired diagnostics on the CI runners, [Node-Wasm](#2-us-ssn-exact-wasm-incremental) and [Chromium](#chromium-diagnostic-diagnostic-only), place the remaining Wasm cells in V8 tier-up timing or the unchanged instantiate gap, not in slower product code.

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

- `profile-cost` (not-met in the report; met by accepted tradeoff for the protected route, see below);
- `protected-partition` (not-run).

`runtime-and-package-cost` and `size-regression-budget` are met through the `8b6a5fde` rows of `benchmarks/accepted-regressions.json` (credential re-bind, merged at `1925bd4`; rescored at `d5de27c`), as at `8f97f14d`. Every other gate is met.

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

### (3) Remaining cells (accepted by the maintainer on 2026-09-29, see below)

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

## Chromium diagnostic (diagnostic only)

This is not the official protocol and not evidence of record. No plan or workflow file changed. It ran on the orphan branch `diag/902-chromium` of this repository in two runs of three jobs each: [36587938904](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36587938904) (EPYC 9V45, Xeon 8573C, EPYC 9V45) and [36589203421](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36589203421) (EPYC 9V45, 9V45, 9V74). It pairs the CI-qualified `wasm-web` builds of `8f97f14d` (run 36553444981) and `8b6a5fde` (run 36581019627). Each job checks the four `.wasm` hashes against the #428 freezes before it starts. It uses Playwright 1.55.0 Chromium, the same as the official workflow, with one fresh browser per sample, both builds ABBA-interleaved on the same host, 20 rounds, 40 samples per side per cell, and the `full` profile. The workload is `validator-heavy`, and the in-page sequence and incremental limits are those of `chromium-sample-v2.mjs`.

Each cell below is PII-on absolute time, `8b6a5fde` over `8f97f14d`: the ratio of medians with a 95 percent bootstrap interval, one line per host.

**(a) Initialize.** This is `default()` (Wasm instantiate) plus `initialize(selectors)`, the official metric.

| Selection | Host | `8f97f14d` ms | `8b6a5fde` ms | Ratio [95% CI] |
| --- | --- | ---: | ---: | --- |
| `pii:global` (PII on) | 9V45 / 8573C / 9V45 | 8.80 / 12.60 / 9.40 | 9.25 / 12.60 / 9.40 | 1.051 [0.972, 1.114] / 1.000 [0.937, 1.074] / 1.000 [0.922, 1.033] |
| `pii:us` (PII on) | 9V45 / 8573C / 9V45 | 8.75 / 12.50 / 9.70 | 9.15 / 12.90 / 9.85 | 1.046 [0.957, 1.104] / 1.032 [0.976, 1.102] / 1.015 [0.910, 1.096] |
| off (PII off) | 9V45 / 8573C / 9V45 | 6.90 / 10.20 / 7.20 | 6.90 / 10.35 / 7.60 | 1.000 [0.937, 1.097] / 1.015 [0.949, 1.080] / 1.056 [0.987, 1.113] |

`initialize(selectors)` alone is 1.4 to 2.4 ms and unchanged (0.91 to 1.05). The on/off gap is the `_pii` build's larger instantiate: 7.2 against 5.8 ms on a 9V45. It is 1.28 at `8f97f14d` and 1.34 at `8b6a5fde` on the same host, so the official cells sit on the edge of their budget at both commits. **Verdict: noise.** PII-on absolute initialize is unchanged, and every interval contains 1.

**(b) `pii:global` incremental, PII on.**

| Variant | Ratio per host [95% CI] |
| --- | --- |
| official order (whole-input scan, then the session) | 1.196 [1.129, 1.317], 1.267 [1.216, 1.302], 1.281 [1.187, 1.332]; second run 1.190, 1.269, 1.194 |
| 10 ms settle after the whole-input scan | 1.212 [1.129, 1.293], 1.171 [1.115, 1.199], 1.235 [1.177, 1.300] |
| warm second session, immediately after | 1.013 [0.926, 1.094], 0.831 [0.780, 0.855], 0.982 [0.923, 1.106] |
| cold (no whole-input scan first) | 0.707 [0.687, 0.747], 0.730 [0.706, 0.747], 0.710 [0.688, 0.739] |
| steady (five more sessions, 100 ms apart; the last) | 0.606 [0.597, 0.617], 0.610 [0.604, 0.616], 0.614 [0.609, 0.617] |
| TurboFan only (`--no-liftoff --no-wasm-lazy-compilation`) | 0.586 [0.580, 0.592], 0.594 [0.589, 0.598], 0.604 [0.599, 0.606] |
| Liftoff only (`--liftoff-only --no-wasm-lazy-compilation`) | 0.634 [0.618, 0.646], 0.670 [0.660, 0.688], 0.694 [0.686, 0.707] |

**(c) `pii:family:us:ssn` incremental, PII on.**

| Variant | Ratio per host [95% CI] |
| --- | --- |
| official order | 1.283 [1.251, 1.377], 1.253 [1.211, 1.272], 1.343 [1.275, 1.429]; second run 1.329, 1.359, 1.292 |
| 10 ms settle | 1.390 [1.342, 1.460], 1.215 [1.165, 1.262], 1.421 [1.341, 1.479] |
| warm second session, immediately after | 1.663 [1.569, 1.776], 1.092 [1.019, 1.194], 1.560 [1.454, 1.665] |
| cold | 0.842 [0.771, 0.871], 0.822 [0.804, 0.852], 0.848 [0.811, 0.882] |
| steady | 0.782 [0.773, 0.791], 0.785 [0.775, 0.795], 0.788 [0.783, 0.793] |
| TurboFan only | 0.776 [0.764, 0.785], 0.769 [0.756, 0.781], 0.783 [0.773, 0.785] |
| Liftoff only | 0.822 [0.795, 0.845], 0.868 [0.849, 0.891], 0.824 [0.801, 0.861] |

PII off is 0.95 to 1.02 in every variant, so the harness does not favour either build.

**Verdict for (b) and (c): a JIT tier-up artifact of the measurement order, not a product regression.**

- With the Wasm tier pinned to TurboFan or to Liftoff, where no tier-up happens, `8b6a5fde` is faster than `8f97f14d` (0.59 to 0.87).
- It is also faster in steady state (0.61 and 0.78) and on a cold first session (0.71 to 0.85).
- It is slower only when a session runs shortly after the whole-input scan. That scan now takes 7 to 65 ms instead of 97 to 470 ms, so hot functions are still being recompiled when the session starts. On these slower x64 hosts, a 10 ms pause and even one extra session are not enough; after five sessions 100 ms apart the build is 22 to 39 percent faster.
- The whole-input scan and the following session together are still much faster: `pii:family:us:ssn` 33.4 + 39.8 ms against 97.5 + 30.0 ms, and `pii:global` 47.4 + 46.7 ms against 311 + 39.2 ms, on a 9V45.

The Node-Wasm diagnostic shows the same shape. No product fix is indicated. Whether the official `incremental` metric should run in its own process or after a settle period is a protocol question for the maintainer.

## Maintainer acceptance of the profile-cost cells

The maintainer decided on 2026-09-29, relayed by the Beta.11 orchestrator, to accept the remaining Beta.11 PII profile-cost cells and size rows at `8b6a5fde` as a tradeoff:

- PII is opt-in.
- The cells compare PII on against PII off in the same artifact, so the cost is paid only when a caller enables PII.
- PII-on absolute time fell to 0.05 to 0.17 of `8f97f14d` on every surface except the CLI.
- The size rows are the accepted Beta.11 PII payload.

The acceptance excludes any cell that the Chromium diagnostic shows to be a real PII-on absolute-time regression; the diagnostic above found none, so none is excluded.

- **Mechanism.** The #143 ledger `benchmarks/accepted-regressions.json` accepts #143 budget triggers only, and profile-cost cells are not triggers. Its sibling [`benchmarks/accepted-pii-profile-cost.json`](../../../benchmarks/accepted-pii-profile-cost.json) follows the same conventions: one entry per candidate commit, the original measurement kept for every item, a rationale, a linked benefit, and `decidedAt`/`decidedBy`. It is validated and applied by [`profile-cost-acceptance.ts`](../../../benchmarks/evaluation/domains/pii/profile-cost-acceptance.ts), with tests in `tests/pii-profile-cost-acceptance.test.mjs`.
- **Entry `beta11-8b6a5fd-pii-profile-cost`.** It binds commit `8b6a5fde`, plan `36d408ea…456f`, the bound candidate run 36584501052 with its report commitment, and size run 36582931734 with its report commitment. It records the second candidate run 36585713241 as not used. It lists all 175 failing cells (172 regression and 3 tail-only invalid, each with its original verdict and measurement) and all 38 open size rows (each with `deltaBytes`), and it excludes nothing.
- **Rule.** The acceptance applies only when it covers every failing cell and open size row of exactly those runs, with identical measurements. A missing, excluded or changed cell, another run, or another commit leaves `profile-cost` not-met, and the tests check each of these.
- **The frozen report is not rescored with it.** `beta11-disposition.ts` belongs to the #428 freeze, and changing scoring after an observation requires a new freeze. The report and disposition therefore keep the measured `profile-cost: not-met`. The protected route reads the acceptance: `b11ProtectedPublicGates` counts an accepted `profile-cost` as met and names the ledger entry.

## Protected partition and six-family disposition after the acceptance

The protected disposition is [`core-8b6a5fde52ec/pii-beta11-protected-disposition-v2.json`](core-8b6a5fde52ec/pii-beta11-protected-disposition-v2.json), written by `npm run pii:beta11:protected -- disposition --core-commit=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 --seal=holdout/pii-b11-17dae942ee4b-seal.json` and re-derived byte for byte in the tests. It binds the report, the disposition, the acceptance, the seal and the six protected runs.

The seal is [`holdout/pii-b11-17dae942ee4b-seal.json`](../../../holdout/pii-b11-17dae942ee4b-seal.json) with one manifest per family, committed at `8143b3f` before any run. Each family used its one attempt against core `8b6a5fde52ecb4dfce13f09c7a947062d21483c7`; the aggregates and trust resolutions are under [`core-8b6a5fde52ec/protected/`](core-8b6a5fde52ec/protected/). The trust resolution of every family is `accepted`: custody of no run is in doubt.

| Family | Status | Public gates | Protected cases | Sensitive detected (balanced / benign-heavy) | False alarms | Protected gate |
| --- | --- | --- | ---: | --- | --- | --- |
| network-address | provisional | all met (accepted `profile-cost`) | 32 | 7/7 / 4/4 | 0/9 / 0/12 | met |
| email | provisional | all met (accepted `profile-cost`) | 32 | 7/7 / 4/4 | 0/9 / 0/12 | met |
| payment-card | provisional | all met (accepted `profile-cost`) | 32 | 7/7 / 4/4 | 0/9 / 0/12 | met |
| iban | provisional | all met (accepted `profile-cost`) | 30 | 7/7 / 4/4 | 0/8 / 0/11 | met |
| us-ssn | pending | all met (accepted `profile-cost`) | 30 | 7/7 / 4/4 | 0/8 / 0/11 | not-met: `identity-only-classification` (`identity-failures:1`) |
| phone | provisional | all met (accepted `profile-cost`) | 30 | 7/7 / 4/4 | 0/8 / 0/11 | met |

Every family had 0 range mismatches, 0 action mismatches, 0 values left after redaction, 0 collateral findings, 0 activation problems, 0 cross-surface disagreements and 0 PII-off findings. For us-ssn, 1 of the 2 identity-only comparisons disagreed on sensitivity; the aggregate does not say which case, and the result stands as measured. Its single attempt is spent, and the runner refuses a second one. The distribution is 5 `provisional`, 1 `pending`, 0 `stable`; this route never produces `stable`.

## Custody of the protected corpus

By maintainer direction on 2026-09-29, the custodian and the reviewer were isolated agents, not the human custodian that [`holdout/PII-CUSTODIAN.md`](../../../holdout/PII-CUSTODIAN.md) assumes. This is a recorded deviation from the guide's human-custodian rule, following the #382 precedent. The attestation names them as `isolated-agent-custodian (maintainer-directed 2026-09-29)` and `isolated-agent-reviewer (maintainer-directed 2026-09-29)`.

- **Could read.** The custodian guide, template and holdout README; the product PII contracts at `8b6a5fde` (`docs/contracts/pii/*`, the `pii-context` v1/v2 vocabularies, and the frozen network-address contract in `docs/audits/evidence/875/README.md`); and public authority sources (RFC 5737/3849/2606/6761, published test card numbers, NANP 555-0100 to 555-0199, ISO 13616, SSA structure rules).
- **Could not read.** The benchmarks `qualification/`, `fixtures/`, `evidence/`, `benchmarks/`, `tests/` and `docs/reports/` trees, the #423 oracle plans, the #424 to #426 population plans, the v2 plans, the #427 parity plan, and any product test or fixture file. The custodian did not run the product scanner while authoring; labels come from the contracts. The only feedback during authoring was the validator's PASS/FAIL codes. The reviewer checked every label against the contracts before sealing, and its advisory findings were applied and re-reviewed. Only after all six runs did the custodian open `scripts/pii-beta11-protected.mjs` and the disposition test, to re-derive the committed disposition from the seal and the runs.
- **Committed.** Only the seal and the per-family manifests (commitments), the per-family aggregates, the trust resolutions and the protected disposition. Case text, ids, ranges, labels, axis tags and the seed stayed in the ignored `holdout/generated/` directory.

## Support projection and site copy

No status changes, so nothing was regenerated.
