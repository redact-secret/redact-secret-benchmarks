# MCP adapter black-box qualification (#321: tools/call and resources/read)

**Result.** complete: 3048 case runs over 24/24 cells (1464 of them resources/read); **0 leaks**, 0 process-output leaks, 0 contract deviations, 96 known false negatives (documented exclusions), 120 deliveries by an explicit or default warn/allow policy, 12 documented host-responsibility observations (the 2.x response cache); the unprotected controls (tools/call and resources/read) were flagged in 24/24 cells.

resources/read alone: 1464 case runs, **0 leaks**, 0 deviations, 24 known false negatives, control flagged in 24/24 cells.

## Identity

| Item | Value |
| --- | --- |
| Benchmark | redact-secret-benchmarks `37451453678a76b30b3f7884b31c1ea555bedbfd` (clean) |
| Core candidate | redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef` |
| core core tarball | `redact-secret-core-0.1.0-beta.8.tgz` sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| core node tarball | `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` sha256 `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| core wasm tarball | `redact-secret-wasm-0.1.0-beta.8.tgz` sha256 `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |
| Adapters | redact-secret-adapters `be3f2ad5088d108867b7bae13933d706d8f1f861`, pin-source sha256 `e30ed79e1adb8a88f0c870a9646764b62b92a26e830176dd63e791dee875a7ec` |
| @redact-secret/adapter@0.1.2 | content digest `sha256:181853358a4c7a0bb75d404c60bc6039a0749ff25a7a7ff88ef1d11308c893d2` (verified) |
| @redact-secret/adapter-ai-context@0.1.0-alpha.1 | content digest `sha256:9b2b8ea10041043fb852fa76502e893113c1511fec90a5c2ebc698d357093fe1` (verified) |
| @redact-secret/adapter-mcp@0.1.0-alpha.1 | content digest `sha256:961d84eb2cc24ee4faba7d0524ca120d90a58fd40a50fb4201f44d771f320a30` (verified) |
| Compatibility record | sha256 `8900469d7155965b3d3a95aba381ad771a453d9f47f0fedaeeac99b15a66439a`, runtime 20.x || 22.x || 24.x |
| Contract | https://github.com/redact-secret/redact-secret/blob/0af4cb83b571baa86d27a678a351ece2ebc1f3cb/docs/reference/mcp-boundary.md |
| resources/read contract | https://github.com/redact-secret/redact-secret/blob/0af4cb83b571baa86d27a678a351ece2ebc1f3cb/docs/reference/mcp-resources-read.md |
| Host | darwin-25.5.0 arm64, Apple M4 |

## Matrix executed

| Node.js | SDK | Transport | Protocol | Status | Cases | Leaks | Deviations | Known FN | Control |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| node-20.20.2 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-20.20.2 | sdk@1.13.0 | http | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-22.16.0 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-22.16.0 | sdk@1.13.0 | http | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-24.21.0 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-24.21.0 | sdk@1.13.0 | http | 2025-06-18 | complete | 126 | 0 | 0 | 4 | flagged |
| node-20.20.2 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-20.20.2 | sdk@1.30.1 | http | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-22.16.0 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-22.16.0 | sdk@1.30.1 | http | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-24.21.0 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-24.21.0 | sdk@1.30.1 | http | 2025-11-25 | complete | 126 | 0 | 0 | 4 | flagged |
| node-20.20.2 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-20.20.2 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-22.16.0 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-22.16.0 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-24.21.0 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-24.21.0 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-20.20.2 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-20.20.2 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-22.16.0 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-22.16.0 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-24.21.0 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |
| node-24.21.0 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 128 | 0 | 0 | 4 | flagged |

## Cases

Containment is what the leak scan found across the model context, host log, store, audit trail and error text (and, for server-wrapped tools and resources, the server's wire output and handler input; for the 2.x response-cache cases, the store the host handed its client). A case conforms when its outcome, fixed result or error and lifecycle checks match the contract and nothing leaked.

### tools/call

| Case | Area | Containment | Conforms | Failed checks | Sinks with plaintext |
| --- | --- | --- | ---: | --- | --- |
| `text-provider-token` | text | contained | 24/24 | — | — |
| `text-mixed-sensitive-and-benign-siblings` | text | contained | 24/24 | — | — |
| `structured-nested-with-text-copy` | structuredContent | contained | 24/24 | — | — |
| `structured-key-context-redacts-in-place` | structuredContent | contained | 24/24 | — | — |
| `structured-private-key-block-finding` | structuredContent | contained | 24/24 | — | — |
| `structured-many-findings-across-leaves` | limits | contained | 24/24 | — | — |
| `structured-secret-as-object-key` | structuredContent | contained | 24/24 | — | — |
| `structured-nodes-near-limit` | limits | contained | 24/24 | — | — |
| `text-secret-at-end-of-large-leaf` | limits | contained | 24/24 | — | — |
| `annotations-with-unknown-field` | fields | contained | 24/24 | — | — |
| `meta-on-result` | _meta | contained | 24/24 | — | — |
| `meta-on-block` | _meta | contained | 24/24 | — | — |
| `resource-link-query-and-description` | resource_link | contained | 24/24 | — | — |
| `embedded-text-resource` | resource | contained | 24/24 | — | — |
| `unknown-top-level-field` | fields | contained | 24/24 | — | — |
| `multibyte-text-and-structured` | text | contained | 24/24 | — | — |
| `is-error-result-is-scanned` | text | contained | 24/24 | — | — |
| `text-private-key-block-finding` | text | contained | 24/24 | — | — |
| `image-blocked-by-default` | binary | contained | 24/24 | — | — |
| `blob-resource-blocked-by-default` | binary | contained | 24/24 | — | — |
| `large-benign-structured` | benign | contained | 24/24 | — | — |
| `large-benign-text` | benign | contained | 24/24 | — | — |
| `depth-within-limit` | limits | contained | 24/24 | — | — |
| `depth-over-limit` | limits | contained | 24/24 | — | — |
| `nodes-over-limit` | limits | contained | 24/24 | — | — |
| `leaf-over-input-limit` | limits | contained | 24/24 | — | — |
| `findings-over-limit-in-one-leaf` | limits | contained | 24/24 | — | — |
| `malformed-unknown-block-type` | malformed | contained | 24/24 | — | — |
| `malformed-non-object-block` | malformed | contained | 24/24 | — | — |
| `malformed-content-not-array` | malformed | contained | 24/24 | — | — |
| `malformed-result-not-object` | malformed | contained | 24/24 | — | — |
| `split-across-blocks` | exclusion | known-false-negative | 24/24 | — | model-context, host-log, store |
| `split-across-fields` | exclusion | known-false-negative | 24/24 | — | model-context, host-log, store |
| `tool-throws-low-level` | failure | contained | 24/24 | — | — |
| `tool-throws-mcp-server` | failure | contained | 24/24 | — | — |
| `arguments-opt-in-redacted-before-dispatch` | arguments | contained | 24/24 | — | — |
| `arguments-opt-in-key-context-redacted-before-dispatch` | arguments | contained | 24/24 | — | — |
| `arguments-opt-in-private-key-not-dispatched` | arguments | contained | 24/24 | — | — |
| `server-wrapped-result` | server-wrapped | contained | 24/24 | — | — |
| `server-wrapped-throw` | server-wrapped | contained | 24/24 | — | — |
| `server-wrapped-arguments` | server-wrapped | contained | 24/24 | — | — |
| `server-wrapped-stream-split` | server-wrapped | contained | 24/24 | — | — |
| `server-wrapped-stream-block-stops-pulling` | server-wrapped | contained | 24/24 | — | — |
| `cancel-slow-tool` | cancellation | contained | 24/24 | — | — |
| `cancel-server-wrapped-slow-stream` | cancellation | contained | 24/24 | — | — |
| `split-across-calls` | exclusion | known-false-negative | 24/24 | — | model-context, host-log, store |
| `stream-partition-sweep` | streaming | contained | 24/24 | — | — |
| `stream-multibyte-partition-sweep` | streaming | contained | 24/24 | — | — |
| `stream-block-finding-stops-pulling` | streaming | contained | 24/24 | — | — |
| `stream-input-limit-stops-pulling` | streaming | contained | 24/24 | — | — |
| `stream-token-limit` | streaming | contained | 24/24 | — | — |
| `stream-abort-sweep` | cancellation | contained | 24/24 | — | — |
| `stream-abort-while-producer-pending` | cancellation | contained | 24/24 | — | — |
| `stream-producer-throws` | failure | contained | 24/24 | — | — |
| `stream-producer-rejects-async` | failure | contained | 24/24 | — | — |
| `stream-non-string-chunk` | streaming | contained | 24/24 | — | — |
| `stream-node-readable-destroyed-on-failure` | streaming | contained | 24/24 | — | — |
| `policy-block-all` | policy | contained | 24/24 | — | — |
| `policy-warn-delivers-unchanged` | policy | delivered-by-policy | 24/24 | — | model-context, host-log, store |
| `policy-allow-delivers-unchanged` | policy | delivered-by-policy | 24/24 | — | model-context, host-log, store |
| `policy-throws-fails-closed` | policy | contained | 24/24 | — | — |
| `audit-callbacks-throw` | audit | contained | 24/24 | — | — |
| `cancel-race-sweep` | cancellation | contained | 24/24 | — | — |
| `downstream-failure-after-sanitization` | failure | contained | 24/24 | — | — |
| `control-unprotected-host` | control | control-detected | 24/24 | — | model-context, host-log, store, audit, error-text |
| `server-crash-mid-call` | failure | contained | 24/24 | — | — |

### resources/read

| Case | Area | Containment | Conforms | Failed checks | Sinks with plaintext |
| --- | --- | --- | ---: | --- | --- |
| `resource-text-provider-tokens` | resource-text | contained | 24/24 | — | — |
| `resource-text-private-key-blocks` | resource-text | contained | 24/24 | — | — |
| `resource-text-multibyte` | resource-text | contained | 24/24 | — | — |
| `resource-json-text-key-context-in-place` | resource-json-text | contained | 24/24 | — | — |
| `resource-json-settings-key-context-in-place` | resource-json-text | contained | 24/24 | — | — |
| `resource-meta-key-identified-in-place` | resource-meta | contained | 24/24 | — | — |
| `resource-entry-meta-nested-key-identified-in-place` | resource-meta | contained | 24/24 | — | — |
| `resource-meta-sibling-context-blocks-under-block-policy` | resource-meta | contained | 24/24 | — | — |
| `resource-meta-sibling-context-warn-delivers` | resource-meta | delivered-by-policy | 24/24 | — | model-context, host-log, store |
| `resource-mixed-entries` | resource-entries | contained | 24/24 | — | — |
| `resource-split-across-entries` | exclusion | known-false-negative | 24/24 | — | model-context, host-log, store |
| `resource-uri-query-token` | resource-fields | contained | 24/24 | — | — |
| `resource-mime-type-token` | resource-fields | contained | 24/24 | — | — |
| `resource-entry-meta-token` | resource-fields | contained | 24/24 | — | — |
| `resource-result-meta-token` | resource-fields | contained | 24/24 | — | — |
| `resource-meta-key-carries-secret` | resource-fields | contained | 24/24 | — | — |
| `resource-unknown-entry-field` | resource-fields | contained | 24/24 | — | — |
| `resource-unknown-result-field` | resource-fields | contained | 24/24 | — | — |
| `resource-empty-contents` | resource-fields | contained | 24/24 | — | — |
| `resource-blob-blocked-by-default` | resource-binary | contained | 24/24 | — | — |
| `resource-blob-passes-unscanned-on-opt-in` | resource-binary | contained | 24/24 | — | — |
| `resource-text-and-blob-entry` | resource-binary | contained | 24/24 | — | — |
| `resource-non-string-blob` | resource-malformed | contained | 24/24 | — | — |
| `resource-entry-without-text-or-blob` | resource-malformed | contained | 24/24 | — | — |
| `resource-entry-non-string-text` | resource-malformed | contained | 24/24 | — | — |
| `resource-entry-not-object` | resource-malformed | contained | 24/24 | — | — |
| `resource-contents-not-array` | resource-malformed | contained | 24/24 | — | — |
| `resource-contents-missing` | resource-malformed | contained | 24/24 | — | — |
| `resource-large-benign-text` | resource-limits | contained | 24/24 | — | — |
| `resource-secret-at-end-of-large-text` | resource-limits | contained | 24/24 | — | — |
| `resource-text-over-input-limit` | resource-limits | contained | 24/24 | — | — |
| `resource-depth-within-limit-from-root` | resource-limits | contained | 24/24 | — | — |
| `resource-depth-over-limit-from-root` | resource-limits | contained | 24/24 | — | — |
| `resource-nodes-near-limit-across-entries` | resource-limits | contained | 24/24 | — | — |
| `resource-nodes-over-limit-across-entries` | resource-limits | contained | 24/24 | — | — |
| `resource-policy-block-all` | resource-policy | contained | 24/24 | — | — |
| `resource-policy-warn-delivers-unchanged` | resource-policy | delivered-by-policy | 24/24 | — | model-context, host-log, store |
| `resource-policy-allow-delivers-unchanged` | resource-policy | delivered-by-policy | 24/24 | — | model-context, host-log, store |
| `resource-policy-throws-fails-closed` | resource-policy | contained | 24/24 | — | — |
| `resource-audit-callbacks-throw` | resource-audit | contained | 24/24 | — | — |
| `resource-read-throws-low-level` | resource-failure | contained | 24/24 | — | — |
| `resource-read-error-with-data-low-level` | resource-failure | contained | 24/24 | — | — |
| `resource-read-throws-mcp-server` | resource-failure | contained | 24/24 | — | — |
| `resource-not-found-echoes-uri` | resource-failure | contained | 24/24 | — | — |
| `resource-mcp-server-fixed-uri` | resource-mcp-server | contained | 24/24 | — | — |
| `resource-mcp-server-template-uri` | resource-mcp-server | contained | 24/24 | — | — |
| `resource-mcp-server-wrapped-fixed-uri` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-mcp-server-wrapped-template-blocked` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-mcp-server-wrapped-throw` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-server-wrapped-result` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-server-wrapped-blocked` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-server-wrapped-throw` | resource-server-wrapped | contained | 24/24 | — | — |
| `resource-cancel-before-read` | resource-cancellation | contained | 24/24 | — | — |
| `resource-cancel-slow-read` | resource-cancellation | contained | 24/24 | — | — |
| `resource-cancel-server-wrapped-slow-read` | resource-cancellation | contained | 24/24 | — | — |
| `resource-cancel-race-sweep` | resource-cancellation | contained | 24/24 | — | — |
| `resource-abort-while-read-rejects` | resource-cancellation | contained | 24/24 | — | — |
| `resource-audit-and-telemetry` | resource-audit | contained | 24/24 | — | — |
| `resource-control-unprotected-host` | control | control-detected | 24/24 | — | model-context, host-log, store, audit, error-text |
| `resource-server-crash-mid-read` | resource-failure | contained | 24/24 | — | — |
| `resource-cache-ttl-stores-raw-before-boundary` | resource-cache | host-responsibility | 12/12 | — | response-cache |
| `resource-cache-bypass-stores-nothing` | resource-cache | contained | 12/12 | — | — |

## Operational cost

Per-call wall time on node-22.16.0, median over processes of each process's median. "Unprotected" is the same host delivering the raw result; "protected" routes it through the boundary first. Traversal is the adapter over a core that finds nothing, minus the unprotected host; core scan is the rest. Measurements only: no MCP budget exists yet.

| Host path | Workload | Processes | Scanner calls/call | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mcp-sdk-1.13.0-stdio | mcp-text-small | 5 | 8 | 51.5 µs | 337.4 µs / 659.2 µs | 285.9 µs | 25.9 µs | 269.4 µs |
| mcp-in-process | mcp-text-small | 20 | 8 | 0.3 µs | 120.1 µs / 155.6 µs | 119.8 µs | 1.7 µs | 118.1 µs |
| mcp-sdk-1.13.0-stdio | mcp-structured-nested | 5 | 68 | 75.3 µs | 1.87 ms / 2.33 ms | 1.79 ms | 20.8 µs | 1.77 ms |
| mcp-in-process | mcp-structured-nested | 20 | 68 | 5.3 µs | 950.6 µs / 1.13 ms | 945.3 µs | 10.2 µs | 935.5 µs |
| mcp-sdk-1.13.0-stdio | mcp-large-benign | 5 | 1023 | 953.0 µs | 42.50 ms / 62.95 ms | 41.48 ms | 268.9 µs | 41.19 ms |
| mcp-in-process | mcp-large-benign | 20 | 1023 | 97.6 µs | 19.50 ms / 22.36 ms | 19.40 ms | 103.3 µs | 19.30 ms |
| mcp-in-process | mcp-stream-16x1k | 20 | 17 | 31.6 µs | 2.73 ms / 3.28 ms | 2.70 ms | 5.2 µs | 2.70 ms |
| mcp-sdk-1.13.0-http | mcp-text-small | 5 | 8 | 296.8 µs | 551.4 µs / 808.8 µs | 254.6 µs | 50.3 µs | 217.2 µs |
| mcp-sdk-1.13.0-http | mcp-structured-nested | 5 | 68 | 225.7 µs | 1.67 ms / 2.18 ms | 1.44 ms | 30.5 µs | 1.41 ms |
| mcp-sdk-1.13.0-http | mcp-large-benign | 5 | 1023 | 789.3 µs | 30.06 ms / 35.06 ms | 29.17 ms | 135.2 µs | 29.09 ms |
| mcp-sdk-1.30.1-stdio | mcp-text-small | 5 | 8 | 18.6 µs | 146.1 µs / 218.2 µs | 127.0 µs | 8.8 µs | 118.2 µs |
| mcp-sdk-1.30.1-stdio | mcp-structured-nested | 5 | 68 | 34.3 µs | 1.01 ms / 1.27 ms | 978.1 µs | 12.9 µs | 965.2 µs |
| mcp-sdk-1.30.1-stdio | mcp-large-benign | 5 | 1023 | 353.8 µs | 20.07 ms / 21.61 ms | 19.72 ms | 96.3 µs | 19.62 ms |
| mcp-sdk-1.30.1-http | mcp-text-small | 5 | 8 | 177.3 µs | 331.4 µs / 545.5 µs | 148.9 µs | 37.8 µs | 125.4 µs |
| mcp-sdk-1.30.1-http | mcp-structured-nested | 5 | 68 | 190.5 µs | 1.18 ms / 1.52 ms | 1.01 ms | 19.6 µs | 986.0 µs |
| mcp-sdk-1.30.1-http | mcp-large-benign | 5 | 1023 | 561.3 µs | 20.47 ms / 23.58 ms | 19.91 ms | 107.4 µs | 19.81 ms |
| mcp-sdk-2.0.0-stdio | mcp-text-small | 5 | 8 | 25.0 µs | 154.4 µs / 225.0 µs | 129.4 µs | 10.8 µs | 118.8 µs |
| mcp-sdk-2.0.0-stdio | mcp-structured-nested | 5 | 68 | 39.8 µs | 1.02 ms / 1.29 ms | 975.7 µs | 16.4 µs | 959.4 µs |
| mcp-sdk-2.0.0-stdio | mcp-large-benign | 5 | 1023 | 370.0 µs | 20.06 ms / 21.96 ms | 19.69 ms | 224.2 µs | 19.47 ms |
| mcp-sdk-2.0.0-http | mcp-text-small | 5 | 8 | 203.3 µs | 374.4 µs / 559.2 µs | 171.6 µs | 28.3 µs | 140.0 µs |
| mcp-sdk-2.0.0-http | mcp-structured-nested | 5 | 68 | 216.7 µs | 1.22 ms / 1.52 ms | 998.3 µs | 18.5 µs | 979.8 µs |
| mcp-sdk-2.0.0-http | mcp-large-benign | 5 | 1023 | 572.8 µs | 20.48 ms / 23.65 ms | 19.93 ms | 110.3 µs | 19.82 ms |
| mcp-sdk-2.1.0-stdio | mcp-text-small | 5 | 8 | 48.8 µs | 278.6 µs / 376.8 µs | 230.0 µs | 15.8 µs | 214.2 µs |
| mcp-sdk-2.1.0-stdio | mcp-structured-nested | 5 | 68 | 68.6 µs | 1.70 ms / 2.02 ms | 1.63 ms | 21.8 µs | 1.61 ms |
| mcp-sdk-2.1.0-stdio | mcp-large-benign | 5 | 1023 | 684.2 µs | 33.08 ms / 50.63 ms | 32.40 ms | 264.3 µs | 32.13 ms |
| mcp-sdk-2.1.0-http | mcp-text-small | 5 | 8 | 378.8 µs | 684.4 µs / 956.6 µs | 317.3 µs | 47.2 µs | 270.0 µs |
| mcp-sdk-2.1.0-http | mcp-structured-nested | 5 | 68 | 348.1 µs | 2.05 ms / 2.91 ms | 1.70 ms | 30.4 µs | 1.66 ms |
| mcp-sdk-2.1.0-http | mcp-large-benign | 5 | 1023 | 942.3 µs | 33.70 ms / 39.88 ms | 32.75 ms | 161.4 µs | 32.65 ms |

Memory, 20 processes: after 500 protected calls of `mcp-large-benign` and a full GC, retained heap is at most 67.3 KiB with the boundary (1.9 KiB without); peak RSS 160.8 MiB.

Initialization, 15 fresh processes each: core import + initialize 5.28 ms median (p95 6.92); adapter-mcp import + createMcpBoundary + one benign call 9.21 ms median (p95 12.24); adapter share 3.92 ms.

## resources/read operational profile

Measured in its own processes on node-22.16.0, apart from tools/call, median over processes of each process's median, per read. Over the transport, 2.x reads use `cacheMode: "bypass"`. In process, "leaf pass" is the AI-context `sanitizeValue` of the result alone on the real core; "backstop" is the protected read minus the leaf pass: the key-context backstop's second scan plus the resource shape pass. Backstop scanner calls and code units are counted through the public injection API. Measurements only: no budget exists.

| Host path | Workload | Bytes | Scanner calls (backstop) | Code units scanned (backstop) | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan | Backstop | Throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mcp-sdk-1.13.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 43.7 µs | 337.1 µs / 556.4 µs | 293.6 µs | 4.4 µs | 295.7 µs | — | — |
| mcp-in-process | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 2.3 µs | 242.0 µs / 380.2 µs | 239.7 µs | 2.7 µs | 237.1 µs | 71.1 µs | 4.2 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 73.9 µs | 1.14 ms / 1.24 ms | 1.06 ms | 3.4 µs | 1.06 ms | — | — |
| mcp-in-process | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 16.0 µs | 974.2 µs / 1.25 ms | 958.2 µs | 2.5 µs | 955.9 µs | 58.1 µs | 8.1 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 282.5 µs | 5.36 ms / 6.07 ms | 5.07 ms | 10.3 µs | 5.05 ms | — | — |
| mcp-in-process | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 63.6 µs | 3.56 ms / 4.38 ms | 3.49 ms | 3.1 µs | 3.49 ms | 57.2 µs | 8.9 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 594.8 µs | 10.57 ms / 12.29 ms | 9.89 ms | -4.7 µs | 9.99 ms | — | — |
| mcp-in-process | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 117.9 µs | 6.58 ms / 7.76 ms | 6.46 ms | 4.4 µs | 6.46 ms | 65.5 µs | 8.9 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 40.7 µs | 420.0 µs / 490.7 µs | 379.3 µs | 3.9 µs | 371.8 µs | — | — |
| mcp-in-process | resource-json-config | 1556 | 11 (2) | 1579 (71) | 3.0 µs | 265.3 µs / 356.4 µs | 262.2 µs | 2.1 µs | 260.2 µs | 65.1 µs | 5.5 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 65.1 µs | 6.74 ms / 7.79 ms | 6.68 ms | 112.1 µs | 6.57 ms | — | — |
| mcp-in-process | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 6.7 µs | 6.03 ms / 6.91 ms | 6.02 ms | 101.2 µs | 5.92 ms | 567.4 µs | 0.8 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 476.2 µs | 29.77 ms / 36.85 ms | 29.29 ms | 259.9 µs | 29.04 ms | — | — |
| mcp-in-process | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 60.1 µs | 27.61 ms / 29.94 ms | 27.55 ms | 277.7 µs | 27.27 ms | 2.75 ms | 2.6 MiB/s |
| mcp-sdk-1.13.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 207.2 µs | 497.0 µs / 730.1 µs | 289.8 µs | 2.2 µs | 284.2 µs | — | — |
| mcp-sdk-1.13.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 217.0 µs | 1.24 ms / 1.50 ms | 1.03 ms | 0.6 µs | 1.03 ms | — | — |
| mcp-sdk-1.13.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 351.5 µs | 3.90 ms / 4.92 ms | 3.56 ms | 8.7 µs | 3.54 ms | — | — |
| mcp-sdk-1.13.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 513.3 µs | 7.19 ms / 8.35 ms | 6.69 ms | 4.1 µs | 6.68 ms | — | — |
| mcp-sdk-1.13.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 158.1 µs | 454.6 µs / 536.6 µs | 297.4 µs | 13.8 µs | 280.4 µs | — | — |
| mcp-sdk-1.13.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 201.2 µs | 6.64 ms / 7.55 ms | 6.40 ms | 120.6 µs | 6.30 ms | — | — |
| mcp-sdk-1.13.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 513.8 µs | 28.79 ms / 32.43 ms | 28.26 ms | 291.7 µs | 27.96 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 32.3 µs | 281.9 µs / 384.0 µs | 248.5 µs | 0.1 µs | 251.3 µs | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 61.1 µs | 1.04 ms / 1.31 ms | 975.1 µs | 4.8 µs | 972.2 µs | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 197.2 µs | 3.74 ms / 4.34 ms | 3.54 ms | 4.7 µs | 3.54 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 345.3 µs | 6.86 ms / 8.43 ms | 6.52 ms | 9.0 µs | 6.50 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 23.0 µs | 286.6 µs / 316.9 µs | 263.0 µs | 2.6 µs | 260.4 µs | — | — |
| mcp-sdk-1.30.1-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 51.6 µs | 6.24 ms / 7.24 ms | 6.19 ms | 105.2 µs | 6.08 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 366.5 µs | 28.11 ms / 29.81 ms | 27.77 ms | 266.5 µs | 27.51 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 233.6 µs | 508.9 µs / 768.0 µs | 282.8 µs | -19.9 µs | 270.9 µs | — | — |
| mcp-sdk-1.30.1-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 218.9 µs | 1.22 ms / 1.53 ms | 1.00 ms | 2.6 µs | 1.00 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 355.4 µs | 3.94 ms / 4.51 ms | 3.58 ms | 14.8 µs | 3.56 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 523.0 µs | 7.10 ms / 7.92 ms | 6.58 ms | -1.9 µs | 6.57 ms | — | — |
| mcp-sdk-1.30.1-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 165.3 µs | 451.9 µs / 571.9 µs | 284.2 µs | 4.0 µs | 282.5 µs | — | — |
| mcp-sdk-1.30.1-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 222.5 µs | 6.36 ms / 7.45 ms | 6.13 ms | 109.8 µs | 6.01 ms | — | — |
| mcp-sdk-1.30.1-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 457.1 µs | 28.31 ms / 30.18 ms | 27.85 ms | 305.3 µs | 27.56 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 39.2 µs | 286.0 µs / 322.2 µs | 247.3 µs | -0.4 µs | 248.6 µs | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 63.3 µs | 1.04 ms / 1.24 ms | 977.8 µs | 4.3 µs | 972.8 µs | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 203.0 µs | 3.76 ms / 4.57 ms | 3.55 ms | 6.5 µs | 3.55 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 358.6 µs | 7.01 ms / 8.75 ms | 6.64 ms | 23.5 µs | 6.59 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 28.2 µs | 298.8 µs / 363.5 µs | 270.6 µs | 3.0 µs | 268.3 µs | — | — |
| mcp-sdk-2.0.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 59.0 µs | 6.23 ms / 6.78 ms | 6.17 ms | 104.1 µs | 6.06 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 380.6 µs | 28.15 ms / 30.05 ms | 27.77 ms | 298.3 µs | 27.47 ms | — | — |
| mcp-sdk-2.0.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 253.7 µs | 544.9 µs / 707.4 µs | 278.1 µs | 13.2 µs | 278.0 µs | — | — |
| mcp-sdk-2.0.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 238.1 µs | 1.23 ms / 1.45 ms | 1.00 ms | -2.7 µs | 995.6 µs | — | — |
| mcp-sdk-2.0.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 374.0 µs | 3.97 ms / 4.76 ms | 3.59 ms | 9.2 µs | 3.58 ms | — | — |
| mcp-sdk-2.0.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 546.8 µs | 7.14 ms / 8.43 ms | 6.60 ms | 13.9 µs | 6.58 ms | — | — |
| mcp-sdk-2.0.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 181.2 µs | 466.5 µs / 583.8 µs | 285.2 µs | 10.7 µs | 276.2 µs | — | — |
| mcp-sdk-2.0.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 221.6 µs | 6.42 ms / 7.06 ms | 6.18 ms | 120.1 µs | 6.06 ms | — | — |
| mcp-sdk-2.0.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 492.3 µs | 28.34 ms / 30.59 ms | 27.81 ms | 282.0 µs | 27.56 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 59.1 µs | 446.4 µs / 509.0 µs | 387.3 µs | 3.4 µs | 381.8 µs | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 104.8 µs | 1.49 ms / 2.15 ms | 1.39 ms | 2.6 µs | 1.39 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 343.8 µs | 6.27 ms / 7.16 ms | 5.94 ms | 3.1 µs | 5.93 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 684.2 µs | 11.79 ms / 13.70 ms | 11.07 ms | -3.7 µs | 11.09 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 46.3 µs | 497.2 µs / 688.5 µs | 451.2 µs | 8.8 µs | 442.7 µs | — | — |
| mcp-sdk-2.1.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 99.6 µs | 10.40 ms / 11.68 ms | 10.30 ms | 167.6 µs | 10.13 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 589.4 µs | 46.38 ms / 62.01 ms | 45.82 ms | 449.5 µs | 45.30 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 440.2 µs | 923.1 µs / 1.68 ms | 482.9 µs | 16.5 µs | 454.1 µs | — | — |
| mcp-sdk-2.1.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 336.0 µs | 1.97 ms / 2.34 ms | 1.64 ms | 24.8 µs | 1.61 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 616.4 µs | 6.62 ms / 8.17 ms | 6.03 ms | -5.7 µs | 6.02 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 892.6 µs | 11.95 ms / 13.37 ms | 11.07 ms | -4.6 µs | 11.06 ms | — | — |
| mcp-sdk-2.1.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 318.4 µs | 840.9 µs / 1.53 ms | 522.5 µs | 11.2 µs | 511.3 µs | — | — |
| mcp-sdk-2.1.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 364.1 µs | 10.82 ms / 12.71 ms | 10.41 ms | 200.3 µs | 10.24 ms | — | — |
| mcp-sdk-2.1.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 796.7 µs | 47.88 ms / 61.83 ms | 47.01 ms | 438.2 µs | 46.59 ms | — | — |

Memory, 20 processes: after 500 protected reads of `resource-text-60k` and a full GC, retained heap is at most 255.5 KiB with the boundary (-2.3 KiB without); peak RSS 154.8 MiB.

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| @redact-secret/adapter@0.1.2 | 12.5 KiB | 38.2 KiB | 18 |
| @redact-secret/adapter-ai-context@0.1.0-alpha.1 | 14.8 KiB | 50.5 KiB | 10 |
| @redact-secret/adapter-mcp@0.1.0-alpha.1 | 20.5 KiB | 75.9 KiB | 10 |
| core candidate (core) | 38.5 KiB | 147.8 KiB | 53 |
| core candidate (node) | 414.5 KiB | 981.2 KiB | 2 |
| core candidate (wasm) | 248.2 KiB | 765.1 KiB | 9 |

## Not measured

- bundle contribution: adapter-mcp is a Node.js server-side package that loads the native core; no browser bundle applies
- a core that fails to initialize: requires breaking the installed core, which is adapter-internal lifecycle already qualified by redact-secret-adapters#13
- the Python mcp SDK, other language SDKs, HTTP+SSE, experimental.tasks: outside the supported range
- MCP messages other than tools/call and resources/read (resources/list, resources/templates/list, subscriptions and update notifications, prompts/get, sampling, elicitation, completion, logging): outside the contracts
- a secret split across two resources/read calls: a documented exclusion, not run; the split across two contents entries is run and counted as a known false negative
- a persistent or shared 2.x responseCacheStore: outside the claim by contract; the response-cache cases show the store receives the raw result before the boundary, which makes it a documented host responsibility

