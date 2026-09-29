# RC performance and resource acceptance

- Status: **ACCEPTED**
- Criteria: `rc-performance-resource-linux-x64-benchmarks-v1` (fixed 2026-09-23)
- Environment profile: `linux-x64-node22-chromium`
- Source commit: `8f97f14d97d73b76602e5396eea35d0a5a4f0eb3`
- Complete assessment: [summary](evidence/603/summary.json)

## Threshold checks

| Check | Observed | Requirement | Result |
| --- | ---: | ---: | --- |
| browser-wasm:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 17.39999999999418 | <= 35 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:processing-p95-ms | 29.5 | <= 250 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 8886576.271186441 | >= 1100000 | pass |
| browser-wasm:performance:scale-logs-medium-fixed4096:memory-browserJsHeap-maximum-bytes | 39600000 | <= 99614720 | pass |
| browser-wasm:performance:scale-logs-small-whole:initialization-p95-ms | 14.5 | <= 30 | pass |
| browser-wasm:performance:scale-logs-small-whole:processing-p95-ms | 21.5 | <= 75 | pass |
| browser-wasm:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 3049023.255813954 | >= 920000 | pass |
| browser-wasm:performance:scale-logs-small-whole:memory-browserJsHeap-maximum-bytes | 10000000 | <= 25165824 | pass |
| cli:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 2.3524890000000056 | <= 6 | pass |
| cli:performance:scale-logs-medium-fixed4096:processing-p95-ms | 21.31898799999999 | <= 200 | pass |
| cli:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 12296737.537447844 | >= 1500000 | pass |
| cli:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3928064 | <= 8388608 | pass |
| cli:performance:scale-logs-small-whole:initialization-p95-ms | 2.271669000000003 | <= 6 | pass |
| cli:performance:scale-logs-small-whole:processing-p95-ms | 7.454580000000021 | <= 50 | pass |
| cli:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 8793788.516589776 | >= 1400000 | pass |
| cli:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3551232 | <= 8388608 | pass |
| node:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 6.130607999999995 | <= 15 | pass |
| node:performance:scale-logs-medium-fixed4096:processing-p95-ms | 23.809052999999977 | <= 200 | pass |
| node:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 11010685.725299543 | >= 1400000 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeHeap-maximum-bytes | 21751928 | <= 54525952 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeRss-maximum-bytes | 95899648 | <= 243269632 | pass |
| node:performance:scale-logs-medium-fixed4096:memory-nodeExternal-maximum-bytes | 2352715 | <= 6291456 | pass |
| node:performance:scale-logs-small-whole:initialization-p95-ms | 5.982061000000002 | <= 15 | pass |
| node:performance:scale-logs-small-whole:processing-p95-ms | 3.684675000000013 | <= 35 | pass |
| node:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 17790985.63645363 | >= 2000000 | pass |
| node:performance:scale-logs-small-whole:memory-nodeHeap-maximum-bytes | 7483080 | <= 18874368 | pass |
| node:performance:scale-logs-small-whole:memory-nodeRss-maximum-bytes | 68509696 | <= 170917888 | pass |
| node:performance:scale-logs-small-whole:memory-nodeExternal-maximum-bytes | 2321013 | <= 6291456 | pass |
| python:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 1.056822 | <= 3 | pass |
| python:performance:scale-logs-medium-fixed4096:processing-p95-ms | 19.637721 | <= 200 | pass |
| python:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 13349512.400140526 | >= 1600000 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-pythonHeap-maximum-bytes | 537700 | <= 2097152 | pass |
| python:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 21778432 | <= 53477376 | pass |
| python:performance:scale-logs-small-whole:initialization-p95-ms | 1.015123 | <= 2 | pass |
| python:performance:scale-logs-small-whole:processing-p95-ms | 3.836869 | <= 35 | pass |
| python:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 17085284.90287263 | >= 2000000 | pass |
| python:performance:scale-logs-small-whole:memory-pythonHeap-maximum-bytes | 75205 | <= 1048576 | pass |
| python:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 21291008 | <= 54525952 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:initialization-p95-ms | 0.053359000000000004 | <= 1 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:processing-p95-ms | 18.760795 | <= 200 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:throughput-minimum-bytes-per-second | 13973501.65597993 | >= 1600000 | pass |
| rust-core:performance:scale-logs-medium-fixed4096:memory-processRss-maximum-bytes | 3858432 | <= 10485760 | pass |
| rust-core:performance:scale-logs-small-whole:initialization-p95-ms | 0.052108 | <= 1 | pass |
| rust-core:performance:scale-logs-small-whole:processing-p95-ms | 3.63877 | <= 40 | pass |
| rust-core:performance:scale-logs-small-whole:throughput-minimum-bytes-per-second | 18015428.290328875 | >= 1700000 | pass |
| rust-core:performance:scale-logs-small-whole:memory-processRss-maximum-bytes | 3842048 | <= 10485760 | pass |
