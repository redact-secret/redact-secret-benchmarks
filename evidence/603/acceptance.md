# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `2b98027bbf38d63f07b75129fe2864ef32ed4732`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 15.599999999976717 | <= 25 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 82.70000000006985 | <= 150 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3169939.5405051825 | >= 2100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 11 | <= 20 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 25.800000000046566 | <= 35 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2540852.7131737084 | >= 2000000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.3305719999999894 | <= 4 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 63.66073300000005 | <= 95 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4117985.8862134023 | >= 2800000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3321856 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.143530999999996 | <= 4 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 17.68699699999999 | <= 30 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3706338.617007739 | >= 2500000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3346432 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.254257999999993 | <= 10 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 71.53671400000002 | <= 150 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 3664607.7984515745 | >= 2500000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21703896 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95305728 | <= 238026752 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348344 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.340756999999996 | <= 9 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 12.575372999999999 | <= 20 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 5212887.1247 | >= 3300000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7402840 | <= 19922944 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 70201344 | <= 168820736 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.90757 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 58.128738 | <= 90 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4509886.314751922 | >= 2900000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21303296 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.884706 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 11.752622 | <= 20 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 5577819.145378793 | >= 3500000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21516288 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.02099 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 60.389026 | <= 90 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 4341086.739832499 | >= 3000000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3895296 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.024819 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 11.950878 | <= 20 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 5485287.357129744 | >= 3600000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3899392 | <= 10485760 | pass |
