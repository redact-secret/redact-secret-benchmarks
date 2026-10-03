# Evidence: published 0.1.0-beta.13 (release source 66b492b) measured in published and release-artifacts modes

**Result:** published mode (`@redact-secret/core` 0.1.0-beta.13 from npm) reads **127 stable of 135** registered
families (documented 89, empirical 38; 7 provisional, 1 pending, 0 unsupported), the same reading as published
beta.12 (`../4227160-published/`). The support matrix generated from it reads **144 stable, 7 provisional, 5 pending
and 17 unsupported of 173** taxonomy families, also unchanged. Classifying the three published npm tarballs as a
candidate bound to `66b492b` gives byte-identical `families`, and every family status equals the beta.12 reading.
`latest` and `beta` both point at 0.1.0-beta.13 (checked 2026-10-03).

## Files

| File | Mode | Run |
| --- | --- | --- |
| [`support-status-published.json`](support-status-published.json) | published npm package 0.1.0-beta.13 (`publishedPackage`, no `product`) | `dd44a31e-0ff8-4f62-9a04-73ca38f266a1` |
| [`support-matrix-published.json`](support-matrix-published.json) | the matrix generated from that file | |
| [`support-status-release-artifacts.json`](support-status-release-artifacts.json) | the three published npm tarballs, classified as a candidate bound to `66b492b` (`product.declaredVersion` 0.1.0-beta.13) | `dcc620c1-e821-4642-8f2c-c896dc6b0a98` |
| [`support-matrix-release-artifacts.json`](support-matrix-release-artifacts.json) | the matrix generated from that file. **This is the file for core's `benchmarks/support-matrix.json`**: it names the version and the source commit, which core's site feed reads. | |

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` | `v0.1.0-beta.13` peels to `66b492bdff5e6751fc6b5409266916346ed7c723`. It differs from the measured candidate core `401158d` only under `docs/`, and no `detectors/mod.rs` change since `4227160`, so the 110-detector registry carries over |
| npm tarballs (`npm pack` from the registry; integrity matches `npm view … dist.integrity`) | core `8e281e2932b245c8d238f52076c08e6c00859edafdb3e1e202500bc176a73cec`, node-darwin-arm64 `6264a8afe4fb50acb4871a2112a02591b6f7fc08acf8a8e07682e299adc391fb`, wasm `79cf28d2fd2fdcdbb93eddaab2fd9dc32bb676c7cf6c75f2ab4365c7dc2a2f17` |
| `redact-secret-benchmarks` | `e9f6b931c6a26bda8a0ec730f8b6c2a466db70db` (branch `workbench/repin-beta13-published`, clean tree: reports record `dirty: false`) |
| Fixture index / taxonomy | `58f09c35…bdfbd` / `7a210894…44fc`, both unchanged from beta.12 |
| Pinned peers | trufflehog 3.97.4 (release binary, read-only directory first on `PATH`), gitleaks 8.30.1 |

## Not covered

- Ledger: no new triage. Published and release-artifacts readings agree with beta.12, `npm run queue:check` passes.
- The 7 provisional families and pending `vercel-token` read as at beta.12.

## Commands

At `e9f6b931`, clean:

```sh
trufflehog --version   # -> 3.97.4
npm pack @redact-secret/core@0.1.0-beta.13 @redact-secret/node-darwin-arm64@0.1.0-beta.13 @redact-secret/wasm@0.1.0-beta.13
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:classify -- --candidate-package=redact-secret-core-0.1.0-beta.13.tgz \
  --candidate-node-package=redact-secret-node-darwin-arm64-0.1.0-beta.13.tgz \
  --candidate-wasm-package=redact-secret-wasm-0.1.0-beta.13.tgz \
  --candidate-source-commit=66b492bdff5e6751fc6b5409266916346ed7c723 --output=<dir>/support-status-release-artifacts.json
npm run eval:matrix -- --input=<dir>/support-status-<mode>.json --output=<dir>/support-matrix-<mode>.json
```

Output goes outside the worktree: writing into it makes the report record `dirty: true`.
