# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `15fce66e7c2d45003d7c6e31a341e5bc875a7326`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 16.79999999998836 | <= 25 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 87.39999999999418 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 2999473.684210726 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 17.89999999999418 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 25.800000000017462 | <= 45 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2540852.713176575 | >= 1400000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.764870999999971 | <= 4 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 81.39497 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3220764.1332136374 | >= 1600000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3223552 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.686489999999992 | <= 4 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 23.363432999999986 | <= 45 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2805837.6523689837 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3219456 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.00643500000001 | <= 9 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 77.39709299999998 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3387129.798272915 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21730072 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95629312 | <= 238026752 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348317 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 5.886623 | <= 9 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 14.603887 | <= 45 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4488804.932549807 | >= 1600000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470792 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67788800 | <= 176160768 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.975002 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 69.475909 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3773307.953408713 | >= 1400000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21286912 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.939196 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 14.538285 | <= 40 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4509060.043877252 | >= 1800000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21512192 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.021891 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 68.871434 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3806425.752656755 | >= 1500000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3735552 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.021429 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 14.387782999999999 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 4556226.626437166 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3768320 | <= 10485760 | pass |
