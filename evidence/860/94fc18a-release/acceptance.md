# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `94fc18a974f659ea882c89120dbf1adb3acf2f28`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 31.29999999998836 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 23.5 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 11155489.361702127 | >= 1100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 12.299999999988358 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 18.10000000000582 | <= 75 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3621767.9557999405 | >= 920000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.3630850000000123 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 17.909322000000003 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 14637851.728837082 | >= 1500000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 4059136 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.137757999999998 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 6.269556999999992 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 10455922.164835583 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3715072 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 5.4099080000000015 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 20.335689000000002 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 12891326.180293178 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21726592 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95481856 | <= 243269632 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2352671 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 4.695816000000001 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 3.002825999999999 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 21830768.749171622 | >= 2000000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7483112 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 67923968 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2321013 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.997237 | <= 3 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 15.205817 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 17240375.837746833 | >= 1600000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537700 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21827584 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 0.907582 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 2.971278 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 22062560.285506777 | >= 2000000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21356544 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.050416 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 14.80826 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 17703227.793137074 | >= 1600000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 4001792 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.051428 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 2.968434 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 22083698.003728565 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3973120 | <= 10485760 | pass |
