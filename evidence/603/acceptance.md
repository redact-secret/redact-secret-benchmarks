# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `3144bb32c6ebf8f1eefa2cbbad7d431d1d6e8c4c`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 17.399999999965075 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 115.5 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2269731.6017316016 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 13.099999999976717 | <= 25 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 35.29999999998836 | <= 50 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1857053.8243632186 | >= 1300000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.8320870000000014 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 85.56273599999997 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3063880.5192017243 | >= 1600000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3284992 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.6162920000000014 | <= 5 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 23.399737000000016 | <= 45 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2801484.4782229797 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3244032 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.395963999999992 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 90.48937000000001 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2897069.5673978054 | >= 1500000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21724840 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 97259520 | <= 240123904 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348439 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.092246000000003 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 15.847566 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4136534.2791441916 | >= 2100000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470936 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 68087808 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.026253 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 81.351337 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3222491.598386392 | >= 1700000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21368832 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.970198 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 15.89261 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4124810.2105318136 | >= 2100000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21610496 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.027922000000000002 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 79.303971 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3305685.663584236 | >= 1700000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3870720 | <= 9437184 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.028283 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 18.380934 | <= 35 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3566412.892837763 | >= 2100000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3911680 | <= 10485760 | pass |
