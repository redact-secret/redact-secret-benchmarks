# Beta.9 #281: black-box MCP adapter boundary and operational qualification

Issue: [#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281).
Evidence: [`evidence/612/`](../../evidence/612/README.md) (identities, command, full report).
Method: [`docs/specs/mcp-qualification.md`](../specs/mcp-qualification.md).
Decision: [`2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md`](../decisions/2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md).

**Result.** Artifacts tested: `@redact-secret/adapter-mcp@0.1.0` and
`@redact-secret/adapter-ai-context@0.1.0` (and `@redact-secret/adapter@0.1.0`)
from redact-secret-adapters `f014a99`, digests verified, over core candidate
`5213be1`. Across 1,584 case runs in 24 cells, no synthetic value reached the
model context, host log, store, audit trail or error text. It did not reach
either process's output or a wrapped server's wire output or handler input
either, and no case deviated from the contract. The negative control was
flagged in every cell. The protection costs about 0.1 ms per small call and
about 1 ms for a nested structured result. A 900-leaf result costs about
16 ms. More than 98% of that is the core's per-leaf scan; the adapter's own
traversal is under 2%.

## Matrix executed

| Node.js | SDK endpoints | Transports | Protocol negotiated |
| --- | --- | --- | --- |
| 20.20.2, 22.16.0, 24.21.0 | `@modelcontextprotocol/sdk` 1.13.0 (lowest) and 1.30.1 (highest); `@modelcontextprotocol/client` + `server` 2.0.0 (lowest) and 2.1.0 (highest) | stdio (server as a child process), Streamable HTTP (server in its own process on 127.0.0.1) | 2025-06-18 on 1.13.0; 2025-11-25 on the other three |

That is 4 endpoints × 3 runtimes × 2 transports = 24 cells, each running all
66 cases. Every endpoint came from the adapters' `compatibility.json`, and
every one was installed into its own clean consumer from the registry. The
adapter tarballs were re-verified there by content digest.

## Containment

| Class | Case runs | What it is |
| --- | ---: | --- |
| leak | **0** | plaintext in a protected sink |
| process-output leak | **0** cells | plaintext on the host's stdout or stderr |
| contract deviation | **0** | a failed outcome, fixed-result or lifecycle check |
| control flagged | 24 / 24 | the unprotected host is caught in all five sinks in every cell |
| known false negative | 72 (3 per cell) | `split-across-blocks`, `split-across-fields`, `split-across-calls`: the halves reach the model context, log and store, exactly as the contract's exclusions say |
| delivered by policy | 48 (2 per cell) | the host configured `warn` or `allow`, which deliver unchanged by contract |

Per area, every cell agreed:

- **Where a value can sit.** Text, nested `structuredContent` with its JSON
  text copy, `_meta` on the result and on a block, `resource_link` `uri` and
  `description`, embedded text resources, unknown top-level fields,
  `isError` results and multibyte context were all delivered redacted. A
  value used as an object key, a key-context-only value and a private-key
  block finding each blocked the whole result as `policy`. Image and blob
  content blocked as `unsupported_value`.
- **Limits.** Depth and node counts on each side of the limit behaved as the
  contract says, and so did a leaf over the input limit and a value in the
  last 200 bytes under it. Findings over the per-scan limit blocked with
  `FINDING_LIMIT_EXCEEDED`, while 300 findings spread over leaves were all
  redacted.
- **Malformed results.** All four shapes the SDK server lines reject
  (unknown block type, non-object block, non-array `content`, non-object
  result) arrived as `tool_error` with the fixed text on both lines and both
  transports. The JSON-RPC error, which can quote the result, reached no
  sink.
- **Failures.** A low-level handler that throws with a value in its message
  gave `tool_error`. An `McpServer` handler that throws gives `isError` text
  carrying the message, which the host boundary redacted. A server that exits
  mid-call gave `tool_error`. A downstream model error that echoes the
  context into its message carried only the sanitized text.
- **Arguments.** Opt-in sanitation redacted before dispatch. A key-context or
  private-key argument blocked, and the server's dispatch counter did not
  move.
- **Server-wrapped tools** (preventive placement). Their wire output and
  handler input were clean. A wrapped throw put the fixed tool-error result
  on the wire. A wrapped block stream stopped after 3 of 15 chunks and
  closed its producer.
- **Streaming.** Every partition of the stream text equalled the whole-result
  outcome in every cell: 183 per cell, covering each two-chunk split, one
  code unit per chunk, 64 seeded random partitions and empty chunks. On the
  multibyte text, the 116 cuts between code points equalled the whole result.
  The 6 cuts inside a surrogate pair, which a streaming decoder never
  produces, failed closed as `core_error`/`UNPAIRED_SURROGATE` and delivered
  nothing. Block findings, input limits and token limits stopped pulling and
  closed the producer; a Node.js `Readable` was destroyed early.
- **Cancellation.** Aborting at each of 11 chunk positions, and while the
  producer was pending, delivered nothing and closed the producer. So did
  cancelling a slow tool or a wrapped slow stream over the transport, and the
  server closed its producer. The race sweep aborted a fast call at eight
  timings, 40 calls per cell. Outcomes were only `ok` (redacted) or
  `aborted`: `aborted` took between 15 and 32 of the 40 per cell, and none
  were raw.
- **Policy and callbacks.** A block-all policy blocked. A throwing policy
  failed closed as `core_error`/`POLICY_FAILURE`. Throwing `onAudit` and
  `onFinding` callbacks did not change the outcome.

One observation, not a failure: `annotations` with an unknown field reached
the host only on SDK 1.13.0 (6 of 24 cells), where the boundary redacted it.
The later SDKs strip the field before the host sees it.

## Operational cost

These are measurements only. `npm run performance:budgets:evaluate` reads
the series (under the new `mcp-javascript` adapter language) and reports all
94 existing triggers `not-evaluated`, because no MCP baseline exists yet.
Everything was measured on Node.js 22.16.0, Apple M4. Figures are the median
over processes of each process's median, 15 repetitions per process, with
modes interleaved and rotated. There were 5 processes per SDK endpoint and
transport, and 20 for the in-process rows.

| Workload | Scanner calls per call | Unprotected, in process | Protected, in process | Adapter traversal | Protected over stdio (range over 4 endpoints) | Protected over HTTP (range) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| small text result, one finding | 7 | 0.3 µs | 108 µs | 1.5 µs | 133–158 µs (unprotected 18–31 µs) | 272–395 µs (unprotected 163–245 µs) |
| nested `structuredContent` + text copy, ~2 KiB | 66 | 5.3 µs | 0.93 ms | 8.7 µs | 0.98–1.20 ms | 1.14–1.32 ms |
| 900 benign leaves + text copy, ~60 KiB | 1,020 | 96 µs | 15.6 ms | 91 µs | 16.0–17.2 ms | 16.1–18.2 ms |
| 16 streamed chunks, ~16 KiB | 17 | 32 µs | 2.71 ms | 4.4 µs | — | — |

- **Where the time goes.** The adapter's own traversal is under 2% of the
  protected cost (0.2–1.4% in process). The rest is the core. Its cost scales with scanner calls:
  about 14–15 µs per `scanAndRedact` call, whatever the leaf's length. The
  key-context check re-scans each value-shaped part, so a structured result
  costs roughly two scans per leaf plus one per key. That is the contract's
  design. Hosts returning wide structured results should expect about
  15 µs per leaf. Anything that lowers the fixed per-call cost belongs to
  the core.
- **Memory.** After 500 protected calls of the 900-leaf workload and a full
  GC, at most 30.7 KiB stayed retained (2.4 KiB without the boundary). That
  is about 60 bytes per call, so no result is being kept. Peak RSS was at most
  151.2 MiB.
- **Initialization.** In 15 fresh processes each, importing the core and
  awaiting `initialize()` took 6.40 ms median (p95 8.90). Importing
  `adapter-mcp` and running `createMcpBoundary()` plus one benign call took
  11.05 ms median (p95 17.39). The adapter's share is 4.65 ms.
- **Package size.** #141 definitions (packed / unpacked / files):

  | Package | Packed / unpacked / files |
  | --- | --- |
  | `adapter-mcp` | 15.7 / 54.7 KiB / 10 |
  | `adapter-ai-context` | 13.1 / 44.7 KiB / 10 |
  | `adapter` | 12.3 / 37.4 KiB / 18 |

  The three together are 41.1 KiB packed on top of the core's 38.5 KiB
  façade and its native or Wasm package. No browser bundle applies: this is
  a Node.js server-side package.

## Judgement for publication

On this evidence, the boundary behavior of the tested artifacts qualifies:
no containment failure, no contract deviation, and a cost dominated by
detection rather than by the adapter.

These are not yet the artifacts that would be published, and three things
stand between them and a release:

1. **The release tarballs will differ from the ones tested.** Both packages
   are `"private": true`. Their CHANGELOGs list the first-release steps,
   which include raising `adapter-ai-context`'s `@redact-secret/adapter`
   range to the first version with `walkStrict`. Every one of those edits
   changes a content digest, so this evidence binds to `f014a99` and not to
   the release. Rerun `npm run mcp:qualify` (16 minutes) on the exact
   release-candidate tarballs and the core version they will ship against.
2. **The dependency on `@redact-secret/adapter` must be released first.**
   Black-box check: installing today's `adapter-ai-context` and
   `adapter-mcp` tarballs next to the registry's `@redact-secret/adapter@0.1.0`
   (the only published version, which `^0.1.0` resolves to) fails at import
   with `SyntaxError: The requested module '@redact-secret/adapter' does not
   provide an export named 'isStrictWalkLimits'`. It fails closed, but a
   registry consumer cannot use the package. The pinned tarball is also
   numbered `0.1.0`, a version the registry already holds with different
   content, so it cannot be published as is. This is already tracked as a
   first-release step in redact-secret-adapters#12. It is not a new defect.
3. **The core is a candidate.** `5213be1` still declares `0.1.0-beta.8` but
   is not the published beta.8. The run should be repeated against the core
   artifact the adapters will declare and ship with.

Not blocking, but worth knowing:

- This run is darwin-arm64 only, so the timings are that host's. The
  containment logic is platform-independent, and the adapters' own CI covers
  Linux for compatibility, but no Linux x86_64 containment run exists here.
- The overhead numbers are not budgeted. Budgeting them means promoting a
  baseline that includes the `mcp-javascript` rows ([regression budgets](../specs/regression-budgets.md#promoting-a-new-baseline)).

## Limitations

- Uninitialized-core and failed-initialization behavior were not exercised.
  They need a broken install and belong to the adapters' qualification.
- The fragment scan finds plaintext substrings of 12 characters or more. It
  does not decode encodings, which the contract excludes.
- The `settledAfterAbortMs` observation on
  `cancel-server-wrapped-slow-stream` includes a preceding stats round trip
  in this run, so some values read as negative. It is not scored. The harness
  now starts the abort timer after that round trip.
