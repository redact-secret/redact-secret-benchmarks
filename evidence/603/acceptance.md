# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-22)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `079095e766e4a71e2b7e29413ed17be37bb3315d`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 12.600000000034925 | <= 30 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 121.79999999998836 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2152331.6912974142 | >= 1000000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 10 | <= 25 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 29.899999999965075 | <= 85 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2192441.471574467 | >= 790000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.1236229999999523 | <= 5 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 125.03346899999997 | <= 300 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2096670.612250229 | >= 1000000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3317760 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.813369999999999 | <= 5 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 42.22219899999999 | <= 70 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1552595.5907696807 | >= 950000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3244032 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 4.960307 | <= 5 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 117.37867399999999 | <= 250 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2233403.999775973 | >= 1200000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21722384 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 94932992 | <= 235929600 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2347998 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 4.777837999999996 | <= 5 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 23.230976000000013 | <= 50 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2821835.810944834 | >= 1300000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470536 | <= 17825792 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 65794048 | <= 166723584 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316123 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.844946 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 135.506363 | <= 250 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1934625.0183100258 | >= 1100000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21270528 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.801802 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 24.257319 | <= 55 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2702442.0959298923 | >= 1100000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21454848 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.019038 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 126.598133 | <= 300 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2070757.2362066351 | >= 1000000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3780608 | <= 9437184 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.021342 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 26.989392000000002 | <= 55 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2428880.205971294 | >= 1200000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3846144 | <= 9437184 | pass |
