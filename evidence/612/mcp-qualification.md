# MCP adapter black-box qualification (#281)

**Result.** complete: 1584 case runs over 24/24 cells; **0 leaks**, 0 process-output leaks, 0 contract deviations, 72 known false negatives (documented exclusions), 48 deliveries by an explicit warn/allow policy; the unprotected control was flagged in 24/24 cells.

## Identity

| Item | Value |
| --- | --- |
| Benchmark | redact-secret-benchmarks `cbe417e2c38309dc3b0b80e310fa666016ced0c4` (clean) |
| Core candidate | redact-secret `5213be1166e4c0c658f97371bc28a5f43d292f79` |
| core core tarball | `redact-secret-core-0.1.0-beta.8.tgz` sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| core node tarball | `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` sha256 `61aefb0b3dd3f15a9a8a64cecd8f6f7afc4cd6446fcf29b909c4206ef714b3fb` |
| core wasm tarball | `redact-secret-wasm-0.1.0-beta.8.tgz` sha256 `75d6ab54b11ed88af9011f3530c0dd69af96b9d9cfc303f90edb5ac31299d003` |
| Adapters | redact-secret-adapters `f014a996ebb9693fbe1c8cc14f144435f011c2b8`, pin-source sha256 `88cedef34dcdb07a6df4912d45bce790ef59b3e0c25b61ec68dbc078719172df` |
| @redact-secret/adapter@0.1.0 | content digest `sha256:7fa97960d067397c7602bf4047abe258856909f6f45b9ab972f0b616fc96035c` (verified) |
| @redact-secret/adapter-ai-context@0.1.0 | content digest `sha256:30fc06941818cdc8da977d92c8f842c995b673e6e9fea56cf09c2347d2c89d26` (verified) |
| @redact-secret/adapter-mcp@0.1.0 | content digest `sha256:76326a37d6a802f62d7ff4a607460d51369da6d2b78f7dcd10fca6e7d69a0f38` (verified) |
| Compatibility record | sha256 `2218c397bd5975590d57df6d4019937aaf4ed6d4d7d7f311de9e5c56857e6622`, runtime 20.x || 22.x || 24.x |
| Contract | https://github.com/redact-secret/redact-secret/blob/5213be1166e4c0c658f97371bc28a5f43d292f79/docs/reference/mcp-boundary.md |
| Host | darwin-25.5.0 arm64, Apple M4 |

## Matrix executed

| Node.js | SDK | Transport | Protocol | Status | Cases | Leaks | Deviations | Known FN | Control |
| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- |
| node-20.20.2 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | sdk@1.13.0 | http | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | sdk@1.13.0 | http | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | sdk@1.13.0 | stdio | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | sdk@1.13.0 | http | 2025-06-18 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | sdk@1.30.1 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | sdk@1.30.1 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | sdk@1.30.1 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | sdk@1.30.1 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | client@2.0.0 + server@2.0.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | client@2.0.0 + server@2.0.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-20.20.2 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-22.16.0 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | client@2.1.0 + server@2.1.0 | stdio | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |
| node-24.21.0 | client@2.1.0 + server@2.1.0 | http | 2025-11-25 | complete | 66 | 0 | 0 | 3 | flagged |

## Cases

Containment is what the leak scan found across the model context, host log, store, audit trail and error text (and, for server-wrapped tools, the server's wire output and handler input). A case conforms when its outcome, fixed result and lifecycle checks match the contract and nothing leaked.

| Case | Area | Containment | Conforms | Failed checks | Sinks with plaintext |
| --- | --- | --- | ---: | --- | --- |
| `text-provider-token` | text | contained | 24/24 | — | — |
| `text-mixed-sensitive-and-benign-siblings` | text | contained | 24/24 | — | — |
| `structured-nested-with-text-copy` | structuredContent | contained | 24/24 | — | — |
| `structured-key-context-only` | structuredContent | contained | 24/24 | — | — |
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
| `arguments-opt-in-key-context-not-dispatched` | arguments | contained | 24/24 | — | — |
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

## Operational cost

Per-call wall time on node-22.16.0, median over processes of each process's median. "Unprotected" is the same host delivering the raw result; "protected" routes it through the boundary first. Traversal is the adapter over a core that finds nothing, minus the unprotected host; core scan is the rest. Measurements only: no MCP budget exists yet.

| Host path | Workload | Processes | Scanner calls/call | Unprotected | Protected (median / p95) | Overhead | Traversal | Core scan |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| mcp-sdk-1.13.0-stdio | mcp-text-small | 5 | 7 | 25.8 µs | 153.1 µs / 272.0 µs | 127.3 µs | 8.5 µs | 121.2 µs |
| mcp-in-process | mcp-text-small | 20 | 7 | 0.3 µs | 108.1 µs / 121.6 µs | 107.8 µs | 1.5 µs | 106.3 µs |
| mcp-sdk-1.13.0-stdio | mcp-structured-nested | 5 | 66 | 39.7 µs | 995.7 µs / 1.37 ms | 956.5 µs | 11.7 µs | 944.6 µs |
| mcp-in-process | mcp-structured-nested | 20 | 66 | 5.3 µs | 931.1 µs / 1.06 ms | 925.8 µs | 8.7 µs | 917.2 µs |
| mcp-sdk-1.13.0-stdio | mcp-large-benign | 5 | 1020 | 335.5 µs | 16.07 ms / 17.07 ms | 15.74 ms | 90.1 µs | 15.65 ms |
| mcp-in-process | mcp-large-benign | 20 | 1020 | 96.4 µs | 15.62 ms / 17.66 ms | 15.52 ms | 91.3 µs | 15.43 ms |
| mcp-in-process | mcp-stream-16x1k | 20 | 17 | 31.6 µs | 2.71 ms / 3.08 ms | 2.68 ms | 4.4 µs | 2.68 ms |
| mcp-sdk-1.13.0-http | mcp-text-small | 5 | 7 | 163.2 µs | 272.0 µs / 456.8 µs | 115.1 µs | 24.6 µs | 89.7 µs |
| mcp-sdk-1.13.0-http | mcp-structured-nested | 5 | 66 | 179.1 µs | 1.14 ms / 1.26 ms | 963.5 µs | 13.7 µs | 947.6 µs |
| mcp-sdk-1.13.0-http | mcp-large-benign | 5 | 1020 | 532.6 µs | 16.11 ms / 17.71 ms | 15.57 ms | 82.7 µs | 15.49 ms |
| mcp-sdk-1.30.1-stdio | mcp-text-small | 5 | 7 | 17.7 µs | 132.5 µs / 174.1 µs | 115.3 µs | 4.1 µs | 107.3 µs |
| mcp-sdk-1.30.1-stdio | mcp-structured-nested | 5 | 66 | 33.1 µs | 979.0 µs / 1.15 ms | 945.9 µs | 12.9 µs | 932.9 µs |
| mcp-sdk-1.30.1-stdio | mcp-large-benign | 5 | 1020 | 341.5 µs | 15.99 ms / 17.41 ms | 15.65 ms | 84.7 µs | 15.56 ms |
| mcp-sdk-1.30.1-http | mcp-text-small | 5 | 7 | 168.6 µs | 298.8 µs / 467.3 µs | 133.2 µs | 34.8 µs | 98.6 µs |
| mcp-sdk-1.30.1-http | mcp-structured-nested | 5 | 66 | 189.4 µs | 1.17 ms / 1.32 ms | 983.5 µs | 21.7 µs | 967.7 µs |
| mcp-sdk-1.30.1-http | mcp-large-benign | 5 | 1020 | 549.9 µs | 16.34 ms / 18.38 ms | 15.77 ms | 84.2 µs | 15.70 ms |
| mcp-sdk-2.0.0-stdio | mcp-text-small | 5 | 7 | 30.9 µs | 157.9 µs / 280.1 µs | 131.3 µs | 11.8 µs | 119.8 µs |
| mcp-sdk-2.0.0-stdio | mcp-structured-nested | 5 | 66 | 49.6 µs | 1.20 ms / 1.57 ms | 1.15 ms | 18.5 µs | 1.13 ms |
| mcp-sdk-2.0.0-stdio | mcp-large-benign | 5 | 1020 | 434.5 µs | 17.16 ms / 18.53 ms | 16.77 ms | 151.3 µs | 16.54 ms |
| mcp-sdk-2.0.0-http | mcp-text-small | 5 | 7 | 244.9 µs | 394.5 µs / 608.4 µs | 167.1 µs | 16.7 µs | 133.4 µs |
| mcp-sdk-2.0.0-http | mcp-structured-nested | 5 | 66 | 226.3 µs | 1.32 ms / 1.56 ms | 1.10 ms | 15.8 µs | 1.07 ms |
| mcp-sdk-2.0.0-http | mcp-large-benign | 5 | 1020 | 624.1 µs | 18.19 ms / 23.71 ms | 17.57 ms | 101.6 µs | 17.46 ms |
| mcp-sdk-2.1.0-stdio | mcp-text-small | 5 | 7 | 27.1 µs | 148.1 µs / 210.6 µs | 119.9 µs | 10.7 µs | 110.1 µs |
| mcp-sdk-2.1.0-stdio | mcp-structured-nested | 5 | 66 | 40.5 µs | 1.00 ms / 1.16 ms | 958.0 µs | 15.2 µs | 947.1 µs |
| mcp-sdk-2.1.0-stdio | mcp-large-benign | 5 | 1020 | 413.5 µs | 16.29 ms / 17.54 ms | 15.87 ms | 143.1 µs | 15.73 ms |
| mcp-sdk-2.1.0-http | mcp-text-small | 5 | 7 | 217.8 µs | 373.9 µs / 579.3 µs | 158.4 µs | 29.2 µs | 139.1 µs |
| mcp-sdk-2.1.0-http | mcp-structured-nested | 5 | 66 | 210.3 µs | 1.19 ms / 1.45 ms | 986.1 µs | 6.5 µs | 971.8 µs |
| mcp-sdk-2.1.0-http | mcp-large-benign | 5 | 1020 | 597.7 µs | 16.58 ms / 17.71 ms | 15.98 ms | 78.5 µs | 15.90 ms |

Memory, 20 processes: after 500 protected calls of `mcp-large-benign` and a full GC, retained heap is at most 30.7 KiB with the boundary (2.4 KiB without); peak RSS 151.2 MiB.

Initialization, 15 fresh processes each: core import + initialize 6.40 ms median (p95 8.90); adapter-mcp import + createMcpBoundary + one benign call 11.05 ms median (p95 17.39); adapter share 4.65 ms.

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| @redact-secret/adapter@0.1.0 | 12.3 KiB | 37.4 KiB | 18 |
| @redact-secret/adapter-ai-context@0.1.0 | 13.1 KiB | 44.7 KiB | 10 |
| @redact-secret/adapter-mcp@0.1.0 | 15.7 KiB | 54.7 KiB | 10 |
| core candidate (core) | 38.5 KiB | 147.8 KiB | 53 |
| core candidate (node) | 414.5 KiB | 981.2 KiB | 2 |
| core candidate (wasm) | 248.2 KiB | 765.1 KiB | 9 |

## Not measured

- bundle contribution: adapter-mcp is a Node.js server-side package that loads the native core; no browser bundle applies
- a core that fails to initialize: requires breaking the installed core, which is adapter-internal lifecycle already qualified by redact-secret-adapters#13
- the Python mcp SDK, other language SDKs, HTTP+SSE, experimental.tasks: outside the supported range
- MCP messages other than tools/call: outside the contract

