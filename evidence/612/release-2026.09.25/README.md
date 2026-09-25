# Evidence: redact-secret#612, MCP boundary requalification on the adapters release train `2026.09.25`

**Result:** PASS. This run used the exact tarballs that release train `2026.09.25` (redact-secret-adapters#28, rc head `cfc6ba5`) would publish, on the published core `0.1.0-beta.8`. It covered 1,584 case runs over 24/24 cells (Node.js 20/22/24 × SDK 1.13.0, 1.30.1, 2.0.0, 2.1.0 × stdio and Streamable HTTP). There was no leak, no contract deviation, and no plaintext in either process's output. The unprotected control was flagged in 24/24 cells. The 72 known false negatives are the three documented split exclusions in every cell. A registry-shaped clean consumer resolved every declared range to the release tarballs, and each package's README example ran with no plaintext.

This repeats the [first #281 run](../README.md) (adapters `f014a99`, pre-release tarballs, a candidate core). It binds the qualification to the release artifacts instead. Nothing in the method changed. The only harness change is `--contract-commit` (#305): the published core predates the MCP contract, so the report links the contract at the commit that defines it. The method is in [`docs/specs/mcp-qualification.md`](../../../docs/specs/mcp-qualification.md). Tracking issue: [redact-secret-benchmarks#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281).

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `7ca9a6ee2bcba66f5c93f10190e7fc3ae24765b7` (the #305 merge on `develop`), clean |
| Core | the **published** `@redact-secret/core@0.1.0-beta.8` (tag `v0.1.0-beta.8`, redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef`), fetched with `npm pack` from registry.npmjs.org. npm checked each tarball against the registry's `dist.integrity` |
| `redact-secret-core-0.1.0-beta.8.tgz` | sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` | sha256 `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| `redact-secret-wasm-0.1.0-beta.8.tgz` | sha256 `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |
| Contract | redact-secret `0e3ba9592b6fa80fafdea47639921987c36ba323` (#612's merge), the same commit the adapters vendor their conformance fixtures from |
| Adapters | redact-secret-adapters `cfc6ba5cddd8b7879936bac69c3b93c1957c6dbd`: the head of `rc/2026.09.25` and the #27 merge on `develop` |
| Release pin | [`rc-release-pin.json`](rc-release-pin.json) (sha256 `6fd0818c666da3086dd23b662ce1e70e1ff3ec92b10e3f780dfb63af88340bfe`): a pin-source v1 record naming `cfc6ba5` and the content digests of the three MCP-path tarballs |
| Supported range | adapters `compatibility.json` at `cfc6ba5` (sha256 `2218c397bd5975590d57df6d4019937aaf4ed6d4d7d7f311de9e5c56857e6622`, byte-identical to the first run's) |
| Host | macOS 26 (darwin 25.5.0) arm64, Apple M4 |

### The release tarballs

| Tarball | sha256 | npm shasum (sha1) | Dist-tag |
| --- | --- | --- | --- |
| `redact-secret-adapter-0.1.1.tgz` | `f26c0e98b04536ad2097f75b908de156d4eaf88d6566a06a81e4ec801d5952f4` | `205ec518a85b8c2cf88f33603d899a7720917864` | `latest` |
| `redact-secret-adapter-ai-context-0.1.0-alpha.tgz` | `564ba3df4410baa38109281fd4c38351f16dd9e1cceefd6456cdad340f8bdc48` | `c1f28522bd38062367e5e4d12a38f934f1372ee2` | `alpha` |
| `redact-secret-adapter-mcp-0.1.0-alpha.tgz` | `c401d25f63d54c7d4a024f4eb74b4ce0ebcef0f89f4b26a370e61d1e88d2db37` | `50442f449a83db6b59e3143e2950dad8949b331e` | `alpha` |
| `redact-secret-adapter-pino-0.1.1.tgz` | `8463d062caac4800d64654ad172b0a6c55dd3c78fcb43dc151bc294170f3f433` | `f52fa252c15cfc8c6e1a61248d5404b9990e1474` | `latest` |
| `redact-secret-adapter-otel-0.1.1.tgz` | `fd652014f431696223b4d1944a18b635b964337bdf5b3f70a6c2e4876f6d10cf` | `284fa51769f93d38e635012abf7414bd1453d54c` | `latest` |

The release workflow uploads no stored artifact. Each publish job runs
`npm ci`, builds its workspaces, and runs `npm publish --workspace <pkg>`
with npm 11.19.1, which packs at publish time. So these tarballs are
reproductions of that pack at `cfc6ba5`, and they are shown to be exact:

1. Two independent packs agree byte for byte. Pack A used a full build. Pack B used each publish job's own build steps and a fresh npm cache. Both used npm 11.19.1 on Node 22.16.0.
2. Each tarball's sha1 equals the `npm notice shasum` that CI's rehearsal recorded for the same `npm publish --dry-run`. That held on the rc PR (Rehearsal run 36181309777) and in the Release `dry_run` on `develop` (run 36180588684), both on ubuntu with Node 22.23.2 and npm 11.19.1. The visible parts of the sha512 integrity match too. The same logs show the dist-tag each would publish under.
3. The qualification runner then re-verified the three MCP-path tarballs, and their installed trees, against `rc-release-pin.json`.

## Scanner and runtime versions

No scanner comparison is involved. The only detector is the published core above, reached through the adapters. Gitleaks and TruffleHog did not run, so the TruffleHog pin does not apply. The runtimes were Node.js `20.20.2` and `24.21.0` (official darwin-arm64 builds, verified against nodejs.org `SHASUMS256.txt`) and `22.16.0`, for both host and server processes. The SDKs were `@modelcontextprotocol/sdk` `1.13.0` (negotiated protocol `2025-06-18`) and `1.30.1`, and `@modelcontextprotocol/client` + `@modelcontextprotocol/server` `2.0.0` and `2.1.0` (all three `2025-11-25`). Each came from the registry into its own clean consumer.

## Results

- **Leaks:** 0 across all 24 cells and every sink (model context, host log, store, audit trail, error text; for server-wrapped tools, the wire output and handler input), plus 0 process-output leaks.
- **Deviations:** 0. Every case's outcome, reason, fixed result and lifecycle checks matched the contract.
- **Negative control:** flagged in 24/24 cells.
- **Known false negatives:** 72, which are `split-across-blocks`, `split-across-fields` and `split-across-calls` in each cell. These are the contract's documented exclusions, the same as the first run.
- **Delivered by policy:** 48, from `policy-warn-delivers-unchanged` and `policy-allow-delivers-unchanged` in each cell.
- **Operational cost:** measured, not budgeted. No MCP baseline exists in `benchmarks/regression-budgets.json`. As in the first run, nearly all of the per-call cost is the core's scan: on Node 22, traversal was 0.6–457 µs per call against a core scan of 152 µs–44 ms. See [`mcp-qualification.md`](mcp-qualification.md) § Operational cost.

## Registry-shaped consumer check

[`registry-consumer-check.mjs`](registry-consumer-check.mjs) → [`registry-consumer-check.json`](registry-consumer-check.json), PASS. It builds two clean consumers outside any checkout. Each installs the release tarballs by file path, together with the registry core tarball above, in one `npm install` (npm 11.4.1, Node 22.16.0). npm ran with an empty `NPM_CONFIG_USERCONFIG` and a scratch cache. The script runs `npm install` and `npm ls` only.

- **MCP chain** (`adapter`, `adapter-ai-context`, `adapter-mcp`, core):
  - The installed manifests declare `adapter-ai-context → @redact-secret/adapter ^0.1.1` and `adapter-mcp → @redact-secret/adapter-ai-context ^0.1.0-alpha`. npm resolved them to `0.1.1` and `0.1.0-alpha`, one copy each.
  - The core peer `^0.1.0-beta.6` resolved to `0.1.0-beta.8`. `npm ls --all` is clean.
  - Every `@redact-secret/adapter*` lockfile entry resolved to a `file:` tarball, none to a registry. The core's native and Wasm packages came from registry.npmjs.org, as a consumer's would.
  - The `adapter-ai-context` and `adapter-mcp` README examples ran verbatim and printed the documented redacted output.
  - Both `@redact-secret/adapter` README blocks ran: the masking-callback block against a stub host, and the injected-API block. `walkStrict` imports from the installed `@redact-secret/adapter`, so the `0.1.0`-lacks-`walkStrict` break is gone: `^0.1.1` can no longer resolve to `0.1.0`.
- **pino and otel 0.1.1** (`adapter`, `adapter-pino`, `adapter-otel`, core, `pino@^10`, `@opentelemetry/sdk-trace-base@^2`, `@opentelemetry/sdk-trace-node@^2`):
  - Both declare `@redact-secret/adapter ^0.1.1`, and npm resolved it to `0.1.1`. `npm ls --all` is clean.
  - The pino README block ran verbatim, with a mixin added and a child logger bound to a synthetic token. The message, the child binding and the mixin output were all redacted, which is the `hooks.streamWrite` fix.
  - The otel README block ran verbatim with an in-memory exporter. The span name, attribute, event name, event attribute and status message were all redacted.

No output of either consumer carried the synthetic value or a fragment of it. The script refuses to write a report that does.

## Command

```sh
# Isolate npm from any user config in every step:
export NPM_CONFIG_USERCONFIG=<empty file> npm_config_cache=<scratch dir>
# Core: the published tarballs.
npm pack @redact-secret/core@0.1.0-beta.8 @redact-secret/node-darwin-arm64@0.1.0-beta.8 @redact-secret/wasm@0.1.0-beta.8
# Adapters: the publish jobs' pack at the rc head, with the npm the publish jobs pin.
git -C <adapters> checkout cfc6ba5cddd8b7879936bac69c3b93c1957c6dbd
npm ci && npm run build
npx -y npm@11.19.1 pack --workspace @redact-secret/adapter --workspace @redact-secret/adapter-ai-context \
  --workspace @redact-secret/adapter-mcp --workspace @redact-secret/adapter-pino --workspace @redact-secret/adapter-otel \
  --pack-destination <rc-tarballs>
git -C <adapters> show cfc6ba5cddd8b7879936bac69c3b93c1957c6dbd:compatibility.json > compatibility.json
# The run (benchmarks at 7ca9a6e); <adapter-dir> holds the three MCP-path tarballs:
npm ci
npm run mcp:qualify -- \
  --core-package <core>/redact-secret-core-0.1.0-beta.8.tgz \
  --core-node-package <core>/redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz \
  --core-wasm-package <core>/redact-secret-wasm-0.1.0-beta.8.tgz \
  --core-source-commit 5639a0ea02e0eefbd1533bea23a05c749b529bef \
  --contract-commit 0e3ba9592b6fa80fafdea47639921987c36ba323 \
  --adapter-dir <adapter-dir> --adapter-pin evidence/612/release-2026.09.25/rc-release-pin.json \
  --compatibility compatibility.json \
  --node <node-20.20.2> --node <node-22.16.0> --node <node-24.21.0> --overhead-processes 5 \
  --out mcp-qualification.json --markdown-out mcp-qualification.md --overhead-out mcp-overhead-series.json
# The consumer check, after the run:
node evidence/612/release-2026.09.25/registry-consumer-check.mjs <rc-tarballs> \
  <core>/redact-secret-core-0.1.0-beta.8.tgz <adapters checkout at cfc6ba5> registry-consumer-check.json
```

The qualification run took 31 minutes and exited 0. The consumer check exited 0.

## Files

- `mcp-qualification.json`: the full report (`schemas/mcp-qualification-v1.json`). Its "Core candidate" row in `mcp-qualification.md` is the published core; the runner's label predates published-core runs.
- `mcp-qualification.md`: the runner's own summary of that report.
- `mcp-overhead-series.json`: the per-process overhead outputs, readable by `npm run performance:budgets:evaluate -- --adapter <file>`. Every trigger reports `not-evaluated`.
- `rc-release-pin.json`: the release pin the runner verified against.
- `registry-consumer-check.mjs` / `.json`: the consumer check and its result. Local paths are replaced by `<rc-tarballs>` and `<registry-core>`.

None of them carries a synthetic value or a fragment of one. `tests/mcp-qualification.test.mjs` re-checks the committed copies.
