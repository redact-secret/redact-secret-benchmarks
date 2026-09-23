# Evidence: redact-secret#683 — performance evaluation REJECTED at product main 065ec76 (fixed by product #684)

**Result:** REJECTED, reproduced. Product `main` at
`065ec76c7978ee60c5de8412bd04b91d39c2c275` fails this repository's fixed
Linux x64 criteria (`rc-performance-resource-linux-x64-benchmarks-v1`,
derived from the `41fc366` run) in two consecutive `performance-evaluation.yml`
runs — 7/46 checks, then 5/46 — every failure a `scale-logs` throughput floor
or processing p95 ceiling, on `rust-core`, `cli` and `node` alike;
throughput is roughly half of the `41fc366` baseline run.

**Resolved:** product [#684](https://github.com/redact-secret/redact-secret/pull/684) (`15fce66`) fixed it; that commit evaluated ACCEPTED, 46/46, against these same criteria ([`evidence/603/`](../603/README.md)), and the criteria were then recalibrated from that run. The rest of this file records the rejected runs as they were.

Filed as [redact-secret/redact-secret#683](https://github.com/redact-secret/redact-secret/issues/683).
Format per [`evidence/README.md`](../README.md). The criteria in
`benchmarks/performance-criteria.json` deliberately stay at the `41fc366`
baseline: a margin-derived threshold necessarily accepts the run it is
derived from, so re-deriving from a rejected run would erase the signal.
Until the product decides, `benchmarks/pin-manifest.json` (`065ec76`) and
`performance-criteria.json` (`41fc366`) disagree and `npm run pins:check` /
`tests/pin-drift.test.mjs`'s real-tree case stay red by design (#150's
coupling).

## Source revisions

| Repository | Revision |
| --- | --- |
| `redact-secret` (measured) | `065ec76c7978ee60c5de8412bd04b91d39c2c275`, `main` (PRs #679, #680, #681 since the `41fc366` baseline), checked out clean by the workflow. |
| `redact-secret` (baseline the criteria came from) | `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`, run 35868842776, `evidence/603/`. |
| `redact-secret-benchmarks` | branch `milocosmopolitan/new-detectors-fixture` at `b385ca9202f7fee61419af67dc6ba6297491a695` (run 35875811051) and `de03f84` (run 35876390241) — the criteria file is identical at both. |

## Pinned scanner versions

Not a scanner comparison. Both runs are core's own release-build
`CompleteAssessment` (`npm run assessment:all -- --runs 5`) over its accuracy
corpus (version `3`, hash `438df062…`) and workload profiles (version `1`,
hash `b4db2cd2…`) on `ubuntu-latest`, Node 22, Python 3.12, Chromium; every
result carries its own `provenance.artifactIdentity` in `summary.json`.

- run [35875811051](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35875811051): REJECTED, 7 failures — [`run-35875811051/acceptance.md`](run-35875811051/acceptance.md)
- run [35876390241](https://github.com/redact-secret/redact-secret-benchmarks/actions/runs/35876390241): REJECTED, 5 failures — [`run-35876390241/acceptance.md`](run-35876390241/acceptance.md)

## Failing checks against the baseline run

| check | 41fc366 (baseline) | 065ec76 run 1 | 065ec76 run 2 | requirement |
| --- | ---: | ---: | ---: | ---: |
| `rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second` | 3184971.9 | 1352752.0 | 1419931.0 | >=1500000 |
| `rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second` | 3446868.5 | 1553236.5 | 1676172.2 | >=1700000 |
| `rust-core:performance:scale-logs-small-whole:processing-p95-ms` | 19.018422 | 42.204776 | 39.109346 | <=40 |
| `cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second` | 3205319.0 | 1334101.5 | 1449693.4 | >=1600000 |
| `cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second` | 2946566.2 | 1303662.9 | 1376698.5 | >=1400000 |
| `cli:performance:scale-logs-small-whole:processing-p95-ms` | 22.247591 | 50.28447 | 47.616815 | <=45 |
| `node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second` | 2874221.4 | 1380702.9 | 1469820.9 | >=1400000 |

Bytes per second for throughput rows, milliseconds for p95 rows. All other
checks (initialization, memory, browser-wasm, python) pass in both runs.

## Command

```sh
# with benchmarks/pin-manifest.json pinning 065ec76c7978ee60c5de8412bd04b91d39c2c275
gh workflow run performance-evaluation.yml --ref milocosmopolitan/new-detectors-fixture
gh run download <run-id> --dir <dir>          # summary.json, acceptance.json, acceptance.md
npm run performance:evaluate -- --summary <dir>/summary.json --criteria benchmarks/performance-criteria.json
```
