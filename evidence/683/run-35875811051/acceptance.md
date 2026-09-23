# RC performance and resource acceptance

- Status: **REJECTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `065ec76c7978ee60c5de8412bd04b91d39c2c275`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 17.900000000023283 | <= 25 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 197.70000000001164 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1326019.2210419048 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 15.5 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 40.20000000001164 | <= 45 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1630696.517412463 | >= 1400000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.59718799999996 | <= 4 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 196.50227599999994 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1334101.5958512363 | >= 1600000 | fail |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3153920 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.7352960000000053 | <= 4 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 50.28447 | <= 45 | fail |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1303662.9400687728 | >= 1400000 | fail |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3194880 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.401909000000018 | <= 9 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 189.86995100000007 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1380702.9422997003 | >= 1400000 | fail |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21733440 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95195136 | <= 238026752 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348283 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.12949900000001 | <= 9 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 36.821533999999986 | <= 45 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1780316.9199849206 | >= 1600000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470912 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67276800 | <= 176160768 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.049628 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 177.392844 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1477816.0949942265 | >= 1400000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21319680 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.988937 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 35.663658 | <= 40 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1838117.671496289 | >= 1800000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21528576 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.02657 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 193.793094 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1352752.0232480525 | >= 1500000 | fail |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3702784 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.024386 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 42.204776 | <= 40 | fail |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1553236.5341780277 | >= 1700000 | fail |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3731456 | <= 10485760 | pass |

## Failures

- `cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second:threshold-not-met`
- `cli:performance:scale-logs-small-whole:processing-p95-ms:threshold-not-met`
- `cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second:threshold-not-met`
- `node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second:threshold-not-met`
- `rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second:threshold-not-met`
- `rust-core:performance:scale-logs-small-whole:processing-p95-ms:threshold-not-met`
- `rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second:threshold-not-met`
