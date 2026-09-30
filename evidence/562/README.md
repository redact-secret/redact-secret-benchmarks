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

- Benchmark source: `redact-secret/redact-secret-benchmarks` branch `workbench/562-563-runtime-outcomes` at `8de4ed8d`,
  run by the `peer-pii-runtime-throughput` workflow with `measurement=runtime-comparison-v2` (Actions run 36737678224).
- Benchmark lockfile SHA-256: `06a6ba659e9ae2d42ee49f0f11e13d682ed242539c89b6bb455c29cdb089c51f` (flare-redact 1.6.1,
  `@openredaction/core` 1.1.5), the same lockfile as `evidence/429`.
- redact-secret: `redact-secret/redact-secret` commit `da69ebf5090e0fb9519eb07829ff46001ede0de2` (`pin-manifest.json`
  `redactSecretRevision`), `bindings/node` built with `napi build --platform --release` inside the pinned Docker image,
  reporting version `0.1.0-beta.11`. Image ID: `sha256:31f4db51a50c074e9a7cf5fdea7d2cba70e85ba2427bf451fe5b492de256099c`.
- Plan commitment `522434d8ed797641d1070e2fec5db6cfb8e7afc4290c101b77b2d5db4e75a4eb`.
- Report `artifactCommitment`: `default` `6fdf7e78bcce279c56c34ef168a68d354ea69abdfc78142ee6b3ebe39dbe0e2a`,
  `pii-global` `43078983a4f7bf0701075ecbdc08f0820937a360a18261e909ea9fec36e77ac4`,
  `pii-global-us` `5dac5512227af43e43e2e1a6ca66d759147f6cfafa2df85c2636e6fddf874e8d`.

## Environment

GitHub Actions `ubuntu-24.04`, native linux x64 (not emulated), AMD EPYC 7763, container limited to 4 CPUs, Node v22.22.2.
`evidence/429` ran on an AMD EPYC 9V74, so a time for the same tool and workload differs a little between the two directories
(different runner hardware and a different run); compare within one directory. The runner is shared infrastructure, so absolute
numbers carry noise. All three libraries ran in one Node process per setting, interleaved round-robin. The three settings ran one
after another in separate containers on the same runner, minutes apart.

## Reproduce

```sh
scripts/run-runtime-comparison-docker.sh --out-dir=evidence/562
```

Run on a native amd64 host, or dispatch the `peer-pii-runtime-throughput` workflow with `measurement=runtime-comparison-v2`
and copy its `runtime-comparison` artifact here. The measurement refuses to write this directory from an emulated host or
from a product commit other than the pin.

`tests/runtime-comparison.test.mjs` validates these files with `validatePeerRuntimeThroughputReport`. A plan, workload or summary
change that makes one stale fails CI, and the fix is a fresh run, not an edit.
