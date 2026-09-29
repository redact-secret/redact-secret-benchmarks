# Evidence: performance acceptance of the 0.1.0-beta.11 release source 94fc18a

**Result:** `performance-evaluation.yml` run
[36609010314](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609010314) evaluates the
approved release source `94fc18a974f659ea882c89120dbf1adb3acf2f28` against baseline 0.1.0-beta.8 and concludes
**success, ACCEPTED**:

- Latency (10 rows), initialization (10) and memory (16) are all within budget.
- The 3 flagged size rows read as accepted tradeoffs.
- Median processing ratios are 0.244–0.283 on the medium workloads and 0.233–0.845 on the small ones.

It ran at `0050c10` on branch `beta11/release-94fc18a-ledger`, the commit that carries the accepted rows below. Reports
are in this directory.

## The release source

`94fc18a` is product main after PR #1007 ("prepare 0.1.0-beta.11"). Against the benchmarked candidate `8b6a5fd` it
changes version strings (`Cargo.toml`, `package.json` files, `packages/javascript/src/version.ts`), READMEs, docs,
product-side support-matrix data and scripts. No `crates/**/*.rs`, binding source or package source changed. All
credential evidence for Beta.11 is recorded at `8b6a5fd` ([`../8b6a5fd/README.md`](../8b6a5fd/README.md)).

A local `benchmark:candidate` run of `94fc18a` confirms that. Run `4bbdef59-dda4-4745-9d52-3faa68821e5c` (benchmarks
`0050c10`, full suite, 4,777 fixtures) gives every fixture the same outcome and finding count as the `8b6a5fd` run
`e795030e`. That run is not committed.

## Runs

- **[36606420213](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36606420213), REGRESSION.**
  It was dispatched before any row existed for `94fc18a`. The ledger was keyed to `8b6a5fd`, so it flagged the 3 size
  rows. It also flagged `initialization/browser-wasm/scale-logs-small-whole/initialization-ratio` at 1.286 against the
  1.25 allowed. Its `wasm-sizes.json` and `quickstart-bundle.json` are the measurements the rows cite. They are
  byte-identical to those of 36609010314.
- **[36609010314](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609010314), ACCEPTED.** This
  is the run of record. The same initialization row reads 1.228, within budget.
- **Paired check on the 36606420213 breach**, `rounds=20`, 40 samples a side
  ([`browser-init-paired.json`](browser-init-paired.json)):

  | Run | Pair | CPU | small-whole ratio [95% CI] | medium-fixed4096 ratio |
  | --- | --- | --- | --- | ---: |
  | [36609019172](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609019172) | 8b6a5fd → 94fc18a | EPYC 7763 | 0.993 [0.853, 1.068] | 1.006 |
  | [36609026856](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609026856) | 8b6a5fd → 94fc18a | EPYC 9V74 | 1.000 [0.883, 1.066] | 0.994 |
  | [36609034804](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609034804) | 8b6a5fd → 94fc18a | EPYC 9V45 | 1.028 [0.904, 1.155] | 1.017 |
  | [36609042852](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/36609042852) | A/A 94fc18a | EPYC 9V74 | 0.927 [0.836, 1.056] | 0.994 |

  Pooled 8b6a5fd → 94fc18a: small-whole 0.971 [0.869, 1.084], medium 1.006. The code is identical, and so is the
  initialization. The 1.286 breach is noise on a row that sits at about 1.1–1.25 against beta.8 for every Beta.11
  candidate ([`../ec9224d-verified/browser-init-paired.md`](../ec9224d-verified/browser-init-paired.md)). It is **not**
  recorded as an accepted tradeoff. The headroom is thin. Official runs at the Beta.11 candidates have now read 1.277,
  1.263, 1.597, 1.286 (breaches) and 1.08–1.23 (within budget).

## Accepted rows for 94fc18a (`benchmarks/accepted-regressions.json`)

These carry the 8b6a5fd rows under the maintainer's acceptance of the Beta.11 size growth:

| Trigger | Baseline (0.1.0-beta.8) | At 8b6a5fd | At 94fc18a | Source |
| --- | ---: | ---: | ---: | --- |
| `size/wasm/full/gzip` | 137,639 | 187,246 | 187,236 | run 36606420213 `wasm-sizes.json` |
| `size/wasm/common/gzip` | 100,058 | 127,655 | 127,653 | run 36606420213 |
| `size/browser-bundle/quickstart/gzip` | 144,501 | 194,626 | 194,615 | run 36606420213 `quickstart-bundle.json` |
| `size/npm/wasm/packed` | 254,413 | 900,829 | 900,773 | local 0.1.0-beta.11 tarball, [`npm-packed-sizes.json`](npm-packed-sizes.json) |
| `size/npm/node-darwin-arm64/packed` | 424,514 | 649,386 | 649,380 | local tarball |
| `size/node-addon/aarch64-apple-darwin` | 1,004,128 | 1,442,736 | 1,442,736 | the `.node` binary in that tarball |

Every difference from `8b6a5fd` is a few bytes from the version string. `size/npm/core/packed` is within budget (41,944).

## Pin

The benchmarks registry pin (`detector-inventory.json`, `detectors.json`, `pin-manifest.json`) and
`performance-criteria.json` `verifiedCommit` stay at `8b6a5fd`. `pins:check` requires `verifiedCommit` to equal the
pinned registry revision, so moving `verifiedCommit` alone would break pin consistency on `develop`. The detector
source is identical, so no re-pin is needed for the release. A re-pin to `94fc18a` would be a separate, cosmetic
change.

## Commands

```sh
gh workflow run performance-evaluation.yml --ref beta11/release-94fc18a-ledger -f candidate_revision=94fc18a974f659ea882c89120dbf1adb3acf2f28
# paired: add -f baseline_revision=8b6a5fde52ecb4dfce13f09c7a947062d21483c7 -f rounds=20 (A/A: baseline = candidate)
```
