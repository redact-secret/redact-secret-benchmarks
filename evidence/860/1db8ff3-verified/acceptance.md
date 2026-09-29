# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `1db8ff38b16e50c51229eb27025452952bf621e1`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 20 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 80.5 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3256571.4285714286 | >= 1100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 17 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 35.600000000034925 | <= 75 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1841404.494380216 | >= 920000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 3.0262340000000165 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 68.52623 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3825600.795491012 | >= 1500000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3305472 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.6781100000000606 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 20.680256999999983 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3169883.2369443015 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3325952 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 7.398889000000025 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 70.479286 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3719589.3272812096 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21748024 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 97853440 | <= 243269632 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2352854 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.454469000000003 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 9.104926000000006 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7199838.856460772 | >= 2000000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7483080 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67657728 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2321013 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.181517 | <= 3 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 63.52211 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4126972.4824946783 | >= 1600000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537581 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21630976 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 1.11046 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 9.024625 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7263902.932254803 | >= 2000000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21913600 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.048222 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 63.077101 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4156088.2767900196 | >= 1600000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3784704 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.046059 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 8.920849 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7348403.722560488 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3735552 | <= 10485760 | pass |
