# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `fdca511d5a161202deebfd5906b17d7218ef9b2c`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 12 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 60.90000000002328 | <= 200 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4304663.382592771 | >= 1400000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 8.099999999976717 | <= 40 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 15.70000000006985 | <= 55 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4175414.012720277 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.7540480000000116 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 45.65577099999996 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 5741968.523541093 | >= 1600000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3350528 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 1.7953970000000083 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 12.843874 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 5103911.794836978 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3276800 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 4.793255999999985 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 52.38368 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 5004497.5839803545 | >= 1600000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21701360 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 94896128 | <= 239075328 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348326 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 4.288857 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 9.722729000000001 | <= 30 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 6742345.693271919 | >= 2200000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7563720 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67448832 | <= 169869312 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.707793 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 44.949518 | <= 150 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 5832187.12156157 | >= 1800000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21286912 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.617996 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 9.177388 | <= 30 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7142991.012257518 | >= 2200000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21450752 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.016793 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 43.554065 | <= 150 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 6019047.820220684 | >= 1900000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3866624 | <= 9437184 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.019848 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 9.008795 | <= 30 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7276666.857221194 | >= 2200000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3895296 | <= 9437184 | pass |
