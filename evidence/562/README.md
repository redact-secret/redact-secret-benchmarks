# Runtime comparison snapshots: `runtime-comparison-v2`

Three frozen reports, one per redact-secret setting, from `qualification/runtime-comparison-v2.json`
([#562](https://github.com/redact-secret/redact-secret-benchmarks/issues/562),
[#563](https://github.com/redact-secret/redact-secret-benchmarks/issues/563)). They are the data source for
`/comparison/runtime` in the new site (`web/`). Informational only: no verdict, no ranking. The existing site keeps reading
`evidence/429/`, which this directory does not touch.

| File | Setting | redact-secret selectors |
| --- | --- | --- |
| `runtime-comparison-default.json` | Default | none (no PII) |
| `runtime-comparison-pii-global.json` | PII | `pii:global` |
| `runtime-comparison-pii-global-us.json` | PII + US | `pii:global`, `pii:us` |

Each report holds, per tool (redact-secret, flare-redact, OpenRedaction) and workload (three PII, three credential): 12 timing
samples and their median and p95, and the outcome of each distinct line (`changed`, `valuesHidden`, `replacement`; defined in
the plan's `outcomeDefinition`). The two peers are timed in every setting's run; they do not change with the setting, so their
three sets of times show how far the machine moved between runs.

## Source identities

- Benchmark source: `redact-secret/redact-secret-benchmarks`, measured from a checkout of `origin/develop` at `58d058e6` plus the
  `--source=published` runner of this change (Refs #562). Plan `qualification/runtime-comparison-v2.json` is unchanged.
- Benchmark lockfile SHA-256: `3c54b9d24ede4940e1c028737c40787ac4ffa8ffc15d394f45bfa80c38e78bc8` (flare-redact 1.6.1,
  `@openredaction/core` 1.1.5, `@redact-secret/core` 0.1.0-beta.12); the peers are the same versions as `evidence/429`.
- redact-secret: the **published** `@redact-secret/core` `0.1.0-beta.12` from npm (mode `published`, provenance kind
  `published-npm-package`), installed by `npm ci` from `package-lock.json`; nothing is built from product source. Its recorded
  `commit` is the pinned release source `4227160c4dac402d7add53d3f8fe990f693912c1` (`pin-manifest.json`
  `redactSecretRevision`). PII is selected through `initialize({ pii })`, one selection per process. Image ID:
  `sha256:3ba29480f9c28aa224a964992778d25f09ed198a23975c363c99acad80cbfa91`.
- Plan commitment `522434d8ed797641d1070e2fec5db6cfb8e7afc4290c101b77b2d5db4e75a4eb`.
- Report `artifactCommitment`: `default` `b94abc4a8397483dd50fe134627394942ecdbbdf865654721c8095eeae6ef70a`,
  `pii-global` `7ee73a593e79363018edcd5f0cfb63d392fd1e888bb20353cb6d4154fb838c23`,
  `pii-global-us` `88edceb8d01fa311ebede8770edb93c096595c1757c568665c486f204e6432da`.

## Environment

Generated 2026-10-02 on a developer laptop: Apple M4 (macOS 26), Docker Desktop 28.3.3, a native `linux/arm64` container (not
emulated; nothing here is platform-native: redact-secret ships WebAssembly and both peers are JavaScript), Node v22.22.2,
container limited to 4 CPUs. The container only sees a virtual CPU, so the runner records the host through `HOST_CPU_MODEL`
(`Apple M4 (Docker Desktop linux/arm64 VM)`). The laptop was not idle and the container runs in a VM, so absolute numbers carry
more noise than a CI runner's. Timings are machine-bound: the previous snapshots (a local beta.11 build on an AMD EPYC 7763,
linux/amd64) are a different build on different hardware and are not comparable with these. Compare within one directory
and one run. All three libraries ran in one Node process per setting, interleaved round-robin. The three settings ran one after
another in separate containers on the same machine.

## Reproduce

```sh
HOST_CPU_MODEL="<the machine>" scripts/run-runtime-comparison-docker.sh --out-dir=evidence/562
```

The default `--source=published` measures the `@redact-secret/core` release `package.json` pins; `--source=local-build` builds
the add-on from the pinned commit instead (the mode of the earlier beta.11 snapshots). Run on any host Docker runs natively, or
dispatch the `peer-pii-runtime-throughput` workflow with `measurement=runtime-comparison-v2` and copy its `runtime-comparison`
artifact here. The measurement refuses to write this directory from an emulated host, from a product commit other than the pin,
or (published) from a package version other than `pin-manifest.json` `packageVersion`.

After a re-pin these snapshots must be replaced: `npm run pins:check` and `tests/runtime-comparison.test.mjs` fail while a
snapshot's version, build kind or commit differs from the pin (`docs/specs/performance-acceptance.md`, "Re-pinning").

`tests/runtime-comparison.test.mjs` validates these files with `validatePeerRuntimeThroughputReport`. A plan, workload or summary
change that makes one stale fails CI, and the fix is a fresh run, not an edit.
