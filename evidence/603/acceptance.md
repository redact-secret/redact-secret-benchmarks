# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `41fc36603ef0a25aeb1992aca2fbfad2e2f37aa1`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 10.5 | <= 30 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 102.10000000003492 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2567619.980410483 | >= 1000000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 14 | <= 20 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 22.29999999998836 | <= 60 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2939641.255606916 | >= 1000000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.9440309999999954 | <= 5 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 81.78717900000001 | <= 300 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3205319.0146098565 | >= 1000000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3321856 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 1.622995000000003 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 22.247591 | <= 85 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2946566.2147420812 | >= 770000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3325952 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 4.3737680000000125 | <= 10 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 91.20869800000003 | <= 250 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2874221.491463456 | >= 1100000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21701712 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 94965760 | <= 238026752 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348236 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 4.2059599999999975 | <= 10 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 20.05687900000001 | <= 50 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3268404.8201118414 | >= 1400000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7405848 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 70074368 | <= 164626432 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.623854 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 89.080396 | <= 300 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2942892.171247196 | >= 960000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21286912 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.57365 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 17.906993 | <= 50 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3660804.468958021 | >= 1300000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21442560 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.018137 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 82.309673 | <= 300 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3184971.9534179172 | >= 1000000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3964928 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.016555 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 19.018422 | <= 55 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3446868.5151691344 | >= 1200000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3854336 | <= 10485760 | pass |
