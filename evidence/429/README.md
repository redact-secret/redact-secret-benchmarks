# Peer runtime PII-redaction throughput snapshot

`peer-pii-runtime-throughput.json` is one frozen run of
`qualification/peer-pii-runtime-throughput-v1.json` (#429). It is the only data
source for the `/report` section "Runtime redaction libraries on the same PII
inputs" (#444). Informational only: no verdict, no ranking.

## Source identities

- Benchmark source: `redact-secret/redact-secret-benchmarks` `develop` commit
  `c4009ea2bf97d9e81417d7a1a8379fab7f15892a`, run by the `peer-pii-runtime-throughput`
  workflow (Actions run 36621123928).
- Benchmark lockfile SHA-256:
  `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f`
  (flare-redact 1.6.1, `@openredaction/core` 1.1.5).
- redact-secret: `redact-secret/redact-secret` commit
  `94fc18a974f659ea882c89120dbf1adb3acf2f28` (`pin-manifest.json` `redactSecretRevision`),
  `bindings/node` built with `napi build --platform --release` inside the pinned Docker image,
  reporting version `0.1.0-beta.11`. Image ID:
  `sha256:3486ba72b1d0c9e8d1908992dbcd3125a3062d800376bc952dc43cc08a31a937`.
- Report `artifactCommitment`:
  `5adf379858ca2cf4140ca3419f09ab3df5e2b4b360e127b0d1b107442fc063c0`.

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
