# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `da69ebf5090e0fb9519eb07829ff46001ede0de2`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 16.399999999965075 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 43 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 6096604.651162791 | >= 1100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 15.400000000023283 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 23.399999999965075 | <= 75 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 2801452.9914571727 | >= 920000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.3526569999999936 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 24.279808000000003 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 10797202.350199802 | >= 1500000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 4030464 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.353689000000003 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 8.204364999999996 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 7990136.957582949 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3682304 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.2178810000000055 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 26.81182000000001 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 9777553.332821118 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21747936 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95096832 | <= 243269632 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2352838 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 6.235112999999998 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 3.7618300000000033 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 17426093.151471477 | >= 2000000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7483008 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 66347008 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2321013 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.072164 | <= 3 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 21.481006 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 12203990.818679534 | >= 1600000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537748 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21848064 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 1.052327 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 3.766802 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 17403091.534941312 | >= 2000000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21340160 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.048641 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 21.127486 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 12408196.602283867 | >= 1600000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3923968 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.045293999999999994 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 3.711055 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 17664518.580295898 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3878912 | <= 10485760 | pass |
