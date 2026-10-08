# Exact configuration-artifact observations for core #1283

Node-hosted WebAssembly measurements for [core #1283](https://github.com/redact-secret/redact-secret/issues/1283), with one exact qualified core source and one clean benchmark source. This is exploratory performance evidence, not support promotion, official Linux acceptance, or a release verdict. No evaluation pins or accepted qualification state changed.

## Identity and qualification

- Core source: [`95293414dbd2dbdd21103a921a746cf346b28d94`](https://github.com/redact-secret/redact-secret/tree/95293414dbd2dbdd21103a921a746cf346b28d94).
- Clean measured benchmark source: [`8e2895144d30d4ea5325c5f3d1e77fe7167a77ac`](https://github.com/redact-secret/redact-secret-benchmarks/tree/8e2895144d30d4ea5325c5f3d1e77fe7167a77ac), verified unchanged and clean before/after sampling. The evidence commit follows this source and does not replace it.
- Successful automatic qualification: [run 37818423797, attempt 1](https://github.com/redact-secret/redact-secret/actions/runs/37818423797). The retained inventory binds standard WASM/glue and core package bytes; custom manifest/build report bind its three-detector composition and clean source.
- Core tarball: `redact-secret-core-0.1.0-beta.14.tgz`, SHA256 `7451a4d6de0c45a54553a45d71d2f6b57129ace52368e427d1f1527a4ff8f37f`. Extracted runtime files were checked against this exact qualified tarball.
- Generated at `2026-10-08T17:55:55.764Z`. Report canonical artifact commitment: `sha256:84b13233a9ae4ebed55dbb13f7dbd9feacc49ceadb4354a2e81098cf689b088f`.
- Measurement host: Darwin/arm64, Apple M4, Node 22.16.0. Artifacts were compiled by the qualified Linux/rustc 1.99.0 workflow; host timing is local Darwin verification.
- TruffleHog 3.97.4 was verified on the canonical peer-bin PATH before measurement. No peer scan or stable count was produced.

Standard embedded manifest source revisions are `null`, recorded unchanged; exact files are bound to the source through the successful qualification inventory. Custom embeds the exact source revision. All five binary digests differ, including dedicated full/common PII binaries and glue; PII was explicitly activated with `pii:global`.

The retained configuration receipt includes Chromium browser checks and local workerd custom runtime checks. It does not demonstrate a deployed Cloudflare service or another browser engine. This measurement itself does not time browser or Workers startup. Qualification controls and runtime checks are distinct from performance observations.

## Protocol and scope

Five fresh processes per artifact/mode, ten iterations after one warmup, synthetic UTF-8 inputs of **4,096 and 65,536 bytes**, ten rows and 50 serial worker processes. Full/common/custom and dedicated full/common PII each run all-included and narrowed modes. Full narrows to GitHub/JWT/generic; common narrows to JWT/generic; custom defaults to its three compiled detectors and narrows to JWT/generic. PII remains activated in both PII modes. The synthetic workload exercises secret detection, contains no intentional PII target, and does not establish PII accuracy or performance on representative PII workloads.

Stock variants use a reconstructed runtime from qualified core internals; custom uses its actual generated bundled entry. Startup is module-import plus initialization, including byte loading, compilation, manifest verification and registry creation. It excludes process/driver boot and is neither default public-package startup nor isolated registry latency. The sum is comparable under this protocol; individual components reflect packaging and synchronous/asynchronous I/O. No timing difference is attributed solely to detector count.

Memory values are RSS/heap/external checkpoints, not peak RSS or separate WebAssembly linear memory; categories overlap. Fixed configuration resolution records configuration bytes/digest, not input-length-dependent resolution. Two/four-side comparison uses repeated identical narrowed configurations. Session creation and 4,096-code-unit chunk append are separate metrics; append excludes session creation/finalization. OS cache is not flushed; five samples do not establish statistical confidence, and the reported nearest-rank p95 equals the maximum with this sample size.

Only hashes/counts of synthetic inputs/findings are retained. Every row's outputs repeated identically across five processes. Both parity pairs matched at both input sizes in every corresponding sample: full/narrowed vs custom/all-included (same three enabled secret detectors), common/narrowed vs custom/narrowed (same two). These are workload observations, not whole-product conformance. Unlike narrowed pairs, all-included rows use different detector sets and are not equivalent-work comparisons.

## Artifact footprint

Gzip level 9 and Brotli quality 11, using the same benchmark helper for all five exact binaries.

| Artifact | Raw B | Gzip B | Brotli B |
| --- | ---: | ---: | ---: |
| full | 775,001 | 271,849 | 208,706 |
| common | 566,699 | 202,825 | 159,319 |
| custom | 554,411 | 195,912 | 153,436 |
| full-pii | 1,073,980 | 395,930 | 306,855 |
| common-pii | 865,692 | 326,813 | 257,231 |

The historical full Brotli baseline is **181,882 B**, with a **15%** arithmetic limit of **209,164.3 B**. Exact final full is **208,706 B**, growth **14.7480%**, within that byte bound by **458.3 B**. The baseline's Darwin/rustc 1.98.1 context differs from qualified Linux/rustc 1.99.0, so `comparableBuildEnvironmentVerified` remains **false**. This is an arithmetic observation, not a comparable-build acceptance claim. Other profiles have no historical acceptance baseline here.

## Timing and memory observations

Values below are five-process medians. Full distributions and all scan/configuration/session metrics remain in the raw report; throughput is MiB/s.

All-included:

| Artifact | Enabled secret detectors | Startup ms | Initialized RSS MiB | 4 KiB scan MiB/s | 64 KiB scan MiB/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| full | 120 | 13.897 | 56.61 | 5.85 | 17.89 |
| common | 6 | 13.852 | 55.91 | 12.81 | 30.43 |
| custom | 3 | 11.881 | 51.00 | 8.52 | 27.36 |
| full-pii | 120 | 14.960 | 57.62 | 5.03 | 15.46 |
| common-pii | 6 | 14.003 | 56.53 | 11.26 | 25.38 |

Narrowed:

| Artifact | Enabled secret detectors | Startup ms | Initialized RSS MiB | 4 KiB scan MiB/s | 64 KiB scan MiB/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| full | 3 | 14.320 | 56.78 | 8.67 | 24.50 |
| common | 2 | 13.645 | 55.89 | 13.37 | 32.32 |
| custom | 2 | 11.990 | 50.86 | 9.94 | 33.25 |
| full-pii | 3 | 14.952 | 57.53 | 7.22 | 21.56 |
| common-pii | 2 | 14.105 | 56.53 | 11.84 | 26.78 |

## Retained inputs and integrity

`measurement-plan.json` preserves the exact absolute-path plan whose canonical digest is recorded in the report. To replay on another host, obtain the exact qualified artifact files and core tarball, validate their recorded hashes, map the plan's local paths to those extracted files, and use a clean checkout of the measured benchmark commit. This local path remapping changes the plan digest; do not rewrite the original measured report. Binary bodies/tarballs are not duplicated in this evidence directory.

```sh
node scripts/measure-configuration-artifacts.mjs \
  --plan /absolute/path/to/mapped-plan.json \
  --out /absolute/path/outside-checkout/configuration-performance.json
```

| Retained file | SHA256 |
| --- | --- |
| [configuration-performance.json](configuration-performance.json) | `134b853136612f872eca02f66a86a51132c4f5a94ade8cacee6c5e9e92744a21` |
| [measurement-plan.json](measurement-plan.json) | `1d2136be9f40751b6f4abdb199825ca7a593df2ef03c66ac2565bd539b131962` |
| [qualification-inventory.json](qualification-inventory.json) | `c4f861ef7c379d76d679d189c2ef752849c90bc634901e5e9075c3f4a0ff6dd5` |
| [configuration-journeys.json](configuration-journeys.json) | `8adf9af367eaf4a2db248ac78d069dc7c835a7d265bf5b199850b20d86916944` |
| [custom-build-report.json](custom-build-report.json) | `3f7f8f43a378311513e7268e0212a39b736381fc0d2154432960bb260f3e9a13` |
| [custom-artifact-manifest.json](custom-artifact-manifest.json) | `bbae97356e850729418a7b4fc15c77db3c52b4b95d9aece8d9fcfe0fe2ad101d` |
