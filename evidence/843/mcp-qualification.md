# MCP adapter black-box qualification (#321: tools/call and resources/read)

**Result.** complete: 3048 case runs over 24/24 cells (1440 of them resources/read); **0 leaks**, 0 process-output leaks, 0 contract deviations, 96 known false negatives (documented exclusions), 120 deliveries by an explicit or default warn/allow policy, 12 documented host-responsibility observations (the 2.x response cache); the unprotected controls (tools/call and resources/read) were flagged in 24/24 cells.

resources/read alone: 1440 case runs, **0 leaks**, 0 deviations, 24 known false negatives, control flagged in 0/24 cells.

## Identity

| Item | Value |
| --- | --- |
| Benchmark | redact-secret-benchmarks `75c1a2b47b37e17feb544b6053a36d242083f20f` (clean) |
| Core candidate | redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef` |
| core core tarball | `redact-secret-core-0.1.0-beta.8.tgz` sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| core node tarball | `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` sha256 `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| core wasm tarball | `redact-secret-wasm-0.1.0-beta.8.tgz` sha256 `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |
| Adapters | redact-secret-adapters `e087cb257486ac183cba01e8168b18e5f69aae98`, pin-source sha256 `c61122f48fc622918486fc732fdc72b30c6c62db00da85263a28ca5b90468009` |
| @redact-secret/adapter@0.1.1 | content digest `sha256:e3a4ffbdf712154845aceaebd072dcbe0e24dfbba9bb45df5b2d81a010569552` (verified) |
| @redact-secret/adapter-ai-context@0.1.0-alpha | content digest `sha256:d9c61e520b6b617457ec1bf3fa8c6694a6a949d5e29675e2c52af06ede2fc8d0` (verified) |
| @redact-secret/adapter-mcp@0.1.0-alpha | content digest `sha256:10af5381a8520654b537cf2c6c0d75e3fc7337777e67d380de7a57955c72fa09` (verified) |
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
| `resource-control-unprotected-host` | control | control-detected | 24/24 | — | model-context, host-log, store, audit, error-text |
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
| `resource-server-crash-mid-read` | resource-failure | contained | 24/24 | — | — |
| `resource-cache-ttl-stores-raw-before-boundary` | resource-cache | host-responsibility | 12/12 | — | response-cache |
| `resource-cache-bypass-stores-nothing` | resource-cache | contained | 12/12 | — | — |

## Operational cost

Per-call wall time on node-22.16.0, median over processes of each process's median. "Unprotected" is the same host delivering the raw result; "protected" routes it through the boundary first. Traversal is the adapter over a core that finds nothing, minus the unprotected host; core scan is the rest. Measurements only: no MCP budget exists yet.

| Host path | Workload | Processes | Scanner calls/call | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mcp-sdk-1.13.0-stdio | mcp-text-small | 5 | 8 | 25.4 µs | 152.3 µs / 235.6 µs | 127.6 µs | 10.6 µs | 117.0 µs |
| mcp-in-process | mcp-text-small | 20 | 8 | 0.3 µs | 113.8 µs / 136.9 µs | 113.5 µs | 1.9 µs | 111.9 µs |
| mcp-sdk-1.13.0-stdio | mcp-structured-nested | 5 | 68 | 39.6 µs | 1.04 ms / 1.24 ms | 996.8 µs | 15.0 µs | 981.8 µs |
| mcp-in-process | mcp-structured-nested | 20 | 68 | 5.3 µs | 960.4 µs / 1.23 ms | 955.1 µs | 10.3 µs | 945.1 µs |
| mcp-sdk-1.13.0-stdio | mcp-large-benign | 5 | 1023 | 463.4 µs | 20.76 ms / 22.98 ms | 20.30 ms | 163.7 µs | 20.12 ms |
| mcp-in-process | mcp-large-benign | 20 | 1023 | 97.0 µs | 19.88 ms / 22.56 ms | 19.79 ms | 103.2 µs | 19.68 ms |
| mcp-in-process | mcp-stream-16x1k | 20 | 17 | 31.9 µs | 2.79 ms / 3.19 ms | 2.76 ms | 5.1 µs | 2.75 ms |
| mcp-sdk-1.13.0-http | mcp-text-small | 5 | 8 | 177.7 µs | 308.1 µs / 458.6 µs | 133.2 µs | 27.0 µs | 106.2 µs |
| mcp-sdk-1.13.0-http | mcp-structured-nested | 5 | 68 | 182.4 µs | 1.22 ms / 2.06 ms | 1.04 ms | 24.9 µs | 1.01 ms |
| mcp-sdk-1.13.0-http | mcp-large-benign | 5 | 1023 | 564.9 µs | 20.93 ms / 24.19 ms | 20.25 ms | 107.2 µs | 20.24 ms |
| mcp-sdk-1.30.1-stdio | mcp-text-small | 5 | 8 | 20.3 µs | 145.7 µs / 223.2 µs | 127.2 µs | 8.6 µs | 118.8 µs |
| mcp-sdk-1.30.1-stdio | mcp-structured-nested | 5 | 68 | 35.0 µs | 1.01 ms / 1.39 ms | 978.3 µs | 13.1 µs | 969.1 µs |
| mcp-sdk-1.30.1-stdio | mcp-large-benign | 5 | 1023 | 358.4 µs | 20.23 ms / 24.16 ms | 19.89 ms | 107.7 µs | 19.79 ms |
| mcp-sdk-1.30.1-http | mcp-text-small | 5 | 8 | 235.2 µs | 436.3 µs / 1.01 ms | 186.7 µs | 23.0 µs | 176.1 µs |
| mcp-sdk-1.30.1-http | mcp-structured-nested | 5 | 68 | 217.3 µs | 1.36 ms / 1.72 ms | 1.16 ms | 17.3 µs | 1.14 ms |
| mcp-sdk-1.30.1-http | mcp-large-benign | 5 | 1023 | 698.1 µs | 24.36 ms / 40.94 ms | 23.66 ms | 96.6 µs | 23.58 ms |
| mcp-sdk-2.0.0-stdio | mcp-text-small | 5 | 8 | 25.0 µs | 158.1 µs / 208.0 µs | 132.4 µs | 11.0 µs | 121.4 µs |
| mcp-sdk-2.0.0-stdio | mcp-structured-nested | 5 | 68 | 42.9 µs | 1.03 ms / 1.14 ms | 988.3 µs | 15.5 µs | 972.8 µs |
| mcp-sdk-2.0.0-stdio | mcp-large-benign | 5 | 1023 | 362.0 µs | 20.06 ms / 22.12 ms | 19.66 ms | 228.8 µs | 19.42 ms |
| mcp-sdk-2.0.0-http | mcp-text-small | 5 | 8 | 207.6 µs | 384.2 µs / 549.7 µs | 163.7 µs | 15.7 µs | 147.9 µs |
| mcp-sdk-2.0.0-http | mcp-structured-nested | 5 | 68 | 214.1 µs | 1.23 ms / 1.58 ms | 1.02 ms | 15.5 µs | 995.0 µs |
| mcp-sdk-2.0.0-http | mcp-large-benign | 5 | 1023 | 580.4 µs | 20.46 ms / 26.20 ms | 19.89 ms | 98.0 µs | 19.77 ms |
| mcp-sdk-2.1.0-stdio | mcp-text-small | 5 | 8 | 46.5 µs | 277.9 µs / 488.0 µs | 230.3 µs | 14.3 µs | 206.5 µs |
| mcp-sdk-2.1.0-stdio | mcp-structured-nested | 5 | 68 | 65.2 µs | 1.31 ms / 1.75 ms | 1.25 ms | 17.5 µs | 1.23 ms |
| mcp-sdk-2.1.0-stdio | mcp-large-benign | 5 | 1023 | 544.1 µs | 26.51 ms / 33.50 ms | 25.97 ms | 324.4 µs | 25.75 ms |
| mcp-sdk-2.1.0-http | mcp-text-small | 5 | 8 | 324.3 µs | 626.8 µs / 1.15 ms | 299.7 µs | 27.7 µs | 264.3 µs |
| mcp-sdk-2.1.0-http | mcp-structured-nested | 5 | 68 | 294.7 µs | 1.92 ms / 2.85 ms | 1.57 ms | 18.4 µs | 1.54 ms |
| mcp-sdk-2.1.0-http | mcp-large-benign | 5 | 1023 | 785.9 µs | 28.03 ms / 39.35 ms | 27.28 ms | 165.2 µs | 27.12 ms |

Memory, 20 processes: after 500 protected calls of `mcp-large-benign` and a full GC, retained heap is at most 68.7 KiB with the boundary (1.5 KiB without); peak RSS 162.5 MiB.

Initialization, 15 fresh processes each: core import + initialize 5.54 ms median (p95 7.12); adapter-mcp import + createMcpBoundary + one benign call 9.45 ms median (p95 12.20); adapter share 3.91 ms.

## resources/read operational profile

Measured in its own processes on node-22.16.0, apart from tools/call, median over processes of each process's median, per read. Over the transport, 2.x reads use `cacheMode: "bypass"`. In process, "leaf pass" is the AI-context `sanitizeValue` of the result alone on the real core; "backstop" is the protected read minus the leaf pass: the key-context backstop's second scan plus the resource shape pass. Backstop scanner calls and code units are counted through the public injection API. Measurements only: no budget exists.

| Host path | Workload | Bytes | Scanner calls (backstop) | Code units scanned (backstop) | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan | Backstop | Throughput |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mcp-sdk-1.13.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 37.2 µs | 284.0 µs / 316.0 µs | 246.7 µs | 3.8 µs | 243.9 µs | — | — |
| mcp-in-process | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 2.9 µs | 284.3 µs / 368.4 µs | 281.5 µs | 2.9 µs | 278.7 µs | 79.3 µs | 3.6 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 67.9 µs | 1.06 ms / 1.26 ms | 987.8 µs | 8.2 µs | 983.1 µs | — | — |
| mcp-in-process | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 18.6 µs | 1.13 ms / 1.41 ms | 1.11 ms | 3.4 µs | 1.11 ms | 66.9 µs | 6.8 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 201.1 µs | 3.73 ms / 4.98 ms | 3.53 ms | 6.8 µs | 3.53 ms | — | — |
| mcp-in-process | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 69.9 µs | 3.97 ms / 5.62 ms | 3.91 ms | 4.4 µs | 3.90 ms | 70.2 µs | 7.9 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 381.3 µs | 7.12 ms / 8.24 ms | 6.69 ms | 24.6 µs | 6.72 ms | — | — |
| mcp-in-process | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 129.1 µs | 7.31 ms / 10.52 ms | 7.18 ms | 3.9 µs | 7.18 ms | 114.5 µs | 8.0 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 29.1 µs | 300.3 µs / 365.3 µs | 269.4 µs | 3.1 µs | 267.7 µs | — | — |
| mcp-in-process | resource-json-config | 1556 | 11 (2) | 1579 (71) | 3.3 µs | 286.8 µs / 348.8 µs | 283.5 µs | 2.3 µs | 281.2 µs | 71.5 µs | 5.1 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 55.7 µs | 6.21 ms / 6.73 ms | 6.16 ms | 107.0 µs | 6.05 ms | — | — |
| mcp-in-process | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 8.1 µs | 7.42 ms / 10.35 ms | 7.41 ms | 123.2 µs | 7.29 ms | 663.2 µs | 0.6 MiB/s |
| mcp-sdk-1.13.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 442.4 µs | 28.19 ms / 32.47 ms | 27.83 ms | 254.6 µs | 27.55 ms | — | — |
| mcp-in-process | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 71.3 µs | 33.51 ms / 45.47 ms | 33.43 ms | 344.8 µs | 33.12 ms | 2.78 ms | 2.1 MiB/s |
| mcp-sdk-1.13.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 243.4 µs | 530.2 µs / 864.7 µs | 305.3 µs | -9.1 µs | 322.0 µs | — | — |
| mcp-sdk-1.13.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 208.7 µs | 1.25 ms / 1.42 ms | 1.04 ms | 6.6 µs | 1.03 ms | — | — |
| mcp-sdk-1.13.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 357.9 µs | 3.92 ms / 5.74 ms | 3.56 ms | 12.9 µs | 3.57 ms | — | — |
| mcp-sdk-1.13.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 516.9 µs | 7.16 ms / 7.55 ms | 6.65 ms | -2.6 µs | 6.66 ms | — | — |
| mcp-sdk-1.13.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 152.3 µs | 433.7 µs / 527.9 µs | 281.5 µs | 6.7 µs | 274.7 µs | — | — |
| mcp-sdk-1.13.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 206.4 µs | 6.60 ms / 8.19 ms | 6.40 ms | 116.0 µs | 6.28 ms | — | — |
| mcp-sdk-1.13.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 548.5 µs | 29.86 ms / 88.38 ms | 29.31 ms | 281.6 µs | 29.04 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 39.4 µs | 354.7 µs / 411.4 µs | 312.6 µs | 1.3 µs | 313.4 µs | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 65.8 µs | 1.12 ms / 1.44 ms | 1.06 ms | 4.3 µs | 1.05 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 248.8 µs | 4.52 ms / 5.62 ms | 4.26 ms | 3.2 µs | 4.27 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 377.3 µs | 7.53 ms / 9.24 ms | 7.15 ms | 9.5 µs | 7.14 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 25.4 µs | 315.6 µs / 329.0 µs | 292.1 µs | 4.4 µs | 286.9 µs | — | — |
| mcp-sdk-1.30.1-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 60.1 µs | 6.82 ms / 9.55 ms | 6.76 ms | 121.7 µs | 6.64 ms | — | — |
| mcp-sdk-1.30.1-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 409.1 µs | 32.58 ms / 45.37 ms | 32.14 ms | 301.6 µs | 31.86 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 253.2 µs | 568.1 µs / 759.8 µs | 316.7 µs | 0.3 µs | 321.0 µs | — | — |
| mcp-sdk-1.30.1-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 245.0 µs | 1.42 ms / 2.37 ms | 1.18 ms | 6.9 µs | 1.16 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 375.7 µs | 3.99 ms / 4.66 ms | 3.61 ms | 7.2 µs | 3.61 ms | — | — |
| mcp-sdk-1.30.1-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 518.2 µs | 7.16 ms / 8.05 ms | 6.64 ms | 6.3 µs | 6.63 ms | — | — |
| mcp-sdk-1.30.1-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 170.8 µs | 472.8 µs / 704.9 µs | 302.0 µs | 7.9 µs | 294.2 µs | — | — |
| mcp-sdk-1.30.1-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 218.9 µs | 6.90 ms / 9.54 ms | 6.70 ms | 130.1 µs | 6.58 ms | — | — |
| mcp-sdk-1.30.1-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 488.5 µs | 29.62 ms / 39.81 ms | 29.09 ms | 328.2 µs | 28.86 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 49.1 µs | 389.2 µs / 445.1 µs | 341.3 µs | 0.5 µs | 340.8 µs | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 83.9 µs | 1.26 ms / 1.77 ms | 1.17 ms | 7.3 µs | 1.17 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 250.7 µs | 4.48 ms / 5.41 ms | 4.23 ms | 4.4 µs | 4.22 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 477.7 µs | 8.75 ms / 10.54 ms | 8.27 ms | 42.3 µs | 8.30 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 46.1 µs | 480.1 µs / 654.9 µs | 430.6 µs | 9.3 µs | 418.9 µs | — | — |
| mcp-sdk-2.0.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 84.0 µs | 8.12 ms / 9.90 ms | 8.04 ms | 128.3 µs | 7.91 ms | — | — |
| mcp-sdk-2.0.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 528.5 µs | 35.97 ms / 45.92 ms | 35.44 ms | 348.8 µs | 35.08 ms | — | — |
| mcp-sdk-2.0.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 353.5 µs | 724.9 µs / 1.04 ms | 374.8 µs | 6.6 µs | 363.7 µs | — | — |
| mcp-sdk-2.0.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 283.4 µs | 1.61 ms / 1.96 ms | 1.32 ms | 3.0 µs | 1.31 ms | — | — |
| mcp-sdk-2.0.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 494.5 µs | 5.15 ms / 8.26 ms | 4.67 ms | -2.8 µs | 4.67 ms | — | — |
| mcp-sdk-2.0.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 700.3 µs | 9.23 ms / 10.28 ms | 8.53 ms | -4.8 µs | 8.54 ms | — | — |
| mcp-sdk-2.0.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 253.4 µs | 661.2 µs / 942.6 µs | 407.8 µs | 24.6 µs | 411.4 µs | — | — |
| mcp-sdk-2.0.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 301.8 µs | 8.70 ms / 10.89 ms | 8.42 ms | 162.5 µs | 8.26 ms | — | — |
| mcp-sdk-2.0.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 663.9 µs | 37.05 ms / 45.86 ms | 36.38 ms | 398.1 µs | 36.02 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 68.8 µs | 459.0 µs / 861.7 µs | 390.1 µs | -1.4 µs | 384.9 µs | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 96.8 µs | 1.48 ms / 2.29 ms | 1.38 ms | 4.4 µs | 1.38 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 410.7 µs | 6.48 ms / 7.87 ms | 6.07 ms | -10.2 µs | 6.08 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 651.0 µs | 10.46 ms / 12.62 ms | 9.88 ms | 13.4 µs | 9.86 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-json-config | 1556 | 11 (2) | 1579 (71) | 40.2 µs | 406.1 µs / 630.6 µs | 365.9 µs | 8.3 µs | 358.7 µs | — | — |
| mcp-sdk-2.1.0-stdio | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 89.3 µs | 9.19 ms / 10.52 ms | 9.10 ms | 150.2 µs | 8.95 ms | — | — |
| mcp-sdk-2.1.0-stdio | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 553.9 µs | 43.17 ms / 56.94 ms | 42.61 ms | 412.6 µs | 42.20 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-1k | 1113 | 11 (2) | 1195 (61) | 456.9 µs | 923.5 µs / 1.22 ms | 466.6 µs | -27.6 µs | 479.9 µs | — | — |
| mcp-sdk-2.1.0-http | resource-text-8k | 8368 | 11 (2) | 8363 (61) | 354.3 µs | 1.96 ms / 2.76 ms | 1.61 ms | 6.2 µs | 1.58 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-32k | 33240 | 11 (2) | 32939 (61) | 773.0 µs | 8.40 ms / 12.42 ms | 7.63 ms | 4.6 µs | 7.63 ms | — | — |
| mcp-sdk-2.1.0-http | resource-text-60k | 62258 | 11 (2) | 61611 (61) | 1.34 ms | 16.81 ms / 20.63 ms | 15.48 ms | 26.6 µs | 15.40 ms | — | — |
| mcp-sdk-2.1.0-http | resource-json-config | 1556 | 11 (2) | 1579 (71) | 354.0 µs | 980.9 µs / 1.90 ms | 632.5 µs | 7.4 µs | 590.3 µs | — | — |
| mcp-sdk-2.1.0-http | resource-meta-keyed-leaves | 5149 | 918 (2) | 13408 (5096) | 401.3 µs | 10.94 ms / 12.96 ms | 10.54 ms | 163.7 µs | 10.37 ms | — | — |
| mcp-sdk-2.1.0-http | resource-many-entries | 74498 | 2001 (201) | 155361 (11692) | 785.8 µs | 47.84 ms / 65.39 ms | 47.06 ms | 470.4 µs | 46.56 ms | — | — |

Memory, 20 processes: after 500 protected reads of `resource-text-60k` and a full GC, retained heap is at most 253.5 KiB with the boundary (-2.2 KiB without); peak RSS 144.1 MiB.

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| @redact-secret/adapter@0.1.1 | 12.5 KiB | 38.2 KiB | 18 |
| @redact-secret/adapter-ai-context@0.1.0-alpha | 14.7 KiB | 50.0 KiB | 10 |
| @redact-secret/adapter-mcp@0.1.0-alpha | 20.4 KiB | 75.5 KiB | 10 |
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

