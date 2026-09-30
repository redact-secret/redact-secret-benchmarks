# Peer runtime PII-redaction throughput snapshot

`peer-pii-runtime-throughput.json` is one frozen run of
`qualification/peer-pii-runtime-throughput-v1.json` (#429). It is the only data
source for the `/report` section "Runtime redaction libraries on the same PII
inputs" (#444). Informational only: no verdict, no ranking.

## Source identities

- Benchmark source: `redact-secret/redact-secret-benchmarks` `develop` commit
  `39a566c51593739792d1533ea992420d0c0473ed`, run by the `peer-pii-runtime-throughput`
  workflow (Actions run 36701748609).
- Benchmark lockfile SHA-256:
  `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f`
  (flare-redact 1.6.1, `@openredaction/core` 1.1.5).
- redact-secret: `redact-secret/redact-secret` commit
  `da69ebf5090e0fb9519eb07829ff46001ede0de2` (`pin-manifest.json` `redactSecretRevision`),
  `bindings/node` built with `napi build --platform --release` inside the pinned Docker image,
  reporting version `0.1.0-beta.11`. Image ID:
  `sha256:dab0ed34b08082aa34370e5cbe4c8849c2ebfb3cc4df73762c5a7043643fc650`.
- Report `artifactCommitment`:
  `8c204fc187485559d5d0c5a5fe35673d0c72f09353789bf0eddfa7d564d088f6`.
- Replaces the run 36621123928 snapshot, which described `94fc18a` (the release source, not the pin).

## Environment

GitHub Actions `ubuntu-24.04`, native linux x64 (not emulated), AMD EPYC 9V74,
container limited to 4 CPUs, Node v22.22.2. The runner is shared infrastructure, so
absolute numbers carry noise. All three libraries ran in one Node process,
interleaved round-robin, so that noise affects them equally.

## Reproduce

```sh
scripts/run-peer-pii-runtime-throughput-docker.sh --out=evidence/429/peer-pii-runtime-throughput.json
```

Run on a native amd64 host, or dispatch the `peer-pii-runtime-throughput` workflow and copy its artifact here.

`tests/peer-runtime-section.test.mjs` validates this file with
`validatePeerRuntimeThroughputReport`. A workload, plan or summary change that
makes it stale fails CI, and the fix is a fresh run, not an edit.
