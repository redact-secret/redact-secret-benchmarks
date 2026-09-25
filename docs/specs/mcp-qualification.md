# Black-box MCP adapter qualification

Issue: [#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281).
Decision: [`2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md`](../decisions/2026-09-25-qualify-adapter-boundaries-black-box-by-sink-containment.md).
Contract under test: redact-secret's
[MCP boundary contract](https://github.com/redact-secret/redact-secret/blob/main/docs/reference/mcp-boundary.md)
(redact-secret#612). Adapter: `@redact-secret/adapter-mcp` and
`@redact-secret/adapter-ai-context` (redact-secret-adapters#13).

Runner: `benchmarks/mcp-qualification.ts` (`npm run mcp:qualify`). Pure
pieces (artifact digests, the leak scan, verdicts): `benchmarks/lib/mcp-qualification.ts`.
Consumer-side host, server and workload corpus: `benchmarks/mcp-qualification/consumer/`.
Report schema: `schemas/mcp-qualification-v1.json`. Tests: `tests/mcp-qualification.test.mjs`.

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
| Core candidate | the façade, native and Wasm tarballs (sha256 each) and the product source commit, built as in [candidate evaluation](candidate-evaluation.md) |
| Adapters | the `@redact-secret/adapter`, `adapter-ai-context` and `adapter-mcp` tarballs, verified against redact-secret's `adapters/pin-source.json` content digests (the same digest `scripts/adapter-pins.py` computes); a mismatch stops the run |
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
| `delivered-by-policy` | the host configured `warn` or `allow`, which deliver unchanged by contract |
| `control-detected` / `control-missed` | the negative control: an unprotected host writes the raw result to all five sinks, which the scan must flag. A miss makes the whole cell's "no leak" meaningless and fails the run |

Independently, each case's checks compare the observed outcome and reason,
the fixed result delivered, and lifecycle observations (not dispatched,
stopped pulling, producer closed, nothing delivered on abort, benign content
unchanged, every stream partition equal to the whole result) with the
contract. A failed check is a **deviation**. Leaks and deviations are counted
separately and never combined into a score. The run exits nonzero on any
leak, deviation, process-output leak or incomplete cell.

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
  --core-source-commit <40-hex> --adapter-dir <product>/.cache/adapters/<commit> \
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
