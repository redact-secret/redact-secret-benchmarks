# MCP adapter black-box qualification (#281)

**Result.** complete: 1584 case runs over 24/24 cells; **0 leaks**, 0 process-output leaks, 0 contract deviations, 72 known false negatives (documented exclusions), 48 deliveries by an explicit warn/allow policy; the unprotected control was flagged in 24/24 cells.

## Identity

| Item | Value |
| --- | --- |
| Benchmark | redact-secret-benchmarks `7ca9a6ee2bcba66f5c93f10190e7fc3ae24765b7` (clean) |
| Core candidate | redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef` |
| core core tarball | `redact-secret-core-0.1.0-beta.8.tgz` sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| core node tarball | `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` sha256 `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| core wasm tarball | `redact-secret-wasm-0.1.0-beta.8.tgz` sha256 `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |
| Adapters | redact-secret-adapters `cfc6ba5cddd8b7879936bac69c3b93c1957c6dbd`, pin-source sha256 `6fd0818c666da3086dd23b662ce1e70e1ff3ec92b10e3f780dfb63af88340bfe` |
| @redact-secret/adapter@0.1.1 | content digest `sha256:aeeaa821e84130d6099fb323123e25e81253c9d4a792ffaa669313dfb613f7f3` (verified) |
| @redact-secret/adapter-ai-context@0.1.0-alpha | content digest `sha256:95748ea7f2709c339b428dc031b0ad22dfe91683ffba7c9f4a16e1b73865276d` (verified) |
| @redact-secret/adapter-mcp@0.1.0-alpha | content digest `sha256:a61939a2a15a952776763fb3470e647c21732a7760c51379222610c5dce79ac4` (verified) |
| Compatibility record | sha256 `2218c397bd5975590d57df6d4019937aaf4ed6d4d7d7f311de9e5c56857e6622`, runtime 20.x || 22.x || 24.x |
| Contract | https://github.com/redact-secret/redact-secret/blob/0e3ba9592b6fa80fafdea47639921987c36ba323/docs/reference/mcp-boundary.md |
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
| mcp-sdk-1.13.0-stdio | mcp-text-small | 5 | 7 | 33.0 µs | 196.3 µs / 268.2 µs | 163.3 µs | 10.4 µs | 152.2 µs |
| mcp-in-process | mcp-text-small | 20 | 7 | 0.4 µs | 165.9 µs / 242.8 µs | 165.4 µs | 2.4 µs | 163.3 µs |
| mcp-sdk-1.13.0-stdio | mcp-structured-nested | 5 | 66 | 49.6 µs | 1.29 ms / 1.69 ms | 1.24 ms | 16.0 µs | 1.22 ms |
| mcp-in-process | mcp-structured-nested | 20 | 66 | 9.5 µs | 1.75 ms / 2.19 ms | 1.74 ms | 15.7 µs | 1.72 ms |
| mcp-sdk-1.13.0-stdio | mcp-large-benign | 5 | 1020 | 487.4 µs | 23.35 ms / 32.89 ms | 22.86 ms | 129.4 µs | 22.71 ms |
| mcp-in-process | mcp-large-benign | 20 | 1020 | 169.7 µs | 27.93 ms / 41.77 ms | 27.76 ms | 163.7 µs | 27.59 ms |
| mcp-in-process | mcp-stream-16x1k | 20 | 17 | 53.6 µs | 4.90 ms / 6.28 ms | 4.85 ms | 7.5 µs | 4.84 ms |
| mcp-sdk-1.13.0-http | mcp-text-small | 5 | 7 | 320.4 µs | 546.6 µs / 1.58 ms | 226.2 µs | 56.4 µs | 218.8 µs |
| mcp-sdk-1.13.0-http | mcp-structured-nested | 5 | 66 | 314.4 µs | 1.98 ms / 2.71 ms | 1.66 ms | 16.4 µs | 1.68 ms |
| mcp-sdk-1.13.0-http | mcp-large-benign | 5 | 1020 | 1.39 ms | 35.54 ms / 42.17 ms | 34.15 ms | 158.7 µs | 33.92 ms |
| mcp-sdk-1.30.1-stdio | mcp-text-small | 5 | 7 | 25.2 µs | 209.4 µs / 366.1 µs | 185.5 µs | 13.1 µs | 173.2 µs |
| mcp-sdk-1.30.1-stdio | mcp-structured-nested | 5 | 66 | 64.2 µs | 1.78 ms / 2.83 ms | 1.71 ms | 28.0 µs | 1.69 ms |
| mcp-sdk-1.30.1-stdio | mcp-large-benign | 5 | 1020 | 647.9 µs | 27.57 ms / 31.97 ms | 26.92 ms | 141.7 µs | 26.78 ms |
| mcp-sdk-1.30.1-http | mcp-text-small | 5 | 7 | 567.6 µs | 1.02 ms / 2.63 ms | 363.3 µs | 0.6 µs | 271.7 µs |
| mcp-sdk-1.30.1-http | mcp-structured-nested | 5 | 66 | 625.6 µs | 3.40 ms / 5.41 ms | 2.77 ms | 40.1 µs | 2.62 ms |
| mcp-sdk-1.30.1-http | mcp-large-benign | 5 | 1020 | 2.25 ms | 46.61 ms / 60.74 ms | 44.18 ms | 129.9 µs | 43.80 ms |
| mcp-sdk-2.0.0-stdio | mcp-text-small | 5 | 7 | 84.0 µs | 350.6 µs / 740.2 µs | 265.7 µs | 8.6 µs | 260.6 µs |
| mcp-sdk-2.0.0-stdio | mcp-structured-nested | 5 | 66 | 109.2 µs | 2.45 ms / 3.10 ms | 2.34 ms | 24.5 µs | 2.29 ms |
| mcp-sdk-2.0.0-stdio | mcp-large-benign | 5 | 1020 | 840.8 µs | 36.10 ms / 46.66 ms | 34.93 ms | 308.5 µs | 34.73 ms |
| mcp-sdk-2.0.0-http | mcp-text-small | 5 | 7 | 406.5 µs | 645.9 µs / 1.69 ms | 243.0 µs | 49.6 µs | 231.8 µs |
| mcp-sdk-2.0.0-http | mcp-structured-nested | 5 | 66 | 574.5 µs | 3.32 ms / 5.51 ms | 2.72 ms | 32.9 µs | 2.64 ms |
| mcp-sdk-2.0.0-http | mcp-large-benign | 5 | 1020 | 1.31 ms | 33.26 ms / 45.37 ms | 31.96 ms | 153.7 µs | 31.86 ms |
| mcp-sdk-2.1.0-stdio | mcp-text-small | 5 | 7 | 46.9 µs | 273.9 µs / 494.2 µs | 227.3 µs | 11.4 µs | 201.2 µs |
| mcp-sdk-2.1.0-stdio | mcp-structured-nested | 5 | 66 | 92.8 µs | 2.07 ms / 3.20 ms | 1.98 ms | 41.3 µs | 1.94 ms |
| mcp-sdk-2.1.0-stdio | mcp-large-benign | 5 | 1020 | 1.04 ms | 36.62 ms / 49.27 ms | 35.52 ms | 457.1 µs | 35.06 ms |
| mcp-sdk-2.1.0-http | mcp-text-small | 5 | 7 | 389.9 µs | 719.6 µs / 1.19 ms | 310.8 µs | 61.3 µs | 249.5 µs |
| mcp-sdk-2.1.0-http | mcp-structured-nested | 5 | 66 | 354.0 µs | 2.10 ms / 4.37 ms | 1.75 ms | 11.9 µs | 1.72 ms |
| mcp-sdk-2.1.0-http | mcp-large-benign | 5 | 1020 | 968.5 µs | 28.05 ms / 44.03 ms | 27.16 ms | 101.9 µs | 26.91 ms |

Memory, 20 processes: after 500 protected calls of `mcp-large-benign` and a full GC, retained heap is at most 31.0 KiB with the boundary (2.4 KiB without); peak RSS 137.3 MiB.

Initialization, 15 fresh processes each: core import + initialize 13.77 ms median (p95 17.35); adapter-mcp import + createMcpBoundary + one benign call 19.67 ms median (p95 34.68); adapter share 5.90 ms.

| Package | Packed | Unpacked | Files |
| --- | ---: | ---: | ---: |
| @redact-secret/adapter@0.1.1 | 12.3 KiB | 37.4 KiB | 18 |
| @redact-secret/adapter-ai-context@0.1.0-alpha | 12.9 KiB | 44.0 KiB | 10 |
| @redact-secret/adapter-mcp@0.1.0-alpha | 15.4 KiB | 53.7 KiB | 10 |
| core candidate (core) | 38.5 KiB | 147.8 KiB | 53 |
| core candidate (node) | 414.5 KiB | 981.2 KiB | 2 |
| core candidate (wasm) | 248.2 KiB | 765.1 KiB | 9 |

## Not measured

- bundle contribution: adapter-mcp is a Node.js server-side package that loads the native core; no browser bundle applies
- a core that fails to initialize: requires breaking the installed core, which is adapter-internal lifecycle already qualified by redact-secret-adapters#13
- the Python mcp SDK, other language SDKs, HTTP+SSE, experimental.tasks: outside the supported range
- MCP messages other than tools/call: outside the contract

