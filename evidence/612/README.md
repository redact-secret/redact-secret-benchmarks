# Evidence: redact-secret#612, black-box MCP boundary qualification of `@redact-secret/adapter-mcp`

**Result:** PASS on containment. 1,584 case runs over 24/24 cells (Node.js 20/22/24 × SDK 1.13.0, 1.30.1, 2.0.0, 2.1.0 × stdio and Streamable HTTP), with no leak, no contract deviation, and no plaintext in either process's output. The unprotected control was flagged in 24/24 cells. The 72 known false negatives are the three documented split exclusions in every cell. The per-call cost is almost entirely the core's scan. It is measured but not budgeted.

This is the independent boundary and operational evidence that
[redact-secret-benchmarks#281](https://github.com/redact-secret/redact-secret-benchmarks/issues/281)
asks for, for the contract decided in
[redact-secret#612](https://github.com/redact-secret/redact-secret/issues/612).
It is not the adapter's conformance suite: that is
[redact-secret-adapters#13](https://github.com/redact-secret/redact-secret-adapters/issues/13),
linked here and not copied. The narrative, the observations and the
publication judgement are in
[`docs/reports/2026-09-25-beta9-281-mcp-qualification.md`](../../docs/reports/2026-09-25-beta9-281-mcp-qualification.md).
The method is in [`docs/specs/mcp-qualification.md`](../../docs/specs/mcp-qualification.md).

## Source revisions

| Item | Identity |
| --- | --- |
| Benchmark | redact-secret-benchmarks `cbe417e2c38309dc3b0b80e310fa666016ced0c4` (the #298 merge on `develop`), clean |
| Core candidate | redact-secret `5213be1166e4c0c658f97371bc28a5f43d292f79` (`main`, declares `0.1.0-beta.8`), clean, built as in [candidate evaluation](../../docs/specs/candidate-evaluation.md) |
| `redact-secret-core-0.1.0-beta.8.tgz` | sha256 `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| `redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz` | sha256 `61aefb0b3dd3f15a9a8a64cecd8f6f7afc4cd6446fcf29b909c4206ef714b3fb` |
| `redact-secret-wasm-0.1.0-beta.8.tgz` | sha256 `75d6ab54b11ed88af9011f3530c0dd69af96b9d9cfc303f90edb5ac31299d003` |
| Adapters | redact-secret-adapters `f014a996ebb9693fbe1c8cc14f144435f011c2b8`, the pin in redact-secret `adapters/pin-source.json` at `5213be1` (sha256 `88cedef34dcdb07a6df4912d45bce790ef59b3e0c25b61ec68dbc078719172df`) |
| `@redact-secret/adapter@0.1.0` | content digest `sha256:7fa97960d067397c7602bf4047abe258856909f6f45b9ab972f0b616fc96035c`, verified as a tarball and as installed |
| `@redact-secret/adapter-ai-context@0.1.0` | content digest `sha256:30fc06941818cdc8da977d92c8f842c995b673e6e9fea56cf09c2347d2c89d26`, verified |
| `@redact-secret/adapter-mcp@0.1.0` | content digest `sha256:76326a37d6a802f62d7ff4a607460d51369da6d2b78f7dcd10fca6e7d69a0f38`, verified |
| Supported range | adapters `compatibility.json` at `f014a99` (sha256 `2218c397bd5975590d57df6d4019937aaf4ed6d4d7d7f311de9e5c56857e6622`) |
| Host | macOS 26 (darwin 25.5.0) arm64, Apple M4. Every Node.js line ran the darwin-arm64 native addon |

## Scanner and runtime versions

No scanner comparison is involved. The only detector is the core candidate
above, reached through the adapters. Gitleaks and TruffleHog did not run, so
the TruffleHog pin does not apply. The runtimes were Node.js `20.20.2`,
`22.16.0` and `24.21.0` for both host and server processes. The SDKs were
`@modelcontextprotocol/sdk` `1.13.0` (negotiated protocol `2025-06-18`) and
`1.30.1`, and `@modelcontextprotocol/client` + `@modelcontextprotocol/server`
`2.0.0` and `2.1.0` (all three `2025-11-25`). Each came from the registry into
its own clean consumer.

## Command

```sh
npm ci
npm run mcp:qualify -- \
  --core-package <dir>/redact-secret-core-0.1.0-beta.8.tgz \
  --core-node-package <dir>/redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz \
  --core-wasm-package <dir>/redact-secret-wasm-0.1.0-beta.8.tgz \
  --core-source-commit 5213be1166e4c0c658f97371bc28a5f43d292f79 \
  --adapter-dir <redact-secret>/.cache/adapters/f014a996ebb9693fbe1c8cc14f144435f011c2b8 \
  --adapter-pin <redact-secret>/adapters/pin-source.json \
  --compatibility compatibility.json \
  --node <node-20> --node <node-22> --node <node-24> --overhead-processes 5 \
  --out mcp-qualification.json --markdown-out mcp-qualification.md --overhead-out mcp-overhead-series.json
```

Here `compatibility.json` is
`git -C <adapters> show f014a996ebb9693fbe1c8cc14f144435f011c2b8:compatibility.json`.
The adapter tarballs come from redact-secret's `scripts/adapter-pins.py`
(`verified_tarballs`) at `5213be1`. The core tarballs come from the
`benchmark-candidate` build steps at `5213be1`. The run took 16 minutes and
exited 0.

## Files

- `mcp-qualification.json`: the full report (`schemas/mcp-qualification-v1.json`): identities, every cell, every case verdict with its checks and the sinks it touched, and the operational measurements.
- `mcp-qualification.md`: the runner's own summary of that report.
- `mcp-overhead-series.json`: the per-process overhead outputs, readable by `npm run performance:budgets:evaluate -- --adapter evidence/612/mcp-overhead-series.json`. Today every trigger reports `not-evaluated`, because no MCP baseline exists yet.

None of them carries a synthetic value or a fragment of one. The runner
refuses to write such a file, and `tests/mcp-qualification.test.mjs`
re-checks the committed copies.
