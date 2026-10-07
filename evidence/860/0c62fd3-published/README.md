# Evidence: published 0.1.0-beta.14 (release source 0c62fd3) measured in published and release-artifacts modes

**Result:** published mode (`@redact-secret/core` 0.1.0-beta.14 from npm) reads **133 stable of 144** registered
families (documented 95, empirical 38; 10 provisional, 1 pending, 0 unsupported). The support matrix generated from it
reads **150 stable, 10 provisional, 5 pending and 17 unsupported of 182** taxonomy families. Beta.13 read 127 of 135
and 144 of 173 (`../66b492b-published/`). All 135 families of that reading keep their status; the difference is nine
families new in the registry since beta.13: `square-token`, `square-oauth-application-secret`, `fly-token`,
`pydantic-logfire-token`, `sourcegraph-token` and `unkey-root-key` read stable, and `xata-api-key`, `buildkite-token`
and `mapbox-token` read provisional (their reasons are product measurements: false alarms on benign controls,
metamorphic and mutation failures for xata and mapbox, one unresolved contract disagreement for buildkite; none was
settled by hand). Classifying the three published npm tarballs as a candidate bound to `0c62fd3` gives byte-identical
`families`. `latest` and `beta` both point at 0.1.0-beta.14 (checked 2026-10-07).

Both readings are for the published package (mode: published, and the same artifacts classified as a candidate).
Neither is a count from an unpublished product build.

## Files

| File | Mode | Run |
| --- | --- | --- |
| [`support-status-published.json`](support-status-published.json) | published npm package 0.1.0-beta.14 (`publishedPackage`, no `product`) | `492f63a1-d52b-4f42-b834-aee5c0bb94d5` |
| [`support-matrix-published.json`](support-matrix-published.json) | the matrix generated from that file | |
| [`support-status-release-artifacts.json`](support-status-release-artifacts.json) | the three published npm tarballs, classified as a candidate bound to `0c62fd3` (`product.declaredVersion` 0.1.0-beta.14) | `520433b4-ef86-41db-b04a-4a10ef7a4493` |
| [`support-matrix-release-artifacts.json`](support-matrix-release-artifacts.json) | the matrix generated from that file. **This is the file for core's `benchmarks/support-matrix.json`**: it names the version and the source commit. | |

## Source revisions

| Item | Identity |
| --- | --- |
| `redact-secret` | `v0.1.0-beta.14` peels to `0c62fd38bca75c5b28b042dc79789b708ebf1d17`, the commit measured as the Beta.14 candidate (performance run 37552333458). The 118-detector registry equals the one pinned at `3b1a5aa` |
| npm tarballs (`npm pack` from the registry; integrity matches `npm view … dist.integrity`) | core `5908f85933cd322b741f6e067b261b7827e3d16dece9d1b645cabae8f3a866a2`, node-darwin-arm64 `c68b4761d8b0173fbb69d4f33e2da6b908da6c8478533ec308f1662a307d15a9`, wasm `d2acc0dd0dcf325799a0ec824f2c5353c56e35a9deaf7b968f0770c226777fc4` |
| `redact-secret-benchmarks` | `11bb2621` (branch `feat/808-published-beta14-repin`, clean tree: reports record `dirty: false`) |
| Fixture index / taxonomy | `e486ab4d…` (6,423 fixtures) / `41d23792…` |
| Pinned peers | trufflehog 3.97.4 (release binary, read-only directory first on `PATH`), gitleaks 8.30.1 |

## Not covered

- Ledger: the released detectors of seven #583 families change redact-secret's observations, so 198 differential rows re-key
  (the ledger id excludes the product version, not its findings). They were settled through established classes before
  this run: 181 `redact-secret-only/<peer>/range-matches-corpus`, 4 `range-disagreement/<peer>/range-matches-corpus`
  (redact-secret reads the authored span exactly) and 13 `differential.t0-pending-fixture` (not-assertable). Rows that
  need a person stay open; nothing about the product's own failures was resolved.
- The 10 provisional families and pending `vercel-token` carry their own gate reasons in `support-status-published.json`.

## Commands

At `11bb2621`, clean:

```sh
trufflehog --version   # -> 3.97.4
npm pack @redact-secret/core@0.1.0-beta.14 @redact-secret/node-darwin-arm64@0.1.0-beta.14 @redact-secret/wasm@0.1.0-beta.14
npm run eval:classify -- --output=<dir>/support-status-published.json
npm run eval:classify -- --candidate-package=redact-secret-core-0.1.0-beta.14.tgz \
  --candidate-node-package=redact-secret-node-darwin-arm64-0.1.0-beta.14.tgz \
  --candidate-wasm-package=redact-secret-wasm-0.1.0-beta.14.tgz \
  --candidate-source-commit=0c62fd38bca75c5b28b042dc79789b708ebf1d17 --output=<dir>/support-status-release-artifacts.json
npm run eval:matrix -- --input=<dir>/support-status-<mode>.json --output=<dir>/support-matrix-<mode>.json
```

Output goes outside the worktree: writing into it makes the report record `dirty: true`.
