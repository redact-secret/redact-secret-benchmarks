# Black-box MCP adapter qualification

Issues: [#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281)
(`tools/call`) and [#321](https://github.com/redact-secret/redact-secret-benchmarks/issues/321)
(`resources/read`).
Decision: [`2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md`](../decisions/2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md).
Contract under test: redact-secret's
[MCP boundary contract](https://github.com/redact-secret/redact-secret/blob/main/docs/reference/mcp-boundary.md)
(redact-secret#612), its
[`resources/read` specialization](https://github.com/redact-secret/redact-secret/blob/main/docs/reference/mcp-resources-read.md)
(redact-secret#843), and the key-aware `sanitizeValue` both rest on
(redact-secret#842). Adapter: `@redact-secret/adapter-mcp` and
`@redact-secret/adapter-ai-context` (redact-secret-adapters#13).

Runner: `benchmarks/mcp-qualification.ts` (`npm run mcp:qualify`). Pure
pieces (artifact digests, the leak scan, verdicts): `benchmarks/lib/mcp-qualification.ts`.
Consumer-side host, server and workload corpus: `benchmarks/mcp-qualification/consumer/`.
Report schema: `schemas/mcp-qualification-v1.json`. Tests: `tests/mcp-qualification.test.mjs`.
First run: [`evidence/612/`](../../evidence/612/README.md), reported in
[`docs/reports/2026-09-25-beta9-281-mcp-qualification.md`](../reports/2026-09-25-beta9-281-mcp-qualification.md).

## What it answers

> When the declared MCP adapter is used at its supported boundary, does
> synthetic plaintext stay contained under adversarial workloads, and what
> does that protection cost?

It is independent boundary and operational evidence. It is not the adapter's
conformance suite: it does not replay the core's `mcp-boundary.json` fixture,
does not re-test traversal internals, and does not own the SDK compatibility
matrix. It reads that matrix from the adapters' `compatibility.json` at the
pinned commit and runs its endpoints.

## Inputs, all exact

| Input | Identity recorded |
| --- | --- |
| Core | the façade, native and Wasm tarballs (sha256 each) and the product source commit: a candidate built as in [candidate evaluation](candidate-evaluation.md), or a published version fetched with `npm pack <name>@<version>` (npm checks each against the registry's `dist.integrity`), which is what a consumer installs |
| Contract | the redact-secret commit whose MCP boundary contract and decision the report links (`--contract-commit`, default the core's source commit). A published core can predate the contract document, so the two are named separately |
| Adapters | the `@redact-secret/adapter`, `adapter-ai-context` and `adapter-mcp` tarballs, verified against a pin-source v1 record's content digests (the same digest `scripts/adapter-pins.py` computes): redact-secret's `adapters/pin-source.json`, or, to qualify a release candidate, a record naming the rc head and the digests of the tarballs its publish jobs would upload; a mismatch stops the run |
| Supported range | the adapters' `compatibility.json` (sha256): the lowest and highest endpoint of the 1.x and 2.x SDK lines |
| Runtimes | every `--node` binary; the host and the server process both run on it |
| Corpus | `workloads.mjs` (sha256 in the report) |

For each SDK endpoint the runner writes a fresh `package.json` in a temporary
directory, installs the core tarballs (native and Wasm through `overrides`),
the three adapter tarballs and the SDK at exactly the endpoint version, and
checks the installed adapter trees against the pinned digests and the SDK
against the endpoint. Nothing points back to a source checkout.

## What runs

For every SDK endpoint × Node.js runtime × transport (stdio, Streamable HTTP),
a real MCP client in the host process talks to a real MCP server in its own
process. The host is the contract's authoritative placement: it applies
`sanitizeToolCall` to every result and writes only `toCallToolResult(outcome)`
to its sinks. Servers return raw content on purpose (a misbehaving tool); the
`wrapped-*` tools also exercise the preventive server placement.

Case areas (`workloads.mjs`, expectations authored from the contract, never
from adapter output):

- text, nested `structuredContent` with a JSON text copy, `_meta` on the result
  and on a block, `resource_link` fields, embedded text resources, unknown
  fields, annotations, `isError` results, object keys;
- block findings, key-context-only values, image and blob content (blocked by
  default);
- limits: depth and node counts on both sides of the limit, a leaf over the
  input limit, a secret at the end of a leaf just under it, findings over the
  per-scan limit and many findings spread over leaves;
- the four results both SDK server lines reject before the host (expected
  `tool_error`);
- tool failures: a low-level handler that throws, an `McpServer` handler that
  throws (the SDK turns the message into result text the host must scan), and
  a server that dies mid-call;
- opt-in arguments: redacted before dispatch, or blocked and never dispatched;
- server-wrapped results, throws, arguments and streams, checked on the
  server's own wire output and handler input;
- multibyte text (astral, combining and right-to-left characters) in text and
  structured content, and every two-chunk split of it: a cut between code
  points must equal the whole result, a cut inside a surrogate pair must fail
  closed;
- host-side streamed output: every two-chunk split, one code unit per chunk
  and seeded random partitions (each must equal the whole-result outcome),
  block findings, input and token limits (each must stop pulling and close
  the producer), abort at every chunk and while the producer is pending,
  producers that throw or reject, non-string chunks and a Node.js `Readable`;
- cancellation over the transport, and a race sweep that aborts at eight
  timings around a fast call (each must be `ok` or `aborted`, never raw);
- policies: block, warn, allow, a throwing policy, throwing audit callbacks,
  and a downstream model failure that echoes the context into its error;
- documented exclusions: a secret split across blocks, fields or calls.

### `resources/read` (#321)

The same host reads resources at the contract's placement,
`sanitizeResourceRead(({ signal }) => client.readResource({ uri }, { signal }))`,
and writes only `toReadResourceResponse(outcome)` to its sinks. On the 2.x
Client every read passes `cacheMode: "bypass"`, so each one reaches the
server and the boundary. Servers: the low-level `Server` with its own
`resources/read` handler (`test://resource/<case>`, `test://raw/*`,
`test://wrapped/*`) and `McpServer.registerResource` with a fixed URI and a
URI template, each raw and through `wrapResourceReadHandler`. Case areas,
the list #843 posted on #321:

1. provider tokens, a private-key block finding and multibyte text in entry `text`;
2. JSON and configuration documents that stay text, with `"password":"..."` redacted in place by key context;
3. key-identified `_meta` leaves (result and entry, nested in an array) redacted in place, and a
   sibling-key-only value that blocks as `policy` under a block policy and is delivered by the
   default `warn`;
4. several entries with benign siblings delivered unchanged, and a split across entries (a documented exclusion);
5. tokens in `uri`, `mimeType`, entry and result `_meta`, an object key, and unknown entry and result fields;
6. `blob` blocked by default, and passed unchanged under `binaryContent: "pass"` with every other field
   still scanned; an entry with both `text` and `blob`, and a non-string `blob`;
7. a 60 KB benign text, a secret at the end of a text just under `maxInputBytes`, a text over it
   (`limit_exceeded` / `INPUT_LIMIT_EXCEEDED`), and depth and node limits that are crossed only when
   counted from the result root;
8. cancellation: before the read (never invoked), during a raw and a wrapped slow read (the server
   must send nothing, checked on its wire output), a race sweep at eight timings, and a signal that
   fires while the read rejects (`aborted`, not `read_error`);
9. the exact fixed errors with no `data` (at the host, and on a wrapped server's wire), and server
   errors whose message, `data` or echoed URI carries a secret, which must become `read_error`
   without their text reaching any sink; malformed results the SDK rejects;
10. the audit record (`stage: "resource"`, only `stage`, `outcome`, `reason`, `code`, `reason` only for
    `blocked`) and the `resource` finding label, checked on every case, plus one exact case.

Where an SDK parses a result before the boundary (it drops or rejects what
its schema does not allow), the case scores what the host received and names
each fail-closed alternative in `acceptAlso`. The observed outcome per SDK is
in the report. The 2.x-only response-cache cases hand the Client a recording
`responseCacheStore`: under `cacheMode: "use"` a result the server marks
cacheable (`ttlMs`) must reach the store raw, and a second read is served
from it and still sanitized; under `"bypass"` nothing is stored. The store
is the `response-cache` sink, before the boundary: plaintext there is
`host-responsibility`, a documented host duty, never scored as contained.

## Sinks and verdicts

The host appends, per case, everything it writes to five sinks: the model
context, its log, its store, its audit trail (`onAudit` records and
`onFinding` metadata) and error text. The server records its wire output and
each handler's input. The runner scans every sink for each synthetic value in
full and as any 12-character fragment with at least four distinct characters,
and also scans the host process's stdout and stderr and the server's stderr.

| Containment | Meaning |
| --- | --- |
| `contained` | no sink carried plaintext |
| `leak` | a host sink (or a wrapped server's wire output or handler input) carried plaintext the contract says it must not. This is a failure of the claim |
| `known-false-negative` | plaintext reached a sink through a documented exclusion (a split across blocks, fields or calls). Recorded, not scored against the claim |
| `delivered-by-policy` | the host configured `warn` or `allow`, or the core's default is `warn`, which deliver unchanged by contract |
| `host-responsibility` | plaintext only in the 2.x Client's `responseCacheStore`, which the contract places before the boundary, in a case that declares it |
| `control-detected` / `control-missed` | the negative control: an unprotected host writes the raw result to all five sinks, which the scan must flag. A miss makes the whole cell's "no leak" meaningless and fails the run |

Independently, each case's checks compare the observed outcome and reason,
the fixed result delivered, and lifecycle observations (not dispatched,
stopped pulling, producer closed, nothing delivered on abort, benign content
unchanged, every stream partition equal to the whole result) with the
contract. A failed check is a **deviation**. Leaks and deviations are counted
separately and never combined into a score. The run exits nonzero on any
leak, deviation, process-output leak or incomplete cell.

A `resources/read` case also fails a check when the delivered response is
not the outcome's (the sanitized result, the exact fixed blocked or read
error with no `data`, or nothing when aborted), when its audit record or
finding label is not the input-free `resource` shape, when a key-identified
leaf is not redacted at its own position with everything else unchanged,
when a cancelled read got a server response, or when a wrapped server's wire
error is not the exact fixed error. Each cell carries a `resources` summary
beside its totals, and two controls (one per surface) that must both be
flagged.

The report carries outcomes, counts, check names and sink names only. The
runner refuses to write a report or Markdown summary that contains any
synthetic value or fragment.

## Operational cost

Measured on the runtime that is on the Node 22 line (the #143 adapter
profile), for each SDK endpoint and transport, in `--overhead-processes`
separate processes:

- **per-call overhead**: modes interleaved and rotated per repetition, 15
  repetitions, nearest-rank percentiles, `process.hrtime.bigint`, as the
  adapters' harness does. `host` is the same host delivering the raw result;
  `adapter-core` routes it through the boundary; `adapter-identity` injects a
  core that finds nothing through the public `createAiContextBoundaryWith`,
  so `traversal = adapter-identity − host` isolates the adapter's own cost and
  `coreScan = adapter-core − adapter-identity` the core's. Over the transport
  and, once per process pair, in process (the parsed result only). Workloads:
  a small text result, nested structured content, 900 benign leaves, and a
  16-chunk streamed output;
- **scanner calls and code units per call**: counted through the same public
  injection with the real core; deterministic;
- **retained heap** after 500 protected calls of the largest workload, after a
  full GC, and peak RSS;
- **initialization**: fresh processes, alternating, `import` + `initialize()`
  of the core against `import` + `createMcpBoundary()` + one benign call;
- **package size**: packed, unpacked and file count of every tarball, #141's
  definitions.

**`resources/read`**, in its own processes and reported apart
(`operational.resources`): per-read latency over each SDK endpoint and
transport, and in process, for text resources of 1, 8, 32 and 60 KiB, a JSON
config document, a result with 300 keyed `_meta` leaves, and 200 entries.
In process a fourth mode, `leaf-pass`, runs the AI-context `sanitizeValue` of
the result alone on the real core, so `backstop = adapter-core - leaf-pass`
is the key-context backstop's second scan plus the resource shape pass. The
backstop's own scanner calls and code units are counted through the public
injection API (the whole read's count minus the leaf pass's). Throughput is
the result's JSON size over the protected median. Retained heap after 500
protected reads of the 60 KiB profile and peak RSS, as for tool calls. The
resource rows are not in the `--overhead-out` series, which stays the
`tools/call` series #143 reads.

The overhead rows are written in the `redact-secret-benchmarks/mcp-overhead-v1`
output shape inside an `adapter-overhead-series-v1` series (`--overhead-out`),
which `npm run performance:budgets:evaluate -- --adapter <series>` reads under
the `mcp-javascript` adapter language. No MCP baseline exists in
`benchmarks/regression-budgets.json` yet, so every MCP metric is reported and
none is judged. Adding it follows [regression-budgets.md](regression-budgets.md#promoting-a-new-baseline):
a baseline promotion with five processes on the budgeted host.

## Command

```sh
# 1. Core candidate tarballs from a clean product checkout (see candidate-evaluation.md).
# 2. Adapter tarballs from the pinned commit, verified against the pin:
python3 -B -c "import importlib.util; s=importlib.util.spec_from_file_location('p','scripts/adapter-pins.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(m.verified_tarballs(m.load_pin()))"   # in the product checkout
git -C <adapters checkout> show <pinned commit>:compatibility.json > compatibility.json
# 3. The run:
npm run mcp:qualify -- \
  --core-package <core.tgz> --core-node-package <node-<platform>.tgz> --core-wasm-package <wasm.tgz> \
  --core-source-commit <40-hex> [--contract-commit <40-hex>] --adapter-dir <product>/.cache/adapters/<commit> \
  --adapter-pin <product>/adapters/pin-source.json --compatibility compatibility.json \
  --node <node20> --node <node22> --node <node24> \
  --out mcp-qualification.json --markdown-out mcp-qualification.md --overhead-out mcp-overhead-series.json
```

`--quick` shrinks repetitions and process counts for a smoke run; its report
says `quick: true` and is not evidence.

## Limitations

- Timings are host-dependent and come from the machine that ran the report.
  The #143 adapter budgets are bound to one host profile; an MCP run from
  another host is not comparable to it.
- Transport timings include the SDK's own serialization and the loopback or
  pipe round trip, which the boundary does not control; the in-process rows
  exclude them.
- A fragment scan finds plaintext substrings. It does not decode encodings,
  which the contract excludes.
- Uninitialized-core and failed-initialization behavior needs a broken
  install and is left to the adapters' own qualification.
