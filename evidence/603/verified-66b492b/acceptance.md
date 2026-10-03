# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `66b492bdff5e6751fc6b5409266916346ed7c723`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 16 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 15.5 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 16913161.29032258 | >= 1100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 14.5 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 6.5 | <= 75 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 10085230.76923077 | >= 920000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.9996459999999985 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 9.972923000000009 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 26286576.16227457 | >= 1500000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3588096 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 1.9284379999999999 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 4.122568999999999 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 15901249.924500966 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3575808 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 4.773975000000007 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 8.285859999999985 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 31638719.45700271 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 16255488 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 96538624 | <= 243269632 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2356053 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 4.9825699999999955 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 1.2737380000000087 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 51465843.05406571 | >= 2000000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7615992 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67596288 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2364668 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.907694 | <= 3 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 8.090955 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 32400872.33212891 | >= 1600000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537740 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21905408 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.895776 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 1.25551 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 52213044.89808923 | >= 2000000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 20955136 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.055634 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 7.7362899999999994 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 33886268.48269649 | >= 1600000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 4063232 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.057948 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 1.241269 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 52812081.829160325 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3538944 | <= 10485760 | pass |
