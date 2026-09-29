# Peer runtime PII-redaction throughput snapshot

`peer-pii-runtime-throughput.json` is one frozen run of
`qualification/peer-pii-runtime-throughput-v1.json` (#429). It is the only data
source for the `/report` section "Runtime redaction libraries on the same PII
inputs" (#444). Informational only: no verdict, no ranking.

## Source identities

- Benchmark source: clean `redact-secret/redact-secret-benchmarks` commit
  `e8b38c33ceb744dcfc23a0005d89619cdfdcd2bd` (`develop`).
- Benchmark lockfile SHA-256:
  `14dbaa9e370ff0320c719110922cf72e916ce833442533842bf62570ee6e3939`
  (flare-redact 1.6.1, `@openredaction/core` 1.1.5).
- redact-secret: clean `redact-secret/redact-secret` `main` commit
  `1127bf91323797be89b4413c8051f9a9a85da43b`, `bindings/node` built with
  `npm run build` (`napi build --platform --release`), reporting version
  `0.1.0-beta.10`. Addon `redact-secret.linux-x64-gnu.node` SHA-256:
  `dd73861c47760bc6e700d1ccc3a74f886943ac3c3b05a863b0c344601f2042b6`.
- Report `artifactCommitment`:
  `cce306785224baa1e8016bd94c2b4ad6dbbcc387149b77eb646f86c3134b0c20`.

## Environment

A Claude Code cloud container: linux x64, 4 vCPU (Intel Xeon 2.10GHz),
Node v22.22.2. The container is shared infrastructure, so absolute numbers
carry more noise than a dedicated runner. All three libraries ran in one Node
process, interleaved round-robin, so that noise affects them equally.

## Reproduce

```sh
scripts/run-peer-pii-runtime-throughput-docker.sh --out=evidence/429/peer-pii-runtime-throughput.json
```

Run on a native amd64 host. This snapshot is `schemaVersion: 1` and predates the Docker run (#513): it records no
product commit or image digest in the report. The next regeneration replaces it with a `schemaVersion: 2` report.

`tests/peer-runtime-section.test.mjs` validates this file with
`validatePeerRuntimeThroughputReport`. A workload, plan or summary change that
makes it stale fails CI, and the fix is a fresh run, not an edit.
