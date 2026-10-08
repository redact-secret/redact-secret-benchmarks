# Cloudflare Workers qualification (#1000)

Four exact packed-artifact variants qualified in local workerd on the Linux CI runner. This record establishes compatibility with the selected Cloudflare Workers runtime, with the limits below.

Product source is [`5696d7e1a2950bdf54fa21244f351e1c4b171f25`](https://github.com/redact-secret/redact-secret/commit/5696d7e1a2950bdf54fa21244f351e1c4b171f25), version `0.1.0-beta.14`, from successful main push [Artifact qualification run 37772337995](https://github.com/redact-secret/redact-secret/actions/runs/37772337995), attempt 1. These are unpublished candidate artifacts from that source, not the registry release of the same version. This record was prepared from benchmarks develop `1c895b543c16aeb596a4db829f3600ab5775bda8` and makes no peer-scanner comparison or independent detector-scoring claim.

The [inventory](core-5696d7e1a295/artifact-inventory.json) binds the source, run, selected WASM hashes and exact bytes of the four reports. Its SHA-256 is `ce4e59de91d00514f29a0035333912d2ec470a8d56a1a0ecbb12fbcc9fd1cb74`. The [receipt](core-5696d7e1a295/receipt.json) records report hashes, immutable workflow/producer sources and Actions artifact IDs/archive digests. Raw reports and inventory are retained unchanged; downloaded edge archive bytes were checked against the Actions digest.

## Measurements

Runtime: workerd `1.20261001.1`, Wrangler `4.147.0`, compatibility date `2026-10-01`. Sizes below are bytes, timings milliseconds. Warm scan values are per-call medians of 21 samples, each batch containing 100 scan-and-redact calls; raw batches and all samples remain in each report. Initialization measures the first instance initialization and excludes process/bundler startup.

| Variant | Fixture bytes | Selected WASM raw / gzip | Qualification bundle raw / gzip | Initialize ms | Warm scan median ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| [full-off](core-5696d7e1a295/full-off.json) | 48 | 772,839 / 271,356 | 1,989,140 / 694,516 | 8 | 0.02 |
| [full-on](core-5696d7e1a295/full-on.json) | 25 | 1,071,819 / 395,853 | 1,989,189 / 694,538 | 9 | 0.01 |
| [common-off](core-5696d7e1a295/common-off.json) | 79 | 564,541 / 202,510 | 1,572,758 / 556,310 | 6 | 0.01 |
| [common-on](core-5696d7e1a295/common-on.json) | 25 | 863,534 / 326,429 | 1,572,776 / 556,291 | 9 | 0.01 |

The identical core tarball is 77,163 packed bytes, SHA-256 `42c0447c124ace12c128768b30e33d83b4c58b8af2d0d8502c6d42f795c62c35`; the WASM tarball is 1,239,966 packed bytes, SHA-256 `77af5822255f28f13b4fc6e2de3ce393abdfe6ce205e7d2e61cb858808c4c037`. Names, versions and filenames are recorded in every report.

## Scope and limits

Every dry-run bundle contains the profile's default and PII WASM modules plus the qualification worker, including smoke checks. Bundle totals sum independent per-module gzip sizes and exclude transport overhead. The off/on bundle delta therefore does not measure incremental PII shipping cost or prove that PII code is stripped. Selected-WASM sizes are distinct from whole-bundle sizes.

Fixtures differ across rows and are deliberately tiny; these timings do not compare profiles or establish generalized latency. `performance.now` is quantized: a zero sample means below clock resolution, not zero cost. Memory is unavailable because workerd exposes no process or isolate memory counters to the worker.

This qualification uses local workerd and offline Wrangler deploy dry-runs, without Cloudflare account deployment. It establishes neither production CPU/memory budgets nor US SSN promotion or cross-profile cost acceptance. The supported limits remain maximum input 1,000,000 UTF-16 code units, buffered input 16,512, token 8,192 and multiline 16,384.

## Reproduction and verification

Use the exact clean product source above, Node 22 and its locked dependencies. The [workflow](https://github.com/redact-secret/redact-secret/blob/5696d7e1a2950bdf54fa21244f351e1c4b171f25/.github/workflows/artifact-qualification.yml) `package-consumer-wasm-runtimes` job downloads that run's `wasm-web` and `wasm-web-common` artifacts into `dist/wasm-web` and `dist/wasm-web-common`, runs `npm ci --ignore-scripts` and `npm run js:build`, then packs and qualifies these inputs:

```sh
node scripts/pack-npm-candidate.mjs --wasm-dir dist/wasm-web --wasm-common-dir dist/wasm-web-common --out-dir edge-candidate
node scripts/qualify-workerd-artifact.mjs --candidate-dir edge-candidate --report edge-reports/full-off.json
node scripts/qualify-workerd-artifact.mjs --candidate-dir edge-candidate --pii --report edge-reports/full-on.json
node scripts/qualify-workerd-artifact.mjs --candidate-dir edge-candidate --detector-profile common --report edge-reports/common-off.json
node scripts/qualify-workerd-artifact.mjs --candidate-dir edge-candidate --detector-profile common --pii --report edge-reports/common-on.json
```

The [qualifier](https://github.com/redact-secret/redact-secret/blob/5696d7e1a2950bdf54fa21244f351e1c4b171f25/scripts/qualify-workerd-artifact.mjs) verifies package manifests, packed file hashes and selected binary identity, then records safe aggregate checks. Fixture paths and corpus SHA-256 values come from exact source files, with fixture IDs recorded in each report. The [inventory producer](https://github.com/redact-secret/redact-secret/blob/5696d7e1a2950bdf54fa21244f351e1c4b171f25/scripts/record-artifact-inventory.py) checks all four profile/PII combinations, consistent package sets and report hashes against the qualified browser artifacts. Independent receipt validation additionally checked exact source/run/attempt, pinned tool versions, source fixture hashes, report-to-inventory equality, selected/bundled WASM identity and measurement consistency.
