# RC performance and resource acceptance

- Status: **REJECTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `f2082ab6fe1d0fc8cc703e371e9203bc4ff68f6b`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 15.700000000011642 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 102.10000000003492 | <= 200 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2567619.980410483 | >= 1500000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 10.600000000034925 | <= 25 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 24.29999999998836 | <= 55 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2697695.473252321 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.5421210000000087 | <= 5 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 79.59136899999999 | <= 150 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3293749.099855288 | >= 2000000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3252224 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.4546670000000006 | <= 5 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 22.135778000000016 | <= 40 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2961450.010928008 | >= 1800000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3227648 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.088954000000001 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 86.99860000000001 | <= 150 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3013312.857908058 | >= 1800000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21730152 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95678464 | <= 239075328 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348335 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 5.805004000000011 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 15.512297000000004 | <= 30 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4225937.654494366 | >= 2600000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470816 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 68177920 | <= 176160768 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.931457 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 76.934735 | <= 150 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3407485.578523147 | >= 2200000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21282816 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.897013 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 15.2941 | <= 25 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4286228.022570795 | >= 2700000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21516288 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.028753 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 75.589225 | <= 150 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3468139.804317348 | >= 2100000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3727360 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.028503 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 15.272590000000001 | <= 25 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4292264.769760728 | >= 2700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3788800 | <= 10485760 | pass |

## Failures

- `suite:accuracy-corpus-identity-mismatch`
