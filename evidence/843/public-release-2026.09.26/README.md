# Public-package requalification for redact-secret-benchmarks#321

**Result:** PASS. This is the release-shaped successor to the pre-release run
in the parent directory. It exercises the package versions and bytes that npm
serves after redact-secret-adapters#36 and the 2026-09-26 release train:

- 24/24 cells completed across Node.js 20/22/24, both supported endpoints of
  MCP 1.x and 2.x, and stdio plus Streamable HTTP;
- 3,048 case runs, including 1,440 `resources/read` runs;
- zero plaintext leaks, zero process-output leaks, and zero contract
  deviations;
- both unprotected controls were detected in every cell; and
- 96 known false negatives, 120 explicit/default policy deliveries, and 12
  response-cache host-responsibility observations, all matching the documented
  contract categories.

The parent directory's `e087cb2` run remains the historical qualification of
the pre-release packages. This directory is the final evidence for the public
package combination.

## Immutable identity

| Item | Identity |
| --- | --- |
| Benchmark execution | redact-secret-benchmarks `37451453678a76b30b3f7884b31c1ea555bedbfd`, clean |
| Evidence integration base | redact-secret-benchmarks `f7366f42dfba10bb532246470b955af4486c3ff6`; no qualification harness, corpus, schema, or spec file changed between the execution commit and this base |
| Core source | redact-secret `5639a0ea02e0eefbd1533bea23a05c749b529bef`, published as `0.1.0-beta.8` |
| MCP contract | redact-secret `0af4cb83b571baa86d27a678a351ece2ebc1f3cb` |
| Adapters source and release tags | redact-secret-adapters `be3f2ad5088d108867b7bae13933d706d8f1f861` |
| Adapter pin | [`public-release-pin.json`](public-release-pin.json), sha256 `e30ed79e1adb8a88f0c870a9646764b62b92a26e830176dd63e791dee875a7ec` |
| Compatibility record | redact-secret-adapters `compatibility.json` at `be3f2ad`, sha256 `8900469d7155965b3d3a95aba381ad771a453d9f47f0fedaeeac99b15a66439a` |
| Host | macOS 26 (darwin 25.5.0) arm64, Apple M4 |

### Published core tarballs

| Package | sha256 |
| --- | --- |
| `@redact-secret/core@0.1.0-beta.8` | `b3c2c2cdc15b048b79fa33c6748b01baae6d2e1f588222059676001a2ff0af33` |
| `@redact-secret/node-darwin-arm64@0.1.0-beta.8` | `3d926c679238d6515121c5879ef89a5024352e0eafab2b3d21a8d9da921ffceb` |
| `@redact-secret/wasm@0.1.0-beta.8` | `2bddbcadfa570115da97183983e04f31033d6884b81d27ff9362a69f651c9973` |

### Public adapter tarballs

The tarballs were downloaded from registry.npmjs.org. Their npm metadata named
`be3f2ad5088d108867b7bae13933d706d8f1f861` as `gitHead`, and their registry
integrity and shasum values were verified before the run. The runner then
verified each clean installed tree against the content digest in the pin.

| Package | Tarball sha256 | npm shasum | Content digest |
| --- | --- | --- | --- |
| `@redact-secret/adapter@0.1.2` | `69dadc07680e7a17ac62593dc7eafd7041f35617067a93d3e75e36224d6da83c` | `31ff24242b2e016cf3459e7ea3aa94bd84f9d8f6` | `sha256:181853358a4c7a0bb75d404c60bc6039a0749ff25a7a7ff88ef1d11308c893d2` |
| `@redact-secret/adapter-ai-context@0.1.0-alpha.1` | `a9b0333934cbea0aa5e77dd91142a8a8426d08df9a5c62f06f04f6650549c678` | `645aa7b629b958879a549268fe0061e465363ac6` | `sha256:9b2b8ea10041043fb852fa76502e893113c1511fec90a5c2ebc698d357093fe1` |
| `@redact-secret/adapter-mcp@0.1.0-alpha.1` | `2975a89d3dfbae0654ba78400ab888ab052fb4947948a9986c2499e3d2342f57` | `de822989051a9f504d83a1f0b59a0469c2ccdd5f` | `sha256:961d84eb2cc24ee4faba7d0524ca120d90a58fd40a50fb4201f44d771f320a30` |

## Runtime and results

The Node.js matrix was `20.20.2`, `22.16.0`, and `24.21.0`. The 20 and 24
binaries were official darwin-arm64 downloads verified against nodejs.org's
`SHASUMS256.txt`. Each SDK endpoint was installed in a fresh external consumer:
`@modelcontextprotocol/sdk` 1.13.0 and 1.30.1, plus
`@modelcontextprotocol/client` and `@modelcontextprotocol/server` 2.0.0 and
2.1.0. The complete cell and case tables are in
[`mcp-qualification.md`](mcp-qualification.md).

The `resources/read` subset has zero leaks and zero deviations. #328 regenerated
the derived summary from the committed case verdicts, so it now records the
`resource-control-unprotected-host` control as detected in all 24 cells. The
correction preserves every verdict, sink observation and security result; no
measurement was rerun.

Operational measurements used five fresh processes per SDK/transport and 20
in-process samples on Node.js 22.16.0. No MCP regression budget exists, so these
are characterization data rather than a pass/fail gate. Representative
in-process medians were 242.0 microseconds for a 1.1 KB text resource, 6.58 ms
for a 62 KB text resource, and 27.61 ms for 200 entries. After 500 protected
60 KB reads and full GC, retained heap was at most 255.5 KiB and peak RSS was
154.8 MiB. Full raw series and tables are committed beside this file.

No scanner comparison ran: the detector was the published core reached through
the public adapters. `eval:classify`, `eval:matrix`, and `benchmark:candidate`
were not invoked, so the TruffleHog 3.97.4 stable-count gate does not apply and
no stable count is reported.

## Reproduction

```sh
npm run mcp:qualify -- \
  --core-package <core>/redact-secret-core-0.1.0-beta.8.tgz \
  --core-node-package <core>/redact-secret-node-darwin-arm64-0.1.0-beta.8.tgz \
  --core-wasm-package <core>/redact-secret-wasm-0.1.0-beta.8.tgz \
  --core-source-commit 5639a0ea02e0eefbd1533bea23a05c749b529bef \
  --contract-commit 0af4cb83b571baa86d27a678a351ece2ebc1f3cb \
  --adapter-dir <public-adapter-tarballs> \
  --adapter-pin evidence/843/public-release-2026.09.26/public-release-pin.json \
  --compatibility <adapters-be3f2ad>/compatibility.json \
  --node <node-20.20.2> --node <node-22.16.0> --node <node-24.21.0> \
  --overhead-processes 5 \
  --out mcp-qualification.json \
  --markdown-out mcp-qualification.md \
  --overhead-out mcp-overhead-series.json
```

The uncontended run took 2 hours 33 minutes and exited 0. The runner refused
plaintext-bearing output before writing the files, and the repository test
rechecks the committed JSON, Markdown, series, and this README.

## Files

- `mcp-qualification.json`: schema-valid complete report, identities, all 24
  cells, case-level verdicts, and operational summaries.
- `mcp-qualification.md`: generated human-readable report.
- `mcp-overhead-series.json`: tools/call raw per-process overhead series.
- `public-release-pin.json`: exact public adapter package versions and content
  digests.
