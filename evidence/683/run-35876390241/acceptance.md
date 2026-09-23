# RC performance and resource acceptance

- Status: **REJECTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `065ec76c7978ee60c5de8412bd04b91d39c2c275`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 16 | <= 25 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 187.09999999997672 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1401143.7733833918 | >= 1200000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 12.299999999988358 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 43.10000000000582 | <= 45 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1520974.4779580312 | >= 1400000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.5184220000001005 | <= 4 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 180.83409499999993 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1449693.4330884896 | >= 1600000 | fail |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3231744 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.4938270000000102 | <= 4 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 47.61681500000003 | <= 45 | fail |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1376698.5465113523 | >= 1400000 | fail |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3207168 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 5.9498629999999935 | <= 9 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 178.35778100000005 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1469820.9325669953 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21701464 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95617024 | <= 238026752 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2348242 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.007730999999993 | <= 9 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 35.950008999999994 | <= 45 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1823476.594957181 | >= 1600000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7470912 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67944448 | <= 176160768 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2316568 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.947134 | <= 2 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 172.348248 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1521071.4529572704 | >= 1400000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537604 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21274624 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.942024 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 34.385143 | <= 40 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1906462.9162659 | >= 1800000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21528576 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.022452 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 184.62446 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 1419931.0318903574 | >= 1500000 | fail |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3735552 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.021058999999999998 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 39.109346 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 1676172.237705023 | >= 1700000 | fail |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3784704 | <= 10485760 | pass |

## Failures

- `cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second:threshold-not-met`
- `cli:performance:scale-logs-small-whole:processing-p95-ms:threshold-not-met`
- `cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second:threshold-not-met`
- `rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second:threshold-not-met`
- `rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second:threshold-not-met`
