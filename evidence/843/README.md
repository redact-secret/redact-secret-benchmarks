# Evidence: redact-secret#843, black-box `resources/read` qualification of `@redact-secret/adapter-mcp`

**Result:** PASS on containment. 3,048 case runs over 24/24 cells (Node.js 20/22/24 × SDK 1.13.0, 1.30.1, 2.0.0, 2.1.0 × stdio and Streamable HTTP), 1,440 of them `resources/read`, with no leak, no contract deviation, and no plaintext in either process's output. Both unprotected controls (tools/call and resources/read) were flagged in 24/24 cells. The 96 known false negatives are the four documented split exclusions in every cell. This directory records the historical run on unreleased adapters at `e087cb2`; the final rerun on the public post-#36 tarballs is frozen in [`public-release-2026.09.26/`](public-release-2026.09.26/README.md) and also passed.

This is the independent boundary and operational evidence that
[redact-secret-benchmarks#321](https://github.com/redact-secret/redact-secret-benchmarks/issues/321)
asks for, for the `resources/read` contract decided in
[redact-secret#843](https://github.com/redact-secret/redact-secret/issues/843)
(merged as `0af4cb8`). It reruns the whole #281 `tools/call` qualification
alongside it. The method is in
[`docs/specs/mcp-qualification.md`](../../docs/specs/mcp-qualification.md)
§ `resources/read` (#321). The adapter's own conformance suite is
redact-secret-adapters#33, linked here and not copied.

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `75c1a2b47b37e17feb544b6053a36d242083f20f` (the #323 merge on `develop`), clean detached worktree |
| Core | the **published** `@redact-secret/core@0.1.0-beta.8` (tag `v0.1.0-beta.8`, redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef`), fetched with `npm pack` from registry.npmjs.org, which checks each tarball against `dist.integrity`. It suffices because the adapters' key-aware path calls only `scanAndRedact` |
| `redact-secret-core-0.1.0-beta.8.tgz` | sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` | sha256 `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| `redact-secret-wasm-0.1.0-beta.8.tgz` | sha256 `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |
| Contract | redact-secret `0af4cb83b571baa86d27a678a351ece2ebc1f3cb` (#848, the #843 merge): [`mcp-resources-read.md`](https://github.com/redact-secret/redact-secret/blob/0af4cb83b571baa86d27a678a351ece2ebc1f3cb/docs/reference/mcp-resources-read.md), [`mcp-boundary.md`](https://github.com/redact-secret/redact-secret/blob/0af4cb83b571baa86d27a678a351ece2ebc1f3cb/docs/reference/mcp-boundary.md) and their decisions |
| Adapters | redact-secret-adapters `e087cb257486ac183cba01e8168b18e5f69aae98` on `develop` (the #33 merge), unreleased |
| Pin | [`adapters-e087cb2-pin.json`](adapters-e087cb2-pin.json) (sha256 `c61122f48fc622918486fc732fdc72b30c6c62db00da85263a28ca5b90468009`): a pin-source v1 record naming `e087cb2` and the content digests of the three MCP-path tarballs |
| Supported range | adapters `compatibility.json` at `e087cb2` (sha256 `8900469d7155965b3d3a95aba381ad771a453d9f47f0fedaeeac99b15a66439a`): `@modelcontextprotocol/sdk` 1.13.0–1.30.1, `client`/`server` 2.0.0–2.1.0, Node.js 20.x/22.x/24.x |
| Host | macOS 26 (darwin 25.5.0) arm64, Apple M4. Every Node.js line ran the darwin-arm64 native addon |

### The adapter tarballs

| Tarball | sha256 | npm shasum (sha1) | Content digest |
| --- | --- | --- | --- |
| `redact-secret-adapter-0.1.1.tgz` | `65ba7a50cce5c74fddaf88add8bb6fb55a532c3d8d4e6bfc43dd5ffd31e447f7` | `a5a675f1f49992072732e9f791cd0b26b319a695` | `sha256:e3a4ffbdf712154845aceaebd072dcbe0e24dfbba9bb45df5b2d81a010569552` |
| `redact-secret-adapter-ai-context-0.1.0-alpha.tgz` | `f973caf2b6bf51154dd66b84721d4ba18a9e9c4ba5ddc599f0edce70ae6ddc21` | `5b16c11d9971031a98c987f9a93697b1423aa7fe` | `sha256:d9c61e520b6b617457ec1bf3fa8c6694a6a949d5e29675e2c52af06ede2fc8d0` |
| `redact-secret-adapter-mcp-0.1.0-alpha.tgz` | `ebf2c79d655a2c78cecb6d763f4a8999254eb7e0847dc7a84d2441730794cb5c` | `1e4c1173350224eab20573fd21d0dad382aeb021` | `sha256:10af5381a8520654b537cf2c6c0d75e3fc7337777e67d380de7a57955c72fa09` |

They are packed the way the adapters `release.yml` publish jobs pack at
publish time (`npm ci`, the job's `npm run build --workspace …` steps, then
npm 11.19.1), on Node 22.16.0:

1. Two independent packs agree byte for byte. Pack A ran `npm ci`, a full `npm run build` and one `npm pack` of all three workspaces. Pack B ran each publish job on its own: a `git clean -fdx`, `npm ci`, exactly that job's build workspaces, and a pack of that one workspace, with a fresh npm cache.
2. The runner re-verified each tarball, and its installed tree in every clean consumer, against `adapters-e087cb2-pin.json`.
3. A separate clean consumer confirmed `npm ls --all` resolves one deduped copy of each `@redact-secret/adapter*` package, all from these `file:` tarballs, so none of them mixes with the published `@redact-secret/adapter@0.1.1` of the same version (redact-secret-adapters#36).

These versions are already used on the registry by different builds
(redact-secret-adapters#36). The tarballs are therefore not what a release
would publish: the fix required a version bump, which changed every digest
above. The completed rerun on those public bytes is in
[`public-release-2026.09.26/`](public-release-2026.09.26/README.md).

## Scanner and runtime versions

No scanner comparison is involved. The only detector is the published core above, reached through the adapters. Gitleaks and TruffleHog did not run, so the TruffleHog pin does not apply. The runtimes were Node.js `20.20.2` and `24.21.0` (official darwin-arm64 builds, verified against nodejs.org `SHASUMS256.txt`) and `22.16.0`, for both host and server processes. The SDKs were `@modelcontextprotocol/sdk` `1.13.0` (negotiated protocol `2025-06-18`) and `1.30.1`, and `@modelcontextprotocol/client` + `@modelcontextprotocol/server` `2.0.0` and `2.1.0` (all three `2025-11-25`). Each came from the registry into its own clean consumer.

## Results

- **Leaks:** 0 across all 24 cells and every sink: model context, host log, store, audit trail, error text; for server-wrapped tools and resources, the wire output and handler input; for the 2.x response-cache cases, the store the host handed its client. 0 process-output leaks (host stdout, host stderr, server stderr).
- **Deviations:** 0. All 61 `resources/read` cases conform in every cell they run in (59 on 1.x, 61 on 2.x):
  - resource text with provider tokens, a private-key block and multibyte text;
  - JSON and settings text with key context, kept as text and redacted in place;
  - key-identified leaves in result and entry `_meta` redacted in place; sibling-key context blocked as `policy` under a block policy and delivered under warn;
  - mixed sensitive and benign entries; credentials in `uri`, `mimeType`, entry and result `_meta`, and in a `_meta` key;
  - `blob` blocked (`unsupported_value`) by default and passed unscanned under `binaryContent: "pass"` with every other field still scanned;
  - large benign text, a secret at the end of a large text, text over `maxInputBytes` (`limit_exceeded`, never truncated), depth and node limits counted from the result root;
  - cancellation before and during a read, a server-wrapped slow read, a race sweep, and an abort while the read rejects: a `null` response and no server response;
  - the exact fixed blocked and read-error JSON-RPC errors with no `data`, a server error carrying a secret becoming `read_error` unread, a not-found error echoing the URI, a server crash mid-read;
  - low-level `Server` handlers and `McpServer.registerResource` with fixed and template URIs, raw and wrapped with `wrapResourceReadHandler`;
  - the `resource` finding label and input-free `{stage:"resource",...}` audit records on every case, and audit callbacks that throw.
- **Negative controls:** `control-unprotected-host` (tools/call) and `resource-control-unprotected-host` (resources/read) were each flagged in all five host sinks in 24/24 cells.
  [#328](https://github.com/redact-secret/redact-secret-benchmarks/issues/328) corrected the derived resources/read summary from the committed case verdicts: it now records `resourceControlsDetected: 24` and says "control flagged in 24/24 cells." The correction preserves every verdict, sink observation and security result; no measurement was rerun.
- **Known false negatives:** 96: `split-across-blocks`, `split-across-fields`, `split-across-calls` and `resource-split-across-entries` in each cell. All are documented exclusions, unmeasured by design. A split across two `resources/read` calls is not run.
- **Delivered by policy:** 120, the explicit warn/allow cases on both surfaces.
- **Host responsibility:** 12, `resource-cache-ttl-stores-raw-before-boundary` in the 12 cells on 2.x. When the server sends `ttlMs`, the 2.x `Client` stores the raw result in its `responseCacheStore` before the boundary runs. The contract names that store as the host's responsibility, and `resource-cache-bypass-stores-nothing` shows that `cacheMode: "bypass"` keeps it empty. Every other 2.x read used `cacheMode: "bypass"`.
- **SDK parsing:** Both client SDKs drop unknown fields inside a `contents` entry, and the `blob` of an entry that also has `text`, before the boundary runs. They reject malformed results, which become `read_error`. The cases score what the host received.

## Operational cost

Measured, not budgeted: no MCP budget exists in
`benchmarks/regression-budgets.json`. The `resources/read` profile ran in its
own processes (5 per SDK endpoint and transport, 20 in process) on Node
22.16.0. The tables are in [`mcp-qualification.md`](mcp-qualification.md)
§ resources/read operational profile.

| In process, Node 22 | Result | Scanner calls | Protected median | Backstop | Throughput |
| --- | ---: | ---: | ---: | ---: | ---: |
| tools/call `mcp-text-small` | small | 8 | 113.8 µs | — | — |
| resources/read `resource-text-1k` | 1.1 KB | 11 | 284.3 µs | 79.3 µs | 3.6 MiB/s |
| resources/read `resource-text-60k` | 62 KB | 11 | 7.31 ms | 114.5 µs | 8.0 MiB/s |
| resources/read `resource-json-config` | 1.6 KB | 11 | 286.8 µs | 71.5 µs | 5.1 MiB/s |
| resources/read `resource-meta-keyed-leaves` (300 leaves) | 5.1 KB | 918 | 7.42 ms | 663.2 µs | 0.6 MiB/s |
| tools/call `mcp-large-benign` (900 leaves) | — | 1023 | 19.88 ms | — | — |
| resources/read `resource-many-entries` (200 entries) | 74 KB | 2001 | 33.51 ms | 2.78 ms | 2.1 MiB/s |

- As for tools/call, nearly all of the cost is the core's scan. The adapter's traversal stays under 0.5 ms on every row, and it is a few microseconds for text resources.
- A small read costs about 2.5× a small tools/call (284 vs 114 µs). The resources/read path adds the key-context backstop's second scan and the shape pass, which is 71–79 µs on small reads.
- The backstop's share falls with size: 28% of a 1 KB read, 9% for 300 keyed `_meta` leaves, 8% for 200 entries, and 1.6% of a 60 KB text.
- Over a transport the per-read overhead tracks the in-process cost. For example, a 60 KB text costs 6.6–9.9 ms on every endpoint and transport except 2.1.0 over HTTP, which measured 15.5 ms. That was the last endpoint measured, and its tools/call rows are also the slowest (for example, 28.0 ms against about 20 ms for `mcp-large-benign`), so treat it as host noise until a budget run repeats it.
- Memory: after 500 protected reads of `resource-text-60k` and a full GC, retained heap was at most 253.5 KiB with the boundary (−2.2 KiB without), and peak RSS was 144.1 MiB (20 processes). For tools/call the figures were 68.7 KiB and 162.5 MiB.
- Initialization: the adapter's share was 3.91 ms (median of 15 fresh processes).

## Command

```sh
# Isolate npm from any user config in every step:
export NPM_CONFIG_USERCONFIG=<empty file> npm_config_cache=<scratch dir>
# Core: the published tarballs.
npm pack @redact-secret/core@0.1.0-beta.8 @redact-secret/node-darwin-arm64@0.1.0-beta.8 @redact-secret/wasm@0.1.0-beta.8
# Adapters: the publish jobs' build and pack at e087cb2, with the npm the publish jobs pin.
git -C <adapters> worktree add --detach <pack-a> e087cb257486ac183cba01e8168b18e5f69aae98
cd <pack-a> && npm ci && npm run build
npx -y npm@11.19.1 pack --workspace @redact-secret/adapter --workspace @redact-secret/adapter-ai-context \
  --workspace @redact-secret/adapter-mcp --pack-destination <adapter-dir>
git -C <adapters> show e087cb257486ac183cba01e8168b18e5f69aae98:compatibility.json > compatibility.json
# The run (benchmarks at 75c1a2b):
npm ci
npm run mcp:qualify -- \
  --core-package <core>/redact-secret-core-0.1.0-beta.8.tgz \
  --core-node-package <core>/redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz \
  --core-wasm-package <core>/redact-secret-wasm-0.1.0-beta.8.tgz \
  --core-source-commit 5639a0ea02e0eefbd1533bea23a05c749b529bef \
  --contract-commit 0af4cb83b571baa86d27a678a351ece2ebc1f3cb \
  --adapter-dir <adapter-dir> --adapter-pin evidence/843/adapters-e087cb2-pin.json \
  --compatibility compatibility.json \
  --node <node-20.20.2> --node <node-22.16.0> --node <node-24.21.0> --overhead-processes 5 \
  --out mcp-qualification.json --markdown-out mcp-qualification.md --overhead-out mcp-overhead-series.json
```

The run went detached with `TMPDIR` pointed at a scratch directory outside
the checkout. It took 82 minutes and exited 0.

## Files

- `mcp-qualification.json`: the full report (`schemas/mcp-qualification-v1.json`). It holds identities, every cell, every case verdict with its checks and the sinks it touched, and both operational profiles (`operational.overhead` for tools/call, `operational.resources` for resources/read). Its "Core candidate" row in `mcp-qualification.md` is the published core; the runner's label predates published-core runs.
- `mcp-qualification.md`: the runner's own summary of that report, regenerated under #328 so the resources/read control agrees with its 24/24 case rows.
- `mcp-overhead-series.json`: the tools/call per-process overhead outputs, readable by `npm run performance:budgets:evaluate -- --adapter <file>`. The resources/read rows are not in it, by design.
- `adapters-e087cb2-pin.json`: the pin the runner verified against.

None of them carries a synthetic value or a fragment of one. The runner
refuses to write such a file, and `tests/mcp-qualification.test.mjs`
re-checks the committed copies.
